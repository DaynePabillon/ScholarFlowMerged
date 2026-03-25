import { getGoogleClients } from '../../config/google';
import { query } from '../../config/database';
import logger from '../../config/logger';

export class GoogleSheetsService {
  /**
   * Fetch grade data from a Google Sheet
   */
  static async fetchGrades(
    spreadsheetId: string,
    range: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { sheets } = getGoogleClients(accessToken, refreshToken);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      });

      const rows = response.data.values || [];
      logger.info(`Fetched ${rows.length} rows from Google Sheets`);

      return rows;
    } catch (error) {
      logger.error('Error fetching grades from Sheets:', error);
      throw new Error('Failed to fetch grades from Google Sheets');
    }
  }

  /**
   * Parse and sync grade data to database
   */
  static async syncGradesToDatabase(
    spreadsheetId: string,
    classId: string,
    range: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const rows = await this.fetchGrades(spreadsheetId, range, accessToken, refreshToken);

      if (rows.length === 0) {
        logger.warn('No grade data found in sheet');
        return [];
      }

      // Assume first row is headers: [Student Email, Current Grade, Letter Grade, ...]
      const headers = rows[0];
      const dataRows = rows.slice(1);

      const synced = [];

      for (const row of dataRows) {
        const studentEmail = row[0];
        const currentGrade = parseFloat(row[1]);
        const letterGrade = row[2];

        // Find student by email
        const studentResult = await query(
          'SELECT id FROM users WHERE email = $1 AND role = $2',
          [studentEmail, 'student']
        );

        if (studentResult.rows.length === 0) {
          logger.warn(`Student not found: ${studentEmail}`);
          continue;
        }

        const studentId = studentResult.rows[0].id;

        // Build grade breakdown from remaining columns
        const gradeBreakdown: any = {};
        for (let i = 3; i < headers.length && i < row.length; i++) {
          gradeBreakdown[headers[i]] = row[i];
        }

        // Upsert grade summary
        await query(
          `INSERT INTO grade_summaries (
            student_id, class_id, sheet_id, current_grade, 
            letter_grade, grade_breakdown, synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (student_id, class_id)
          DO UPDATE SET
            current_grade = EXCLUDED.current_grade,
            letter_grade = EXCLUDED.letter_grade,
            grade_breakdown = EXCLUDED.grade_breakdown,
            synced_at = NOW(),
            last_updated = NOW()
          RETURNING *`,
          [studentId, classId, spreadsheetId, currentGrade, letterGrade, JSON.stringify(gradeBreakdown)]
        );

        synced.push({ studentEmail, currentGrade, letterGrade });
      }

      logger.info(`Synced ${synced.length} grade records`);
      return synced;
    } catch (error) {
      logger.error('Error syncing grades to database:', error);
      throw new Error('Failed to sync grades');
    }
  }

  /**
   * Get student's grade summary
   */
  static async getStudentGrades(studentId: string) {
    try {
      const result = await query(
        `SELECT 
          gs.*, c.name as class_name, c.section
        FROM grade_summaries gs
        JOIN classes c ON gs.class_id = c.id
        WHERE gs.student_id = $1
        ORDER BY gs.last_updated DESC`,
        [studentId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching student grades:', error);
      throw new Error('Failed to fetch student grades');
    }
  }

  /**
   * Get class grade statistics
   */
  static async getClassGradeStats(classId: string) {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_students,
          AVG(current_grade) as average_grade,
          MAX(current_grade) as highest_grade,
          MIN(current_grade) as lowest_grade,
          COUNT(CASE WHEN current_grade >= 90 THEN 1 END) as a_count,
          COUNT(CASE WHEN current_grade >= 80 AND current_grade < 90 THEN 1 END) as b_count,
          COUNT(CASE WHEN current_grade >= 70 AND current_grade < 80 THEN 1 END) as c_count,
          COUNT(CASE WHEN current_grade >= 60 AND current_grade < 70 THEN 1 END) as d_count,
          COUNT(CASE WHEN current_grade < 60 THEN 1 END) as f_count
        FROM grade_summaries
        WHERE class_id = $1`,
        [classId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching class grade stats:', error);
      throw new Error('Failed to fetch class grade statistics');
    }
  }

  /**
   * Create a new gradebook sheet
   */
  static async createGradebookSheet(
    title: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { sheets } = getGoogleClients(accessToken, refreshToken);

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title,
          },
          sheets: [
            {
              properties: {
                title: 'Grades',
              },
            },
          ],
        },
      });

      logger.info(`Created gradebook sheet ${response.data.spreadsheetId}`);

      // Set up headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: response.data.spreadsheetId!,
        range: 'Grades!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Student Email', 'Current Grade', 'Letter Grade', 'Assignments', 'Exams', 'Participation']],
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating gradebook sheet:', error);
      throw new Error('Failed to create gradebook sheet');
    }
  }

  /**
   * Update a cell in a sheet
   */
  static async updateCell(
    spreadsheetId: string,
    range: string,
    value: any,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { sheets } = getGoogleClients(accessToken, refreshToken);

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[value]],
        },
      });

      logger.info(`Updated cell ${range} in sheet ${spreadsheetId}`);
      return response.data;
    } catch (error) {
      logger.error('Error updating cell:', error);
      throw new Error('Failed to update cell in Google Sheets');
    }
  }
}

export default GoogleSheetsService;
