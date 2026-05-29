"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect, useCallback } from "react"
import {
  BarChart3, TrendingUp, Users, CheckSquare, MessageSquare,
  Sparkles, AlertTriangle, Trophy, Lightbulb, RefreshCw,
  ChevronRight, Star, Download
} from "lucide-react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"

interface TeamData {
  id: string
  name: string
  team_number: number
  adviser_name: string
  proposed_project: string
  status: string
  grade: string
  member_count: string
  total_checkpoints: string
  completed_checkpoints: string
  comment_count: string
}

interface AnalyticsOverview {
  totalTeams: number
  totalMembers: number
  totalComments: number
  checkpoints: {
    total: number
    completed: number
    in_progress: number
    pending: number
  }
  teamsByStatus: Record<string, number>
  teams: TeamData[]
  recentActivity: Array<{
    user_name: string
    content: string
    created_at: string
    team_name: string
  }>
}

interface ScoreBreakdown {
  schedule_fit: number
  momentum: number
  discipline: number
  engagement: number
  distribution: number
  collaboration: number
}

interface TeamHealth {
  team_id: string
  name: string
  team_number: number
  health_score: number
  classification: 'Top Performer' | 'On Track' | 'Watch' | 'At Risk'
  breakdown: ScoreBreakdown
  weighted_breakdown: ScoreBreakdown
  strengths: string[]
  concerns: string[]
  suggested_actions: string[]
  narrative: string | null
  signals?: {
    overall_progress_pct: number
    expected_progress_pct: number
    schedule_delta_pct: number
    completed_count: number
    total_count: number
    velocity_7d: number
    overdue_count: number
    blocked_count: number
    participation_ratio: number
    active_members_7d: number
    member_count: number
    total_discussions: number
    work_concentration: number
  }
}

interface AIInsights {
  summary: string
  recommendations: string[]
  atRiskTeams: Array<{ name: string; reason: string; classification?: string; score?: number }>
  topPerformers: Array<{ name: string; reason: string; classification?: string; score?: number }>
  keyInsight: string
  cached?: boolean
  generated_at?: string
  // New richer fields (optional during rollout)
  class_health?: {
    overall_score: number
    team_count: number
    medians?: any
  }
  teams?: TeamHealth[]
  executive_summary?: string
  focus_this_week?: string
}

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member' | 'adviser'
}

// ─── Team Health Card ───
// Per-team card showing classification, health score, strengths, concerns,
// and an expandable score breakdown. Classifications are computed
// deterministically on the backend — NOT by the AI — so the chips here
// always reflect hard data.
function TeamHealthCard({ team, orgId }: { team: TeamHealth; orgId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null)

  const classificationStyle = {
    'Top Performer': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'On Track': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    'Watch': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    'At Risk': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  }[team.classification]

  const scoreColor =
    team.health_score >= 75 ? 'text-emerald-600' :
    team.health_score >= 50 ? 'text-blue-600' :
    team.health_score >= 30 ? 'text-amber-600' :
    'text-red-600'

  const sendFeedback = async (kind: 'correct' | 'incorrect') => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      await fetch(`${API_URL}/api/analytics/ai-insights/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_group_id: team.team_id,
          classification: team.classification,
          feedback: kind,
        }),
      })
      setFeedbackSent(kind)
    } catch (err) {
      console.error('Feedback failed:', err)
    }
  }

  return (
    <div className={`${classificationStyle.bg} border ${classificationStyle.border} rounded-xl p-4 transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${classificationStyle.dot}`} />
            <h5 className="text-sm font-bold text-gray-800 truncate">{team.name}</h5>
            <span className={`text-[10px] font-black uppercase tracking-wider ${classificationStyle.text}`}>
              {team.classification}
            </span>
          </div>

          {team.narrative && (
            <p className="text-xs text-gray-600 leading-relaxed mb-2">{team.narrative}</p>
          )}

          {/* Signal strip */}
          {team.signals && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-2">
              <span>Progress: <span className="font-bold text-gray-700">{team.signals.overall_progress_pct}%</span> (exp {team.signals.expected_progress_pct}%)</span>
              <span>Velocity 7d: <span className="font-bold text-gray-700">{team.signals.velocity_7d}</span></span>
              <span>Overdue: <span className={`font-bold ${team.signals.overdue_count > 0 ? 'text-red-600' : 'text-gray-700'}`}>{team.signals.overdue_count}</span></span>
              <span>Active: <span className="font-bold text-gray-700">{team.signals.active_members_7d}/{team.signals.member_count}</span></span>
              <span>Discussions: <span className="font-bold text-gray-700">{team.signals.total_discussions}</span></span>
            </div>
          )}

          {/* Strengths */}
          {team.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {team.strengths.slice(0, 2).map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
          {/* Concerns */}
          {team.concerns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {team.concerns.slice(0, 3).map((c, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                  ⚠ {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-2xl font-black ${scoreColor}`}>{team.health_score}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">/ 100</div>
        </div>
      </div>

      {/* Expandable breakdown + feedback */}
      <div className="mt-3 pt-3 border-t border-gray-200/50 flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          {expanded ? 'Hide' : 'Why this score?'}
        </button>

        {feedbackSent ? (
          <span className="text-[11px] text-gray-400 italic">Thanks for the feedback</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Looks right?</span>
            <button
              onClick={() => sendFeedback('correct')}
              className="text-[10px] px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200 font-bold"
              title="Classification is accurate"
            >
              Yes
            </button>
            <button
              onClick={() => sendFeedback('incorrect')}
              className="text-[10px] px-2 py-0.5 bg-white hover:bg-red-50 text-red-600 rounded-full border border-red-200 font-bold"
              title="Classification feels wrong"
            >
              No
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 bg-white/80 rounded-lg p-3 border border-gray-200">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</div>
          <div className="space-y-2">
            {Object.entries(team.breakdown).map(([key, val]) => {
              const labels: Record<string, { label: string; weight: string }> = {
                schedule_fit: { label: 'Schedule fit', weight: '40%' },
                momentum: { label: 'Momentum', weight: '20%' },
                discipline: { label: 'On-time discipline', weight: '15%' },
                engagement: { label: 'Member engagement', weight: '10%' },
                distribution: { label: 'Work distribution', weight: '10%' },
                collaboration: { label: 'Collaboration', weight: '5%' },
              }
              const info = labels[key] || { label: key, weight: '' }
              const pct = val as number
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="text-[11px] text-gray-600 w-44 flex items-center justify-between">
                    <span>{info.label}</span>
                    <span className="text-[9px] text-gray-400 font-bold">{info.weight}</span>
                  </div>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-gray-700 w-10 text-right">{pct}</div>
                </div>
              )
            })}
          </div>
          {team.suggested_actions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Suggested actions</div>
              <ul className="space-y-1">
                {team.suggested_actions.map((a, i) => (
                  <li key={i} className="text-[11px] text-gray-600 flex items-start gap-2">
                    <span className="text-indigo-400 flex-shrink-0">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Simple Bar Chart Component ───
function BarChartSimple({ data, maxVal }: { data: { label: string; value: number; color: string }[]; maxVal: number }) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: 'var(--color-textSecondary)' }}>{item.label}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{item.value}</span>
          </div>
          <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'var(--color-hover)' }}>
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${item.color}`}
              style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [isStudent, setIsStudent] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/"); return }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        const { organizations: orgs, ...userData } = data
        setUser(userData)
        setOrganizations(orgs || [])
        if (orgs?.length > 0) setSelectedOrg(orgs[0])
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('organizations', JSON.stringify(orgs || []))
        setIsLoading(false)
      })
      .catch(() => { router.push("/"); setIsLoading(false) })
  }, [router])

  const fetchOverview = useCallback(async () => {
    if (!selectedOrg) return
    const token = localStorage.getItem("token")
    if (!token) return

    setOverviewLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/analytics/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': selectedOrg.id,
        }
      })
      if (res.status === 403) {
        setIsStudent(true)
        setOverviewLoading(false)
        return
      }
      if (res.ok) {
        setIsStudent(false)
        setOverview(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    }
    setOverviewLoading(false)
  }, [selectedOrg])

  useEffect(() => {
    if (selectedOrg) {
      fetchOverview()
      fetchAIInsights(false) // auto-load cached on page visit
    }
  }, [selectedOrg, fetchOverview])

  const fetchAIInsights = async (forceRefresh = false) => {
    if (!selectedOrg) return
    const token = localStorage.getItem("token")
    if (!token) return

    setInsightsLoading(true)
    if (forceRefresh) setInsights(null)
    try {
      const url = forceRefresh
        ? `${API_URL}/api/analytics/ai-insights?refresh=true`
        : `${API_URL}/api/analytics/ai-insights`
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': selectedOrg.id,
        }
      })
      if (res.ok) setInsights(await res.json())
    } catch (err) {
      console.error('Failed to fetch AI insights:', err)
    }
    setInsightsLoading(false)
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  // Student / member view — restricted
  if (isStudent) {
    return (
      <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-12 border border-white/40 shadow-lg">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Analytics Not Available</h2>
            <p className="text-gray-500">Analytics and AI Insights are available for teachers, adviser, and admins only.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const checkpointRate = overview && overview.checkpoints.total > 0
    ? Math.round((overview.checkpoints.completed / overview.checkpoints.total) * 100)
    : 0

  // Sort teams — prefer health score (deterministic) over raw progress.
  const healthByName = new Map<string, TeamHealth>()
  insights?.teams?.forEach(t => healthByName.set(t.name, t))

  const sortedTeams = overview ? [...overview.teams].sort((a, b) => {
    const ha = healthByName.get(a.name)?.health_score
    const hb = healthByName.get(b.name)?.health_score
    if (ha !== undefined && hb !== undefined) return hb - ha
    const progressA = parseInt(a.total_checkpoints) > 0 ? parseInt(a.completed_checkpoints) / parseInt(a.total_checkpoints) : 0
    const progressB = parseInt(b.total_checkpoints) > 0 ? parseInt(b.completed_checkpoints) / parseInt(b.total_checkpoints) : 0
    return progressB - progressA
  }) : []

  const maxMembers = overview ? Math.max(...overview.teams.map(t => parseInt(t.member_count)), 1) : 1
  const maxComments = overview ? Math.max(...overview.teams.map(t => parseInt(t.comment_count)), 1) : 1

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Analytics & AI Insights
            </h1>
            <p className="mt-1" style={{ color: 'var(--color-textSecondary)' }}>Powered by Google Gemini • Teacher Command Center</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchOverview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors"
              style={{ 
                border: '1px solid var(--color-border)', 
                color: 'var(--color-textSecondary)',
                backgroundColor: 'var(--color-surface)'
              }}
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {overviewLoading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
              <p style={{ color: 'var(--color-textSecondary)' }}>Loading analytics data...</p>
            </div>
          </div>
        ) : overview ? (
          <div className="space-y-8">

            {/* ─── Key Metrics ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl"><Users className="w-5 h-5 text-blue-600" /></div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-textSecondary)' }}>Total Teams</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{overview.totalTeams}</p>
                <p className="text-xs text-blue-500 mt-1 font-medium">{overview.totalMembers} total members</p>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-green-100 rounded-xl"><CheckSquare className="w-5 h-5 text-green-600" /></div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-textSecondary)' }}>Checkpoints</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{overview.checkpoints.completed}<span className="text-lg" style={{ color: 'var(--color-textSecondary)', opacity: 0.6 }}>/{overview.checkpoints.total}</span></p>
                <p className="text-xs text-green-500 mt-1 font-medium">{checkpointRate}% completion rate</p>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-purple-100 rounded-xl"><MessageSquare className="w-5 h-5 text-purple-600" /></div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-textSecondary)' }}>Discussions</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{overview.totalComments}</p>
                <p className="text-xs text-purple-500 mt-1 font-medium">Comments across teams</p>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-orange-100 rounded-xl"><TrendingUp className="w-5 h-5 text-orange-600" /></div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-textSecondary)' }}>Progress Rate</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{checkpointRate}%</p>
                <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${checkpointRate}%` }} />
                </div>
              </div>
            </div>

            {/* ─── AI Insights Panel ─── */}
            <div className="bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 backdrop-blur-xl rounded-2xl border border-indigo-200/50 shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-indigo-100/50 bg-white/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>AI Insights</h3>
                    <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>Powered by Google Gemini 2.5 Flash{insights?.cached ? " • Cached" : ""}</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchAIInsights(true)}
                  disabled={insightsLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md text-sm font-medium"
                >
                  {insightsLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
                  ) : insights ? (
                    <><RefreshCw className="w-4 h-4" /> Regenerate</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Insights</>
                  )}
                </button>
              </div>

              <div className="p-6">
                {!insights && !insightsLoading && (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-1">Click &quot;Generate Insights&quot; to get AI-powered analysis</p>
                    <p className="text-xs text-gray-400">Gemini will analyze your team data and provide actionable recommendations</p>
                  </div>
                )}

                {insightsLoading && (
                  <div className="text-center py-8">
                    <div className="animate-pulse flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-200 rounded-full flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-indigo-500 animate-spin" />
                      </div>
                      <p className="text-indigo-600 font-medium">Gemini is analyzing your teams...</p>
                      <p className="text-xs text-gray-400">This may take a few seconds</p>
                    </div>
                  </div>
                )}

                {insights && (
                  <div className="space-y-6">
                    {/* Cached status */}
                    {insights.generated_at && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {insights.cached && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200 font-medium">Cached — no tokens used</span>}
                        <span>Last generated: {new Date(insights.generated_at).toLocaleString()}</span>
                      </div>
                    )}
                    {/* Summary */}
                    <div className="bg-white/60 rounded-xl p-4 border border-indigo-100">
                      <p className="text-sm text-gray-700 leading-relaxed">{insights.summary}</p>
                    </div>

                    {/* Key Insight */}
                    {insights.keyInsight && (
                      <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Key Focus This Week</p>
                          <p className="text-sm text-gray-700">{insights.keyInsight}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Recommendations */}
                      <div className="bg-white/60 rounded-xl p-4 border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5" /> Recommendations
                        </h4>
                        <ul className="space-y-2">
                          {insights.recommendations.map((r, i) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                              <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* At-Risk Teams */}
                      <div className="bg-white/60 rounded-xl p-4 border border-red-100">
                        <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> At-Risk Teams
                        </h4>
                        {insights.atRiskTeams.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No at-risk teams identified!</p>
                        ) : (
                          <ul className="space-y-2">
                            {insights.atRiskTeams.map((t, i) => (
                              <li key={i} className="text-xs">
                                <span className="font-semibold text-red-700">{t.name}</span>
                                {t.score !== undefined && (
                                  <span className="ml-1 text-[10px] text-red-500 font-bold">({t.score}/100)</span>
                                )}
                                <span className="text-gray-500 ml-1">— {t.reason}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Top Performers */}
                      <div className="bg-white/60 rounded-xl p-4 border border-emerald-100">
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5" /> Top Performers
                        </h4>
                        {insights.topPerformers.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Not enough data yet</p>
                        ) : (
                          <ul className="space-y-2">
                            {insights.topPerformers.map((t, i) => (
                              <li key={i} className="text-xs">
                                <span className="font-semibold text-emerald-700">{t.name}</span>
                                {t.score !== undefined && (
                                  <span className="ml-1 text-[10px] text-emerald-500 font-bold">({t.score}/100)</span>
                                )}
                                <span className="text-gray-500 ml-1">— {t.reason}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* ─── Team Health Cards (new rich view) ─── */}
                    {insights.teams && insights.teams.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-indigo-100/50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500" /> Team Health Breakdown
                          </h4>
                          {insights.class_health && (
                            <span className="text-xs text-gray-500">
                              Class avg: <span className="font-bold text-indigo-600">{insights.class_health.overall_score}/100</span>
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {insights.teams.map((team) => (
                            <TeamHealthCard
                              key={team.team_id}
                              team={team}
                              orgId={selectedOrg!.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Charts Row ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Team Members Distribution */}
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" /> Members per Team
                </h3>
                <BarChartSimple
                  data={overview.teams.map((t, i) => ({
                    label: t.name,
                    value: parseInt(t.member_count),
                    color: ['bg-blue-500', 'bg-cyan-500', 'bg-teal-500', 'bg-indigo-500'][i % 4],
                  }))}
                  maxVal={maxMembers}
                />
              </div>

              {/* Discussion Activity Distribution */}
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-500" /> Discussion Activity
                </h3>
                <BarChartSimple
                  data={overview.teams.map((t, i) => ({
                    label: t.name,
                    value: parseInt(t.comment_count),
                    color: ['bg-purple-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-violet-500'][i % 4],
                  }))}
                  maxVal={maxComments}
                />
              </div>
            </div>

            {/* ─── Team Leaderboard ─── */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
              <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Team Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Rank</th>
                      <th className="text-left py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Team</th>
                      <th className="text-left py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Project</th>
                      <th className="text-center py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Members</th>
                      <th className="text-center py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Health</th>
                      <th className="text-center py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</th>
                      <th className="text-center py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Discussions</th>
                      <th className="text-center py-3 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, i) => {
                      const totalCp = parseInt(team.total_checkpoints)
                      const completedCp = parseInt(team.completed_checkpoints)
                      const progress = totalCp > 0 ? Math.round((completedCp / totalCp) * 100) : 0
                      return (
                        <tr key={team.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5">
                              {i === 0 && <Star className="w-4 h-4 text-amber-400" />}
                              {i === 1 && <Star className="w-4 h-4 text-gray-400" />}
                              {i === 2 && <Star className="w-4 h-4 text-orange-400" />}
                              <span className="text-gray-600 font-semibold">#{i + 1}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-semibold text-gray-800">{team.name}</span>
                            {team.adviser_name && <span className="text-xs text-gray-400 ml-2">• {team.adviser_name}</span>}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs text-gray-500 truncate max-w-[200px] block">
                              {team.proposed_project || <span className="italic text-gray-300">No project yet</span>}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="text-gray-700 font-medium">{team.member_count}</span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {(() => {
                              const h = healthByName.get(team.name)
                              if (!h) return <span className="text-gray-300 text-xs">—</span>
                              const color =
                                h.health_score >= 75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                h.health_score >= 50 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                h.health_score >= 30 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-red-100 text-red-700 border-red-200'
                              return (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${color}`} title={h.classification}>
                                  {h.health_score}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${progress >= 70 ? 'bg-green-500' : progress >= 30 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                  style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-8">{progress}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`text-sm font-medium ${parseInt(team.comment_count) > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                              {team.comment_count}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`text-xs px-2 py-1 rounded-lg font-bold ${team.grade
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-50 text-gray-300'
                              }`}>
                              {team.grade || '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── Recent Activity ─── */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
              <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" /> Recent Discussion Activity
              </h3>
              {overview.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No discussion activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overview.recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/40 transition-colors">
                      <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                          <span className="font-semibold text-blue-600">{activity.user_name}</span>
                          <span className="text-gray-400 mx-1.5">in</span>
                          <span className="font-medium text-gray-700">{activity.team_name}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.content}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(activity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                          {new Date(activity.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Data Available</h2>
            <p className="text-gray-500 mb-4">Import your class data from ScholarSync to see analytics here.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
