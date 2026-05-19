import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

// Permission levels: Admin > Manager > Member
const ROLE_HIERARCHY = {
    admin: 3,
    manager: 2,
    member: 1
};

// Define which actions require which minimum role
export const PERMISSIONS = {
    // Organization management
    DELETE_ORGANIZATION: 'admin',
    UPDATE_ORGANIZATION: 'admin',

    // Member management
    INVITE_MEMBER: 'manager',
    REMOVE_MEMBER: 'admin',
    CHANGE_MEMBER_ROLE: 'admin',

    // Project management
    CREATE_PROJECT: 'manager',
    DELETE_PROJECT: 'admin',
    UPDATE_PROJECT: 'manager',

    // Task management
    CREATE_TASK: 'manager',
    DELETE_TASK: 'manager',
    ASSIGN_TASK: 'manager',
    UPDATE_TASK_STATUS: 'member',

    // View permissions
    VIEW_ANALYTICS: 'manager',
    VIEW_TEAM_SETTINGS: 'admin'
} as const;

type Permission = keyof typeof PERMISSIONS;
type Role = 'admin' | 'manager' | 'member';

/**
 * Check if a role has permission for an action
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can perform a specific action
 */
export function canPerform(userRole: Role, action: Permission): boolean {
    const requiredRole = PERMISSIONS[action] as Role;
    return hasPermission(userRole, requiredRole);
}

/**
 * Middleware to check if user has required role for an organization
 */
export function requireRole(minRole: Role) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user?.id;
            const orgId = req.params.orgId || req.body.organization_id || req.query.orgId;

            if (!userId) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            if (!orgId) {
                return res.status(400).json({ error: 'Organization ID required' });
            }

            // Get user's role in this organization
            const result = await pool.query(
                `SELECT role FROM organization_members 
         WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
                [orgId, userId]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Not a member of this organization' });
            }

            const userRole = result.rows[0].role as Role;

            if (!hasPermission(userRole, minRole)) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: minRole,
                    current: userRole
                });
            }

            // Attach role to request for later use
            (req as any).userRole = userRole;
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
}

/**
 * Middleware to check specific permission
 */
export function requirePermission(permission: Permission) {
    const requiredRole = PERMISSIONS[permission] as Role;
    return requireRole(requiredRole);
}
