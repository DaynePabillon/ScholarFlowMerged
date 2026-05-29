"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import apiClient from "@/lib/api/client"
import AppLayout from "@/components/layout/AppLayout"
import {
  Layers, Plus, Search, X, Edit3, Trash2, ChevronRight,
  Calendar, CheckSquare, AlertCircle, Clock,
  TrendingUp, Archive, PauseCircle, Loader2, FolderOpen, Users
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id: string
  name: string
  role: "admin" | "manager" | "member" | "adviser"
}

interface Project {
  id: string
  organization_id: string
  name: string
  description: string | null
  status: "planning" | "active" | "on_hold" | "completed" | "archived"
  priority: "low" | "medium" | "high" | "critical"
  start_date: string | null
  end_date: string | null
  budget: number | null
  created_by: string | null
  created_at: string
  organization_name?: string
  created_by_name?: string
  user_role?: string
  task_count?: number
  completed_tasks?: number
}

interface FormData {
  name: string
  description: string
  status: Project["status"]
  priority: Project["priority"]
  start_date: string
  end_date: string
  budget: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Project["status"], { label: string; color: string; icon: React.ElementType }> = {
  planning:  { label: "Planning",  color: "bg-slate-100 text-slate-700",   icon: Clock },
  active:    { label: "Active",    color: "bg-emerald-100 text-emerald-700", icon: TrendingUp },
  on_hold:   { label: "On Hold",   color: "bg-amber-100 text-amber-700",   icon: PauseCircle },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700",     icon: CheckSquare },
  archived:  { label: "Archived",  color: "bg-gray-100 text-gray-500",     icon: Archive },
}

const PRIORITY_CONFIG: Record<Project["priority"], { label: string; color: string }> = {
  low:      { label: "Low",      color: "bg-green-50 text-green-700 border border-green-200" },
  medium:   { label: "Medium",   color: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  high:     { label: "High",     color: "bg-orange-50 text-orange-700 border border-orange-200" },
  critical: { label: "Critical", color: "bg-red-50 text-red-700 border border-red-200" },
}

const EMPTY_FORM: FormData = {
  name: "", description: "", status: "planning",
  priority: "medium", start_date: "", end_date: "", budget: "",
}

const STATUS_FILTERS = ["all", "planning", "active", "on_hold", "completed", "archived"] as const

// ── Modal wrapper — defined OUTSIDE the page so React never recreates it ─────
// (Defining components inside a parent causes remount on every render, breaking inputs)
function ProjectModal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  )
}

// ── ProjectForm — defined OUTSIDE the page so React never recreates it ────────
// (Defining components inside a parent causes remount on every render, breaking inputs)

interface ProjectFormProps {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  formError: string
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

function ProjectForm({ formData, setFormData, formError, submitting, onSubmit, onCancel }: ProjectFormProps) {
  return (
    <div className="space-y-4">
      {formError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {formError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Website Redesign"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="What is this project about?"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={e => setFormData(f => ({ ...f, status: e.target.value as Project["status"] }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={formData.priority}
            onChange={e => setFormData(f => ({ ...f, priority: e.target.value as Project["priority"] }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={formData.start_date}
            onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={formData.end_date}
            onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget (optional)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formData.budget}
          onChange={e => setFormData(f => ({ ...f, budget: e.target.value }))}
          placeholder="e.g. 50000"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!formData.name.trim() || submitting}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Saving…" : "Save Project"}
        </button>
      </div>
    </div>
  )
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()

  // Auth state
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [mounted, setMounted] = useState(false)

  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Teams mapped by project_id
  const [teamsByProject, setTeamsByProject] = useState<Record<string, { id: string; team_number: number; name: string; member_count: number }[]>>({})

  // UI state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Step 1: Load from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    const storedOrgs = localStorage.getItem("organizations")
    const storedSelectedOrg = localStorage.getItem("selectedOrganization")
    if (storedUser) setUser(JSON.parse(storedUser))
    if (storedOrgs) setOrganizations(JSON.parse(storedOrgs))
    if (storedSelectedOrg) setSelectedOrg(JSON.parse(storedSelectedOrg))
    setMounted(true)
  }, [])

  // Step 2: API fallback
  useEffect(() => {
    if (!mounted) return
    const token = localStorage.getItem("token")
    if (!token) { router.push("/"); return }
    if (!user) {
      apiClient.get("/auth/me")
        .then(res => {
          const { organizations: orgs, onboarding_data, ...userData } = res.data
          setUser({ ...userData, onboarding_data })
          setOrganizations(orgs || [])
          localStorage.setItem("user", JSON.stringify({ ...userData, onboarding_data }))
          localStorage.setItem("organizations", JSON.stringify(orgs || []))
          if (orgs?.length > 0 && !selectedOrg) {
            setSelectedOrg(orgs[0])
            localStorage.setItem("selectedOrganization", JSON.stringify(orgs[0]))
          }
        })
        .catch(() => router.push("/"))
    }
  }, [mounted, router, user, selectedOrg])

  // Fetch projects + org teams (to show which teams are on each project).
  // Teams fetch is best-effort — if the migration hasn't been run yet the
  // team-group query will 500, but projects must still render.
  const fetchProjects = useCallback(async (orgId: string) => {
    setLoading(true)
    setError("")
    try {
      const projectsRes = await apiClient.get(`/projects?organization_id=${orgId}`)
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : [])
    } catch {
      setError("Failed to load projects. Please try again.")
    } finally {
      setLoading(false)
    }

    // Best-effort: fetch teams and group by project. Silently ignored on failure.
    try {
      const teamsRes = await apiClient.get(`/organizations/${orgId}/team-groups`)
      const allTeams: any[] = teamsRes.data?.teams || []
      const grouped: Record<string, { id: string; team_number: number; name: string; member_count: number }[]> = {}
      for (const t of allTeams) {
        if (t.project_id) {
          if (!grouped[t.project_id]) grouped[t.project_id] = []
          grouped[t.project_id].push({
            id: t.id,
            team_number: t.team_number,
            name: t.name,
            member_count: Number(t.member_count) || 0,
          })
        }
      }
      setTeamsByProject(grouped)
    } catch {
      // Migration 039 may not have been applied yet — ignore silently
    }
  }, [])

  useEffect(() => {
    if (selectedOrg) fetchProjects(selectedOrg.id)
  }, [selectedOrg, fetchProjects])

  const handleOrgChange = (org: Organization) => {
    setSelectedOrg(org)
    localStorage.setItem("selectedOrganization", JSON.stringify(org))
  }

  // Create
  const handleCreate = async () => {
    if (!formData.name.trim() || !selectedOrg) return
    setSubmitting(true)
    setFormError("")
    try {
      await apiClient.post("/projects", {
        organization_id: selectedOrg.id,
        name: formData.name.trim(),
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
      })
      setShowCreateModal(false)
      setFormData({ ...EMPTY_FORM })
      fetchProjects(selectedOrg.id)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Failed to create project.")
    } finally {
      setSubmitting(false)
    }
  }

  // Edit
  const openEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      description: project.description || "",
      status: project.status,
      priority: project.priority,
      start_date: project.start_date ? project.start_date.split("T")[0] : "",
      end_date: project.end_date ? project.end_date.split("T")[0] : "",
      budget: project.budget != null ? String(project.budget) : "",
    })
    setFormError("")
  }

  const handleUpdate = async () => {
    if (!editingProject || !formData.name.trim()) return
    setSubmitting(true)
    setFormError("")
    try {
      await apiClient.put(`/projects/${editingProject.id}`, {
        name: formData.name.trim(),
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
      })
      setEditingProject(null)
      setFormData({ ...EMPTY_FORM })
      if (selectedOrg) fetchProjects(selectedOrg.id)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Failed to update project.")
    } finally {
      setSubmitting(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deletingProject) return
    setSubmitting(true)
    try {
      await apiClient.delete(`/projects/${deletingProject.id}`)
      setDeletingProject(null)
      if (selectedOrg) fetchProjects(selectedOrg.id)
    } catch {
      /* keep modal open */
    } finally {
      setSubmitting(false)
    }
  }

  // Derived
  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const canManage = selectedOrg?.role === "admin" || selectedOrg?.role === "manager"
  const canDelete = selectedOrg?.role === "admin"

  const counts: Record<string, number> = {
    all: projects.length,
    planning:  projects.filter(p => p.status === "planning").length,
    active:    projects.filter(p => p.status === "active").length,
    on_hold:   projects.filter(p => p.status === "on_hold").length,
    completed: projects.filter(p => p.status === "completed").length,
    archived:  projects.filter(p => p.status === "archived").length,
  }

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={handleOrgChange}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Layers className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Projects
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedOrg?.name} · {projects.length} project{projects.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {canManage && (
              <button
                onClick={() => { setFormData({ ...EMPTY_FORM }); setFormError(""); setShowCreateModal(true) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === s
                      ? "bg-indigo-500 text-white shadow-sm"
                      : "bg-white/70 text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {s === "all" ? "All" : s === "on_hold" ? "On Hold" : s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ml-1 opacity-70">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                <div className="h-3 bg-gray-200 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl mb-6">
              <FolderOpen className="w-16 h-16 text-indigo-300 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              {searchQuery || statusFilter !== "all" ? "No projects match your filters" : "No projects yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-6 max-w-sm">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : canManage
                ? "Create your first project to start organising tasks and tracking progress."
                : "Your organisation hasn't created any projects yet."}
            </p>
            {canManage && !searchQuery && statusFilter === "all" && (
              <button
                onClick={() => { setFormData({ ...EMPTY_FORM }); setFormError(""); setShowCreateModal(true) }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Project
              </button>
            )}
          </div>
        )}

        {/* Project cards */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => {
              const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planning
              const priorityCfg = PRIORITY_CONFIG[project.priority] ?? PRIORITY_CONFIG.medium
              const StatusIcon = statusCfg.icon

              const startDate = project.start_date
                ? new Date(project.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null
              const endDate = project.end_date
                ? new Date(project.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null

              const total = project.task_count ?? 0
              const done = project.completed_tasks ?? 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <div
                  key={project.id}
                  className="group bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col overflow-hidden"
                >
                  {/* Priority accent bar */}
                  <div className={`h-1 w-full ${
                    project.priority === "critical" ? "bg-gradient-to-r from-red-500 to-rose-600" :
                    project.priority === "high"     ? "bg-gradient-to-r from-orange-400 to-amber-500" :
                    project.priority === "medium"   ? "bg-gradient-to-r from-yellow-400 to-amber-400" :
                                                      "bg-gradient-to-r from-green-400 to-teal-400"
                  }`} />

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-bold text-gray-800 leading-snug mb-2 group-hover:text-indigo-700 transition-colors">
                      {project.name}
                    </h3>

                    {/* Description */}
                    {project.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">
                        {project.description}
                      </p>
                    )}

                    {/* Dates */}
                    {(startDate || endDate) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                        <Calendar className="w-3.5 h-3.5" />
                        {startDate && endDate
                          ? `${startDate} → ${endDate}`
                          : startDate ? `Starts ${startDate}` : `Ends ${endDate}`}
                      </div>
                    )}

                    {/* Progress bar */}
                    {total > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{done}/{total} tasks done</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Budget */}
                    {project.budget != null && (
                      <div className="text-xs text-gray-400 mb-4">
                        Budget: <span className="font-semibold text-gray-600">${Number(project.budget).toLocaleString()}</span>
                      </div>
                    )}

                    {/* Assigned Teams */}
                    {(() => {
                      const teams = teamsByProject[project.id] || []
                      return (
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-medium">Teams</span>
                            {teams.length > 0 && <span className="text-gray-300">·</span>}
                            {teams.length > 0 && <span>{teams.length} assigned</span>}
                          </div>
                          {teams.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {teams.map(t => (
                                <a
                                  key={t.id}
                                  href="/boards"
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full text-xs font-semibold text-indigo-700 transition-colors cursor-pointer"
                                  title={`${t.name} · ${t.member_count} member${t.member_count !== 1 ? 's' : ''}`}
                                >
                                  <Users className="w-2.5 h-2.5" />
                                  Team {String(t.team_number).padStart(2, '0')}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No teams assigned yet</p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Actions */}
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                      <a
                        href="/tasks"
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        View Tasks
                        <ChevronRight className="w-3 h-3" />
                      </a>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(project)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit project"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeletingProject(project)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <ProjectModal>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                <Layers className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">New Project</h2>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <ProjectForm
              formData={formData}
              setFormData={setFormData}
              formError={formError}
              submitting={submitting}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </ProjectModal>
      )}

      {/* Edit modal */}
      {editingProject && (
        <ProjectModal>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                <Edit3 className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Edit Project</h2>
            </div>
            <button onClick={() => setEditingProject(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <ProjectForm
              formData={formData}
              setFormData={setFormData}
              formError={formError}
              submitting={submitting}
              onSubmit={handleUpdate}
              onCancel={() => setEditingProject(null)}
            />
          </div>
        </ProjectModal>
      )}

      {/* Delete confirm */}
      {deletingProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 w-full max-w-md animate-in zoom-in-95 duration-200 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Delete Project</h2>
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-700">"{deletingProject.name}"</span>?
                  This action cannot be undone. Tasks linked to this project will be unlinked.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProject(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl text-sm font-semibold hover:from-red-600 hover:to-rose-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Deleting…" : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
