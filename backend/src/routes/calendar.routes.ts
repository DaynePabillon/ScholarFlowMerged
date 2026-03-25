import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { GoogleCalendarService } from '../services/google/calendar.service';
import { query } from '../config/database';
import { getGoogleClients } from '../config/google';
import logger from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/calendar/events - Get upcoming events from Google Calendar
router.get('/events', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Get user's tokens from database
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

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

    const events = response.data.items || [];
    logger.info(`Fetched ${events.length} calendar events for user ${userId}`);

    return res.json({ events });
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
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

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
    const userResult = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { access_token, refresh_token } = userResult.rows[0];

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

    // Get user's tokens
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
