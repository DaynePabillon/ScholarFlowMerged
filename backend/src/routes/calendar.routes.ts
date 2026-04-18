import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { GoogleCalendarService } from '../services/google/calendar.service';
import { query } from '../config/database';
import { getGoogleClients } from '../config/google';
import logger from '../config/logger';

const router = Router();

const normalizeTime = (raw: any): string => {
  if (!raw) return '00:00:00';
  
  if (raw instanceof Date) {
    const h = String(raw.getHours()).padStart(2, '0');
    const m = String(raw.getMinutes()).padStart(2, '0');
    const s = String(raw.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  const str = String(raw).trim();
  // Standardize HH:mm:ss using regex to handle complex strings or ISO fragments
  const match = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const s = (match[3] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  return '00:00:00';
};

// Helper to get Google tokens checking both SkyFlow and ScholarSync tables
const getUserTokens = async (userId: string, email: string) => {
  // 1. Try SkyFlow users table (unified auth) by ID
  let userResult = await query(
    'SELECT access_token, refresh_token FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows[0]?.access_token) {
    return userResult.rows[0];
  }

  // 1b. Try SkyFlow users table by email (consistent fallback)
  userResult = await query(
    'SELECT access_token, refresh_token FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  if (userResult.rows[0]?.access_token) {
    return userResult.rows[0];
  }

  // 2. Try ScholarSync ss_account table (fallback for ScholarSync-only users)
  const ssResult = await query(
    'SELECT "googleAccessToken" as access_token FROM ss_account WHERE LOWER("accountEmail") = LOWER($1)',
    [email]
  );
  
  if (ssResult.rows[0]?.access_token) {
    return { access_token: ssResult.rows[0].access_token, refresh_token: null };
  }

  return null;
};

// All routes require authentication
router.use(authenticateToken);

// GET /api/calendar/events - Get upcoming events from Google Calendar
router.get('/events', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;

    // Get user's tokens from database (checking fallbacks)
    const tokens = await getUserTokens(userId, userEmail);

    if (!tokens) {
      return res.status(404).json({ 
        error: 'Google connection not found. Please connect your Google Calendar in ScholarSync or Dashboard.',
        connectionIssue: true 
      });
    }

    const { access_token, refresh_token } = tokens;

    // Fetch events directly from Google Calendar API
    const { calendar } = getGoogleClients(access_token, refresh_token);

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const eventsFromGoogle = response.data.items || [];
    
    // Fetch ScholarSync Consultation Slots as fallbacks/offline visibility
    let ssEvents: any[] = [];
    try {
      const ssSlotsRes = await query(
        `SELECT s.slot_id, s.slot_date, s.start_time, s.end_time, c."courseCode", s.google_event_id
         FROM ss_consultation_slots s
         JOIN ss_courses c ON s.course_id = c.id
         JOIN ss_account a ON s.adviser_id = a.account_id
         WHERE a."accountEmail" = $1`,
        [(req as any).user.email]
      );

      ssEvents = ssSlotsRes.rows.map((s: any) => {
        // Use local methods because Node pg parses DATE columns as local midnight.
        const d = new Date(s.slot_date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        
        return {
          id: s.google_event_id || `consultation-${s.slot_id}`,
          summary: `Consultation Slot - ${s.courseCode}`,
          description: 'ScholarSync consultation slot',
          start: { dateTime: `${dateStr}T${normalizeTime(s.start_time)}+08:00` },
          end: { dateTime: `${dateStr}T${normalizeTime(s.end_time)}+08:00` },
          location: 'ScholarSync',
          _isScholarSyncFallback: true
        };
      });
    } catch (err) {
      logger.warn('Failed to fetch fallback ss_consultation_slots:', err);
    }

    // Merge: prioritize Google events but ensure DB ones are present if not found in Google
    const googleIds = new Set(eventsFromGoogle.map(e => e.id));
    const mergedEvents = [...eventsFromGoogle];
    
    for (const sse of ssEvents) {
      if (!googleIds.has(sse.id)) {
        mergedEvents.push(sse);
      }
    }

    logger.info(`Fetched ${eventsFromGoogle.length} google events and ${ssEvents.length} scholar sync events for user ${userId}`);

    return res.json({ events: mergedEvents });
  } catch (error) {
    logger.error('Error fetching calendar events:', error);
    return res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/events - Create new event
// Only admin and manager can create events
router.post('/events', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const eventData = req.body;
    const { organization_id } = req.body;

    // Check user role if organization_id is provided
    if (organization_id) {
      const roleCheck = await query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
        [organization_id, userId]
      );

      if (roleCheck.rows.length > 0 && roleCheck.rows[0].role === 'member') {
        return res.status(403).json({ error: 'Members cannot create calendar events. Contact an admin or manager.' });
      }
    }

    // Get user's tokens
    const tokens = await getUserTokens(userId, (req as any).user.email);

    if (!tokens) {
      return res.status(404).json({ error: 'Google connection not found.' });
    }

    const { access_token, refresh_token } = tokens;

    const event = await GoogleCalendarService.createEvent(
      eventData,
      userId,
      access_token,
      refresh_token
    );

    return res.json({ event });
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    return res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/events/:eventId - Update an existing event
router.put('/events/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;
    const eventData = req.body;

    // Get user's tokens
    const tokens = await getUserTokens(userId, (req as any).user.email);

    if (!tokens) {
      return res.status(404).json({ error: 'Google connection not found.' });
    }

    const { access_token, refresh_token } = tokens;

    // Ensure startTime and endTime are proper Date objects
    const patchedEventData = {
      ...eventData,
      startTime: new Date(eventData.startTime),
      endTime: new Date(eventData.endTime),
    };

    const event = await GoogleCalendarService.updateEvent(
      eventId,
      patchedEventData,
      access_token,
      refresh_token
    );

    return res.json({ event });
  } catch (error) {
    logger.error('Error updating calendar event:', error);
    return res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /api/calendar/events/:eventId - Delete a calendar event
router.delete('/events/:eventId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;

    // Handle ScholarSync Consultation Slots
    if (eventId.startsWith('consultation-')) {
      const slotId = parseInt(eventId.replace('consultation-', ''), 10);
      if (isNaN(slotId)) {
        return res.status(400).json({ error: 'Invalid consultation slot ID' });
      }

      // 1. Get user's tokens for potential Google sync
      const tokens = await getUserTokens(userId, (req as any).user.email);
      if (!tokens) {
        return res.status(404).json({ error: 'Google connection not found.' });
      }
      const { access_token, refresh_token } = tokens;

      // 2. Find the slot to verify ownership and get Google event ID
      const slotRes = await query(
        `SELECT s.google_event_id 
         FROM ss_consultation_slots s
         JOIN ss_account a ON s.adviser_id = a.account_id
         WHERE s.slot_id = $1 AND a."accountEmail" = $2`,
        [slotId, (req as any).user.email]
      );

      if (slotRes.rows.length === 0) {
        // Fallback: Check if it's an admin (optional but safer)
        const adminRes = await query('SELECT role FROM users WHERE id = $1', [userId]);
        if (adminRes.rows[0]?.role !== 'admin') {
          return res.status(404).json({ error: 'Consultation slot not found or you do not have permission to delete it.' });
        }
        
        // If admin, find slot without email check
        const adminSlotRes = await query('SELECT google_event_id FROM ss_consultation_slots WHERE slot_id = $1', [slotId]);
        if (adminSlotRes.rows.length === 0) {
          return res.status(404).json({ error: 'Consultation slot not found.' });
        }
        
        const gId = adminSlotRes.rows[0].google_event_id;
        if (gId) {
          try {
            await GoogleCalendarService.deleteEvent(gId, access_token, refresh_token);
          } catch (e) {
            logger.warn(`Admin failed to delete Google event ${gId}:`, e);
          }
        }
        await query('DELETE FROM ss_consultation_slots WHERE slot_id = $1', [slotId]);
      } else {
        const { google_event_id } = slotRes.rows[0];
        if (google_event_id) {
          try {
            await GoogleCalendarService.deleteEvent(google_event_id, access_token, refresh_token);
          } catch (e) {
            logger.warn(`Failed to delete Google event ${google_event_id}:`, e);
          }
        }
        await query('DELETE FROM ss_consultation_slots WHERE slot_id = $1', [slotId]);
      }

      logger.info(`User ${userId} deleted ScholarSync consultation slot ${slotId}`);
      return res.json({ success: true });
    }

    // Default: Handle generic/Google Calendar events
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

    await GoogleCalendarService.deleteEvent(eventId, access_token, refresh_token);

    logger.info(`User ${userId} deleted calendar event ${eventId}`);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting calendar event:', error);
    return res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

export default router;
