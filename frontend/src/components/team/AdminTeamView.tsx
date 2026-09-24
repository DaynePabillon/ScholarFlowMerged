"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { Users, UserPlus, Search, Mail, Shield, MoreVertical, Crown, Briefcase, User, Settings, X, Copy, Check, Clock, FolderKanban, Link2, RefreshCw, Trash2 } from "lucide-react"
import RoleManagement from "./RoleManagement"
import ProjectTeamsSection from "./ProjectTeamsSection"

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'member' | 'adviser'
  academic_role?: string | null
  profile_picture?: string | null
  joined_at: string
  status: string
}

interface AdminTeamViewProps {
  user: any
  organization: {
    id: string
    name: string
    role: string
  }
}

export default function AdminTeamView({ user, organization }: AdminTeamViewProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("member")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'members' | 'project-teams'>('members')
  const [joinCodes, setJoinCodes] = useState<any[]>([])
  const [generatingRole, setGeneratingRole] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [joinProjectId, setJoinProjectId] = useState<string>('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetchMembers()
    fetchJoinCodes()
    fetchProjects()
  }, [organization.id])

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/organizations/${organization.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        setMembers([])
        setIsLoading(false)
        return
      }

      const data = await response.json()
      setMembers(data.members || [])
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching members:', error)
      setMembers([])
      setIsLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/projects?organization_id=${organization.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || data || [])
      }
    } catch (_) {}
  }

  const fetchJoinCodes = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/join-codes/${organization.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setJoinCodes(data.codes || [])
      }
    } catch (_) {}
  }

  const generateJoinCode = async (role: 'manager' | 'member') => {
    setGeneratingRole(role)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/join-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          organization_id: organization.id,
          role,
          label: `${role} link`,
          project_id: joinProjectId || undefined
        })
      })
      if (res.ok) {
        await fetchJoinCodes()
      }
    } catch (_) {}
    setGeneratingRole(null)
  }

  const revokeJoinCode = async (codeId: string) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/api/join-codes/${codeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      await fetchJoinCodes()
    } catch (_) {}
  }

  const copyJoinLink = (code: string) => {
    const url = `${window.location.origin}/join?code=${code}`
    navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/members/${memberId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: newRole })
        }
      )

      if (response.ok) {
        fetchMembers() // Refresh member list
        // If the current user's own role changed, update localStorage so AppLayout
        // reflects the new role immediately (otherwise requires logout/login).
        if (memberId === user.id) {
          const stored = localStorage.getItem('selectedOrganization')
          if (stored) {
            const org = JSON.parse(stored)
            localStorage.setItem('selectedOrganization', JSON.stringify({ ...org, role: newRole }))
          }
          window.location.reload()
        }
      }
    } catch (error) {
      console.error('Error changing role:', error)
    }
  }

  // Sets a member's ScholarFlow Academics-side role (Student / Adviser / Admin /
  // External Leader) from the SAME Team → Role Management picker as the org role —
  // so admins no longer need to visit the separate /scholar/admin/accounts page.
  const handleAcademicRoleChange = async (memberId: string, newAcademicRole: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/members/${memberId}/academic-role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ academic_role: newAcademicRole })
        }
      )

      if (response.ok) {
        fetchMembers() // Refresh member list so the new academic role badge shows
      } else {
        const data = await response.json().catch(() => ({}))
        console.error('Error changing academic role:', data?.error || response.statusText)
      }
    } catch (error) {
      console.error('Error changing academic role:', error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        fetchMembers() // Refresh member list
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviteLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole })
        }
      )

      if (response.ok) {
        const data = await response.json()
        setInviteUrl(data.inviteUrl)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert('Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeInviteModal = () => {
    setIsInviteModalOpen(false)
    setInviteEmail('')
    setInviteRole('member')
    setInviteUrl(null)
    setCopied(false)
  }

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Crown className="w-4 h-4" />
    if (role === 'manager') return <Briefcase className="w-4 h-4" />
    return <User className="w-4 h-4" />
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
      manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
      member: { label: 'Member', color: 'bg-green-100 text-green-700' }
    }
    return badges[role as keyof typeof badges] || badges.member
  }

  // Unified role label — combines this member's SkyFlow org role with their
  // ScholarSync academic role (Student / Adviser / Admin / External Leader),
  // e.g. "Member & Student", so both systems' role assignments are visible together.
  const formatMemberRole = (member: TeamMember) => {
    const base = getRoleBadge(member.role).label
    return member.academic_role ? `${base} & ${member.academic_role}` : base
  }

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterRole === 'all' || member.role === filterRole ||
      (filterRole === 'invited' && member.status === 'invited')
    return matchesSearch && matchesFilter
  })

  // Don't show anything during initial load to avoid flash
  if (isLoading) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" onClick={() => setOpenActionMenu(null)}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Roster</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Manage members in {organization.name}</p>
          </div>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
          >
            <UserPlus className="w-5 h-5" />
            <span className="font-medium">Invite Member</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Members
          </button>
          <button
            onClick={() => setActiveTab('project-teams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'project-teams'
                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            Project Teams
          </button>
        </div>
      </div>

      {activeTab === 'members' && (<>
        {/* Join Links — reusable role-based invite codes for testing / onboarding */}
        <div className="mb-6 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Join Links</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Anyone with the link joins this org with the assigned role</span>
          </div>

          {/* Project selector — links new members to a project automatically */}
          {projects.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                Auto-add to project (optional)
              </label>
              <select
                value={joinProjectId}
                onChange={e => {
                  setJoinProjectId(e.target.value)
                  setJoinCodes([]) // reset codes so user re-generates with new project
                  fetchJoinCodes()
                }}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 dark:text-gray-200"
              >
                <option value="">No project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {joinProjectId && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Members who join will be added to this project automatically.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['manager', 'member'] as const).map(role => {
              const existing = joinCodes.find(c => c.role === role)
              const joinUrl = existing ? `${window.location.origin}/join?code=${existing.code}` : null
              return (
                <div key={role} className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {role === 'manager' ? <Briefcase className="w-4 h-4 text-blue-500" /> : <User className="w-4 h-4 text-green-500" />}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{role} Link</span>
                    </div>
                    {existing && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{existing.use_count} use{existing.use_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {existing?.project_name && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                      → {existing.project_name}
                    </p>
                  )}
                  {joinUrl ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={joinUrl}
                        className="flex-1 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 truncate"
                      />
                      <button
                        onClick={() => copyJoinLink(existing.code)}
                        className="flex-shrink-0 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        title="Copy link"
                      >
                        {copiedCode === existing.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-blue-500" />}
                      </button>
                      <button
                        onClick={() => revokeJoinCode(existing.id)}
                        className="flex-shrink-0 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        title="Revoke link"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => generateJoinCode(role)}
                      disabled={generatingRole === role}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
                    >
                      {generatingRole === role ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Generate {role} link
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
            <option value="adviser">Adviser</option>
            <option value="invited">Invited</option>
          </select>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Crown className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Admins</span>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {members.filter(m => m.role === 'admin').length}
          </p>
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Managers</span>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {members.filter(m => m.role === 'manager').length}
          </p>
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Members</span>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {members.filter(m => m.role === 'member' && m.status !== 'invited').length}
          </p>
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Invited</span>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {members.filter(m => m.status === 'invited').length}
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredMembers.map((member) => {
                const isInvited = member.status === 'invited'
                return (
                <tr key={member.id} className={`transition-colors ${
                  isInvited ? 'opacity-50 bg-gray-50/30' : 'hover:bg-blue-50/50'
                }`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {member.profile_picture ? (
                        <img
                          src={member.profile_picture}
                          alt={member.name}
                          className={`flex-shrink-0 h-10 w-10 rounded-full object-cover ${
                            isInvited ? 'border-2 border-dashed border-gray-300 grayscale' : ''
                          }`}
                        />
                      ) : (
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          isInvited
                            ? 'bg-gray-300 border-2 border-dashed border-gray-400'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                        }`}>
                          {isInvited ? <Mail className="w-4 h-4 text-gray-500" /> : member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${
                          isInvited ? 'text-gray-400 italic' : 'text-gray-800 dark:text-gray-100'
                        }`}>
                          {isInvited ? member.email : member.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(member.role).color}`}>
                      {getRoleIcon(member.role)}
                      {formatMemberRole(member)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isInvited ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" />
                        Pending Invite
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {member.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!isInvited && (
                      <div className="relative flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenActionMenu(prev => prev === member.id ? null : member.id)
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                        {openActionMenu === member.id && (
                          <div className="absolute right-0 top-8 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[160px]">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700">
                              Change Role
                            </div>
                            {(['admin', 'manager', 'member', 'adviser'] as const)
                              .filter(r => r !== member.role)
                              .map(r => (
                                <button
                                  key={r}
                                  onClick={() => { handleRoleChange(member.id, r); setOpenActionMenu(null) }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 capitalize transition-colors"
                                >
                                  Set as {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              ))
                            }
                            <div className="border-t border-gray-100 dark:border-slate-700 mt-1">
                              <button
                                onClick={() => { handleRemoveMember(member.id); setOpenActionMenu(null) }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Remove Member
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )})
              }
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-blue-600">No members found</p>
          </div>
        )}
      </div>

      {/* Role Management Section */}
      <div className="mt-6">
        <RoleManagement
          members={members.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role,
            // Surface the linked ScholarSync academic role (Student / Adviser /
            // Admin / External Leader) so it can be set from this same picker —
            // unifying both "sides" of a member's identity in one place.
            academic_role: m.academic_role
          }))}
          organizationId={organization.id}
          currentUserId={user.id}
          onRoleChange={handleRoleChange}
          onAcademicRoleChange={handleAcademicRoleChange}
          onRemoveMember={handleRemoveMember}
        />
      </div>
      </>)}

      {activeTab === 'project-teams' && (
        <ProjectTeamsSection
          organizationId={organization.id}
          orgMembers={members
            .filter(m => m.status !== 'invited')
            .map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role }))}
          canManage={true}
        />
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                👋 Invite Team Member
              </h2>
              <button onClick={closeInviteModal} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!inviteUrl ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="member">👤 Member</option>
                    <option value="manager">💼 Manager</option>
                    <option value="admin">👑 Admin</option>
                    <option value="adviser">🎓 Adviser</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 py-3 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail || inviteLoading}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 hover:from-blue-600 hover:to-cyan-600"
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-green-700 font-medium mb-2">✅ Invitation Created!</p>
                  <p className="text-sm text-green-600">Share this link with {inviteEmail}:</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-mono truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${copied
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={closeInviteModal}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
