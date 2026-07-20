"use client"

import { useState, useEffect, useRef } from 'react'
import { Shield, Crown, User, ChevronDown, Trash2, X, GraduationCap, Briefcase } from 'lucide-react'

interface Member {
    id: string
    name: string
    email: string
    role: 'admin' | 'manager' | 'member' | 'adviser'
    // The member's academic-side role within ScholarFlow's Academics area
    // (Student / Adviser / Admin / External Leader). May be null/undefined
    // for members who don't yet have a linked academic account.
    academic_role?: string | null
    profile_picture?: string
}

interface RoleManagementProps {
    members: Member[]
    organizationId: string
    currentUserId: string
    onRoleChange: (memberId: string, newRole: string) => Promise<void>
    onRemoveMember: (memberId: string) => Promise<void>
    // Optional — when provided, the dropdown also lets admins set the member's
    // academic role from the SAME picker, so there's one unified place to manage
    // both "sides" of a person's identity within ScholarFlow instead of having
    // to visit a separate Academics admin page.
    onAcademicRoleChange?: (memberId: string, newAcademicRole: string) => Promise<void>
}

const ROLE_CONFIG = {
    admin: {
        label: 'Admin',
        icon: Crown,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        description: 'Full access to all features'
    },
    manager: {
        label: 'Manager',
        icon: Shield,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: 'Can manage projects and tasks'
    },
    member: {
        label: 'Member',
        icon: User,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: 'Can view and update assigned tasks'
    },
    adviser: {
        label: 'Adviser',
        icon: User,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        description: 'Can view all teams and manage tasks'
    }
}

// Academic-side roles (ScholarFlow Academics area). Distinct dimension from the
// organization role above — a person can be e.g. an org "Manager" AND an
// academic "Adviser" at the same time ("Manager & Adviser").
const ACADEMIC_ROLE_CONFIG: Record<string, { label: string; icon: typeof User; color: string; bgColor: string; description: string }> = {
    Student: {
        label: 'Student',
        icon: GraduationCap,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        description: 'Takes courses & books consultations'
    },
    Adviser: {
        label: 'Adviser',
        icon: Shield,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        description: 'Guides groups & runs consultations'
    },
    Admin: {
        label: 'Admin',
        icon: Crown,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        description: 'Manages courses, accounts & settings'
    },
    'External Leader': {
        label: 'External Leader',
        icon: Briefcase,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        description: 'Reviews & validates consultation records'
    }
}

function academicRoleConfigFor(role?: string | null) {
    if (!role) return null
    return ACADEMIC_ROLE_CONFIG[role] || ACADEMIC_ROLE_CONFIG[
        Object.keys(ACADEMIC_ROLE_CONFIG).find(k => k.toLowerCase() === role.toLowerCase()) || ''
    ] || null
}

export default function RoleManagement({
    members,
    organizationId,
    currentUserId,
    onRoleChange,
    onRemoveMember,
    onAcademicRoleChange
}: RoleManagementProps) {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [loading, setLoading] = useState<string | null>(null)
    const [academicLoading, setAcademicLoading] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleRoleChange = async (memberId: string, newRole: string) => {
        setLoading(memberId)
        try {
            await onRoleChange(memberId, newRole)
        } finally {
            setLoading(null)
            setOpenDropdown(null)
        }
    }

    const handleAcademicRoleChange = async (memberId: string, newAcademicRole: string) => {
        if (!onAcademicRoleChange) return
        setAcademicLoading(memberId)
        try {
            await onAcademicRoleChange(memberId, newAcademicRole)
        } finally {
            setAcademicLoading(null)
            setOpenDropdown(null)
        }
    }

    const handleRemove = async (memberId: string) => {
        setLoading(memberId)
        try {
            await onRemoveMember(memberId)
        } finally {
            setLoading(null)
            setConfirmRemove(null)
        }
    }

    return (
        <div className="bg-white dark:bg-slate-800/70 rounded-2xl border border-gray-200 dark:border-slate-700">
            <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 text-white rounded-t-2xl">
                <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Role Management
                </h3>
                <p className="text-sm text-white/70 mt-1">Manage team member permissions</p>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {members.map((member) => {
                    const roleConfig = ROLE_CONFIG[member.role]
                    const RoleIcon = roleConfig.icon
                    const isCurrentUser = member.id === currentUserId

                    return (
                        <div
                            key={member.id}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                            {/* Member Info */}
                            <div className="flex items-center gap-3">
                                {member.profile_picture ? (
                                    <img
                                        src={member.profile_picture}
                                        alt={member.name}
                                        className="w-10 h-10 rounded-full"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div className="font-medium text-gray-800 dark:text-gray-100">
                                        {member.name}
                                        {isCurrentUser && (
                                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(You)</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                                </div>
                            </div>

                            {/* Role Dropdown & Actions */}
                            <div className="flex items-center gap-2">
                                {/* Unified Role Picker — combines Organization role and Academic role
                                    in one dropdown so admins don't need to visit a separate page */}
                                <div className="relative">
                                    <button
                                        onClick={() => setOpenDropdown(openDropdown === member.id ? null : member.id)}
                                        disabled={loading === member.id}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${loading === member.id ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <RoleIcon className={`w-4 h-4 ${roleConfig.color}`} />
                                        <span className="text-sm font-medium dark:text-gray-200">{roleConfig.label}</span>
                                        {(() => {
                                            const academicConfig = academicRoleConfigFor(member.academic_role)
                                            if (!academicConfig) return null
                                            const AcademicIcon = academicConfig.icon
                                            return (
                                                <span className={`flex items-center gap-1 pl-1.5 ml-0.5 border-l border-gray-200 dark:border-slate-600 text-xs font-medium ${academicConfig.color}`}>
                                                    <AcademicIcon className="w-3.5 h-3.5" />
                                                    {academicConfig.label}
                                                </span>
                                            )
                                        })()}
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {openDropdown === member.id && (
                                        <div
                                            ref={dropdownRef}
                                            className="absolute right-0 mt-1 w-72 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-[9999]"
                                        >
                                            {/* Organization Role section */}
                                            <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                                Organization Role
                                            </div>
                                            {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                                                const Icon = config.icon
                                                return (
                                                    <button
                                                        key={role}
                                                        onClick={() => handleRoleChange(member.id, role)}
                                                        disabled={loading === member.id}
                                                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-50 ${member.role === role ? 'bg-gray-50 dark:bg-slate-800' : ''
                                                            }`}
                                                    >
                                                        <div className={`p-1 rounded ${config.bgColor}`}>
                                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium dark:text-gray-200">{config.label}</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                                                        </div>
                                                        {member.role === role && (
                                                            <span className="ml-auto text-blue-500">✓</span>
                                                        )}
                                                    </button>
                                                )
                                            })}

                                            {/* Academic Role section — only shown when a handler is provided,
                                                merging academic role assignment into this same picker so
                                                admins don't have to visit /scholar/admin/accounts separately */}
                                            {onAcademicRoleChange && (
                                                <>
                                                    <div className="mt-1 px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-t border-gray-100 dark:border-slate-700">
                                                        Academic Role
                                                    </div>
                                                    {Object.entries(ACADEMIC_ROLE_CONFIG).map(([role, config]) => {
                                                        const Icon = config.icon
                                                        const isSelected = (member.academic_role || '').toLowerCase() === role.toLowerCase()
                                                        return (
                                                            <button
                                                                key={role}
                                                                onClick={() => handleAcademicRoleChange(member.id, role)}
                                                                disabled={academicLoading === member.id}
                                                                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-50 ${isSelected ? 'bg-gray-50 dark:bg-slate-800' : ''
                                                                    }`}
                                                            >
                                                                <div className={`p-1 rounded ${config.bgColor}`}>
                                                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium">{config.label}</div>
                                                                    <div className="text-xs text-gray-500">{config.description}</div>
                                                                </div>
                                                                {isSelected && (
                                                                    <span className="ml-auto text-blue-500">✓</span>
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Remove Button */}
                                {!isCurrentUser && (
                                    <button
                                        onClick={() => setConfirmRemove(member.id)}
                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                        title="Remove member"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Confirm Remove Modal */}
            {confirmRemove && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-transparent dark:border-slate-700">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Remove Member?</h4>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            This will remove the member from your organization. They will lose access to all projects and tasks.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmRemove(null)}
                                className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRemove(confirmRemove)}
                                disabled={loading === confirmRemove}
                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                {loading === confirmRemove ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
