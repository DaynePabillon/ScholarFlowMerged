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
import { sendTeamImportEmail, sendAdvisorImportEmail } from '../services/email.service';

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

const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "default-secret-key", async (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    let role = normalizeAcademicRole(user.role);
    
    if (role !== 'admin' && user.email) {
      try {
        const { rows } = await pool.query('SELECT "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1', [user.email]);
        if (rows.length > 0) role = normalizeAcademicRole(rows[0].accountRole);
      } catch (e) {}
    }

    if (role !== 'admin') return res.status(403).json({ error: "Admin access required" });
    (req as any).user = user;
    next();
  });
};

const verifyInstructor = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "default-secret-key", async (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    let role = normalizeAcademicRole(user.role);
    
    if (role !== 'admin' && role !== 'advisers' && user.email) {
      try {
        const { rows } = await pool.query('SELECT "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1', [user.email]);
        if (rows.length > 0) role = normalizeAcademicRole(rows[0].accountRole);
      } catch (e) {}
    }

    if (role !== 'admin' && role !== 'advisers') {
      return res.status(403).json({ error: "Instructor access required" });
    }
    (req as any).user = user;
    next();
  });
};

const normalizeAcademicRole = (value: unknown): 'admin' | 'advisers' | 'student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'adviser' || role === 'advisers' || role === 'advisor' || role === 'advisors' || role === 'manager') return 'advisers';
  return 'student';
};

const inferFollowUpStatus = (
  storedValue: unknown,
  concernValue: unknown,
  actionValue: unknown,
  updatedAtValue?: unknown
): 'overdue' | 'open' | 'resolved' => {
  const storedStatus = String(storedValue || '').trim().toLowerCase();
  if (storedStatus === 'overdue' || storedStatus === 'open' || storedStatus === 'resolved') {
    return storedStatus;
  }

  const concern = String(concernValue || '').trim().toLowerCase();
  const action = String(actionValue || '').trim().toLowerCase();
  const hasFollowUpContent = concern.length > 0 || action.length > 0;

  if (!hasFollowUpContent) {
    return 'resolved';
  }

  const updatedAtSource: string | number | Date =
    updatedAtValue instanceof Date
      ? updatedAtValue
      : (typeof updatedAtValue === 'string' || typeof updatedAtValue === 'number')
        ? updatedAtValue
        : 0;

  const updatedAt = new Date(updatedAtSource).getTime();
  const ageDays = Number.isFinite(updatedAt) && updatedAt > 0
    ? Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24))
    : 0;

  if (ageDays > 14 || concern.includes('blocker') || concern.includes('risk')) {
    return 'overdue';
  }

  return 'open';
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER: Get Google Access Token
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const getAccessToken = async (token: string): Promise<string | null> => {
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    
    // Try SkyFlow users table first (unified auth stores Google token here)
    // Use getUserWithTokens to auto-refresh expired tokens
    try {
      // Quick check to avoid "User not found" logs for pure ScholarSync users
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.id]);
      if (userCheck.rows.length > 0) {
        const user = await GoogleAuthService.getUserWithTokens(decoded.id);
        if (user?.access_token) return user.access_token;
      }
    } catch (e) {
      // Fall through to ss_account on any failure
    }

    // Try ss_account next (ScholarSync-native users) — match by email since decoded.id is SkyFlow UUID
    const ssResult = await pool.query(
      'SELECT "googleAccessToken" FROM ss_account WHERE "accountEmail" = $1',
      [decoded.email]
    );
    if (ssResult.rows[0]?.googleAccessToken) {
      return ssResult.rows[0].googleAccessToken;
    }
    
    return null;
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

// Dashboard aggregate: Admin Data Integrity
router.get('/dashboard/admin-data-integrity', verifyAdmin, async (_req: Request, res: Response) => {
  try {
    const [coursesRes, accountsRes, groupsRes, consultationsRes, consultationCountRes, journalCountRes] = await Promise.all([
      pool.query(`SELECT id, "courseName", "courseCode", "courseSection" FROM ss_courses ORDER BY id DESC`),
      pool.query(`SELECT account_id, "accountName", "accountEmail", "accountRole" FROM ss_account ORDER BY "accountName"`),
      pool.query(
        `SELECT
           tg.id,
           tg.course_id,
           tg.name,
           tg.adviser_name,
           COALESCE(m.member_count, 0)::int AS member_count
         FROM team_groups tg
         LEFT JOIN (
           SELECT team_group_id, COUNT(*)::int AS member_count
           FROM team_group_members
           GROUP BY team_group_id
         ) m ON m.team_group_id = tg.id
         ORDER BY tg.course_id, tg.team_number, tg.name`
      ),
      pool.query(
        `SELECT DISTINCT "courseID", LOWER(TRIM(COALESCE("groupName", ''))) AS group_key
         FROM ss_consultation
         WHERE COALESCE(TRIM("groupName"), '') <> ''`
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM ss_consultation`),
      pool.query(`SELECT COUNT(*)::int AS total FROM member_journals`)
    ]);

    const courses = coursesRes.rows;
    const accounts = accountsRes.rows;
    const groups = groupsRes.rows;
    const consultationKeys = new Set(
      consultationsRes.rows.map((row: any) => `${Number(row.courseID)}::${String(row.group_key || '')}`)
    );

    const roleBreakdown = { Admin: 0, Advisers: 0, Student: 0 };
    for (const account of accounts) {
      const role = normalizeAcademicRole(account.accountRole);
      if (role === 'admin') roleBreakdown.Admin += 1;
      else if (role === 'advisers') roleBreakdown.Advisers += 1;
      else roleBreakdown.Student += 1;
    }

    const courseMap = new Map<number, any>();
    for (const course of courses) {
      courseMap.set(Number(course.id), {
        id: Number(course.id),
        courseName: course.courseName,
        courseCode: course.courseCode,
        courseSection: course.courseSection,
        groups: [] as any[]
      });
    }

    for (const group of groups) {
      const courseId = Number(group.course_id);
      if (!courseMap.has(courseId)) continue;
      courseMap.get(courseId).groups.push(group);
    }

    const issues: Array<{ severity: 'high' | 'medium' | 'low'; title: string; detail: string; courseId?: number }> = [];

    if (roleBreakdown.Admin === 0) {
      issues.push({ severity: 'high', title: 'No Admin Account', detail: 'At least one Admin account is required for governance.' });
    }

    for (const course of courseMap.values()) {
      if (!Array.isArray(course.groups) || course.groups.length === 0) {
        issues.push({
          severity: 'high',
          title: 'Course Has No Groups',
          detail: `${course.courseCode} (${course.courseSection}) has no groups configured.`,
          courseId: course.id
        });
        continue;
      }

      for (const group of course.groups) {
        const groupName = String(group.name || '').trim();
        const groupKey = `${course.id}::${groupName.toLowerCase()}`;

        if (!String(group.adviser_name || '').trim()) {
          issues.push({
            severity: 'high',
            title: 'Group Missing Adviser',
            detail: `${course.courseCode} · ${groupName || 'Unnamed Group'} has no adviser assignment.`,
            courseId: course.id
          });
        }

        if (Number(group.member_count || 0) === 0) {
          issues.push({
            severity: 'medium',
            title: 'Group Missing Members',
            detail: `${course.courseCode} · ${groupName || 'Unnamed Group'} has no enrolled members.`,
            courseId: course.id
          });
        }

        if (!consultationKeys.has(groupKey)) {
          issues.push({
            severity: 'low',
            title: 'No Consultation History',
            detail: `${course.courseCode} · ${groupName || 'Unnamed Group'} has no consultation logs yet.`,
            courseId: course.id
          });
        }
      }
    }

    const summary = {
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length
    };

    return res.json({
      courses,
      accounts,
      roleBreakdown,
      summary,
      issues,
      consultationLogs: Number(consultationCountRes.rows[0]?.total || 0),
      journalEntries: Number(journalCountRes.rows[0]?.total || 0)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load admin dashboard integrity data.' });
  }
});

// Dashboard aggregate: Admin Adviser Availability (by semester)
router.get('/dashboard/adviser-availability', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const requestedTerm = String(req.query.term || '').trim();

    const [termsRes, advisersRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT "courseTerm"
         FROM ss_courses
         WHERE COALESCE(TRIM("courseTerm"), '') <> ''
         ORDER BY "courseTerm" DESC`
      ),
      pool.query(
        `SELECT account_id, "accountName", "accountEmail", "accountRole"
         FROM ss_account
         WHERE LOWER(COALESCE("accountRole", '')) IN ('adviser', 'advisers', 'manager')
         ORDER BY "accountName" ASC NULLS LAST, "accountEmail" ASC`
      )
    ]);

    const terms = termsRes.rows.map((row: any) => String(row.courseTerm || '').trim()).filter(Boolean);
    const selectedTerm = requestedTerm || terms[0] || '';

    const advisers = advisersRes.rows.map((row: any) => ({
      accountId: row.account_id,
      name: String(row.accountName || '').trim() || String(row.accountEmail || '').split('@')[0],
      email: String(row.accountEmail || '').trim(),
      role: String(row.accountRole || 'Advisers').trim()
    }));

    if (!selectedTerm) {
      return res.json({
        terms,
        selectedTerm,
        advisers: advisers.map((adviser: any) => ({
          ...adviser,
          assignedCount: 0,
          availabilityStatus: 'Available',
          assignedGroups: []
        })),
        summary: {
          totalAdvisers: advisers.length,
          assignedAdvisers: 0,
          availableAdvisers: advisers.length,
          totalGroupsInTerm: 0,
          unassignedGroupsInTerm: 0,
          mappedGroupsInTerm: 0
        },
        unassignedGroups: [],
        unmappedAdviserLabels: []
      });
    }

    const groupsRes = await pool.query(
      `SELECT
         tg.id AS "groupId",
         tg.name AS "groupName",
         tg.adviser_name,
         tg.course_id AS "courseId",
         c."courseCode",
         c."courseSection",
         c."courseTerm"
       FROM team_groups tg
       JOIN ss_courses c ON c.id = tg.course_id
       WHERE c."courseTerm" = $1
       ORDER BY c."courseCode", c."courseSection", tg.team_number, tg.name`,
      [selectedTerm]
    );

    const groups = groupsRes.rows.map((row: any) => ({
      groupId: String(row.groupId || '').trim(),
      groupName: String(row.groupName || '').trim() || 'Unnamed Group',
      adviserLabel: String(row.adviser_name || '').trim(),
      courseId: Number(row.courseId),
      courseCode: String(row.courseCode || '').trim(),
      courseSection: String(row.courseSection || '').trim(),
      courseTerm: String(row.courseTerm || '').trim()
    }));

    const adviserByKeys = new Map<string, any>();
    for (const adviser of advisers) {
      const emailKey = adviser.email.toLowerCase();
      const nameKey = adviser.name.toLowerCase();
      if (emailKey) adviserByKeys.set(emailKey, adviser);
      if (nameKey) adviserByKeys.set(nameKey, adviser);
    }

    const adviserAssignments = new Map<string, any[]>();
    for (const adviser of advisers) {
      adviserAssignments.set(adviser.email.toLowerCase(), []);
    }

    const unassignedGroups: any[] = [];
    const unmappedAdviserLabels = new Set<string>();
    let mappedGroupsCount = 0;

    for (const group of groups) {
      const label = group.adviserLabel.toLowerCase();
      if (!label) {
        unassignedGroups.push(group);
        continue;
      }

      const matched = adviserByKeys.get(label);
      if (!matched) {
        unmappedAdviserLabels.add(group.adviserLabel);
        continue;
      }

      mappedGroupsCount += 1;
      const key = matched.email.toLowerCase();
      adviserAssignments.get(key)?.push({
        groupId: group.groupId,
        groupName: group.groupName,
        courseId: group.courseId,
        courseCode: group.courseCode,
        courseSection: group.courseSection,
        courseTerm: group.courseTerm
      });
    }

    const adviserAvailability = advisers.map((adviser) => {
      const assignedGroups = adviserAssignments.get(adviser.email.toLowerCase()) || [];
      return {
        ...adviser,
        assignedCount: assignedGroups.length,
        availabilityStatus: assignedGroups.length > 0 ? 'Assigned' : 'Available',
        assignedGroups
      };
    });

    const assignedAdvisers = adviserAvailability.filter((adviser) => adviser.assignedCount > 0).length;

    return res.json({
      terms,
      selectedTerm,
      advisers: adviserAvailability,
      summary: {
        totalAdvisers: adviserAvailability.length,
        assignedAdvisers,
        availableAdvisers: adviserAvailability.length - assignedAdvisers,
        totalGroupsInTerm: groups.length,
        unassignedGroupsInTerm: unassignedGroups.length,
        mappedGroupsInTerm: mappedGroupsCount
      },
      unassignedGroups,
      unmappedAdviserLabels: Array.from(unmappedAdviserLabels).sort((a, b) => a.localeCompare(b))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load adviser availability dashboard data.' });
  }
});

// Dashboard aggregate: Admin Semester Readiness Checklist (by term)
router.get('/dashboard/semester-readiness', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const requestedTerm = String(req.query.term || '').trim();

    const [termsRes, advisersRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT "courseTerm"
         FROM ss_courses
         WHERE COALESCE(TRIM("courseTerm"), '') <> ''
         ORDER BY "courseTerm" DESC`
      ),
      pool.query(
        `SELECT account_id, "accountName", "accountEmail"
         FROM ss_account
         WHERE LOWER(COALESCE("accountRole", '')) IN ('adviser', 'advisers', 'manager')`
      )
    ]);

    const terms = termsRes.rows.map((row: any) => String(row.courseTerm || '').trim()).filter(Boolean);
    const selectedTerm = requestedTerm || terms[0] || '';

    if (!selectedTerm) {
      return res.json({
        terms,
        selectedTerm,
        summary: {
          coursesInTerm: 0,
          groupsInTerm: 0,
          advisersInSystem: advisersRes.rows.length,
          assignedAdvisersInTerm: 0,
          availableAdvisersInTerm: advisersRes.rows.length,
          readinessScore: 100
        },
        checklist: {
          coursesWithoutGroups: [],
          groupsWithoutAdviser: [],
          groupsWithoutMembers: [],
          groupsWithoutConsultation: []
        }
      });
    }

    const coursesRes = await pool.query(
      `SELECT id, "courseName", "courseCode", "courseSection", "courseTerm"
       FROM ss_courses
       WHERE "courseTerm" = $1
       ORDER BY "courseCode", "courseSection"`,
      [selectedTerm]
    );

    const courses = coursesRes.rows;
    const courseIds = courses.map((course: any) => Number(course.id)).filter(Number.isFinite);

    if (courseIds.length === 0) {
      return res.json({
        terms,
        selectedTerm,
        summary: {
          coursesInTerm: 0,
          groupsInTerm: 0,
          advisersInSystem: advisersRes.rows.length,
          assignedAdvisersInTerm: 0,
          availableAdvisersInTerm: advisersRes.rows.length,
          readinessScore: 100
        },
        checklist: {
          coursesWithoutGroups: [],
          groupsWithoutAdviser: [],
          groupsWithoutMembers: [],
          groupsWithoutConsultation: []
        }
      });
    }

    const [groupsRes, consultationsRes] = await Promise.all([
      pool.query(
        `SELECT
           tg.id AS "groupId",
           tg.name AS "groupName",
           tg.adviser_name,
           tg.course_id AS "courseId",
           c."courseCode",
           c."courseSection",
           COALESCE(m.member_count, 0)::int AS member_count
         FROM team_groups tg
         JOIN ss_courses c ON c.id = tg.course_id
         LEFT JOIN (
           SELECT team_group_id, COUNT(*)::int AS member_count
           FROM team_group_members
           GROUP BY team_group_id
         ) m ON m.team_group_id = tg.id
         WHERE tg.course_id = ANY($1::int[])
         ORDER BY c."courseCode", c."courseSection", tg.team_number, tg.name`,
        [courseIds]
      ),
      pool.query(
        `SELECT DISTINCT "courseID", LOWER(TRIM(COALESCE("groupName", ''))) AS group_key
         FROM ss_consultation
         WHERE "courseID" = ANY($1::int[])
           AND COALESCE(TRIM("groupName"), '') <> ''`,
        [courseIds]
      )
    ]);

    const groups = groupsRes.rows;
    const consultationKeys = new Set(
      consultationsRes.rows.map((row: any) => `${Number(row.courseID)}::${String(row.group_key || '')}`)
    );

    const coursesWithoutGroups = courses
      .filter((course: any) => !groups.some((group: any) => Number(group.courseId) === Number(course.id)))
      .map((course: any) => ({
        courseId: Number(course.id),
        courseCode: String(course.courseCode || ''),
        courseSection: String(course.courseSection || ''),
        courseName: String(course.courseName || '')
      }));

    const groupsWithoutAdviser = groups
      .filter((group: any) => !String(group.adviser_name || '').trim())
      .map((group: any) => ({
        groupId: String(group.groupId || '').trim(),
        groupName: String(group.groupName || 'Unnamed Group'),
        courseId: Number(group.courseId),
        courseCode: String(group.courseCode || ''),
        courseSection: String(group.courseSection || '')
      }));

    const groupsWithoutMembers = groups
      .filter((group: any) => Number(group.member_count || 0) === 0)
      .map((group: any) => ({
        groupId: String(group.groupId || '').trim(),
        groupName: String(group.groupName || 'Unnamed Group'),
        courseId: Number(group.courseId),
        courseCode: String(group.courseCode || ''),
        courseSection: String(group.courseSection || ''),
        memberCount: Number(group.member_count || 0)
      }));

    const groupsWithoutConsultation = groups
      .filter((group: any) => {
        const key = `${Number(group.courseId)}::${String(group.groupName || '').trim().toLowerCase()}`;
        return !consultationKeys.has(key);
      })
      .map((group: any) => ({
        groupId: String(group.groupId || '').trim(),
        groupName: String(group.groupName || 'Unnamed Group'),
        courseId: Number(group.courseId),
        courseCode: String(group.courseCode || ''),
        courseSection: String(group.courseSection || '')
      }));

    const adviserEmails = new Set(
      advisersRes.rows.map((adviser: any) => String(adviser.accountEmail || '').trim().toLowerCase()).filter(Boolean)
    );

    const assignedAdviserKeys = new Set<string>();
    for (const group of groups) {
      const label = String(group.adviser_name || '').trim().toLowerCase();
      if (!label) continue;
      if (adviserEmails.has(label)) assignedAdviserKeys.add(label);
    }

    const penalty =
      coursesWithoutGroups.length * 12 +
      groupsWithoutAdviser.length * 6 +
      groupsWithoutMembers.length * 6 +
      groupsWithoutConsultation.length * 3;
    const readinessScore = Math.max(0, Math.min(100, 100 - penalty));

    return res.json({
      terms,
      selectedTerm,
      summary: {
        coursesInTerm: courses.length,
        groupsInTerm: groups.length,
        advisersInSystem: advisersRes.rows.length,
        assignedAdvisersInTerm: assignedAdviserKeys.size,
        availableAdvisersInTerm: Math.max(0, advisersRes.rows.length - assignedAdviserKeys.size),
        readinessScore
      },
      checklist: {
        coursesWithoutGroups,
        groupsWithoutAdviser,
        groupsWithoutMembers,
        groupsWithoutConsultation
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load semester readiness checklist data.' });
  }
});

// Dashboard aggregate: Adviser Follow-up Queue
router.get('/dashboard/adviser-followups', verifyInstructor, async (req: Request, res: Response) => {
  try {
    const user: any = (req as any).user || {};
    const email = String(user?.email || '').toLowerCase().trim();
    const name = String(user?.name || '').toLowerCase().trim();

    let role = normalizeAcademicRole(user?.role);
    if (email) {
      try {
        const roleRes = await pool.query(
          'SELECT "accountRole" FROM ss_account WHERE LOWER("accountEmail") = LOWER($1) LIMIT 1',
          [email]
        );
        if (roleRes.rows.length > 0) {
          role = normalizeAcademicRole(roleRes.rows[0].accountRole);
        }
      } catch {
        // keep role from token fallback
      }
    }

    let courses: any[] = [];
    if (role === 'admin') {
      const coursesRes = await pool.query(
        `SELECT id, "courseName", "courseCode"
         FROM ss_courses
         ORDER BY id DESC`
      );
      courses = coursesRes.rows;
    } else {
      const coursesRes = await pool.query(
        `SELECT DISTINCT c.id, c."courseName", c."courseCode"
         FROM ss_courses c
         LEFT JOIN team_groups tg ON tg.course_id = c.id
         WHERE LOWER(COALESCE(c."courseAdviser", '')) = $1
            OR LOWER(COALESCE(tg.adviser_name, '')) = $1
            OR LOWER(COALESCE(tg.adviser_name, '')) = $2
         ORDER BY c.id DESC`,
        [email, name]
      );
      courses = coursesRes.rows;
    }

    const courseIds = courses.map((course: any) => Number(course.id)).filter(Number.isFinite);
    if (courseIds.length === 0) {
      return res.json({ items: [] });
    }

    const [groupsRes, consultationsRes] = await Promise.all([
      pool.query(
        `SELECT tg.id, tg.name AS "groupName", tg.course_id AS "courseId", c."courseCode"
         FROM team_groups tg
         JOIN ss_courses c ON c.id = tg.course_id
         WHERE tg.course_id = ANY($1::int[])
         ORDER BY tg.course_id, tg.team_number, tg.name`,
        [courseIds]
      ),
      pool.query(
        `SELECT
           "conID",
           "courseID",
           "groupName",
           "conAction",
           "conConcerns",
           COALESCE(follow_up_status, '') as follow_up_status,
           submitted_at,
           updated_at,
           created_at,
           "conDate"
         FROM ss_consultation
         WHERE "courseID" = ANY($1::int[])
         ORDER BY COALESCE(submitted_at, updated_at, created_at) DESC NULLS LAST, "conID" DESC`,
        [courseIds]
      )
    ]);

    const latestByGroupKey = new Map<string, any>();
    for (const log of consultationsRes.rows) {
      const key = `${Number(log.courseID)}::${String(log.groupName || '').trim().toLowerCase()}`;
      if (!key.endsWith('::')) {
        if (!latestByGroupKey.has(key)) {
          latestByGroupKey.set(key, log);
        }
      }
    }

    const daysSince = (value: any): number => {
      const ts = new Date(value || 0).getTime();
      if (!Number.isFinite(ts) || ts <= 0) return 999;
      return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    };

    const items = groupsRes.rows.map((group: any) => {
      const key = `${Number(group.courseId)}::${String(group.groupName || '').trim().toLowerCase()}`;
      const latest = latestByGroupKey.get(key);

      if (!latest) {
        return {
          id: `${group.id}-no-log`,
          groupId: String(group.id),
          groupName: String(group.groupName || 'Unnamed Group'),
          courseId: Number(group.courseId),
          courseCode: String(group.courseCode || 'Course'),
          concern: 'No consultation logs yet.',
          action: 'Schedule and complete an initial consultation.',
          status: 'overdue',
          updatedAt: ''
        };
      }

      const updatedAt = String(latest.submitted_at || latest.updated_at || latest.created_at || latest.conDate || '');
      const concern = String(latest.conConcerns || '').trim();
      const action = String(latest.conAction || '').trim();
      const ageDays = daysSince(updatedAt);

      const status = inferFollowUpStatus(
        latest.follow_up_status,
        latest.conConcerns,
        latest.conAction,
        updatedAt
      );

      return {
        id: `${group.id}-${latest.conID || 'latest'}`,
        consultationId: Number(latest.conID || 0),
        groupId: String(group.id),
        groupName: String(group.groupName || 'Unnamed Group'),
        courseId: Number(group.courseId),
        courseCode: String(group.courseCode || 'Course'),
        concern: concern || 'No concern details entered.',
        action: action || 'No action item provided.',
        status,
        updatedAt
      };
    });

    items.sort((a: any, b: any) => {
      const score = (status: string) => (status === 'overdue' ? 2 : status === 'open' ? 1 : 0);
      const scoreDiff = score(b.status) - score(a.status);
      if (scoreDiff !== 0) return scoreDiff;
      return daysSince(b.updatedAt) - daysSince(a.updatedAt);
    });

    return res.json({ items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load adviser follow-up queue.' });
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
      // If the requester is an adviser, only return groups assigned to that adviser
      if (account && (account.accountRole === 'Adviser' || account.accountRole === 'Advisers')) {
        const adviserEmail = String(account.accountEmail || '').toLowerCase().trim();
        const adviserName = String(account.accountName || '').toLowerCase().trim();
        const { rows } = await pool.query(
          `SELECT id, name as "groupName", team_number, adviser_name as adviser, proposed_project,
                  consultation_dates, comments, grade, course_id as "courseID"
           FROM team_groups WHERE course_id = $1 AND (LOWER(COALESCE(adviser_name, '')) = $2 OR LOWER(COALESCE(adviser_name, '')) = $3) ORDER BY team_number`,
          [req.params.id, adviserEmail, adviserName]
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

    // Enrich groups with members (like /group-members endpoint)
    const enrichedGroups = await Promise.all(allGroups.map(async (g: any) => {
      const { rows: members } = await pool.query(
        `SELECT member_number, name, email, is_leader FROM team_group_members WHERE team_group_id = $1 ORDER BY member_number`,
        [g.id]
      );
      return { ...g, groupMembers: members.length, members };
    }));

    if (role === 'Admin') {
      return res.json({ teams: enrichedGroups, userRole: 'admin', viewType: 'all' });
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
        // Return only groups that match the adviser (server-side filter)
        const adviserGroups = enrichedGroups.filter((g: any) => {
          const adv = String(g.adviser || '').toLowerCase().trim();
          return adv === adviserEmail || adv === adviserName;
        });
        return res.json({ teams: adviserGroups, userRole: 'adviser', viewType: 'advised' });
      }
      return res.json({ teams: [], userRole: 'adviser', viewType: 'none' });
    } else {
      const studentGroup = account.accountGroup;
      if (studentGroup) {
        const myTeam = enrichedGroups.filter((g: any) => g.groupName === studentGroup);
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
    const groupId = String(req.params.id || '').trim();
    if (!groupId || groupId === 'null' || groupId === 'undefined') {
      return res.status(400).json({ error: 'Invalid group id' });
    }
    const { rows: groups } = await pool.query(
      `SELECT id as "groupID", name as "groupName", team_number, adviser_name as adviser, proposed_project,
              consultation_dates, comments, grade, course_id as "courseID"
       FROM team_groups WHERE id = $1`,
      [groupId]
    );
    if (groups.length === 0) return res.status(404).json({ error: "Group not found" });
    const group = groups[0];

    const { rows: members } = await pool.query(
      `SELECT member_number, name, email, is_leader FROM team_group_members WHERE team_group_id = $1 ORDER BY member_number`,
      [groupId]
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
    return res.json({ comments: rows });
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
    return res.json({ comment: rows[0] });
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

  // Note: Include both Google Sheets and MS Excel formats
  const DRIVE_URL = `https://www.googleapis.com/drive/v3/files?q=(mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27%20or%20mimeType%3D%27application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet%27%20or%20mimeType%3D%27application%2Fvnd.ms-excel%27)&pageSize=50&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,owners)`;

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
    let importerName = String(user.name || user.email || '').trim() || 'Imported by';

    // Helper: find the actual header row (scans until it finds a row with a cell === 'TEAM CODE' or 'GROUP')
    const findHeaderRow = (rows: any[][]): { headers: string[]; dataRows: any[][] } | null => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const hasTeamCode = row.some((cell: any) => {
          if (cell === null || cell === undefined) return false;
          const v = cell.toString().trim().toUpperCase();
          return ['TEAM CODE', 'TEAMCODE', 'GROUP', 'GROUP NAME'].includes(v);
        });
        if (hasTeamCode) {
          return {
            headers: row.map((h: any) => (h || '').toString().trim()),
            dataRows: rows.slice(i + 1)
          };
        }
      }
      return null;
    };

    // Try Google Sheets API first (private sheets) or Google Drive directly for Excel
    if (accessToken) {
      let mimeType = 'application/vnd.google-apps.spreadsheet';
      try {
        const metaDriveRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${sheetId}?fields=name,mimeType`, { headers: { Authorization: `Bearer ${accessToken}` } });
        sheetTitle = metaDriveRes.data?.name || sheetTitle;
        mimeType = metaDriveRes.data?.mimeType || mimeType;
      } catch (e: any) {
         logger.info('Could not get Drive metadata, assuming Google Sheets');
      }

      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
         try {
            const fileRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${sheetId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer'
            });
            const xlsx = require('xlsx');
            const workbook = xlsx.read(fileRes.data, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const values: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            const found = findHeaderRow(values);
            if (found && found.dataRows.length > 0) {
              records = found.dataRows
                .filter((row: any[]) => row.some((cell: any) => cell && cell.toString().trim() !== ''))
                .map((row: any[]) => {
                  const obj: any = {};
                  found.headers.forEach((h: string, i: number) => { obj[h] = (row[i] ?? '').toString().trim(); });
                  return obj;
                });
            }
         } catch(e: any) {
             logger.error('Excel processing failed:', e.message);
         }
      } else {
         // Google Sheets API as normal
         try {
           const dataRes = await axios.get(
             `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1000`,
             { headers: { Authorization: `Bearer ${accessToken}` } }
           );
           const values: any[][] = dataRes.data.values || [];
           const found = findHeaderRow(values);
           if (found && found.dataRows.length > 0) {
             records = found.dataRows
               .filter((row: any[]) => row.some((cell: any) => cell && cell.toString().trim() !== ''))
               .map((row: any[]) => {
                 const obj: any = {};
                 found.headers.forEach((h: string, i: number) => { obj[h] = (row[i] ?? '').toString().trim(); });
                 return obj;
               });
           }
         } catch (e: any) {
           logger.info('Sheets API failed, falling back to CSV:', e.message);
         }
      }
    }

    // Fallback: public CSV
    if (records.length === 0) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const response = await axios.get(csvUrl, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {});
      const rawRows: any[][] = parse(response.data, { columns: false, skip_empty_lines: false, relax_column_count: true });
      const found = findHeaderRow(rawRows);
      if (found && found.dataRows.length > 0) {
        records = found.dataRows
          .filter(row => row.some((cell: any) => cell && cell.toString().trim() !== ''))
          .map(row => {
            const obj: any = {};
            found.headers.forEach((h: string, i: number) => { obj[h] = (row[i] ?? '').toString().trim(); });
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
      const email = findCol(row, 'EMAIL @gmail', 'EMAIL @cit', 'EMAIL @', 'EMAIL', 'Email', 'email');
      const fullName = findCol(row, 'FIRSTNAME', 'First Name', 'Full name', 'Full Name', 'Name', 'LASTNAME', 'Lastname');
      const lastName = findCol(row, 'LASTNAME', 'Lastname', 'Last Name');
      const firstName = findCol(row, 'FIRSTNAME', 'Firstname', 'First Name');
      const studentId = findCol(row, 'STUDENT ID', 'Student ID', 'student_id', 'ID');
      const memberNum = parseInt(findCol(row, 'MEMBER #', 'Member #', 'member', 'Member') || '0', 10);
      const adviserEmail = findCol(row, 'ADVISER Email', 'ADVISER EMAIL', 'Adviser Email', 'Advisor Email', 'advisor email');
      const adviser = findCol(row, 'ADVISER', 'Adviser', 'advisor', 'Advisor');
      const proposedProject = findCol(row, 'PROPOSED PROJECT', 'Proposed Project', 'Project', 'project');

      if (!teamCode) continue;
      // Use student ID as email fallback if email column is empty
      const resolvedEmail = email || (studentId ? `${studentId}@scholarflow.local` : '');

      const parsed = parseTeamCode(teamCode);
      if (!parsed) continue;

      const key = parsed.courseKey;
      if (!courseMap[key]) {
        courseMap[key] = { parsed, groups: {} };
      }

      const displayName = fullName || (firstName && lastName ? `${firstName} ${lastName}` : resolvedEmail.split('@')[0]);

      const currentCourse = courseMap[key]!;
      if (!currentCourse.groups[parsed.groupName]) {
        currentCourse.groups[parsed.groupName] = { members: [], adviser: '', proposedProject: '' };
      }

      const currentGroup = currentCourse.groups[parsed.groupName]!;
      currentGroup.members.push({
        email: resolvedEmail,
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
    const importedAdvisors: { email: string; name: string }[] = [];

    try {
      await client.query('BEGIN');

      const importerRes = await client.query(
        'SELECT "accountName" FROM ss_account WHERE LOWER("accountEmail") = LOWER($1) LIMIT 1',
        [user.email]
      );
      importerName = String(importerRes.rows[0]?.accountName || importerName).trim() || importerName;

      // Sync Adviser roles in ss_account
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
          await client.query(
            'UPDATE ss_courses SET "courseImportedBy" = $1 WHERE id = $2',
            [importerName, courseId]
          );
        } else {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          const suffix = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
          const uniqueKey = `${parsed.courseKey.substring(0, 16)}-${suffix}`;

          const newCourse = await client.query(
            `INSERT INTO ss_courses ("courseName", "courseCode", "courseSection", "courseTerm", "courseKey", "courseAmount", "courseAdviser", "courseImportedBy")
             VALUES ($1, $2, \'\', $3, $4, 0, $5, $6) RETURNING id`,
            [parsed.courseName, parsed.courseCode, parsed.courseTerm, uniqueKey, detectedCourseAdviser || user.email || null, importerName]
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

        // --- Role Merge: Ensure all course advisers are synced to the organization as 'manager' ---
        const courseAdvisers = new Map<string, string>();
        for (const group of Object.values(groups)) {
          if (group.adviser && group.adviser.includes('@')) {
            // Extracted name format varies, but we can default to the split or capture from another source later.
            // We use the email prefix if no formal name was captured separately for the advisor.
            courseAdvisers.set(group.adviser.toLowerCase().trim(), group.adviser.split('@')[0]);
          }
        }

        for (const [advEmail, advName] of courseAdvisers.entries()) {
          // Track for emails later
          importedAdvisors.push({ email: advEmail, name: advName });

          // Upsert adviser into users table
          const advUserRes = await client.query(
            `INSERT INTO users (google_id, email, name, created_at)
             VALUES ($1, $1, $2, NOW())
             ON CONFLICT (email) DO UPDATE SET google_id = COALESCE(users.google_id, EXCLUDED.google_id)
             RETURNING id`,
            [advEmail, advName]
          );
          const advUserId = advUserRes.rows[0].id;

          // Add to organization as 'manager' (Merging concept of Adviser and Workspace Manager)
          await client.query(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'manager', 'active', NOW())
             ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'manager', status = 'active'`,
            [orgId, advUserId]
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
              `INSERT INTO users (google_id, email, name, created_at)
               VALUES ($1, $2, $3, NOW())
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
            // TEMPORARY BYPASS FOR TESTING: Always send emails even if they have an account
            // if (existingEmails.has(emailLower) && !forceReplace) {
            //   skippedCount++;
            //   continue; // Already has an account — skip
            // }

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

            // 5 second delay to comfortably bypass Resend's 2 request/sec rate limit
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          logger.info(`📨 Import invitations: ${sentCount} sent, ${skippedCount} skipped (existing accounts)`);
        } catch (emailErr: any) {
          logger.error('Error sending import invitation emails:', emailErr);
        }
      });
    }

    if (importedAdvisors.length > 0) {
      setImmediate(async () => {
        try {
          const uniqueAdvisors = Array.from(new Map(importedAdvisors.map(a => [a.email, a])).values());
          const allAdvEmails = uniqueAdvisors.map(a => a.email);
          const existingRes = await pool.query(
            `SELECT LOWER("accountEmail") as email FROM ss_account WHERE LOWER("accountEmail") = ANY($1::text[])`,
            [allAdvEmails]
          );
          const existingEmails = new Set(existingRes.rows.map((r: any) => r.email));

          let sentCount = 0;
          let skippedCount = 0;

          for (const advisor of uniqueAdvisors) {
            const emailLower = advisor.email.toLowerCase().trim();
            // TEMPORARY BYPASS FOR TESTING
            // if (existingEmails.has(emailLower) && !forceReplace) {
            //   skippedCount++;
            //   continue; // Existed before, do not spam
            // }

            const result = await sendAdvisorImportEmail({
              to: advisor.email,
              advisorName: advisor.name || advisor.email.split('@')[0],
            });

            if (result.success) sentCount++;
            else logger.warn(`⚠️ Failed to send advisor import email to ${advisor.email}: ${result.error}`);

            // 5 second delay between emails
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          logger.info(`📨 Advisor Import Emails — Sent: ${sentCount}, Skipped (Existing Users): ${skippedCount}`);
        } catch (emailErr: any) {
          logger.error('Error in advisor async email loop:', emailErr);
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

// ═══════════════════════════════════════════════════════════════════════════════════
// CONSULTATION PREP CHECKLIST AGGREGATE
// ═══════════════════════════════════════════════════════════════════════════════════
// GET /scholar/consultation/prep/:bookingId
// Aggregates all prep data: group info, recent journals, outstanding follow-ups, consultation history, attendance/participation
router.get('/consultation/prep/:bookingId', verifyInstructor, async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) return res.status(400).json({ error: 'Missing booking ID' });

    // Get booking details (consultation slot)
    const bookingRes = await pool.query(
      `SELECT
         s.slot_id,
         s.slot_date,
         s.start_time,
         s.end_time,
         s.max_groups AS capacity,
         s.owner_account_id,
         COALESCE(a."accountName", 'Unknown Adviser') as adviser_name,
         COALESCE(a."accountEmail", '') as adviser_email
       FROM ss_consultation_slots s
       LEFT JOIN ss_account a ON a.account_id = s.owner_account_id
       WHERE s.slot_id = $1
       LIMIT 1`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consultation slot not found' });
    }

    const booking = bookingRes.rows[0];

    // Get booked groups for this slot from bookings table (consultation logs may not exist yet)
    const bookedGroupsRes = await pool.query(
      `SELECT DISTINCT
         b.group_id AS booking_group_id,
         b.group_name AS booking_group_name,
         b.course_id AS booking_course_id,
         tg.id AS team_group_id,
         tg.name AS team_group_name,
         tg.course_id AS team_course_id,
         tg.adviser_name,
         tg.proposed_project,
         sc.id AS course_id,
         sc."courseName",
         sc."courseCode",
         sc."courseSection"
       FROM ss_consultation_bookings b
       LEFT JOIN team_groups tg
         ON LOWER(TRIM(COALESCE(tg.name, ''))) = LOWER(TRIM(COALESCE(b.group_name, '')))
        AND (b.course_id IS NULL OR tg.course_id = b.course_id)
       LEFT JOIN ss_courses sc ON sc.id = COALESCE(b.course_id, tg.course_id)
       WHERE b.slot_id = $1
         AND UPPER(COALESCE(b.status, 'CONFIRMED')) <> 'CANCELLED'
       LIMIT 5`,
      [bookingId]
    );

    const bookedGroups = bookedGroupsRes.rows;

    if (bookedGroups.length === 0) {
      return res.status(404).json({ error: 'No group bookings found for this slot' });
    }

    // Use the first booked group as the primary group to prep for
    const primaryGroup = bookedGroups[0];
    let groupId = String(primaryGroup.team_group_id || primaryGroup.booking_group_id || '').trim() || null;
    let groupName = String(primaryGroup.team_group_name || primaryGroup.booking_group_name || '').trim();
    let courseId = Number(primaryGroup.team_course_id || primaryGroup.booking_course_id || 0) || null;

    // Fallback resolver when booking rows have legacy/non-team group ids
    if (!groupId && groupName) {
      const fallbackGroupRes = await pool.query(
        `SELECT id, course_id, name, adviser_name, proposed_project
         FROM team_groups
         WHERE LOWER(TRIM(name)) = LOWER($1)
         ORDER BY CASE WHEN course_id = $2 THEN 0 ELSE 1 END, id
         LIMIT 1`,
        [groupName, courseId || 0]
      );

      if (fallbackGroupRes.rows.length > 0) {
        const fallback = fallbackGroupRes.rows[0];
        groupId = String(fallback.id || groupId || '').trim() || groupId;
        courseId = Number(fallback.course_id || courseId || 0) || courseId;
        groupName = String(fallback.name || groupName);
      }
    }

    // Get group members
    const membersRes = groupId
      ? await pool.query(
          `SELECT member_number, name, email, is_leader
           FROM team_group_members
           WHERE team_group_id = $1
           ORDER BY member_number`,
          [groupId]
        )
      : { rows: [] as any[] };

    const members = membersRes.rows.map((m: any) => ({
      memberNumber: m.member_number,
      name: m.name,
      email: m.email,
      isLeader: m.is_leader
    }));

    // Get recent member journals (last 5)
    const journalsRes = groupId
      ? await pool.query(
          `SELECT
             id,
             member_email,
             journal_date as consultation_date,
             journal_text as summary,
             created_at
           FROM member_journals
           WHERE LOWER(group_id::text) = LOWER($1)
           ORDER BY created_at DESC
           LIMIT 5`,
          [groupId]
        )
      : { rows: [] as any[] };

    const journals = journalsRes.rows;

    // Get recent consultation logs (last 5) for this group
    const consultationLogsRes = await pool.query(
      `SELECT
         c."conID",
         c."conDate" as consultation_date,
         c."conSum" as summary,
         c."conAction" as action,
         c."conConcerns" as concerns,
         COALESCE(c.follow_up_status, '') as follow_up_status,
         COALESCE(
           to_jsonb(c)->>'conAtt',
           to_jsonb(c)->>'attendance_data',
           ''
         ) as attendance,
         c.submitted_at,
         c.created_at
       FROM ss_consultation c
       WHERE LOWER(TRIM(COALESCE(c."groupName", ''))) = LOWER($1)
       ORDER BY COALESCE(c.submitted_at, c.created_at) DESC
       LIMIT 5`,
      [String(groupName || '').trim().toLowerCase()]
    );

    const consultationLogs = consultationLogsRes.rows;

    // Get outstanding follow-ups for this group (from follow-ups queue logic)
    const daysSince = (value: any): number => {
      const ts = new Date(value || 0).getTime();
      if (!Number.isFinite(ts) || ts <= 0) return 999;
      return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    };

    let outstandingFollowUps: any[] = [];
    if (consultationLogs.length > 0) {
      const latest = consultationLogs[0];
      const concern = String(latest.concerns || '').trim();
      const action = String(latest.action || '').trim();
      const updatedAt = latest.submitted_at || latest.created_at;
      const ageDays = daysSince(updatedAt);

      const status = inferFollowUpStatus(
        latest.follow_up_status,
        latest.concerns,
        latest.action,
        updatedAt
      );

      if (status !== 'resolved') {
        outstandingFollowUps.push({
          id: latest.conID,
          consultationId: latest.conID,
          concern: concern || 'No concern details entered.',
          action: action || 'No action item provided.',
          status,
          lastUpdated: updatedAt,
          daysSince: ageDays
        });
      }
    }

    // Build participation summary from consultation JSON snapshots saved by feedback endpoint.
    const participationRes = await pool.query(
      `SELECT
         "conID",
         "conDate" as consultation_date,
         COALESCE(attendance_data, '{}'::jsonb) as attendance_data,
         COALESCE(participation_data, '{}'::jsonb) as participation_data
       FROM ss_consultation
       WHERE LOWER(TRIM(COALESCE("groupName", ''))) = LOWER($1)
       ORDER BY "conDate" DESC, "conID" DESC
       LIMIT 20`,
      [String(groupName || '').trim().toLowerCase()]
    );

    const participationRows = participationRes.rows;

    const participationScoreFromText = (value: unknown): number => {
      const text = String(value || '').trim().toLowerCase();
      if (!text) return 0;

      const numeric = Number(text.replace('%', ''));
      if (Number.isFinite(numeric)) {
        return numeric > 1 ? Math.max(0, Math.min(1, numeric / 100)) : Math.max(0, Math.min(1, numeric));
      }

      if (['excellent', 'very high', 'high', 'active', 'engaged'].some((k) => text.includes(k))) return 1;
      if (['good', 'moderate', 'average', 'participated'].some((k) => text.includes(k))) return 0.75;
      if (['fair', 'low', 'passive'].some((k) => text.includes(k))) return 0.5;
      if (['poor', 'minimal'].some((k) => text.includes(k))) return 0.25;
      if (['absent', 'none', 'no show', 'did not attend'].some((k) => text.includes(k))) return 0;

      return 0.5;
    };

    const isAttendedFromText = (value: unknown): boolean => {
      const text = String(value || '').trim().toLowerCase();
      if (!text) return false;
      return !['absent', 'none', 'no show', 'did not attend', 'n/a'].some((k) => text.includes(k));
    };

    const statsByMemberNumber = new Map<number, {
      consultations: number;
      attended: number;
      scoreTotal: number;
      scoreCount: number;
      lastConsultation: string;
    }>();

    const getValueForMember = (obj: any, keys: string[]): string => {
      if (!obj || typeof obj !== 'object') return '';
      const direct = Object.entries(obj as Record<string, unknown>);
      for (const key of keys) {
        const exact = (obj as Record<string, unknown>)[key];
        if (exact !== undefined && exact !== null) return String(exact);
      }
      for (const [rawKey, rawValue] of direct) {
        const normalized = String(rawKey || '').trim().toLowerCase();
        if (keys.includes(normalized) && rawValue !== undefined && rawValue !== null) {
          return String(rawValue);
        }
      }
      return '';
    };

    for (const row of participationRows) {
      const attendanceData = row.attendance_data || {};
      const participationDataRow = row.participation_data || {};

      for (const member of members) {
        const memberNumber = Number(member.memberNumber || 0);
        if (!Number.isFinite(memberNumber) || memberNumber <= 0) continue;

        const memberName = String(member.name || '').trim().toLowerCase();
        const memberEmail = String(member.email || '').trim().toLowerCase();
        const memberAlias = memberEmail.includes('@') ? memberEmail.split('@')[0] : memberEmail;
        const lookupKeys = [memberName, memberEmail, memberAlias].filter(Boolean);

        const attendanceValue = getValueForMember(attendanceData, lookupKeys);
        const participationValue = getValueForMember(participationDataRow, lookupKeys);

        const existing = statsByMemberNumber.get(memberNumber) || {
          consultations: 0,
          attended: 0,
          scoreTotal: 0,
          scoreCount: 0,
          lastConsultation: '',
        };

        existing.consultations += 1;

        if (attendanceValue) {
          const attendanceText = attendanceValue.trim().toLowerCase();
          if (attendanceText === 'present' || attendanceText === 'attended' || attendanceText === 'yes') {
            existing.attended += 1;
          }
        } else if (isAttendedFromText(participationValue)) {
          existing.attended += 1;
        }

        if (String(participationValue || '').trim()) {
          const score = participationScoreFromText(participationValue);
          existing.scoreTotal += score;
          existing.scoreCount += 1;
        }

        if (!existing.lastConsultation && row.consultation_date) {
          existing.lastConsultation = String(row.consultation_date);
        }

        statsByMemberNumber.set(memberNumber, existing);
      }
    }

    const participationData = members.map((member: any) => {
      const stat = statsByMemberNumber.get(Number(member.memberNumber || 0));
      const totalConsultations = stat?.consultations || 0;
      const totalAttended = stat?.attended || 0;
      const attendanceRate = totalConsultations > 0 ? (totalAttended / totalConsultations) * 100 : 0;
      const participationAvg = (stat?.scoreCount || 0) > 0 ? (stat!.scoreTotal / stat!.scoreCount) : 0;

      return {
        member_id: Number(member.memberNumber || 0),
        member_email: String(member.email || ''),
        total_consultations: totalConsultations,
        total_attended: totalAttended,
        attendance_rate: attendanceRate,
        participation_avg: participationAvg,
        last_consultation: stat?.lastConsultation || null,
      };
    });

    return res.json({
      consultation: {
        slotId: booking.slot_id,
        slotDate: booking.slot_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        capacity: booking.capacity,
        adviserName: booking.adviser_name,
        adviserEmail: booking.adviser_email
      },
      group: {
        id: groupId,
        courseId: Number(primaryGroup.course_id || courseId || primaryGroup.courseId || 0) || null,
        name: groupName,
        courseName: primaryGroup.courseName,
        courseCode: primaryGroup.courseCode,
        courseSection: primaryGroup.courseSection,
        adviser: primaryGroup.adviser_name,
        proposedProject: primaryGroup.proposed_project
      },
      members,
      recentJournals: journals,
      recentConsultations: consultationLogs,
      outstandingFollowUps,
      participationSummary: participationData,
      checklist: {
        groupInfoReviewed: false,
        membersReviewed: false,
        recentJournalsReviewed: false,
        outstandingFollowUpsReviewed: false,
        previousConsultationReviewed: false,
        readyForConsultation: false
      }
    });
  } catch (error: any) {
    logger.error('Error fetching consultation prep data:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch consultation prep data' });
  }
});

// POST resend individual team import email
router.post('/resend-invite', verifyInstructor, async (req: Request, res: Response) => {
  const { memberEmail, memberName, courseCode, courseName, groupName, adviserName } = req.body;
  if (!memberEmail) {
    return res.status(400).json({ error: 'Missing memberEmail' });
  }

  try {
    const result = await sendTeamImportEmail({
      to: memberEmail,
      studentName: memberName || memberEmail.split('@')[0],
      courseName: courseName || '',
      courseCode: courseCode || '',
      groupName: groupName || '',
      adviserName: adviserName || '',
    });

    if (result.success) {
      return res.json({ success: true, message: `Invite resent to ${memberEmail}` });
    } else {
      return res.status(500).json({ error: `Failed to send email: ${result.error}` });
    }
  } catch (error: any) {
    logger.error('Error resending invite:', error);
    return res.status(500).json({ error: error.message || 'Failed to resend invite' });
  }
});

logger.info('📚 ScholarSync academic routes registered');

export default router;
