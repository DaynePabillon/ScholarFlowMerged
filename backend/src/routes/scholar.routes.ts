// scholar.routes.ts
// Unified ScholarSync academic routes â€” extracted from ScholarSync server.ts
// These routes handle: Auth (Google OAuth), Accounts, Courses, Groups, Import,
// Enrollment, Consultations, Calendar, Drive/Sheets, Member Journals, AI, and Bookings.

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { google } from 'googleapis';
import { pool } from '../config/database';
import logger from '../config/logger';
import GoogleAuthService from '../services/google/auth.service';
import { sendTeamImportEmail } from '../services/email.service';

const router = Router();

// Passport Google OAuth setup removed - consolidated into authRoutes (auth.routes.ts)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MIDDLEWARE HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === 'string' && authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('[Scholar Auth] Missing token in request to:', req.path);
    return res.status(401).json({ error: 'Access token required' });
  }

  const secret = process.env.JWT_SECRET || 'default-secret-key';
  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      logger.warn('[Scholar Auth] Invalid token attempt for:', req.path, 'Reason:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = user;
    next();
  });
};

const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "default-secret-key", (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    if (user.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    (req as any).user = user;
    next();
  });
};

const verifyInstructor = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "default-secret-key", (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    if (user.role !== 'Admin' && user.role !== 'Adviser' && user.role !== 'Advisers') {
      return res.status(403).json({ error: "Instructor access required" });
    }
    (req as any).user = user;
    next();
  });
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER: Get Google Access Token
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const getAccessToken = async (token: string): Promise<string | null> => {
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    
    // Try ss_account first (ScholarSync-native users) — match by email since decoded.id is SkyFlow UUID
    const ssResult = await pool.query(
      'SELECT "googleAccessToken" FROM ss_account WHERE "accountEmail" = $1',
      [decoded.email]
    );
    if (ssResult.rows[0]?.googleAccessToken) {
      return ssResult.rows[0].googleAccessToken;
    }
    
    // Fall back to SkyFlow users table (unified auth stores Google token here)
    // Use getUserWithTokens to auto-refresh expired tokens
    try {
      const user = await GoogleAuthService.getUserWithTokens(decoded.id);
      return user.access_token || null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Google OAuth routes removed - consolidated into auth.routes.ts â”€â”€â”€

// Complete profile (new user registration)
router.post('/complete-profile', async (req: Request, res: Response) => {
  const { token, name } = req.body;
  if (!token || !name) return res.status(400).json({ error: "Missing token or name" });

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    if (!decoded.isRegistrationToken || !decoded.email) {
      return res.status(400).json({ error: "Invalid registration token" });
    }

    const email = decoded.email;
    const accessToken = decoded.accessToken;

    const insertRes = await pool.query(
      `INSERT INTO ss_account ("accountName", "accountEmail", "accountRole", "googleAccessToken") 
       VALUES ($1, $2, 'Student', $3) RETURNING *`,
      [name, email, accessToken]
    );
    const newUser = insertRes.rows[0];

    const sessionToken = jwt.sign(
      { id: newUser.account_id, email: newUser.accountEmail, role: newUser.accountRole, name: newUser.accountName },
      process.env.JWT_SECRET || "default-secret-key",
      { expiresIn: '24h' }
    );

    res.json({ token: sessionToken, user: newUser });
  } catch (error: any) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// /me â€” Current user info
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key', async (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    try {
      const { rows } = await pool.query(
        'SELECT account_id, "accountName", "accountEmail", "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1',
        [user.email]
      );

      if (rows.length === 0) {
        // Fallback for unified users not in ss_account yet
        return res.json({
          ...user,
          role: user.role === 'admin' ? 'Admin' : 'Student' 
        });
      }

      const account = rows[0];
      return res.json({
        id: user.id, // Keep unified UUID
        academicId: account.account_id,
        name: account.accountName,
        email: account.accountEmail,
        role: account.accountRole,
      });
    } catch {
      return res.json(user);
    }
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACCOUNTS (Admin CRUD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/accounts', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT account_id, "accountName", "accountEmail", "accountRole" FROM ss_account ORDER BY "accountName"');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/accounts/:id/role', verifyAdmin, async (req: Request, res: Response) => {
  const accountId = req.params.id;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: "Missing role" });

  try {
    const { rows } = await pool.query(
      'UPDATE ss_account SET "accountRole" = $1 WHERE account_id = $2 RETURNING *',
      [role, accountId]
    );
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/accounts/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM ss_account WHERE account_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COURSES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/courses', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const user: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");

    if (user.role === 'Admin' || user.role === 'admin') {
      const { rows: allCourses } = await pool.query(
        `SELECT c.*, COALESCE(ec.enrolled_count, 0)::int AS "courseAmount"
         FROM ss_courses c
         LEFT JOIN (SELECT course_id, COUNT(*)::int AS enrolled_count FROM ss_enrollments GROUP BY course_id) ec ON ec.course_id = c.id
         ORDER BY c.id DESC`
      );
      return res.json(allCourses);
    }

    // Helper to find Academic Account
    const accountRes = await pool.query(
      'SELECT account_id, "accountEmail", "accountName", "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1',
      [user.email]
    );
    const account = accountRes.rows[0];

    const userAcademicRole = account?.accountRole || (user.role === 'admin' ? 'Admin' : 'Student');

    // Admin from ss_account gets all courses (same as JWT Admin path above)
    if (userAcademicRole === 'Admin') {
      const { rows: allCourses } = await pool.query(
        `SELECT c.*, COALESCE(ec.enrolled_count, 0)::int AS "courseAmount"
         FROM ss_courses c
         LEFT JOIN (SELECT course_id, COUNT(*)::int AS enrolled_count FROM ss_enrollments GROUP BY course_id) ec ON ec.course_id = c.id
         ORDER BY c.id DESC`
      );
      return res.json(allCourses);
    }

    if (userAcademicRole === 'Adviser' || userAcademicRole === 'Advisers') {
      const adviserEmail = String(user.email || '').toLowerCase().trim();
      const adviserName = String(user.name || '').toLowerCase().trim();

      const { rows } = await pool.query(
        `SELECT DISTINCT c.*, COALESCE(ec.enrolled_count, 0)::int AS "courseAmount"
         FROM ss_courses c
         LEFT JOIN (SELECT course_id, COUNT(*)::int AS enrolled_count FROM ss_enrollments GROUP BY course_id) ec ON ec.course_id = c.id
         LEFT JOIN team_groups tg ON tg.course_id = c.id
         WHERE LOWER(COALESCE(c."courseAdviser", '')) = $1
            OR LOWER(COALESCE(tg.adviser_name, '')) = $1
            OR LOWER(COALESCE(tg.adviser_name, '')) = $2
         ORDER BY c.id DESC`,
        [adviserEmail, adviserName]
      );
      return res.json(rows);
    }

    if (userAcademicRole === 'Student') {
      if (!account) return res.json([]);
      const enrollRes = await pool.query('SELECT course_id FROM ss_enrollments WHERE account_id = $1', [account.account_id]);
      const enrolledCourseIds = enrollRes.rows.map((e: any) => e.course_id);
      if (enrolledCourseIds.length === 0) return res.json([]);
      const { rows } = await pool.query(
        `SELECT c.*, COALESCE(ec.enrolled_count, 0)::int AS "courseAmount"
         FROM ss_courses c
         LEFT JOIN (SELECT course_id, COUNT(*)::int AS enrolled_count FROM ss_enrollments GROUP BY course_id) ec ON ec.course_id = c.id
         WHERE c.id = ANY($1::int[])
         ORDER BY c.id DESC`,
        [enrolledCourseIds]
      );
      return res.json(rows);
    }

    return res.json([]);
  } catch (err) {
    return res.sendStatus(403);
  }
});

router.get('/courses/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const { rows } = await pool.query(
      `SELECT c.*, COALESCE(ec.enrolled_count, 0)::int AS "courseAmount"
       FROM ss_courses c
       LEFT JOIN (SELECT course_id, COUNT(*)::int AS enrolled_count FROM ss_enrollments GROUP BY course_id) ec ON ec.course_id = c.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Course not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.sendStatus(403);
  }
});

router.post('/courses', verifyInstructor, async (req: Request, res: Response) => {
  const { courseName, courseCode, courseSection, courseTerm } = req.body;
  const user = (req as any).user;

  if (String(user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Only Admin can create courses.' });
  }

  if (!courseName || !courseCode || !courseSection || !courseTerm) {
    return res.status(400).json({ error: "Missing course details" });
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let courseKey = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');

  try {
    const { rows } = await pool.query(
      `INSERT INTO ss_courses ("courseName", "courseCode", "courseSection", "courseTerm", "courseKey", "courseAmount", "courseAdviser") 
       VALUES ($1, $2, $3, $4, $5, 0, $6) RETURNING *`,
      [courseName, courseCode, courseSection, courseTerm, courseKey, user.email]
    );
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// â”€â”€ Course members â”€â”€
router.get('/courses/:id/members', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    const { rows } = await pool.query(
      `SELECT a.account_id, a."accountName", a."accountEmail", a."accountRole"
       FROM ss_account a
       JOIN ss_enrollments e ON e.account_id = a.account_id
       WHERE e.course_id = $1
       ORDER BY a."accountName"`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.sendStatus(403);
  }
});

// â”€â”€ Course groupings â”€â”€
router.get('/courses/:id/groupings', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const { rows } = await pool.query(
      `SELECT id, name as "groupName", team_number, adviser_name as adviser, proposed_project, 
              consultation_dates, comments, grade, course_id as "courseID"
       FROM team_groups WHERE course_id = $1 ORDER BY team_number`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.sendStatus(403);
  }
});

// â”€â”€ Course group members â”€â”€
router.get('/courses/:id/group-members', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const user: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const accRes = await pool.query('SELECT "accountRole", "accountGroup" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1', [user.email]);
    const account = accRes.rows[0];

    let groups;
    if (account && account.accountRole === 'Student' && account.accountGroup) {
      const { rows } = await pool.query(
        `SELECT id, name as "groupName", team_number, adviser_name as adviser, proposed_project,
                consultation_dates, comments, grade, course_id as "courseID"
         FROM team_groups WHERE course_id = $1 AND name = $2 ORDER BY team_number`,
        [req.params.id, account.accountGroup]
      );
      groups = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT id, name as "groupName", team_number, adviser_name as adviser, proposed_project,
                consultation_dates, comments, grade, course_id as "courseID"
         FROM team_groups WHERE course_id = $1 ORDER BY team_number`,
        [req.params.id]
      );
      groups = rows;
    }

    const enriched = await Promise.all(groups.map(async (g: any) => {
      const { rows: members } = await pool.query(
        `SELECT member_number, name, email, is_leader FROM team_group_members
         WHERE team_group_id = $1 ORDER BY member_number`,
        [g.id]
      );
      return { ...g, groupMembers: members.length, members };
    }));

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// â”€â”€ Course teams (role-filtered) â”€â”€
router.get('/courses/:id/teams', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const user: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const courseId = req.params.id;

    const accRes = await pool.query('SELECT "accountRole", "accountEmail", "accountGroup", "accountName" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1', [user.email]);
    const account = accRes.rows[0];
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const role = account.accountRole;
    const { rows: allGroups } = await pool.query(
      'SELECT id, name as "groupName", team_number, adviser_name as adviser, proposed_project, consultation_dates, comments, grade, course_id as "courseID" FROM team_groups WHERE course_id = $1 ORDER BY team_number',
      [courseId]
    );

    if (role === 'Admin') {
      return res.json({ teams: allGroups, userRole: 'admin', viewType: 'all' });
    } else if (role === 'Adviser' || role === 'Advisers') {
      const adviserEmail = String(account.accountEmail || '').toLowerCase().trim();
      const adviserName = String(account.accountName || '').toLowerCase().trim();
      const accessRes = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM ss_courses c LEFT JOIN team_groups tg ON tg.course_id = c.id
           WHERE c.id = $1 AND (LOWER(COALESCE(c."courseAdviser", '')) = $2 OR LOWER(COALESCE(tg.adviser_name, '')) = $2 OR LOWER(COALESCE(tg.adviser_name, '')) = $3)
         ) AS allowed`,
        [courseId, adviserEmail, adviserName]
      );
      if (accessRes.rows[0]?.allowed) {
        return res.json({ teams: allGroups, userRole: 'adviser', viewType: 'advised' });
      }
      return res.json({ teams: [], userRole: 'adviser', viewType: 'none' });
    } else {
      const studentGroup = account.accountGroup;
      if (studentGroup) {
        const myTeam = allGroups.filter((g: any) => g.groupName === studentGroup);
        return res.json({ teams: myTeam, userRole: 'student', viewType: 'own' });
      }
      return res.json({ teams: [], userRole: 'student', viewType: 'none' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
});

// â”€â”€ Course consultations â”€â”€
router.get('/courses/:id/consultations', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    const { rows } = await pool.query(
      `SELECT "conID", "courseID", "groupName", "conDate", "conType", "conMil",
              "conSum", "conAction", "conAtt", "isDraft", "conStat", "conNotes"
       FROM ss_consultation
       WHERE "courseID" = $1
       ORDER BY "conDate" DESC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.json([]);
  }
});

// â”€â”€ Course groups (for schedule page) â”€â”€
router.get('/courses/:id/groups', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const { rows } = await pool.query(
      'SELECT id, name, team_number FROM team_groups WHERE course_id = $1 ORDER BY team_number',
      [req.params.id]
    );
    return res.json({ groups: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// â”€â”€ Course sheets (connected sheets) â”€â”€
router.get('/courses/:id/sheets', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    const { rows } = await pool.query('SELECT * FROM ss_connected_sheets WHERE "courseID" = $1 ORDER BY created_at DESC', [req.params.id]);
    const sheets = rows.map((s: any) => ({
      id: s.id, sheetId: s.sheetId, sheetName: s.sheetName,
      courseId: s.courseID, createdAt: s.created_at, groupCount: s.groupCount || 0
    }));
    return res.json({ sheets });
  } catch {
    return res.status(403).json({ error: 'Unauthorized' });
  }
});

router.post('/courses/:id/connect-sheet', verifyInstructor, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const { sheetUrl } = req.body;
  if (!sheetUrl) return res.status(400).json({ error: 'Missing sheet URL' });

  const match = sheetUrl.match(/\/d\/(.*?)\//);
  if (!match?.[1]) return res.status(400).json({ error: 'Invalid Google Sheets URL' });
  const sheetId = match[1];

  try {
    let sheetName = 'Connected Sheet';
    try {
      const metaRes = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title&key=`,
        { validateStatus: () => true }
      );
      sheetName = metaRes.data?.properties?.title || sheetName;
    } catch { }

    try {
      const { rows } = await pool.query(
        'INSERT INTO ss_connected_sheets ("courseID", "sheetId", "sheetName") VALUES ($1, $2, $3) RETURNING *',
        [courseId, sheetId, sheetName]
      );
      return res.json({ success: true, sheet: rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(400).json({ error: 'Sheet already connected to this course' });
      throw error;
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to connect sheet' });
  }
});

router.delete('/connected-sheets/:id', verifyInstructor, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM ss_connected_sheets WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENROLLMENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.post('/enroll', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  const { courseKey } = req.body;
  if (!courseKey) return res.status(400).json({ error: "Missing course key" });

  try {
    const user: any = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    if (user.role !== 'Student') {
      return res.status(403).json({ error: 'Only students can enroll using a course key.' });
    }

    const crsRes = await pool.query('SELECT id, "courseAmount" FROM ss_courses WHERE "courseKey" = $1', [courseKey]);
    const course = crsRes.rows[0];
    if (!course) return res.status(404).json({ error: "Invalid course key" });

    try {
      await pool.query('INSERT INTO ss_enrollments (account_id, course_id) VALUES ($1, $2)', [user.id, course.id]);
      await pool.query('UPDATE ss_courses SET "courseAmount" = "courseAmount" + 1 WHERE id = $1', [course.id]);
      return res.json({ success: true, message: "Successfully enrolled!" });
    } catch (enrollError: any) {
      if (enrollError.code === '23505') {
        return res.status(400).json({ error: "You are already enrolled in this course." });
      }
      throw enrollError;
    }
  } catch (err) {
    return res.status(401).json({ error: "Invalid session token" });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GROUPS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/groups/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    const { rows: groups } = await pool.query(
      `SELECT id as "groupID", name as "groupName", team_number, adviser_name as adviser, proposed_project,
              consultation_dates, comments, grade, course_id as "courseID"
       FROM team_groups WHERE id = $1`,
      [req.params.id]
    );
    if (groups.length === 0) return res.status(404).json({ error: "Group not found" });
    const group = groups[0];

    const { rows: members } = await pool.query(
      `SELECT member_number, name, email, is_leader FROM team_group_members WHERE team_group_id = $1 ORDER BY member_number`,
      [req.params.id]
    );

    const groupData: any = {
      ...group, id: group.groupID,
      member1: members[0]?.email || null, roleOne: members[0]?.is_leader ? 'leader' : (members[0] ? 'member' : null), nameOne: members[0]?.name || null,
      member2: members[1]?.email || null, roleTwo: members[1]?.is_leader ? 'leader' : (members[1] ? 'member' : null), nameTwo: members[1]?.name || null,
      member3: members[2]?.email || null, roleThree: members[2]?.is_leader ? 'leader' : (members[2] ? 'member' : null), nameThree: members[2]?.name || null,
      member4: members[3]?.email || null, roleFour: members[3]?.is_leader ? 'leader' : (members[3] ? 'member' : null), nameFour: members[3]?.name || null,
      member5: members[4]?.email || null, roleFive: members[4]?.is_leader ? 'leader' : (members[4] ? 'member' : null), nameFive: members[4]?.name || null,
    };
    return res.json(groupData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/groups/:id/tasks', async (_req: Request, res: Response) => {
  return res.json([]);
});

router.get('/group/by-member/:email', verifyToken, async (req: Request, res: Response) => {
  try {
    const rawEmail = String(req.params.email || '').trim().toLowerCase();
    if (!rawEmail) return res.status(400).json({ error: 'Missing member email' });

    const { rows: membershipRows } = await pool.query(
      `SELECT tgm.team_group_id, tgm.member_number, tgm.is_leader, tg.name as "groupName", tg.course_id as "courseID"
       FROM team_group_members tgm JOIN team_groups tg ON tg.id = tgm.team_group_id
       WHERE LOWER(tgm.email) = $1 ORDER BY tg.team_number LIMIT 1`,
      [rawEmail]
    );

    if (membershipRows.length === 0) {
      return res.status(404).json({ error: 'Member is not assigned to a group.' });
    }

    const membership = membershipRows[0];
    const { rows: members } = await pool.query(
      `SELECT member_number, name, email, is_leader FROM team_group_members WHERE team_group_id = $1 ORDER BY member_number`,
      [membership.team_group_id]
    );

    const leaderEmail = String(members.find((m: any) => m.is_leader)?.email || members[0]?.email || '').trim().toLowerCase();

    let ssGroup = await pool.query('SELECT * FROM ss_group WHERE "groupName" = $1 LIMIT 1', [membership.groupName]);
    if (ssGroup.rows.length === 0) {
      ssGroup = await pool.query(
        `INSERT INTO ss_group ("groupName", member1, "roleOne", member2, "roleTwo", member3, "roleThree", member4, "roleFour", member5, "roleFive")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [membership.groupName, members[0]?.email || null, leaderEmail || null, members[1]?.email || null, null, members[2]?.email || null, null, members[3]?.email || null, null, members[4]?.email || null, null]
      );
    }

    const legacyGroup = ssGroup.rows[0];
    const isLeader = String(rawEmail) === String(leaderEmail);

    return res.json({
      group: {
        smallgroupID: legacyGroup?.smallgroupID || null,
        bookingGroupId: legacyGroup?.smallgroupID || null,
        teamGroupID: membership.team_group_id,
        groupName: membership.groupName,
        roleOne: leaderEmail,
        member1: members[0]?.email || null, member2: members[1]?.email || null, member3: members[2]?.email || null, member4: members[3]?.email || null, member5: members[4]?.email || null,
        memberNumber: membership.member_number || null,
        courseID: membership.courseID,
        leaderEmail, isLeader, canBookConsultation: isLeader,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resolve member group.' });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEAM GROUP COMMENTS (ScholarSync â€” prefixed to avoid conflict with SkyFlow's /team-groups/:id/comments)
// Both use the same team_comments table, but different route paths for each frontend.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/scholar/team-groups/:id/comments', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    jwt.verify(token, process.env.JWT_SECRET || "default-secret-key");
    const { rows } = await pool.query(
      `SELECT id, user_name, content, created_at FROM team_comments WHERE team_group_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.sendStatus(403);
  }
});

router.post('/scholar/team-groups/:id/comments', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret-key") as any;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    const userResult = await pool.query(
      'SELECT "accountName", "accountEmail" FROM ss_account WHERE account_id = $1',
      [decoded.id]
    );
    const userName = userResult.rows[0]?.accountName || decoded.email || 'Unknown';

    const { rows } = await pool.query(
      `INSERT INTO team_comments (team_group_id, user_id, user_name, content)
       VALUES ($1, $2, $3, $4) RETURNING id, user_name, content, created_at`,
      [req.params.id, null, userName, content.trim()]
    );
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSULTATIONS (CRUD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.post('/consultations', verifyToken, async (req: Request, res: Response) => {
  const { courseID, groupName, conDate, conType, conMil, conSum, conAction, conAtt, isDraft, conStat, conNotes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO ss_consultation ("courseID", "groupName", "conDate", "conType", "conMil", "conSum", "conAction", "conAtt", "isDraft", "conStat", "conNotes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [courseID, groupName, conDate, conType, conMil, conSum, conAction, conAtt, isDraft, conStat, conNotes]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/consultations/:id', verifyInstructor, async (req: Request, res: Response) => {
  const { conSum, conAction, conAtt, isDraft, conStat, conNotes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE ss_consultation SET "conSum" = $1, "conAction" = $2, "conAtt" = $3, "isDraft" = $4, "conStat" = $5, "conNotes" = $6 WHERE "conID" = $7 RETURNING *`,
      [conSum, conAction, conAtt, isDraft, conStat, conNotes, req.params.id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GOOGLE DRIVE & SHEETS (ScholarSync)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
router.get('/scholar/drive/files', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  const accessToken = await getAccessToken(token);
  if (!accessToken) return res.status(403).json({ error: 'No Google access token. Please re-login.' });

  try {
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,modifiedTime,size)',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.json({ files: response.data.files || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch Drive files.' });
  }
});

router.get('/scholar/drive/folders', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  const accessToken = await getAccessToken(token);
  if (!accessToken) return res.status(403).json({ error: 'No Google access token.' });

  try {
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27&pageSize=50&fields=files(id,name)&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.json({ folders: response.data.files || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch Drive folders.' });
  }
});

router.post('/scholar/sheets/content', async (req: Request, res: Response) => {
  const { spreadsheetId, range } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  const accessToken = await getAccessToken(token);
  if (!accessToken) return res.status(403).json({ error: 'No Google access token.' });

  try {
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.json(response.data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch Sheet content.' });
  }
});

router.get('/scholar/sheets/content', async (req: Request, res: Response) => {
  const { spreadsheetId, range } = req.query;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  const accessToken = await getAccessToken(token);
  if (!accessToken) return res.status(403).json({ error: 'No Google access token.' });

  try {
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.json(response.data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch Sheet content.' });
  }
});

router.get('/scholar/sheets/list', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  const DRIVE_URL = `https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27&pageSize=50&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,owners)`;

  const fetchSheets = async (accessTok: string) => {
    const response = await axios.get(DRIVE_URL, { headers: { Authorization: `Bearer ${accessTok}` } });
    return response.data.files || [];
  };

  try {
    let accessToken = await getAccessToken(token);
    if (!accessToken) return res.status(403).json({ error: 'No Google access token.' });

    try {
      const files = await fetchSheets(accessToken);
      return res.json({ files });
    } catch (firstErr: any) {
      // If Google returns 401 (expired token), force-refresh and retry once
      if (firstErr.response?.status === 401) {
        logger.info('Google token expired, force-refreshing...');
        try {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
          const freshToken = await GoogleAuthService.refreshAccessToken(decoded.id);
          if (freshToken) {
            const files = await fetchSheets(freshToken);
            return res.json({ files });
          }
        } catch (refreshErr: any) {
          logger.error('Token refresh failed:', refreshErr.message);
        }
      }
      logger.error('Google Sheets API error:', firstErr.response?.data || firstErr.message);
      return res.status(500).json({ error: firstErr.response?.data?.error?.message || 'Failed to fetch Sheets.' });
    }
  } catch (err: any) {
    logger.error('Sheets list error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch Sheets.' });
  }
});

// SMART IMPORT: Auto-detect course from TEAM CODE column
// Format: 2526-sem1-it332-01
//   2526  = academic year (2025-2026)
//   sem1  = semester
//   it332 = course code
//   01    = group number
// ================================================================

function parseTeamCode(teamCode: string) {
  const clean = teamCode.trim().toLowerCase();
  const parts = clean.split('-');
  if (parts.length < 4) return null;

  const yearPart = parts[0] ?? '';
  const semPart = parts[1] ?? '';
  const codePart = parts[2] ?? '';
  const groupPart = parts.slice(3).join('-');

  if (!yearPart.match(/^\d{4}$/) || !semPart.startsWith('sem') || !codePart) return null;

  const y1 = `20${yearPart.slice(0, 2)}`;
  const y2 = `20${yearPart.slice(2, 4)}`;
  const academicYear = `${y1}-${y2}`;
  const semNum = semPart.replace('sem', '');
  const semester = semNum === '1' ? '1st Semester' : semNum === '2' ? '2nd Semester' : `Semester ${semNum}`;
  const courseCode = codePart.toUpperCase();
  const groupNum = parseInt(groupPart, 10) || groupPart;
  const groupName = `Group ${groupNum}`;
  const courseKeyBase = `${yearPart}${semPart}${codePart}`;

  return {
    courseCode,
    courseName: `${courseCode} — ${semester} ${academicYear}`,
    courseTerm: `${semester} ${academicYear}`,
    courseKey: courseKeyBase.substring(0, 20),
    groupName,
    groupPart,
  };
}

router.post('/import-from-sheet', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  let user: any;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
  } catch {
    return res.sendStatus(403);
  }

  const { sheetId } = req.body;
  if (!sheetId) return res.status(400).json({ error: 'Missing sheetId' });

  try {
    const accessToken = await getAccessToken(token);
    let records: any[] = [];
    let sheetTitle = 'Imported Sheet';

    // Helper: find the actual header row (scans until it finds a row with a cell === 'TEAM CODE')
    const findHeaderRow = (rows: string[][]): { headers: string[]; dataRows: string[][] } | null => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const hasTeamCode = row.some(cell => cell.toString().trim().toUpperCase() === 'TEAM CODE');
        if (hasTeamCode) {
          return {
            headers: row.map(h => h.toString().trim()),
            dataRows: rows.slice(i + 1)
          };
        }
      }
      return null;
    };

    // Try Google Sheets API first (private sheets)
    if (accessToken) {
      try {
        const metaRes = await axios.get(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        sheetTitle = metaRes.data?.properties?.title || sheetTitle;

        const dataRes = await axios.get(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1000`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const values: string[][] = dataRes.data.values || [];
        const found = findHeaderRow(values);
        if (found && found.dataRows.length > 0) {
          records = found.dataRows
            .filter(row => row.some(cell => cell.toString().trim() !== ''))
            .map(row => {
              const obj: any = {};
              found.headers.forEach((h, i) => { obj[h] = (row[i] ?? '').toString().trim(); });
              return obj;
            });
        }
      } catch (e: any) {
        logger.info('Sheets API failed, falling back to CSV:', e.message);
      }
    }

    // Fallback: public CSV
    if (records.length === 0) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const response = await axios.get(csvUrl);
      const rawRows: string[][] = parse(response.data, { columns: false, skip_empty_lines: false, relax_column_count: true });
      const found = findHeaderRow(rawRows);
      if (found && found.dataRows.length > 0) {
        records = found.dataRows
          .filter(row => row.some(cell => cell.toString().trim() !== ''))
          .map(row => {
            const obj: any = {};
            found.headers.forEach((h, i) => { obj[h] = (row[i] ?? '').toString().trim(); });
            return obj;
          });
      } else {
        records = parse(response.data, { columns: true, skip_empty_lines: true });
      }
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'Sheet is empty or inaccessible.' });
    }

    // Case-insensitive column finder
    const findCol = (row: any, ...names: string[]) => {
      for (const name of names) {
        const nameLow = name.toLowerCase();
        let key = Object.keys(row).find(k => k.trim().toLowerCase() === nameLow);
        if (!key) {
          key = Object.keys(row).find(k => k.trim().toLowerCase().includes(nameLow));
        }
        if (key !== undefined && row[key]) return row[key].toString().trim();
      }
      return '';
    };

    // Group rows by team code
    const courseMap: Record<string, {
      parsed: ReturnType<typeof parseTeamCode>;
      groups: Record<string, { members: { email: string; fullName: string; memberNum: number }[]; adviser: string; proposedProject: string }>;
    }> = {};

    for (const row of records) {
      const teamCode = findCol(row, 'TEAM CODE', 'Team Code', 'teamcode', 'group', 'Group', 'GROUP');
      const email = findCol(row, 'EMAIL', 'Email', 'email');
      const fullName = findCol(row, 'FIRSTNAME', 'First Name', 'Full name', 'Full Name', 'Name', 'LASTNAME', 'Lastname');
      const lastName = findCol(row, 'LASTNAME', 'Lastname', 'Last Name');
      const firstName = findCol(row, 'FIRSTNAME', 'Firstname', 'First Name');
      const memberNum = parseInt(findCol(row, 'MEMBER #', 'Member #', 'member', 'Member') || '0', 10);
      const adviserEmail = findCol(row, 'ADVISER Email', 'ADVISER EMAIL', 'Adviser Email', 'Advisor Email', 'advisor email');
      const adviser = findCol(row, 'ADVISER', 'Adviser', 'advisor', 'Advisor');
      const proposedProject = findCol(row, 'PROPOSED PROJECT', 'Proposed Project', 'Project', 'project');

      if (!teamCode || !email) continue;

      const parsed = parseTeamCode(teamCode);
      if (!parsed) continue;

      const key = parsed.courseKey;
      if (!courseMap[key]) {
        courseMap[key] = { parsed, groups: {} };
      }

      const displayName = fullName || (firstName && lastName ? `${firstName} ${lastName}` : email.split('@')[0]);

      const currentCourse = courseMap[key]!;
      if (!currentCourse.groups[parsed.groupName]) {
        currentCourse.groups[parsed.groupName] = { members: [], adviser: '', proposedProject: '' };
      }

      const currentGroup = currentCourse.groups[parsed.groupName]!;
      currentGroup.members.push({
        email,
        fullName: displayName,
        memberNum: memberNum || (currentGroup.members.length + 1)
      });

      if (adviserEmail) {
        currentGroup.adviser = adviserEmail.toLowerCase().trim();
      } else if (adviser) {
        currentGroup.adviser = adviser;
      }
      if (proposedProject) currentGroup.proposedProject = proposedProject;
    }

    const forceReplace = req.body.forceReplace === true;

    if (Object.keys(courseMap).length === 0) {
      return res.status(400).json({
        error: 'No valid TEAM CODE rows found. Expected format: 2526-sem1-it332-01'
      });
    }

    // Collect adviser emails and update roles
    const adviserEmails = new Set<string>();
    for (const { groups } of Object.values(courseMap)) {
      for (const { adviser } of Object.values(groups)) {
        if (adviser && adviser.includes('@')) {
          adviserEmails.add(adviser.toLowerCase().trim());
        }
      }
    }

    const client = await pool.connect();
    const results: any[] = [];
    // Collect members for invitation emails (sent after successful commit)
    const importedMembers: { email: string; name: string; courseCode: string; courseName: string; groupName: string; adviser: string }[] = [];

    try {
      await client.query('BEGIN');

      // Assign Adviser role
      for (const advEmail of adviserEmails) {
        await client.query(
          'UPDATE ss_account SET "accountRole" = \'Advisers\' WHERE LOWER("accountEmail") = LOWER($1)',
          [advEmail]
        );
      }

      // Pre-check: detect existing teams
      if (!forceReplace) {
        const existingConflicts: any[] = [];
        for (const [courseKey, { parsed }] of Object.entries(courseMap)) {
          if (!parsed) continue;
          const existingCourse = await client.query(
            'SELECT id FROM ss_courses WHERE "courseKey" = $1 OR "courseKey" LIKE $1 || \'-%\' LIMIT 1',
            [parsed.courseKey]
          );
          if (existingCourse.rows.length > 0) {
            const courseId = existingCourse.rows[0].id;
            const existingTeams = await client.query(
              'SELECT COUNT(*) as count FROM team_groups WHERE course_id = $1',
              [courseId]
            );
            const teamCount = parseInt(existingTeams.rows[0].count);
            if (teamCount > 0) {
              existingConflicts.push({
                courseKey: parsed.courseKey,
                courseCode: parsed.courseCode,
                courseName: parsed.courseName,
                courseTerm: parsed.courseTerm,
                existingTeamCount: teamCount,
              });
            }
          }
        }

        if (existingConflicts.length > 0) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(409).json({
            conflict: true,
            message: `Teams for ${existingConflicts.map(c => c.courseCode).join(', ')} already exist.`,
            existingCourses: existingConflicts,
            hint: 'Set forceReplace: true to replace existing data.',
          });
        }
      }

      for (const [courseKey, { parsed, groups }] of Object.entries(courseMap)) {
        if (!parsed) continue;

        const detectedCourseAdviser =
          Object.values(groups)
            .map(g => String(g.adviser || '').toLowerCase().trim())
            .find(a => a.includes('@')) || null;

        // Find or create course
        const existingCourse = await client.query(
          'SELECT id FROM ss_courses WHERE "courseKey" = $1 OR "courseKey" LIKE $1 || \'-%\' LIMIT 1',
          [parsed.courseKey]
        );

        let courseId: number;
        if (existingCourse.rows.length > 0) {
          courseId = existingCourse.rows[0].id;
          if (detectedCourseAdviser) {
            await client.query(
              'UPDATE ss_courses SET "courseAdviser" = $1 WHERE id = $2',
              [detectedCourseAdviser, courseId]
            );
          }
        } else {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          const suffix = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
          const uniqueKey = `${parsed.courseKey.substring(0, 16)}-${suffix}`;

          const newCourse = await client.query(
            `INSERT INTO ss_courses ("courseName", "courseCode", "courseSection", "courseTerm", "courseKey", "courseAmount", "courseAdviser")
             VALUES ($1, $2, \'\', $3, $4, 0, $5) RETURNING id`,
            [parsed.courseName, parsed.courseCode, parsed.courseTerm, uniqueKey, detectedCourseAdviser || user.email || null]
          );
          courseId = newCourse.rows[0].id;
        }

        // Create or get organization
        const orgName = `${parsed.courseCode} - ${parsed.courseTerm}`;
        const orgDomain = `${parsed.courseCode.toLowerCase().replace(/\s+/g, '-')}.scholarsync.local`;

        let orgResult = await client.query(
          "SELECT id FROM organizations WHERE name = $1 LIMIT 1",
          [orgName]
        );

        if (orgResult.rows.length === 0) {
          orgResult = await client.query(
            `INSERT INTO organizations (name, description, domain)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [
              orgName,
              `${parsed.courseName} - Academic collaboration workspace synced from ScholarSync`,
              orgDomain
            ]
          );
        }
        const orgId = orgResult.rows[0]?.id;

        // Ensure user exists in SkyFlow's users table
        const accountRes = await client.query('SELECT account_id, "accountName", "accountEmail", "accountRole" FROM ss_account WHERE "accountEmail" = $1', [user.email]);
        const account = accountRes.rows[0];

        if (account) {
          let googleId = account.accountEmail;
          if (accessToken) {
            try {
              const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (profileRes.data?.id) googleId = profileRes.data.id;
            } catch (err: any) {
              logger.info('Failed to fetch google_id from userinfo:', err.message);
            }
          }

          // Upsert into SkyFlow users table
          const skyUserRes = await client.query(
            `INSERT INTO users (google_id, email, name, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (email) DO UPDATE SET google_id = EXCLUDED.google_id, name = EXCLUDED.name
             RETURNING id`,
            [googleId, account.accountEmail, account.accountName]
          );
          const skyUserId = skyUserRes.rows[0].id;

          // Add to organization
          await client.query(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
             VALUES ($1, $2, \'admin\', \'active\', NOW())
             ON CONFLICT (organization_id, user_id) DO UPDATE SET role = \'admin\', status = \'active\'`,
            [orgId, skyUserId]
          );
        }

        // Clear old team_groups
        const oldTeams = await client.query('SELECT id FROM team_groups WHERE course_id = $1', [courseId]);
        for (const t of oldTeams.rows) {
          await client.query('DELETE FROM team_group_members WHERE team_group_id = $1', [t.id]);
        }
        await client.query('DELETE FROM team_groups WHERE course_id = $1', [courseId]);

        // Get highest team_number
        const maxNumRes = await client.query(
          'SELECT COALESCE(MAX(team_number), 0) as max_num FROM team_groups WHERE organization_id = $1',
          [orgId]
        );
        let teamNumber = parseInt(maxNumRes.rows[0].max_num) + 1;

        for (const [groupName, groupData] of Object.entries(groups)) {
          let adviserId = null;
          if (groupData.adviser && groupData.adviser.includes('@')) {
            const advRes = await client.query('SELECT id FROM users WHERE email = $1', [groupData.adviser.toLowerCase().trim()]);
            if (advRes.rows.length > 0) adviserId = advRes.rows[0].id;
          }

          const teamRes = await client.query(
            `INSERT INTO team_groups (organization_id, team_code, team_number, name, description, adviser_name, adviser_id, course_id, proposed_project, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, \'active\') RETURNING id`,
            [
              orgId,
              parsed.courseKey,
              teamNumber,
              groupName,
              `${parsed.courseName} | ${parsed.courseTerm}`,
              groupData.adviser || null,
              adviserId,
              courseId,
              groupData.proposedProject || null,
            ]
          );
          const teamId = teamRes.rows[0].id;

          // Insert members
          let memberNum = 1;
          for (const member of groupData.members) {
            await client.query(
              `INSERT INTO team_group_members (team_group_id, member_number, name, email, is_leader)
               VALUES ($1, $2, $3, $4, $5)`,
              [teamId, member.memberNum || memberNum, member.fullName, member.email, (member.memberNum || memberNum) === 1]
            );
            memberNum++;
          }

          // Update accountGroup for each member AND sync to SkyFlow users + org_members
          for (const member of groupData.members) {
            await client.query(
              'UPDATE ss_account SET "accountGroup" = $1 WHERE "accountEmail" = $2',
              [groupName, member.email]
            );

            // Upsert member into SkyFlow users table
            const memberSkyRes = await client.query(
              `INSERT INTO users (google_id, email, name, role, created_at)
               VALUES ($1, $2, $3, 'member', NOW())
               ON CONFLICT (email) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name)
               RETURNING id`,
              [member.email, member.email, member.fullName || member.email.split('@')[0]]
            );
            const memberSkyUserId = memberSkyRes.rows[0].id;

            // Add member to the organization in SkyFlow
            await client.query(
              `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
               VALUES ($1, $2, 'member', 'active', NOW())
               ON CONFLICT (organization_id, user_id) DO NOTHING`,
              [orgId, memberSkyUserId]
            );
          }

          // Collect members for invitation emails
          for (const member of groupData.members) {
            if (member.email) {
              importedMembers.push({
                email: member.email,
                name: member.fullName,
                courseCode: parsed.courseCode,
                courseName: parsed.courseName,
                groupName,
                adviser: groupData.adviser || '',
              });
            }
          }

          teamNumber++;
        }

        // Auto-enroll students
        const courseEmails = Array.from(
          new Set(
            Object.values(groups)
              .flatMap(g => g.members.map(m => m.email?.toLowerCase().trim()))
              .filter((email): email is string => !!email)
          )
        );

        if (courseEmails.length > 0) {
          await client.query(
            `INSERT INTO ss_enrollments (account_id, course_id)
             SELECT a.account_id, $1
             FROM ss_account a
             WHERE LOWER(a."accountEmail") = ANY($2::text[])
             ON CONFLICT (account_id, course_id) DO NOTHING`,
            [courseId, courseEmails]
          );

          await client.query(
            `UPDATE ss_courses
             SET "courseAmount" = (
               SELECT COUNT(*)
               FROM ss_enrollments
               WHERE course_id = $1
             )
             WHERE id = $1`,
            [courseId]
          );
        }

        // Save to connected sheets
        await client.query(
          `INSERT INTO ss_connected_sheets ("courseID", "sheetId", "sheetName", "groupCount")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("courseID", "sheetId") DO UPDATE SET "sheetName" = $3, "groupCount" = $4`,
          [courseId, sheetId, sheetTitle, Object.keys(groups).length]
        );

        results.push({
          courseCode: parsed.courseCode,
          courseName: parsed.courseName,
          courseId,
          groupCount: Object.keys(groups).length,
          memberCount: Object.values(groups).reduce((s, g) => s + g.members.length, 0),
        });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const totalGroups = results.reduce((s, r) => s + r.groupCount, 0);
    const totalMembers = results.reduce((s, r) => s + r.memberCount, 0);

    // ─── Send invitation emails (async, non-blocking) ───
    // No-spam rule: check which emails already have an account (they already know the platform)
    // Only send to truly new students who haven't logged in before
    if (importedMembers.length > 0) {
      setImmediate(async () => {
        try {
          // Get emails that already have an active ss_account (they've already signed up)
          const allEmails = [...new Set(importedMembers.map(m => m.email.toLowerCase().trim()))];
          const existingRes = await pool.query(
            `SELECT LOWER("accountEmail") as email FROM ss_account WHERE LOWER("accountEmail") = ANY($1::text[])`,
            [allEmails]
          );
          const existingEmails = new Set(existingRes.rows.map((r: any) => r.email));

          let sentCount = 0;
          let skippedCount = 0;

          for (const member of importedMembers) {
            const emailLower = member.email.toLowerCase().trim();
            if (existingEmails.has(emailLower)) {
              skippedCount++;
              continue; // Already has an account — skip
            }

            const result = await sendTeamImportEmail({
              to: member.email,
              studentName: member.name || member.email.split('@')[0],
              courseName: member.courseName,
              courseCode: member.courseCode,
              groupName: member.groupName,
              adviserName: member.adviser,
            });

            if (result.success) sentCount++;
            else logger.warn(`⚠️ Failed to send import email to ${member.email}: ${result.error}`);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          logger.info(`📨 Import invitations: ${sentCount} sent, ${skippedCount} skipped (existing accounts)`);
        } catch (emailErr: any) {
          logger.error('Error sending import invitation emails:', emailErr);
        }
      });
    }

    return res.json({
      success: true,
      message: `Imported ${totalGroups} groups across ${results.length} course(s) from "${sheetTitle}" — ${totalMembers} members synced!`,
      courses: results,
      sheetTitle,
      emailsQueued: importedMembers.length,
    });

  } catch (error: any) {
    if (error?.response?.status === 403 || error?.response?.status === 404) {
      return res.status(400).json({ error: "Cannot access sheet. Make sure it's shared with 'Anyone with the link'." });
    }
    logger.error('Import from sheet error:', error);
    return res.status(500).json({ error: error?.message || 'Import failed.' });
  }
});

// GET consultation history logs for a group (used by group modal)
router.get('/consultation/group/:groupId/logs', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const rawGroupId = String(req.params.groupId || '').trim();
    if (!rawGroupId) return res.status(400).json({ error: 'Missing group id.' });

    let groupName = '';

    const teamGroupRes = await pool.query(
      `SELECT name
       FROM team_groups
       WHERE CAST(id AS text) = $1
       LIMIT 1`,
      [rawGroupId]
    );

    if (teamGroupRes.rows.length > 0) {
      groupName = String(teamGroupRes.rows[0].name || '').trim();
    } else if (/^\d+$/.test(rawGroupId)) {
      const legacyGroupRes = await pool.query(
        `SELECT "groupName"
         FROM ss_group
         WHERE "smallgroupID" = $1
         LIMIT 1`,
        [Number(rawGroupId)]
      );
      groupName = String(legacyGroupRes.rows[0]?.groupName || '').trim();
    }

    if (!groupName) {
      return res.json({ logs: [] });
    }

    const { rows } = await pool.query(
      `SELECT
         c.*,
         s.slot_date::text as slot_date,
         s.start_time,
         s.end_time,
         a."accountName" as adviser_name
       FROM ss_consultation c
       LEFT JOIN ss_consultation_slots s ON s.slot_id = c.slot_id
       LEFT JOIN ss_account a ON a.account_id = s.owner_account_id
       WHERE LOWER(TRIM(COALESCE(c."groupName", ''))) = LOWER($1)
       ORDER BY COALESCE(c.submitted_at, c.updated_at, c.created_at) DESC, c."conID" DESC`,
      [groupName]
    );

    return res.json({ logs: rows });
  } catch (error: any) {
    logger.error('Error fetching consultation logs:', error);
    return res.status(500).json({ error: 'Failed to fetch consultation logs' });
  }
});

// GET member journals for a specific group in a course
router.get('/member-journals/course/:courseId/group/:groupId', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  try {
    const { courseId, groupId } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM member_journals
       WHERE course_id = $1 AND group_id = $2
       ORDER BY created_at DESC`,
      [courseId, groupId]
    );

    return res.json({ journals: rows });
  } catch (err: any) {
    logger.error('Error fetching member journals:', err);
    return res.status(500).json({ error: err.message });
  }
});

logger.info('📚 ScholarSync academic routes registered');

export default router;
