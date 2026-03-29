"use client"

import { apiClient, API_URL } from '@/lib/api/client'
import { useState, useEffect, useCallback } from "react"
import { TrendingUp, Users, FolderKanban, CheckSquare, Calendar, X, FileText, BarChart3, Target, Sparkles, Building2, ArrowRight, Loader2, ExternalLink, MessageSquare, Award, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import OrganizationGateway from "@/components/organization/OrganizationGateway"

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member'
}

interface OnboardingPreferences {
  purpose?: string
  role?: string
  teamSize?: string
  focusAreas?: string[]
  hearAbout?: string
  completedAt?: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date?: string
}

interface Project {
  id: string
  name: string
  status: string
}

interface Member {
  user_id: string
  name: string
  email: string
  role: string
}

interface TeamOverview {
  totalTeams: number
  totalMembers: number
  totalComments: number
  checkpoints: { total: number; completed: number; in_progress: number; pending: number }
  teams: Array<{
    id: string; name: string; team_number: number; proposed_project: string | null
    adviser_name: string | null; status: string; member_count: number
    total_checkpoints: number; completed_checkpoints: number; comment_count: number
  }>
  recentActivity: Array<{ user_name: string; content: string; created_at: string; team_name: string }>
}

interface AIInsights {
  summary: string
  recommendations: string[]
  keyInsight: string
  cached?: boolean
  generated_at?: string
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [preferences, setPreferences] = useState<OnboardingPreferences | null>(null)
  const [showOrgSelector, setShowOrgSelector] = useState(false)
  const [selectingOrgId, setSelectingOrgId] = useState<string | null>(null)



  // Dashboard data state
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])

  // Team data (from analytics overview)
  const [teamData, setTeamData] = useState<TeamOverview | null>(null)
  const [teamDataLoading, setTeamDataLoading] = useState(false)

  // AI insights (for teachers/admins only)
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Refetch organizations on mount
  const refetchOrganizations = async () => {
    try {
      const response = await apiClient.get('/organizations')
      if (response.data) {
        setOrganizations(response.data)
        localStorage.setItem('organizations', JSON.stringify(response.data))
      }
    } catch (error) {
      console.error('Error refetching organizations:', error)
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      let storedToken = localStorage.getItem("token")
      let storedUser = localStorage.getItem("user")
      let storedOrgs = localStorage.getItem("organizations")

      // Token sharing: Check for ScholarSync token if SkyFlow token doesn't exist
      if (!storedToken) {
        const scholarSyncToken = localStorage.getItem("auth_token")
        if (scholarSyncToken) {
          localStorage.setItem("token", scholarSyncToken)
          storedToken = scholarSyncToken
        }
      }

      // If no token at all, redirect
      if (!storedToken) {
        console.warn("No token found, redirecting to landing")
        router.push("/landing")
        return
      }

      try {
        // Fetch/Verify user data using the centralized apiClient
        const response = await apiClient.get('/auth/me');
        const data = response.data;
        const { organizations, onboarding_data, ...userData } = data
        
        // Update storage and state
        const updatedUser = { ...userData, onboarding_data };
        localStorage.setItem('user', JSON.stringify(updatedUser))
        localStorage.setItem('organizations', JSON.stringify(organizations || []))
        
        setUser(updatedUser)
        setOrganizations(organizations || [])

        // Manage organization selection
        const storedSelectedOrg = localStorage.getItem("selectedOrganization")
        if (storedSelectedOrg) {
          setSelectedOrg(JSON.parse(storedSelectedOrg))
        } else if (organizations?.length === 1) {
          setSelectedOrg(organizations[0])
          localStorage.setItem('selectedOrganization', JSON.stringify(organizations[0]))
        } else if (organizations?.length > 1) {
          setShowOrgSelector(true)
        }

      } catch (error: any) {
        console.error("Authentication check failed:", error)
        // Only redirect if it's a 401/403 (handled by apiClient interceptor) 
        // or if we have no local user data to fall back on
        if (!storedUser || error.response?.status === 401) {
          router.push("/landing")
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!selectedOrg) return

      try {
        const [tasksRes, projectsRes, membersRes] = await Promise.all([
          apiClient.get(`/organizations/${selectedOrg.id}/tasks`),
          apiClient.get(`/organizations/${selectedOrg.id}/projects`),
          apiClient.get(`/organizations/${selectedOrg.id}/members`)
        ])
        
        setTasks(tasksRes.data.tasks || [])
        setProjects(projectsRes.data.projects || [])
        
        const d = membersRes.data
        setMembers(Array.isArray(d) ? d : (d.members || []))
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
    }
    fetchDashboardData()
  }, [selectedOrg])

  // Fetch team overview data
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!selectedOrg) return

      setTeamDataLoading(true)
      try {
        const res = await apiClient.get('/analytics/overview', {
          headers: { 'x-organization-id': selectedOrg.id }
        })
        setTeamData(res.data)
      } catch (error) {
        console.error('Error fetching team data:', error)
      }
      setTeamDataLoading(false)
    }
    fetchTeamData()
  }, [selectedOrg])

  // Fetch cached AI insights for teachers/admins (auto-load from cache)
  useEffect(() => {
    const fetchAI = async () => {
      if (!selectedOrg || selectedOrg.role === 'member') return

      setAiLoading(true)
      try {
        const res = await apiClient.get('/analytics/ai-insights', {
          headers: { 'x-organization-id': selectedOrg.id }
        })
        setAiInsights(res.data)
      } catch (error) {
        console.error('Error fetching AI insights:', error)
      }
      setAiLoading(false)
    }
    fetchAI()
  }, [selectedOrg])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/landing')
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const handleOrgChange = (org: Organization) => {
    setSelectedOrg(org)
    localStorage.setItem('selectedOrganization', JSON.stringify(org))
  }

  if (!selectedOrg) {
    return (
      <OrganizationGateway
        user={user}
        organizations={organizations}
        onSelectOrg={handleOrgChange}
        onCreateOrg={() => router.push('/onboarding')}
      />
    )
  }

  const isTeacher = selectedOrg.role === 'admin' || selectedOrg.role === 'manager'
  const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done' || t.status === 'completed').length / tasks.length) * 100) : 0
  const checkpointRate = teamData && teamData.checkpoints.total > 0
    ? Math.round((teamData.checkpoints.completed / teamData.checkpoints.total) * 100) : 0

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={handleOrgChange}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Dashboard</h1>
          <p className="mt-2 text-lg" style={{ color: 'var(--text-primary)' }}>
            Welcome back, {user.name}
            {selectedOrg.role !== 'member' && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full capitalize">{selectedOrg.role}</span>
            )}
          </p>
        </div>

        {/* ═══════════ STATS GRID ═══════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users className="w-5 h-5 text-white" />} gradient="from-purple-500 to-pink-500" label="Teams" value={teamData?.totalTeams ?? 0} sub={`${teamData?.totalMembers ?? members.length} members`} />
          <StatCard icon={<CheckSquare className="w-5 h-5 text-white" />} gradient="from-green-500 to-emerald-500" label="Checkpoints" value={teamData?.checkpoints.completed ?? 0} sub={`${teamData?.checkpoints.total ?? 0} total • ${checkpointRate}%`} />
          <StatCard icon={<MessageSquare className="w-5 h-5 text-white" />} gradient="from-blue-500 to-cyan-500" label="Discussions" value={teamData?.totalComments ?? 0} sub="Team comments" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-white" />} gradient="from-orange-500 to-red-500" label="Tasks" value={tasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.status !== 'archived').length} sub={`${tasks.length} total • ${completionRate}%`} />
        </div>

        {/* ═══════════ QUICK ACTIONS ═══════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <QuickAction href="/boards" icon={<FolderKanban className="w-4 h-4" />} label="Project Boards" color="blue" />
          {isTeacher && <QuickAction href="/analytics" icon={<BarChart3 className="w-4 h-4" />} label="AI Analytics" color="indigo" />}
          {isTeacher && <QuickAction href="/scholar/dashboard" icon={<ExternalLink className="w-4 h-4" />} label="Academic Portal" color="purple" />}
          <QuickAction href="/team" icon={<Users className="w-4 h-4" />} label="Team Members" color="cyan" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* ═══════════ LEFT COLUMN: TEAM OVERVIEW ═══════════ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Team Leaderboard */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Award className="w-5 h-5 text-amber-500" /> Team Overview
                </h2>
                <a href="/boards" className="text-sm text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {teamDataLoading ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></div>
              ) : teamData && teamData.teams.length > 0 ? (
                <div className="space-y-3">
                  {teamData.teams.slice(0, 5).map((team, i) => {
                    const progress = team.total_checkpoints > 0 ? Math.round((team.completed_checkpoints / team.total_checkpoints) * 100) : 0
                    return (
                      <div key={team.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/80 hover:bg-blue-50/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{team.proposed_project || team.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{team.member_count} members • {team.comment_count} discussions</div>
                        </div>
                        <div className="w-28 flex-shrink-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                            <span className="font-bold" style={{ color: progress >= 75 ? '#16a34a' : progress >= 40 ? '#d97706' : '#dc2626' }}>{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress >= 75 ? '#16a34a' : progress >= 40 ? '#d97706' : '#dc2626' }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {user?.scholarsyncRole === 'Student' 
                      ? "No teams assigned. Once your instructor adds you to a team, it will appear here." 
                      : "No teams yet. Import from ScholarSync to get started."}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-5" style={{ color: 'var(--text-primary)' }}>
                <MessageSquare className="w-5 h-5 text-blue-500" /> Recent Activity
              </h2>
              {teamData && teamData.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {teamData.recentActivity.slice(0, 5).map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: `hsl(${(activity.user_name.charCodeAt(0) * 37) % 360}, 60%, 50%)` }}>
                        {activity.user_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-blue-600">{activity.user_name}</span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>in {activity.team_name}</span>
                        </div>
                        <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-primary)' }}>{activity.content}</p>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(activity.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════ RIGHT COLUMN: AI + LINKS ═══════════ */}
          <div className="space-y-6">
            {/* AI Insights (Teachers/Admins only) */}
            {isTeacher && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 backdrop-blur-xl rounded-2xl p-6 border border-indigo-100 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles className="w-5 h-5 text-indigo-500" /> AI Summary
                  </h3>
                  {aiInsights?.cached && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-medium">Cached</span>
                  )}
                </div>

                {aiLoading ? (
                  <div className="text-center py-4">
                    <Sparkles className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading AI insights...</p>
                  </div>
                ) : aiInsights ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{aiInsights.summary}</p>
                    {aiInsights.keyInsight && (
                      <div className="bg-white/60 rounded-xl p-3 border border-indigo-100">
                        <div className="text-xs font-semibold text-indigo-600 mb-1">💡 Key Insight</div>
                        <p className="text-xs text-gray-600">{aiInsights.keyInsight}</p>
                      </div>
                    )}
                    {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">Top Recommendations</div>
                        {aiInsights.recommendations.slice(0, 2).map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-600 py-1">
                            <span className="text-indigo-400 mt-0.5">•</span> {r}
                          </div>
                        ))}
                      </div>
                    )}
                    <a href="/analytics" className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all mt-2">
                      <BarChart3 className="w-4 h-4" /> View Full Analytics
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500 mb-3">Generate insights from Analytics first</p>
                    <a href="/analytics" className="inline-flex items-center gap-2 py-2 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all">
                      <Sparkles className="w-4 h-4" /> Go to Analytics
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ScholarSync Link Card - Only for teachers */}
            {isTeacher && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-2xl p-6 border border-green-100 shadow-lg">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-green-600" /> Academic Portal
                </h3>
                <p className="text-sm text-gray-600 mb-4">Import team data from Google Sheets to SkyFlow</p>
                <a href="/scholar/dashboard" className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all">
                  <ExternalLink className="w-4 h-4" /> Open Academy
                </a>
              </div>
            )}

            {/* Checkpoint Summary */}
            {teamData && teamData.checkpoints.total > 0 && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" /> Checkpoints
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="text-sm font-bold text-green-600">{teamData.checkpoints.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="text-sm font-bold text-blue-600">{teamData.checkpoints.in_progress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="text-sm font-bold text-gray-500">{teamData.checkpoints.pending}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex mt-2">
                    <div className="h-full bg-green-500" style={{ width: `${(teamData.checkpoints.completed / teamData.checkpoints.total) * 100}%` }} />
                    <div className="h-full bg-blue-500" style={{ width: `${(teamData.checkpoints.in_progress / teamData.checkpoints.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organization Selector Modal */}
      {showOrgSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl mb-4 shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Welcome back, {user?.name?.split(' ')[0]}!
              </h2>
              <p className="text-gray-600">Select a workspace to continue</p>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectingOrgId(org.id)
                    setSelectedOrg(org)
                    localStorage.setItem('selectedOrganization', JSON.stringify(org))
                    setTimeout(() => { setShowOrgSelector(false); setSelectingOrgId(null) }, 300)
                  }}
                  disabled={selectingOrgId === org.id}
                  className="w-full group flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">{org.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 group-hover:text-blue-600">{org.name}</p>
                      <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                    </div>
                  </div>
                  {selectingOrgId === org.id ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button className="text-sm text-blue-500 hover:text-blue-700 font-medium">
                + Create new workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

// ─── Sub-components ───
function StatCard({ icon, gradient, label, value, sub }: { icon: React.ReactNode; gradient: string; label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 bg-gradient-to-br ${gradient} rounded-xl shadow-md`}>{icon}</div>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <p className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}

function QuickAction({ href, icon, label, color, external }: { href: string; icon: React.ReactNode; label: string; color: string; external?: boolean }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500', indigo: 'from-indigo-500 to-purple-500',
    purple: 'from-purple-500 to-pink-500', cyan: 'from-cyan-500 to-teal-500',
  }
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
      className={`flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:${colorMap[color]} hover:text-white hover:border-transparent transition-all duration-200 group shadow-sm hover:shadow-md`}>
      <span className={`text-${color}-600 group-hover:text-white transition-colors`}>{icon}</span>
      <span className="text-sm font-medium text-gray-700 group-hover:text-white transition-colors">{label}</span>
    </a>
  )
}
