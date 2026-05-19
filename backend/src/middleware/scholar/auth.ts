import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/database';

const normalizeRole = (value: unknown): string => {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'admin') return 'admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'advisers';
  if (role === 'student' || role === 'member') return 'student';

  return role;
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    (req as any).user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token." });
  }
};

export const authorizeRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const allowedRoles = new Set((roles || []).map(normalizeRole).filter(Boolean));

    const user = (req as any).user || {};
    const roleCandidates = [
      normalizeRole(user.role),
      normalizeRole(user.scholarsyncRole),
      normalizeRole(user.accountRole)
    ].filter(Boolean);

    if (!roleCandidates.some((role) => allowedRoles.has(role))) {
      // Fallback: resolve ScholarSync role from ss_account for merged-login tokens.
      const userEmail = String(user.email || user.accountEmail || '').trim();
      if (userEmail) {
        try {
          const { rows } = await pool.query(
            'SELECT "accountRole" FROM ss_account WHERE LOWER("accountEmail") = LOWER($1) LIMIT 1',
            [userEmail]
          );

          if (rows.length > 0) {
            const dbRole = normalizeRole(rows[0].accountRole);
            if (dbRole) {
              roleCandidates.push(dbRole);
            }
          }
        } catch {
          // Ignore DB lookup errors and fall through to 403.
        }
      }
    }

    const hasAccess = roleCandidates.some((role) => allowedRoles.has(role));

    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions." });
    }

    next();
  };
};
