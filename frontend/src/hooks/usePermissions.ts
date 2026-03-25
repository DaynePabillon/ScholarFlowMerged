"use client"

import { useMemo } from 'react'

// Permission levels: Admin > Manager > Member
const ROLE_HIERARCHY = {
    admin: 3,
    manager: 2,
    member: 1
}

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
    VIEW_TEAM_SETTINGS: 'admin',

    // Workspace Sync permissions
    CONNECT_WORKSPACE: 'manager',
    SYNC_WORKSPACE: 'manager',
    CONNECT_SHEET: 'manager',
    DELETE_WORKSPACE: 'admin'
} as const

type Permission = keyof typeof PERMISSIONS
type Role = 'admin' | 'manager' | 'member'

function hasPermission(userRole: Role, requiredRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function usePermissions(role: Role | string | undefined) {
    const userRole = (role || 'member') as Role

    const permissions = useMemo(() => ({
        // Check specific permission
        can: (action: Permission): boolean => {
            const requiredRole = PERMISSIONS[action] as Role
            return hasPermission(userRole, requiredRole)
        },

        // Check minimum role
        isAtLeast: (minRole: Role): boolean => hasPermission(userRole, minRole),

        // Role checks
        isAdmin: userRole === 'admin',
        isManager: userRole === 'manager' || userRole === 'admin',
        isMember: true,

        // Specific action checks
        canInviteMembers: hasPermission(userRole, 'manager'),
        canRemoveMembers: hasPermission(userRole, 'admin'),
        canChangeRoles: hasPermission(userRole, 'admin'),
        canCreateProjects: hasPermission(userRole, 'manager'),
        canDeleteProjects: hasPermission(userRole, 'admin'),
        canCreateTasks: hasPermission(userRole, 'manager'),
        canDeleteTasks: hasPermission(userRole, 'manager'),
        canAssignTasks: hasPermission(userRole, 'manager'),
        canViewTeamSettings: hasPermission(userRole, 'admin'),

        // Workspace sync permissions
        canConnectWorkspace: hasPermission(userRole, 'manager'),
        canSyncWorkspace: hasPermission(userRole, 'manager'),
        canConnectSheet: hasPermission(userRole, 'manager'),
        canDeleteWorkspace: hasPermission(userRole, 'admin'),

        // Current role
        role: userRole
    }), [userRole])

    return permissions
}

export default usePermissions
