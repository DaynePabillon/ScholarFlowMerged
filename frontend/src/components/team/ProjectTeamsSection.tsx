"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import {
  FolderKanban, ChevronDown, ChevronRight, UserPlus, Crown, Users,
  Eye, Trash2, MoreVertical, Search
} from "lucide-react"

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  profile_picture?: string | null
}

interface ProjectMember {
  id: string
  name: string
  email: string
  profile_picture?: string | null
  role: 'lead' | 'member' | 'viewer'
  assigned_at: string
}

interface Project {
  id: string
  name: string
  status: string
  priority: string
  members?: ProjectMember[]
  loadingMembers?: boolean
}

interface ProjectTeamsSectionProps {
  organizationId: string
  orgMembers: OrgMember[]
  canManage: boolean
}

const ROLE_CONFIG = {
  lead: { label: 'Lead', color: 'bg-purple-100 text-purple-700', icon: <Crown className="w-3 h-3" /> },
  member: { label: 'Member', color: 'bg-blue-100 text-blue-700', icon: <Users className="w-3 h-3" /> },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-600', icon: <Eye className="w-3 h-3" /> },
}

export default function ProjectTeamsSection({ organizationId, orgMembers, canManage }: ProjectTeamsSectionProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [addingToProject, setAddingToProject] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ userId: '', role: 'member' as 'lead' | 'member' | 'viewer' })
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const token = () => localStorage.getItem('token')

  useEffect(() => {
    fetchProjects()
  }, [organizationId])

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects?organization_id=${organizationId}`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) return
      const data: Project[] = await res.json()
      setProjects(data.map(p => ({ ...p, members: undefined, loadingMembers: false })))
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectMembers = async (projectId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, loadingMembers: true } : p))
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) return
      const members: ProjectMember[] = await res.json()
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, members, loadingMembers: false } : p))
    } catch {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, loadingMembers: false } : p))
    }
  }

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
        const project = projects.find(p => p.id === projectId)
        if (!project?.members) fetchProjectMembers(projectId)
      }
      return next
    })
  }

  const handleAddMember = async (projectId: string) => {
    if (!addForm.userId) return
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: addForm.userId, role: addForm.role })
      })
      if (res.ok) {
        setAddingToProject(null)
        setAddForm({ userId: '', role: 'member' })
        fetchProjectMembers(projectId)
      }
    } catch (err) {
      console.error('Error adding project member:', err)
    }
  }

  const handleRoleChange = async (projectId: string, memberId: string, newRole: string) => {
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/members/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ role: newRole })
      })
      fetchProjectMembers(projectId)
    } catch (err) {
      console.error('Error changing role:', err)
    }
  }

  const handleRemoveMember = async (projectId: string, memberId: string) => {
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      })
      fetchProjectMembers(projectId)
    } catch (err) {
      console.error('Error removing member:', err)
    }
  }

  const filteredProjects = projects.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) return <div className="text-center py-8 text-gray-400">Loading projects...</div>

  return (
    <div className="space-y-4" onClick={() => setActionMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-500" />
            Project Teams
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage member roles within each project</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-white/70 dark:bg-slate-800/70 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <FolderKanban className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No projects found</p>
        </div>
      )}

      {filteredProjects.map(project => {
        const isExpanded = expandedProjects.has(project.id)
        const members = project.members ?? []
        const alreadyAdded = new Set(members.map(m => m.id))
        const availableToAdd = orgMembers.filter(m => !alreadyAdded.has(m.id))

        return (
          <div key={project.id} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-md overflow-hidden">
            {/* Project header row */}
            <button
              onClick={() => toggleExpand(project.id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-blue-50/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <FolderKanban className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-gray-800">{project.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  project.status === 'active' ? 'bg-green-100 text-green-700' :
                  project.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-amber-100 text-amber-700'
                }`}>{project.status}</span>
              </div>
              <span className="text-sm text-gray-400">
                {project.members !== undefined ? `${project.members.length} member${project.members.length !== 1 ? 's' : ''}` : ''}
              </span>
            </button>

            {/* Expanded member list */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-6 py-4 space-y-3">
                {project.loadingMembers && (
                  <p className="text-sm text-gray-400 text-center py-2">Loading members...</p>
                )}

                {!project.loadingMembers && members.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">No members assigned yet.</p>
                )}

                {members.map(member => {
                  const roleConfig = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member
                  const menuKey = `${project.id}-${member.id}`
                  return (
                    <div key={member.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        {member.profile_picture ? (
                          <img src={member.profile_picture} alt={member.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{member.name}</p>
                          <p className="text-xs text-gray-400">{member.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleConfig.color}`}>
                          {roleConfig.icon}
                          {roleConfig.label}
                        </span>

                        {canManage && (
                          <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setActionMenu(prev => prev === menuKey ? null : menuKey)}
                              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                            {actionMenu === menuKey && (
                              <div className="absolute right-0 top-7 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">Change Role</div>
                                {(['lead', 'member', 'viewer'] as const).filter(r => r !== member.role).map(r => (
                                  <button
                                    key={r}
                                    onClick={() => { handleRoleChange(project.id, member.id, r); setActionMenu(null) }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 capitalize"
                                  >
                                    {ROLE_CONFIG[r].icon}
                                    Set as {ROLE_CONFIG[r].label}
                                  </button>
                                ))}
                                <div className="border-t border-gray-100 mt-1">
                                  <button
                                    onClick={() => { handleRemoveMember(project.id, member.id); setActionMenu(null) }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3 h-3" /> Remove from project
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Add member form */}
                {canManage && (
                  <div className="pt-2 border-t border-gray-100">
                    {addingToProject === project.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <select
                          value={addForm.userId}
                          onChange={e => setAddForm(f => ({ ...f, userId: e.target.value }))}
                          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          <option value="">Select member...</option>
                          {availableToAdd.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                          ))}
                        </select>
                        <select
                          value={addForm.role}
                          onChange={e => setAddForm(f => ({ ...f, role: e.target.value as 'lead' | 'member' | 'viewer' }))}
                          className="text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          <option value="lead">Lead</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleAddMember(project.id)}
                          disabled={!addForm.userId}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingToProject(null); setAddForm({ userId: '', role: 'member' }) }}
                          className="px-3 py-2 text-gray-500 text-sm rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingToProject(project.id); setAddForm({ userId: '', role: 'member' }) }}
                        className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 font-medium mt-1"
                      >
                        <UserPlus className="w-4 h-4" /> Add member to project
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
