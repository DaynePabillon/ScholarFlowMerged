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

logger.info('ðŸ“š ScholarSync academic routes registered');

export default router;
