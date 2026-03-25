import { getGoogleClients } from '../../config/google';
import { query } from '../../config/database';
import logger from '../../config/logger';

export class GoogleCalendarService {
  /**
   * Sync calendar events for a user
   */
  static async syncCalendarEvents(
    userId: string,
    calendarId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { calendar } = getGoogleClients(accessToken, refreshToken);
      
      // Get events from the next 30 days
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId: calendarId || 'primary',
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      logger.info(`Found ${events.length} calendar events for user ${userId}`);

      for (const event of events) {
        if (!event.start || !event.end) continue;

        const startTime = event.start.dateTime || event.start.date;
        const endTime = event.end.dateTime || event.end.date;
        const allDay = !event.start.dateTime;

        await query(
          `INSERT INTO calendar_events (
            google_event_id, calendar_id, title, description, location,
            start_time, end_time, all_day, event_type, created_by, synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (google_event_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            location = EXCLUDED.location,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            all_day = EXCLUDED.all_day,
            synced_at = NOW(),
            updated_at = NOW()
          RETURNING *`,
          [
            event.id,
            calendarId || 'primary',
            event.summary || 'Untitled Event',
            event.description,
            event.location,
            startTime,
            endTime,
            allDay,
            this.determineEventType(event.summary || ''),
            userId,
          ]
        );
      }

      return events;
    } catch (error) {
      logger.error('Error syncing calendar events:', error);
      throw new Error('Failed to sync calendar events');
    }
  }

  /**
   * Create a new calendar event
   */
  static async createEvent(
    eventData: {
      title: string;
      description?: string;
      location?: string;
      startTime: Date;
      endTime: Date;
      allDay?: boolean;
      eventType?: string;
      classId?: string;
    },
    userId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { calendar } = getGoogleClients(accessToken, refreshToken);

      const event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: eventData.allDay
          ? { date: eventData.startTime.toISOString().split('T')[0] }
          : { dateTime: eventData.startTime.toISOString(), timeZone: 'UTC' },
        end: eventData.allDay
          ? { date: eventData.endTime.toISOString().split('T')[0] }
          : { dateTime: eventData.endTime.toISOString(), timeZone: 'UTC' },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      logger.info(`Created calendar event ${response.data.id}`);

      // Save to database
      await query(
        `INSERT INTO calendar_events (
          google_event_id, calendar_id, title, description, location,
          start_time, end_time, all_day, event_type, class_id, created_by, synced_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          response.data.id,
          'primary',
          eventData.title,
          eventData.description,
          eventData.location,
          eventData.startTime,
          eventData.endTime,
          eventData.allDay || false,
          eventData.eventType || 'other',
          eventData.classId,
          userId,
        ]
      );

      return response.data;
    } catch (error) {
      logger.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update an existing calendar event
   */
  static async updateEvent(
    eventId: string,
    eventData: any,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { calendar } = getGoogleClients(accessToken, refreshToken);

      const event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: eventData.allDay
          ? { date: eventData.startTime.toISOString().split('T')[0] }
          : { dateTime: eventData.startTime.toISOString(), timeZone: 'UTC' },
        end: eventData.allDay
          ? { date: eventData.endTime.toISOString().split('T')[0] }
          : { dateTime: eventData.endTime.toISOString(), timeZone: 'UTC' },
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
      });

      logger.info(`Updated calendar event ${eventId}`);

      // Update in database
      await query(
        `UPDATE calendar_events SET
          title = $1, description = $2, location = $3,
          start_time = $4, end_time = $5, all_day = $6,
          updated_at = NOW(), synced_at = NOW()
        WHERE google_event_id = $7`,
        [
          eventData.title,
          eventData.description,
          eventData.location,
          eventData.startTime,
          eventData.endTime,
          eventData.allDay || false,
          eventId,
        ]
      );

      return response.data;
    } catch (error) {
      logger.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  static async deleteEvent(eventId: string, accessToken: string, refreshToken?: string) {
    try {
      const { calendar } = getGoogleClients(accessToken, refreshToken);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      logger.info(`Deleted calendar event ${eventId}`);

      // Delete from database
      await query('DELETE FROM calendar_events WHERE google_event_id = $1', [eventId]);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Get upcoming events for a user
   */
  static async getUpcomingEvents(userId: string, days: number = 7) {
    try {
      const result = await query(
        `SELECT 
          ce.*, c.name as class_name, c.section
        FROM calendar_events ce
        LEFT JOIN classes c ON ce.class_id = c.id
        WHERE ce.created_by = $1 
          AND ce.start_time >= NOW()
          AND ce.start_time <= NOW() + INTERVAL '${days} days'
        ORDER BY ce.start_time ASC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching upcoming events:', error);
      throw new Error('Failed to fetch upcoming events');
    }
  }

  /**
   * Get events for a specific class
   */
  static async getClassEvents(classId: string) {
    try {
      const result = await query(
        `SELECT * FROM calendar_events
        WHERE class_id = $1 AND start_time >= NOW()
        ORDER BY start_time ASC`,
        [classId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching class events:', error);
      throw new Error('Failed to fetch class events');
    }
  }

  /**
   * Helper: Determine event type from title
   */
  private static determineEventType(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('exam') || lowerTitle.includes('test') || lowerTitle.includes('quiz')) {
      return 'exam';
    } else if (lowerTitle.includes('class') || lowerTitle.includes('lecture')) {
      return 'class';
    } else if (lowerTitle.includes('assignment') || lowerTitle.includes('homework')) {
      return 'assignment';
    } else if (lowerTitle.includes('meeting')) {
      return 'meeting';
    }
    
    return 'other';
  }
}

export default GoogleCalendarService;
