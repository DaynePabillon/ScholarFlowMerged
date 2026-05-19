"use client"

import { useState, useEffect, useRef } from 'react'
import { Shield, Crown, User, ChevronDown, Trash2, X } from 'lucide-react'

interface Member {
    id: string
    name: string
    email: string
    role: 'admin' | 'manager' | 'member'
    profile_picture?: string
}

interface RoleManagementProps {
    members: Member[]
    organizationId: string
    currentUserId: string
    onRoleChange: (memberId: string, newRole: string) => Promise<void>
    onRemoveMember: (memberId: string) => Promise<void>
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
    }
}

export default function RoleManagement({
    members,
    organizationId,
    currentUserId,
    onRoleChange,
    onRemoveMember
}: RoleManagementProps) {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [loading, setLoading] = useState<string | null>(null)
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
        <div className="bg-white rounded-2xl border border-gray-200">
            <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Role Management
                </h3>
                <p className="text-sm text-white/70 mt-1">Manage team member permissions</p>
            </div>

            <div className="divide-y divide-gray-100">
                {members.map((member) => {
                    const roleConfig = ROLE_CONFIG[member.role]
                    const RoleIcon = roleConfig.icon
                    const isCurrentUser = member.id === currentUserId

                    return (
                        <div
                            key={member.id}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
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
                                    <div className="font-medium text-gray-800">
                                        {member.name}
                                        {isCurrentUser && (
                                            <span className="ml-2 text-xs text-gray-400">(You)</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500">{member.email}</div>
                                </div>
                            </div>

                            {/* Role Dropdown & Actions */}
                            <div className="flex items-center gap-2">
                                {/* Role Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setOpenDropdown(openDropdown === member.id ? null : member.id)}
                                        disabled={loading === member.id}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${loading === member.id ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <RoleIcon className={`w-4 h-4 ${roleConfig.color}`} />
                                        <span className="text-sm font-medium">{roleConfig.label}</span>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {openDropdown === member.id && (
                                        <div
                                            ref={dropdownRef}
                                            className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-[9999]"
                                        >
                                            {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                                                const Icon = config.icon
                                                return (
                                                    <button
                                                        key={role}
                                                        onClick={() => handleRoleChange(member.id, role)}
                                                        className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 ${member.role === role ? 'bg-gray-50' : ''
                                                            }`}
                                                    >
                                                        <div className={`p-1 rounded ${config.bgColor}`}>
                                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">{config.label}</div>
                                                            <div className="text-xs text-gray-500">{config.description}</div>
                                                        </div>
                                                        {member.role === role && (
                                                            <span className="ml-auto text-blue-500">✓</span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Remove Button */}
                                {!isCurrentUser && (
                                    <button
                                        onClick={() => setConfirmRemove(member.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Remove Member?</h4>
                        <p className="text-gray-600 mb-4">
                            This will remove the member from your organization. They will lose access to all projects and tasks.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmRemove(null)}
                                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
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
