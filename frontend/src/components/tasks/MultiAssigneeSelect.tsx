"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect, useRef } from "react"
import { X, ChevronDown, Check, User, Users } from "lucide-react"

interface Member {
    user_id: string
    name: string
    email: string
    profile_picture?: string
}

interface Assignee {
    user_id: string
    name: string
    email?: string
    profile_picture?: string
}

interface MultiAssigneeSelectProps {
    taskId: string
    currentAssignees: Assignee[]
    members: Member[]
    onAssigneesChange: (assignees: Assignee[]) => void
    disabled?: boolean
    canModify?: boolean // Only admin/manager can add/remove
}

export default function MultiAssigneeSelect({
    taskId,
    currentAssignees,
    members,
    onAssigneesChange,
    disabled = false,
    canModify = true
}: MultiAssigneeSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(currentAssignees.map(a => a.user_id))
    )
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setSelectedIds(new Set(currentAssignees.map(a => a.user_id)))
    }, [currentAssignees])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleMember = async (member: Member) => {
        if (!canModify || disabled) return

        const newSelectedIds = new Set(selectedIds)

        if (newSelectedIds.has(member.user_id)) {
            // Remove assignee
            newSelectedIds.delete(member.user_id)
            try {
                const token = localStorage.getItem('token')
                await fetch(`${API_URL}/api/tasks/${taskId}/assignees/${member.user_id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            } catch (error) {
                console.error('Error removing assignee:', error)
                return
            }
        } else {
            // Add assignee
            newSelectedIds.add(member.user_id)
            try {
                const token = localStorage.getItem('token')
                await fetch(`${API_URL}/api/tasks/${taskId}/assignees`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user_ids: [member.user_id] })
                })
            } catch (error) {
                console.error('Error adding assignee:', error)
                return
            }
        }

        setSelectedIds(newSelectedIds)

        // Update parent with new assignees list
        const newAssignees = members
            .filter(m => newSelectedIds.has(m.user_id))
            .map(m => ({
                user_id: m.user_id,
                name: m.name,
                email: m.email,
                profile_picture: m.profile_picture
            }))
        onAssigneesChange(newAssignees)
    }

    const clearAll = async () => {
        if (!canModify || disabled) return

        // Remove all assignees
        const token = localStorage.getItem('token')
        for (const id of selectedIds) {
            try {
                await fetch(`${API_URL}/api/tasks/${taskId}/assignees/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            } catch (error) {
                console.error('Error removing assignee:', error)
            }
        }

        setSelectedIds(new Set())
        onAssigneesChange([])
    }

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Selected Assignees Display */}
            <div
                onClick={() => canModify && !disabled && setIsOpen(!isOpen)}
                className={`min-h-[42px] px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl flex flex-wrap gap-2 items-center ${canModify && !disabled ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-500' : 'cursor-default bg-gray-50 dark:bg-slate-800'
                    }`}
            >
                {selectedIds.size === 0 ? (
                    <span className="text-gray-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        No assignees
                    </span>
                ) : (
                    <>
                        {currentAssignees.filter(a => selectedIds.has(a.user_id)).slice(0, 3).map(assignee => (
                            <div
                                key={assignee.user_id}
                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm"
                            >
                                <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                    {getInitials(assignee.name)}
                                </div>
                                <span className="max-w-[100px] truncate">{assignee.name}</span>
                                {canModify && !disabled && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleMember({ user_id: assignee.user_id, name: assignee.name, email: assignee.email || '' })
                                        }}
                                        className="hover:bg-blue-200 rounded p-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {selectedIds.size > 3 && (
                            <span className="text-sm text-gray-500">
                                +{selectedIds.size - 3} more
                            </span>
                        )}
                    </>
                )}
                {canModify && !disabled && (
                    <ChevronDown className={`w-4 h-4 ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && canModify && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:border-slate-700 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                    {/* Clear All Option */}
                    {selectedIds.size > 0 && (
                        <button
                            onClick={clearAll}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Clear all assignees
                        </button>
                    )}

                    {/* Member List */}
                    {members.map(member => (
                        <button
                            key={member.user_id}
                            onClick={() => toggleMember(member)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-sm font-medium">
                                {getInitials(member.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{member.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</div>
                            </div>
                            {selectedIds.has(member.user_id) && (
                                <Check className="w-5 h-5 text-blue-500" />
                            )}
                        </button>
                    ))}

                    {members.length === 0 && (
                        <div className="px-3 py-4 text-center text-gray-500 text-sm">
                            No team members available
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
