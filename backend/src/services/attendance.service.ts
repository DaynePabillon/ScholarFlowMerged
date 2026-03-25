import { query } from '../config/database';
import logger from '../config/logger';

export class AttendanceService {
  /**
   * Record attendance for a student
   */
  static async recordAttendance(
    classId: string,
    studentId: string,
    date: Date,
    status: 'present' | 'absent' | 'late' | 'excused',
    notes: string | undefined,
    recordedBy: string
  ) {
    try {
      const result = await query(
        `INSERT INTO attendance (class_id, student_id, date, status, notes, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (class_id, student_id, date)
        DO UPDATE SET
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          recorded_by = EXCLUDED.recorded_by,
          updated_at = NOW()
        RETURNING *`,
        [classId, studentId, date, status, notes, recordedBy]
      );

      logger.info(`Recorded attendance for student ${studentId} in class ${classId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error recording attendance:', error);
      throw new Error('Failed to record attendance');
    }
  }

  /**
   * Get attendance records for a student
   */
  static async getStudentAttendance(studentId: string, classId?: string) {
    try {
      let queryText = `
        SELECT 
          a.*, c.name as class_name, c.section
        FROM attendance a
        JOIN classes c ON a.class_id = c.id
        WHERE a.student_id = $1
      `;
      const params: any[] = [studentId];

      if (classId) {
        queryText += ' AND a.class_id = $2';
        params.push(classId);
      }

      queryText += ' ORDER BY a.date DESC';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching student attendance:', error);
      throw new Error('Failed to fetch student attendance');
    }
  }

  /**
   * Get attendance statistics for a student
   */
  static async getStudentAttendanceStats(studentId: string, classId?: string) {
    try {
      let queryText = `
        SELECT 
          COUNT(*) as total_days,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
          COUNT(CASE WHEN status = 'excused' THEN 1 END) as excused_count,
          ROUND(
            (COUNT(CASE WHEN status = 'present' THEN 1 END)::numeric / 
            NULLIF(COUNT(*), 0)) * 100, 
            2
          ) as attendance_percentage
        FROM attendance
        WHERE student_id = $1
      `;
      const params: any[] = [studentId];

      if (classId) {
        queryText += ' AND class_id = $2';
        params.push(classId);
      }

      const result = await query(queryText, params);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching attendance stats:', error);
      throw new Error('Failed to fetch attendance statistics');
    }
  }

  /**
   * Get class attendance for a specific date
   */
  static async getClassAttendance(classId: string, date: Date) {
    try {
      const result = await query(
        `SELECT 
          a.*, u.name as student_name, u.email as student_email
        FROM attendance a
        JOIN users u ON a.student_id = u.id
        WHERE a.class_id = $1 AND a.date = $2
        ORDER BY u.name`,
        [classId, date]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching class attendance:', error);
      throw new Error('Failed to fetch class attendance');
    }
  }

  /**
   * Get class attendance summary
   */
  static async getClassAttendanceSummary(classId: string, startDate?: Date, endDate?: Date) {
    try {
      let queryText = `
        SELECT 
          u.id as student_id,
          u.name as student_name,
          u.email as student_email,
          COUNT(*) as total_days,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
          ROUND(
            (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / 
            NULLIF(COUNT(*), 0)) * 100, 
            2
          ) as attendance_percentage
        FROM class_enrollments ce
        JOIN users u ON ce.student_id = u.id
        LEFT JOIN attendance a ON a.student_id = u.id AND a.class_id = ce.class_id
        WHERE ce.class_id = $1 AND ce.status = 'active'
      `;
      const params: any[] = [classId];

      if (startDate) {
        queryText += ' AND (a.date IS NULL OR a.date >= $2)';
        params.push(startDate);
      }

      if (endDate) {
        queryText += ` AND (a.date IS NULL OR a.date <= $${params.length + 1})`;
        params.push(endDate);
      }

      queryText += ' GROUP BY u.id, u.name, u.email ORDER BY u.name';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching class attendance summary:', error);
      throw new Error('Failed to fetch class attendance summary');
    }
  }

  /**
   * Bulk record attendance for multiple students
   */
  static async bulkRecordAttendance(
    attendanceRecords: Array<{
      classId: string;
      studentId: string;
      date: Date;
      status: 'present' | 'absent' | 'late' | 'excused';
      notes?: string;
    }>,
    recordedBy: string
  ) {
    try {
      const results = [];

      for (const record of attendanceRecords) {
        const result = await this.recordAttendance(
          record.classId,
          record.studentId,
          record.date,
          record.status,
          record.notes,
          recordedBy
        );
        results.push(result);
      }

      logger.info(`Bulk recorded ${results.length} attendance records`);
      return results;
    } catch (error) {
      logger.error('Error bulk recording attendance:', error);
      throw new Error('Failed to bulk record attendance');
    }
  }

  /**
   * Get recent attendance for dashboard
   */
  static async getRecentAttendance(userId: string, role: 'student' | 'teacher', limit: number = 10) {
    try {
      let queryText;
      
      if (role === 'student') {
        queryText = `
          SELECT 
            a.*, c.name as class_name, c.section
          FROM attendance a
          JOIN classes c ON a.class_id = c.id
          WHERE a.student_id = $1
          ORDER BY a.date DESC
          LIMIT $2
        `;
      } else {
        queryText = `
          SELECT 
            a.*, c.name as class_name, u.name as student_name
          FROM attendance a
          JOIN classes c ON a.class_id = c.id
          JOIN users u ON a.student_id = u.id
          WHERE c.teacher_id = $1
          ORDER BY a.date DESC
          LIMIT $2
        `;
      }

      const result = await query(queryText, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching recent attendance:', error);
      throw new Error('Failed to fetch recent attendance');
    }
  }
}

export default AttendanceService;
