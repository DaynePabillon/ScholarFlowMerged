import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import GoogleClassroomService from '../services/google/classroom.service';
import GoogleCalendarService from '../services/google/calendar.service';
import AttendanceService from '../services/attendance.service';
import GoogleSheetsService from '../services/google/sheets.service';
import GoogleAuthService from '../services/google/auth.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/dashboard/student
 * Get student dashboard data
 */
router.get('/student', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get user with fresh tokens
    const user = await GoogleAuthService.getUserWithTokens(userId);

    // Fetch all dashboard data in parallel
    const [assignments, upcomingEvents, attendanceStats, grades] = await Promise.all([
      GoogleClassroomService.getStudentAssignments(userId),
      GoogleCalendarService.getUpcomingEvents(userId, 7),
      AttendanceService.getStudentAttendanceStats(userId),
      GoogleSheetsService.getStudentGrades(userId),
    ]);

    res.json({
      assignments: assignments.slice(0, 10), // Top 10 upcoming
      upcomingEvents: upcomingEvents.slice(0, 5),
      attendance: attendanceStats,
      grades,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture,
      },
    });
  } catch (error) {
    logger.error('Error fetching student dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/dashboard/teacher
 * Get teacher dashboard data
 */
router.get('/teacher', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get user with fresh tokens
    const user = await GoogleAuthService.getUserWithTokens(userId);

    // Sync teacher courses first
    await GoogleClassroomService.syncTeacherCourses(
      userId,
      user.access_token,
      user.refresh_token
    );

    // Fetch dashboard data
    const { query } = await import('../config/database');
    
    const classesResult = await query(
      'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const classes = classesResult.rows;

    // Get stats for each class
    const classStats = await Promise.all(
      classes.map(async (cls: any) => {
        const [enrollmentCount, assignmentCount, avgGrade] = await Promise.all([
          query('SELECT COUNT(*) FROM class_enrollments WHERE class_id = $1 AND status = $2', [cls.id, 'active']),
          query('SELECT COUNT(*) FROM assignments WHERE class_id = $1', [cls.id]),
          query('SELECT AVG(current_grade) FROM grade_summaries WHERE class_id = $1', [cls.id]),
        ]);

        return {
          ...cls,
          studentCount: parseInt(enrollmentCount.rows[0].count),
          assignmentCount: parseInt(assignmentCount.rows[0].count),
          avgGrade: parseFloat(avgGrade.rows[0].avg) || 0,
        };
      })
    );

    res.json({
      classes: classStats,
      user: {
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture,
      },
    });
  } catch (error) {
    logger.error('Error fetching teacher dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
