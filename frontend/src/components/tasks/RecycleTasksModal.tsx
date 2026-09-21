"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { X, RotateCcw, Loader2, Layers, Users } from 'lucide-react'

interface RecycleTasksModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  sourceTaskIds: string[]
  onRecycled: () => void
}

interface ProjectOption { id: string; name: string }
interface TeamOption { id: string; name: string }

/**
 * Recycle selected (completed/archived) tasks into a NEW or existing project,
 * assigned to a NEW or existing team. Tasks are cloned as fresh `todo` items. (Rev 4)
 */
export default function RecycleTasksModal({
  isOpen,
  onClose,
  organizationId,
  sourceTaskIds,
  onRecycled,
}: RecycleTasksModalProps) {
  const [projectMode, setProjectMode] = useState<'new' | 'existing'>('new')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [existingProjectId, setExistingProjectId] = useState('')

  const [teamMode, setTeamMode] = useState<'new' | 'existing'>('new')
  const [teamName, setTeamName] = useState('')
  const [teamMemberEmails, setTeamMemberEmails] = useState('')
  const [existingTeamId, setExistingTeamId] = useState('')

  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Reset transient state each time the modal opens
    setError(null)
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }

    fetch(`${API_URL}/api/projects?organization_id=${organizationId}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data.map((p: any) => ({ id: p.id, name: p.name })) : []))
      .catch(() => setProjects([]))

    fetch(`${API_URL}/api/organizations/${organizationId}/team-groups`, { headers })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((data) => setTeams((data.teams || []).map((t: any) => ({ id: t.id, name: t.name }))))
      .catch(() => setTeams([]))
  }, [isOpen, organizationId])

  if (!isOpen) return null

  const handleSubmit = async () => {
    setError(null)

    const project =
      projectMode === 'existing'
        ? { id: existingProjectId }
        : { name: projectName.trim(), description: projectDescription.trim() || undefined }
    const team =
      teamMode === 'existing'
        ? { id: existingTeamId }
        : {
            name: teamName.trim(),
            members: teamMemberEmails
              .split(/[\n,]/)
              .map((e) => e.trim())
              .filter(Boolean)
              .map((email) => ({ email, name: email })),
          }

    if (projectMode === 'existing' && !existingProjectId) return setError('Choose an existing project.')
    if (projectMode === 'new' && !project.name) return setError('Enter a name for the new project.')
    if (teamMode === 'existing' && !existingTeamId) return setError('Choose an existing team.')
    if (teamMode === 'new' && !team.name) return setError('Enter a name for the new team.')

    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/tasks/recycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organization_id: organizationId,
          source_task_ids: sourceTaskIds,
          project,
          team,
        }),
      })
      if (res.ok) {
        onRecycled()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err.error || `Failed to recycle tasks (${res.status})`)
      }
    } catch (e) {
      console.error('Recycle failed:', e)
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto border dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-500" /> Recycle Tasks
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Clone <span className="font-semibold">{sourceTaskIds.length}</span>{' '}
          {sourceTaskIds.length === 1 ? 'task' : 'tasks'} into a project for a team as fresh{' '}
          <span className="font-medium">To&nbsp;Do</span> tasks (assignees, dates and progress are cleared).
        </p>

        {/* Project */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Target Project
          </label>
          <div className="flex gap-2 mb-3">
            {(['new', 'existing'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setProjectMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  projectMode === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white/70 dark:bg-slate-800/70 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {m === 'new' ? 'New project' : 'Existing project'}
              </button>
            ))}
          </div>
          {projectMode === 'new' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="New project name"
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400 dark:bg-slate-800/70 dark:text-white"
              />
              <input
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400 dark:bg-slate-800/70 dark:text-white"
              />
            </div>
          ) : (
            <select
              value={existingProjectId}
              onChange={(e) => setExistingProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400 dark:bg-slate-800/70 dark:text-white"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Team */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            <Users className="w-4 h-4 text-violet-500" /> Target Team
          </label>
          <div className="flex gap-2 mb-3">
            {(['new', 'existing'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTeamMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  teamMode === m
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white/70 dark:bg-slate-800/70 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {m === 'new' ? 'New team' : 'Existing team'}
              </button>
            ))}
          </div>
          {teamMode === 'new' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="New team name"
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-400 dark:bg-slate-800/70 dark:text-white"
              />
              <textarea
                value={teamMemberEmails}
                onChange={(e) => setTeamMemberEmails(e.target.value)}
                placeholder="Member emails (optional) — one per line or comma-separated"
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-400 dark:bg-slate-800/70 dark:text-white resize-y"
              />
            </div>
          ) : (
            <select
              value={existingTeamId}
              onChange={(e) => setExistingTeamId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-400 dark:bg-slate-800/70 dark:text-white"
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            ⚠ {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || sourceTaskIds.length === 0}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-medium disabled:opacity-50 hover:from-indigo-600 hover:to-violet-600 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {submitting ? 'Recycling…' : 'Recycle'}
          </button>
        </div>
      </div>
    </div>
  )
}
