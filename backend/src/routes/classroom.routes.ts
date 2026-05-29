import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import { getClassroomCourses, getClassroomStudents } from '../services/google/classroom.service';

const router = Router();

/**
 * GET /api/classroom/courses
 * Fetch active Google Classroom courses for the authenticated user
 */
router.get('/classroom/courses', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [req.user!.id]
    );
    const user = result.rows[0];
    if (!user?.access_token) {
      return res.status(401).json({ error: 'Google account not connected' });
    }
    const courses = await getClassroomCourses(user.access_token, user.refresh_token);
    res.json({ courses });
  } catch (error: any) {
    console.error('Error fetching classroom courses:', error);
    // Detect Google "insufficient scopes" — user's token was issued before Classroom
    // scopes were added; they must reconnect to grant those scopes.
    const isScope =
      error?.code === 403 ||
      error?.status === 403 ||
      error?.message?.toLowerCase().includes('insufficient') ||
      error?.message?.toLowerCase().includes('permission') ||
      (error?.errors && error.errors[0]?.domain === 'global' && error.errors[0]?.reason === 'forbidden');
    if (isScope) {
      return res.status(403).json({
        error: 'Google Classroom permissions are required. Please reconnect your Google account to grant Classroom access.',
        reconnect_required: true
      });
    }
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  }
});

/**
 * GET /api/classroom/courses/:courseId/students
 * Fetch roster for a specific course
 */
router.get('/classroom/courses/:courseId/students', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT access_token, refresh_token FROM users WHERE id = $1',
      [req.user!.id]
    );
    const user = result.rows[0];
    if (!user?.access_token) {
      return res.status(401).json({ error: 'Google account not connected' });
    }
    const students = await getClassroomStudents(req.params.courseId, user.access_token, user.refresh_token);
    res.json({ students });
  } catch (error: any) {
    console.error('Error fetching classroom students:', error);
    const isScope =
      error?.code === 403 ||
      error?.status === 403 ||
      error?.message?.toLowerCase().includes('insufficient') ||
      error?.message?.toLowerCase().includes('permission');
    if (isScope) {
      return res.status(403).json({
        error: 'Google Classroom permissions are required. Please reconnect your Google account.',
        reconnect_required: true
      });
    }
    res.status(500).json({ error: 'Failed to fetch students', details: error.message });
  }
});

/**
 * POST /api/classroom/import
 * Import students as org member invitations.
 *
 * Accepts either:
 *   { organization_id, students: [{userId, name, email}] }   ← frontend pre-built list (preferred)
 *   { organization_id, course_id }                           ← fallback: fetch from Classroom API
 *
 * The pre-built list path is used so the frontend can merge Classroom emails
 * with admin-entered manual emails for personal-Gmail classrooms where
 * profile.emailAddress is null.
 */
router.post('/classroom/import', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { course_id, organization_id, students: providedStudents } = req.body;
    if (!organization_id) {
      return res.status(400).json({ error: 'organization_id is required' });
    }

    // Build the canonical list of { name, email } pairs
    let studentList: { userId?: string; name: string; email: string }[] = [];

    if (Array.isArray(providedStudents) && providedStudents.length > 0) {
      // Frontend already resolved emails (including manual entries)
      studentList = providedStudents.map((s: any) => ({
        userId: s.userId,
        name: String(s.name || 'Student'),
        email: String(s.email || '').trim().toLowerCase()
      }));
    } else if (course_id) {
      // Fallback: fetch fresh from Classroom API
      const result = await query(
        'SELECT access_token, refresh_token FROM users WHERE id = $1',
        [req.user!.id]
      );
      const user = result.rows[0];
      if (!user?.access_token) {
        return res.status(401).json({ error: 'Google account not connected' });
      }
      const raw = await getClassroomStudents(course_id, user.access_token, user.refresh_token);
      studentList = raw.map((s: any) => ({
        userId: s.userId,
        name: s.profile?.name?.fullName || 'Student',
        email: String(s.profile?.emailAddress || '').trim().toLowerCase()
      }));
    } else {
      return res.status(400).json({ error: 'Either students array or course_id is required' });
    }

    let imported = 0;
    let skipped  = 0;

    for (const student of studentList) {
      const { email, name } = student;

      if (!email) {
        skipped++;
        continue;
      }

      // 1. Upsert SkyFlow org invitation with role = 'member'
      await query(
        `INSERT INTO organization_invitations (organization_id, email, role, token, invited_by, expires_at)
         VALUES ($1, $2, 'member', gen_random_uuid()::text, $3, NOW() + INTERVAL '30 days')
         ON CONFLICT (organization_id, email) DO NOTHING`,
        [organization_id, email, req.user!.id]
      );

      // 2. Upsert ScholarSync ss_account with role = 'Student'
      try {
        await query(
          `INSERT INTO ss_account ("accountName", "accountEmail", "accountRole")
           VALUES ($1, $2, 'Student')
           ON CONFLICT ("accountEmail") DO UPDATE
             SET "accountRole" = CASE
               WHEN ss_account."accountRole" = 'Admin' THEN ss_account."accountRole"
               ELSE 'Student'
             END`,
          [name, email]
        );
      } catch (_ssErr) {
        // ss_account may not exist in all environments — non-fatal
      }

      imported++;
    }

    res.json({ imported, skipped, total: studentList.length });
  } catch (error: any) {
    console.error('Error importing classroom students:', error);
    res.status(500).json({ error: 'Failed to import students', details: error.message });
  }
});

export default router;
