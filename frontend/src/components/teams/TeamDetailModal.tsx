"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { X, Award, Send, Plus, Trash2, MessageSquare, BarChart3, ClipboardList, Mail, Layers, Check } from "lucide-react"
import TeamProgressCharts from "./TeamProgressCharts"

interface TeamGroup {
    id: string
    team_code: string | null
    team_number: number
    name: string
    description: string | null
    adviser_name: string | null
    leader_name: string | null
    status: string
    organization_id: string
    proposed_project: string | null
    project_id?: string | null
    project_name?: string | null
    project_status?: string | null
}

interface AvailableProject {
    id: string
    name: string
    status: string
    priority: string
}

interface TeamMember {
    id: string
    name: string
    email: string | null
    student_id: string | null
    member_number: number
    is_leader: boolean
}

interface Checkpoint {
    id: string
    title: string
    description: string | null
    status: string
    due_date: string | null
    completed_at: string | null
    member_name: string | null
    member_id: string | null
}

interface Comment {
    id: string
    content: string
    user_name: string
    user_id: string
    created_at: string
}

interface TeamDetailModalProps {
    team: TeamGroup
    userRole: string
    onClose: () => void
    onTeamUpdated: () => void
}

export default function TeamDetailModal({ team, userRole, onClose, onTeamUpdated }: TeamDetailModalProps) {
    const [members, setMembers] = useState<TeamMember[]>([])
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [activeTab, setActiveTab] = useState<'progress' | 'discussion'>('progress')
    const [loading, setLoading] = useState(true)
    const [isResending, setIsResending] = useState<string | null>(null)

    // Add member form
    const [showAddMember, setShowAddMember] = useState(false)
    const [newMember, setNewMember] = useState({ name: '', email: '', student_id: '', member_number: 1 })
    const [addMemberError, setAddMemberError] = useState('')

    // Add checkpoint form
    const [showAddCheckpoint, setShowAddCheckpoint] = useState(false)
    const [newCheckpoint, setNewCheckpoint] = useState({ title: '', description: '', due_date: '', member_id: '' })

    // Project assignment
    const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([])
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(team.project_id ?? null)
    const [currentProjectName, setCurrentProjectName] = useState<string | null>(team.project_name ?? null)
    const [savingProject, setSavingProject] = useState(false)
    const [projectSaveError, setProjectSaveError] = useState('')
    const [projectsLoading, setProjectsLoading] = useState(false)

    useEffect(() => {
        fetchTeamDetail()
        fetchComments()
        if (userRole === 'admin' || userRole === 'manager') {
            fetchAvailableProjects()
        }
    }, [team.id])

    const getToken = () => localStorage.getItem('token')

    const fetchAvailableProjects = async () => {
        if (!team.organization_id) return
        setProjectsLoading(true)
        try {
            const res = await fetch(`${API_URL}/api/projects?organization_id=${team.organization_id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (res.ok) {
                const data = await res.json()
                setAvailableProjects(Array.isArray(data) ? data : [])
            } else {
                console.error('fetchAvailableProjects failed:', res.status, await res.text())
            }
        } catch (e) {
            console.error('Error fetching projects:', e)
        } finally {
            setProjectsLoading(false)
        }
    }

    const handleAssignProject = async (projectId: string | null) => {
        setSavingProject(true)
        setProjectSaveError('')
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/assign-project`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ project_id: projectId })
            })
            if (res.ok) {
                const project = availableProjects.find(p => p.id === projectId)
                setCurrentProjectId(projectId)
                setCurrentProjectName(project?.name || null)
                onTeamUpdated()
            } else {
                const errData = await res.json().catch(() => ({}))
                setProjectSaveError(errData.error || `Save failed (${res.status})`)
            }
        } catch (e) {
            console.error('Error assigning project:', e)
            setProjectSaveError('Network error — please try again.')
        } finally {
            setSavingProject(false)
        }
    }

    const fetchTeamDetail = async () => {
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (res.ok) {
                const data = await res.json()
                setMembers(data.members || [])
                setCheckpoints(data.checkpoints || [])
            }
        } catch (e) {
            console.error('Error fetching team detail:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchComments = async () => {
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/comments`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (res.ok) {
                const data = await res.json()
                setComments(data.comments || [])
            }
        } catch (e) {
            console.error('Error fetching comments:', e)
        }
    }

    const handleAddComment = async () => {
        if (!newComment.trim()) return
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ content: newComment })
            })
            if (res.ok) {
                setNewComment('')
                fetchComments()
            }
        } catch (e) {
            console.error('Error adding comment:', e)
        }
    }

    const handleAddMember = async () => {
        if (!newMember.name) return
        setAddMemberError('')
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ name: newMember.name, email: newMember.email, student_id: newMember.student_id, is_leader: false })
            })
            if (res.ok) {
                setShowAddMember(false)
                setNewMember({ name: '', email: '', student_id: '', member_number: 1 })
                setAddMemberError('')
                fetchTeamDetail()
                onTeamUpdated()
            } else {
                const data = await res.json().catch(() => ({}))
                setAddMemberError(data.error || 'Failed to add member. Please try again.')
            }
        } catch (e) {
            console.error('Error adding member:', e)
            setAddMemberError('Network error — please try again.')
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this member?')) return
        try {
            await fetch(`${API_URL}/api/team-groups/${team.id}/members/${memberId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            fetchTeamDetail()
            onTeamUpdated()
        } catch (e) {
            console.error('Error removing member:', e)
        }
    }

    const handleResendInvite = async (member: TeamMember) => {
        if (!member.email) return
        setIsResending(member.id)
        try {
            // Use SkyFlow's resend invite endpoint (moved from ScholarSync)
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/members/${member.id}/resend-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
            })
            if (res.ok) {
                const data = await res.json()
                alert(data.message || 'Invite resent successfully to ' + member.email)
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to resend invite.')
            }
        } catch (e) {
            console.error('Error resending invite:', e)
            alert('Failed to resend invite.')
        } finally {
            setIsResending(null)
        }
    }

    const handleAddCheckpoint = async () => {
        if (!newCheckpoint.title) return
        try {
            const res = await fetch(`${API_URL}/api/team-groups/${team.id}/checkpoints`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({
                    title: newCheckpoint.title,
                    description: newCheckpoint.description || null,
                    due_date: newCheckpoint.due_date || null,
                    member_id: newCheckpoint.member_id || null,
                })
            })
            if (res.ok) {
                setShowAddCheckpoint(false)
                setNewCheckpoint({ title: '', description: '', due_date: '', member_id: '' })
                fetchTeamDetail()
                onTeamUpdated()
            }
        } catch (e) {
            console.error('Error adding checkpoint:', e)
        }
    }

    const handleToggleCheckpoint = async (cpId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
        try {
            await fetch(`${API_URL}/api/team-checkpoints/${cpId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ status: newStatus })
            })
            fetchTeamDetail()
            onTeamUpdated()
        } catch (e) {
            console.error('Error updating checkpoint:', e)
        }
    }

    const canManage = userRole === 'admin' || userRole === 'manager'

    const formatCommentTime = (value: unknown) => {
        const ts = new Date(String(value || '')).getTime()
        if (!Number.isFinite(ts) || ts <= 0) return 'Just now'
        return new Date(ts).toLocaleTimeString()
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 dark:bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-500"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="flex flex-col w-full max-w-[1200px] max-h-[90vh] bg-white/95 dark:bg-slate-900/40 backdrop-blur-[50px] border border-gray-200 dark:border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.2)] dark:shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-700">
                {/* Header */}
                <div className="flex justify-between items-center px-10 py-8 border-b border-gray-100 dark:border-white/5 bg-gradient-to-br from-blue-600/5 dark:from-blue-600/10 to-transparent">
                    <div className="space-y-1">
                        <div className="text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase opacity-70">
                            Team Info • {team.team_number.toString().padStart(2, '0')} {team.team_code ? `• ${team.team_code}` : ''}
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase leading-none">
                            {team.proposed_project || team.name}
                        </h2>
                        {team.proposed_project && (
                            <div className="text-[11px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mt-1">
                                {team.name}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 hover:rotate-90 transition-all duration-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content — Two panels */}
                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT PANEL — Team info & members */}
                    <div className="flex flex-col w-[400px] min-w-[400px] border-r border-gray-100 dark:border-white/5 p-10 overflow-y-auto gap-10 bg-gray-100/30 dark:bg-slate-950/40">
                        {/* Team Info */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200 dark:to-white/5" />
                                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-[0.2em]">Team Info</span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200 dark:to-white/5" />
                            </div>
                            {team.adviser_name && (
                                <div className="flex items-center gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-3xl border border-gray-200 dark:border-white/5 shadow-md dark:shadow-xl">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl flex-shrink-0">
                                        <Award size={20} className="text-amber-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[9px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest">Adviser</div>
                                        <div className="text-[13px] text-gray-900 dark:text-white font-black uppercase tracking-tight break-all">{team.adviser_name}</div>
                                    </div>
                                </div>
                            )}
                            {team.description && (
                                <div className="p-6 bg-gray-50 dark:bg-slate-900/40 rounded-3xl border border-gray-200 dark:border-white/5 text-xs text-gray-600 dark:text-slate-400 font-bold leading-relaxed uppercase tracking-wider">
                                    {team.description}
                                </div>
                            )}
                        </div>

                        {/* Assigned Project */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200 dark:to-white/5" />
                                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-[0.2em]">Project</span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200 dark:to-white/5" />
                            </div>

                            <div className="flex flex-col gap-3">
                                {(userRole === 'admin' || userRole === 'manager') ? (
                                    projectsLoading ? (
                                        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-gray-200 dark:border-white/5 shadow-md">
                                            <div className="p-3 bg-indigo-500/10 rounded-2xl flex-shrink-0">
                                                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                            <div className="text-[11px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Loading projects…</div>
                                        </div>
                                    ) : availableProjects.length === 0 ? (
                                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-3xl border border-amber-200 dark:border-amber-500/20">
                                            <div className="p-3 bg-amber-500/10 rounded-2xl flex-shrink-0">
                                                <Layers size={20} className="text-amber-500" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">No Projects Found</div>
                                                <div className="text-[11px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                                                    Create a project on the{' '}
                                                    <a href="/projects" target="_blank" className="underline hover:text-amber-900 dark:hover:text-amber-100">
                                                        Projects page
                                                    </a>{' '}
                                                    first, then return here and click Refresh.
                                                </div>
                                                <button
                                                    onClick={fetchAvailableProjects}
                                                    className="mt-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                                                >
                                                    ↻ Refresh
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-[9px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">Assign Project</div>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    {savingProject
                                                        ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                        : <Layers size={16} className="text-indigo-500" />
                                                    }
                                                </div>
                                                <select
                                                    value={currentProjectId ?? ''}
                                                    onChange={(e) => handleAssignProject(e.target.value || null)}
                                                    disabled={savingProject}
                                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-500/30 rounded-2xl text-[12px] font-black uppercase tracking-tight text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 cursor-pointer transition-colors hover:border-indigo-400 dark:hover:border-indigo-400 dark:[color-scheme:dark]"
                                                >
                                                    <option value="">— No project assigned —</option>
                                                    {availableProjects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    /* Read-only view for members */
                                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-gray-200 dark:border-white/5 shadow-md">
                                        <div className="p-3 bg-indigo-500/10 rounded-2xl flex-shrink-0">
                                            <Layers size={20} className="text-indigo-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-1">Assigned Project</div>
                                            <div className={`text-[13px] font-black uppercase tracking-tight truncate ${currentProjectName ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-600 italic'}`}>
                                                {currentProjectName || 'No project assigned'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error feedback */}
                                {projectSaveError && (
                                    <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                                        ⚠ {projectSaveError}
                                    </div>
                                )}

                                {/* Save confirmation */}
                                {!projectSaveError && !savingProject && currentProjectName && availableProjects.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-black uppercase tracking-widest px-1">
                                        <Check size={12} /> Assigned: {currentProjectName}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Members */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4 flex-1">
                                    <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-[0.2em]">Members</span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-white/5 to-transparent" />
                                </div>
                                {canManage && (
                                    <button onClick={() => setShowAddMember(!showAddMember)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-600/20 transition-all">
                                        <Plus size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Add Member</span>
                                    </button>
                                )}
                            </div>

                            {/* Add member form */}
                            {showAddMember && (
                                <div className="flex flex-col gap-3 p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl animate-in slide-in-from-top-4 duration-300">
                                    {addMemberError && (
                                        <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                                            {addMemberError}
                                        </div>
                                    )}
                                    <input
                                        placeholder="Full Name *"
                                        value={newMember.name}
                                        onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-blue-500/40 transition-all"
                                    />
                                    <input
                                        placeholder="Email Address"
                                        value={newMember.email}
                                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-blue-500/40 transition-all"
                                    />
                                    <input
                                        placeholder="Student ID (optional)"
                                        value={newMember.student_id}
                                        onChange={(e) => setNewMember({ ...newMember, student_id: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-blue-500/40 transition-all"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleAddMember} className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all">Confirm</button>
                                        <button onClick={() => { setShowAddMember(false); setAddMemberError('') }} className="px-6 py-3.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Members list */}
                            <div className="flex flex-col gap-3">
                                {members.map(member => (
                                    <div key={member.id} className="flex items-center gap-4 p-4 rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/10 transition-all group/member shadow-md dark:shadow-lg">
                                        <div className="relative">
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '1.25rem',
                                                background: `linear-gradient(135deg, hsl(${member.member_number * 60}, 80%, 40%), hsl(${member.member_number * 60 + 30}, 80%, 30%))`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 900,
                                                color: '#fff',
                                            }} className="shadow-2xl shadow-black/40 border border-white/20">
                                                {member.name.charAt(0)}
                                            </div>
                                            {member.is_leader && (
                                                <div className="absolute -top-1 -right-1 bg-yellow-500 p-1 rounded-lg border-2 border-slate-900 shadow-xl">
                                                    <Award size={10} className="text-black" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-900 dark:text-white font-black uppercase tracking-tight flex items-center gap-2 leading-none">
                                                {member.name}
                                            </div>
                                            <div className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">
                                                ID: {member.student_id || 'Not provided'}
                                            </div>
                                        </div>
                                        {canManage && member.email && (
                                            <button 
                                                onClick={() => handleResendInvite(member)} 
                                                className="p-3 rounded-xl opacity-0 group-hover/member:opacity-100 hover:bg-blue-500/10 text-slate-600 hover:text-blue-500 transition-all"
                                                title="Resend Invitation Email"
                                                disabled={isResending === member.id}
                                            >
                                                {isResending === member.id ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Mail size={16} />}
                                            </button>
                                        )}
                                        {canManage && (
                                            <button onClick={() => handleRemoveMember(member.id)} className="p-3 rounded-xl opacity-0 group-hover/member:opacity-100 hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all" title="Remove Member">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Discussion section */}
                        <div className="mt-auto space-y-6">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-[0.2em]">Discussion</span>
                                <div className="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-white/5 to-transparent" />
                            </div>
                            <div className="max-h-[240px] overflow-y-auto pr-2 flex flex-col gap-4 scrollbar-hide">
                                {comments.map(c => (
                                    <div key={c.id} className="p-5 rounded-3xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/5 shadow-md dark:shadow-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{c.user_name}</span>
                                            <span className="text-[8px] font-bold text-gray-400 dark:text-slate-600 uppercase">
                                                {formatCommentTime(c.created_at)}
                                            </span>
                                        </div>
                                        <div className="text-[11px] font-bold text-gray-700 dark:text-slate-300 leading-relaxed uppercase tracking-wider">{c.content}</div>
                                    </div>
                                ))}
                            </div>
                            {canManage && (
                                <div className="flex gap-2 p-1.5 bg-gray-50 dark:bg-slate-950/60 border border-gray-200 dark:border-white/5 rounded-2xl shadow-inner focus-within:border-blue-500/40 transition-all">
                                    <input
                                        placeholder="Post a message..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                        className="flex-1 px-4 py-2 bg-transparent text-gray-900 dark:text-white text-xs font-bold outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                    />
                                    <button onClick={handleAddComment} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:scale-110 active:scale-90 transition-all">
                                        <Send size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL — Progress & Checkpoints */}
                    <div className="flex-1 p-10 overflow-y-auto bg-gray-50/30 dark:bg-slate-950/20 backdrop-blur-3xl scrollbar-hide">
                        {/* Tab buttons */}
                        <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-200 dark:border-white/5">
                            <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-slate-900/60 rounded-2xl border border-gray-200 dark:border-white/5">
                                <button
                                    onClick={() => setActiveTab('progress')}
                                    className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeTab === 'progress' 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                            : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <BarChart3 size={16} /> Team Progress
                                </button>
                            </div>
                            
                            {canManage && (
                                <button
                                    onClick={() => setShowAddCheckpoint(!showAddCheckpoint)}
                                    className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:scale-[1.05] active:scale-95 transition-all"
                                >
                                    <Plus size={18} /> Add Checkpoint
                                </button>
                            )}
                        </div>

                        {/* Add checkpoint form */}
                        {showAddCheckpoint && (
                            <div className="flex flex-col gap-4 p-8 mb-10 bg-white/95 dark:bg-slate-900/90 border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in-95">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                        <ClipboardList className="text-emerald-500" size={24} />
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">New Checkpoint</h4>
                                </div>
                                
                                <input
                                    placeholder="Checkpoint Title *"
                                    value={newCheckpoint.title}
                                    onChange={(e) => setNewCheckpoint({ ...newCheckpoint, title: e.target.value })}
                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-emerald-500/40"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest ml-1">Deadline</label>
                                        <input
                                            type="date"
                                            value={newCheckpoint.due_date}
                                            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, due_date: e.target.value })}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-emerald-500/40 dark:[color-scheme:dark]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest ml-1">Assigned Member</label>
                                        <select
                                            value={newCheckpoint.member_id}
                                            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, member_id: e.target.value })}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-white/5 rounded-2xl text-gray-900 dark:text-white text-xs font-bold outline-none focus:border-emerald-500/40 appearance-none"
                                        >
                                            <option value="">Entire Team</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={handleAddCheckpoint} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20">Add Checkpoint</button>
                                    <button onClick={() => setShowAddCheckpoint(false)} className="px-10 py-4 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all">Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Progress Charts */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                <span className="text-[10px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest">Loading...</span>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                <TeamProgressCharts checkpoints={checkpoints} members={members} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
