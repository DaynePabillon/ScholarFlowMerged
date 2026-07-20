"use client"

import { apiClient, API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import Link from "next/link"
import {
  TrendingUp, Users, FolderKanban, CheckSquare, Calendar, X, FileText,
  BarChart3, Target, Sparkles, Building2, ArrowRight, Loader2, ExternalLink,
  MessageSquare, Award, Plug, CreditCard, BookOpen, Shield, ClipboardList,
  AlertTriangle, CheckCircle2, Activity, UserCheck, Clock
} from "lucide-react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import OrganizationGateway from "@/components/organization/OrganizationGateway"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member' | 'adviser'
}

interface Task {
  id: string; title: string; status: string; priority: string; due_date?: string
}

interface Member {
  user_id: string; name: string; email: string; role: string
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
  summary: string; recommendations: string[]; keyInsight: string; cached?: boolean; generated_at?: string
}

type Course = {
  id: number; courseName: string; courseCode: string; courseSection: string
  courseTerm: string; courseAmount?: number
}

type DashboardInsights = {
  totalGroups: number; consultationLogs: number; groupWithoutConsultation: number
  journalEntries: number; upcomingSlots: number
  riskGroups: Array<{ groupName: string; courseCode: string; reason: string }>
  followUps: Array<{ groupName: string; courseCode: string; action: string; concern: string }>
  actionItems: string[]; dataIntegrityIssues: string[]
}

type ReadinessSummary = {
  selectedTerm: string; readinessScore: number; coursesWithoutGroups: number
  groupsWithoutAdviser: number; groupsWithoutMembers: number; groupsWithoutConsultation: number
}

type AvailabilitySummary = {
  selectedTerm: string; totalAdvisers: number; assignedAdvisers: number
  availableAdvisers: number; totalGroupsInTerm: number; unassignedGroupsInTerm: number
}

const emptyInsights: DashboardInsights = {
  totalGroups: 0, consultationLogs: 0, groupWithoutConsultation: 0,
  journalEntries: 0, upcomingSlots: 0, riskGroups: [], followUps: [],
  actionItems: [], dataIntegrityIssues: []
}

const emptyReadiness: ReadinessSummary = {
  selectedTerm: '', readinessScore: 100, coursesWithoutGroups: 0,
  groupsWithoutAdviser: 0, groupsWithoutMembers: 0, groupsWithoutConsultation: 0
}

const emptyAvailability: AvailabilitySummary = {
  selectedTerm: '', totalAdvisers: 0, assignedAdvisers: 0,
  availableAdvisers: 0, totalGroupsInTerm: 0, unassignedGroupsInTerm: 0
}

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'admin') return 'Admin'
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser'
  return 'Student'
}

const parseActionItems = (value: unknown): string[] => {
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw.split(/\n|;|\.|,/).map(p => p.trim()).filter(p => p.length > 6).slice(0, 3)
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showOrgSelector, setShowOrgSelector] = useState(false)
  const [selectingOrgId, setSelectingOrgId] = useState<string | null>(null)

  // Project data
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [teamData, setTeamData] = useState<TeamOverview | null>(null)
  const [teamDataLoading, setTeamDataLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Academic data
  const [hasScholarProfile, setHasScholarProfile] = useState(false)
  const [scholarRole, setScholarRole] = useState<'Admin' | 'Adviser' | 'Student' | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [insights, setInsights] = useState<DashboardInsights>(emptyInsights)
  const [readiness, setReadiness] = useState<ReadinessSummary>(emptyReadiness)
  const [availability, setAvailability] = useState<AvailabilitySummary>(emptyAvailability)

  // ─── Phase 1: Auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      let storedToken = localStorage.getItem("token")
      if (!storedToken) {
        const scholarSyncToken = localStorage.getItem("auth_token")
        if (scholarSyncToken) { localStorage.setItem("token", scholarSyncToken); storedToken = scholarSyncToken }
      }
      if (!storedToken) { router.push("/login"); return }

      try {
        const response = await apiClient.get('/auth/me')
        const data = response.data
        const { organizations: orgs, onboarding_data, ...userData } = data
        const updatedUser = { ...userData, onboarding_data }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        localStorage.setItem('organizations', JSON.stringify(orgs || []))
        setUser(updatedUser)
        setOrganizations(orgs || [])

        const storedSelectedOrg = localStorage.getItem("selectedOrganization")
        if (storedSelectedOrg) {
          setSelectedOrg(JSON.parse(storedSelectedOrg))
        } else if (orgs?.length === 1) {
          setSelectedOrg(orgs[0])
          localStorage.setItem('selectedOrganization', JSON.stringify(orgs[0]))
        } else if (orgs?.length > 1) {
          setShowOrgSelector(true)
        }

        // Detect scholar profile
        const sRole = data.scholarsyncRole
        if (sRole) {
          const normalized = normalizeRole(sRole)
          setScholarRole(normalized)
          setHasScholarProfile(true)
          localStorage.setItem('scholar_profile', JSON.stringify({ ...data, role: normalized, scholarsyncRole: normalized }))
        } else {
          const cached = localStorage.getItem('scholar_profile')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              const normalized = normalizeRole(parsed.scholarsyncRole || parsed.role)
              setScholarRole(normalized)
              setHasScholarProfile(true)
            } catch {}
          }
        }
      } catch (error: any) {
        const storedUser = localStorage.getItem("user")
        if (!storedUser || error.response?.status === 401) { router.push("/login") }
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // ─── Phase 2: Project data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedOrg) return
    const fetchDashboardData = async () => {
      try {
        const [tasksRes, membersRes] = await Promise.all([
          apiClient.get(`/organizations/${selectedOrg.id}/tasks`),
          apiClient.get(`/organizations/${selectedOrg.id}/members`)
        ])
        setTasks(tasksRes.data.tasks || [])
        const d = membersRes.data
        setMembers(Array.isArray(d) ? d : (d.members || []))
      } catch (error) { console.error('Error fetching dashboard data:', error) }
    }
    fetchDashboardData()
  }, [selectedOrg])

  useEffect(() => {
    if (!selectedOrg) return
    setTeamDataLoading(true)
    apiClient.get('/analytics/overview', { headers: { 'x-organization-id': selectedOrg.id } })
      .then(res => setTeamData(res.data))
      .catch(err => console.error('Error fetching team data:', err))
      .finally(() => setTeamDataLoading(false))
  }, [selectedOrg])

  useEffect(() => {
    if (!selectedOrg || selectedOrg.role === 'member') return
    setAiLoading(true)
    apiClient.get('/analytics/ai-insights', { headers: { 'x-organization-id': selectedOrg.id } })
      .then(res => setAiInsights(res.data))
      .catch(err => console.error('Error fetching AI insights:', err))
      .finally(() => setAiLoading(false))
  }, [selectedOrg])

  // ─── Phase 3: Academic data ────────────────────────────────────────────────
  useEffect(() => {
    if (!hasScholarProfile || !scholarRole || !user) return
    let isMounted = true

    const loadAcademicData = async () => {
      try {
        const coursesRes = await apiClient.get('/courses')
        const fetchedCourses: Course[] = Array.isArray(coursesRes.data) ? coursesRes.data : []
        if (isMounted) setCourses(fetchedCourses)
      } catch { /* courses may not be available */ }

      const parseRiskGroups = (items: any[]) =>
        items.filter(i => i.status !== 'resolved' || i.concern?.toLowerCase().includes('blocker') || i.concern?.toLowerCase().includes('risk'))
          .slice(0, 6).map(i => ({ groupName: i.groupName, courseCode: i.courseCode, reason: i.concern || i.action || 'Follow-up required.' }))

      const parseFollowUps = (items: any[]) =>
        items.filter(i => i.action || i.concern).slice(0, 8)
          .map(i => ({ groupName: i.groupName, courseCode: i.courseCode, action: i.action, concern: i.concern }))

      const buildActionItems = (items: any[]) =>
        items.flatMap(i => parseActionItems(i.action)).slice(0, 10)

      const normalize = (items: any[]) => items.map((item: any) => ({
        groupName: String(item.groupName || 'Unnamed Group'),
        courseCode: String(item.courseCode || 'Course'),
        concern: String(item.concern || '').trim(),
        action: String(item.action || '').trim(),
        status: String(item.status || '').trim().toLowerCase()
      }))

      try {
        if (scholarRole === 'Admin') {
          const [integrityRes, readinessRes, availabilityRes, followupsRes, slotsRes] = await Promise.all([
            apiClient.get('/dashboard/admin-data-integrity'),
            apiClient.get('/dashboard/semester-readiness'),
            apiClient.get('/dashboard/adviser-availability'),
            apiClient.get('/dashboard/adviser-followups'),
            apiClient.get(`/consultation/slots/adviser/${user.id}`)
          ])
          if (!isMounted) return
          const integrityAccounts = Array.isArray(integrityRes.data?.accounts) ? integrityRes.data.accounts : []
          const integrityIssues = Array.isArray(integrityRes.data?.issues)
            ? integrityRes.data.issues.map((i: any) => String(i.detail || i.title || '').trim()).filter(Boolean) : []
          const followUpItems = normalize(Array.isArray(followupsRes.data?.items) ? followupsRes.data.items : [])
          const now = Date.now()
          const slots = Array.isArray(slotsRes.data?.slots) ? slotsRes.data.slots : []
          const upcomingSlots = slots.filter((s: any) => new Date(s.slot_date || s.slot_date_only || 0).getTime() >= now).length

          setAccounts(integrityAccounts)
          setReadiness({
            selectedTerm: String(readinessRes.data?.selectedTerm || ''),
            readinessScore: Number(readinessRes.data?.summary?.readinessScore || 0),
            coursesWithoutGroups: Array.isArray(readinessRes.data?.checklist?.coursesWithoutGroups) ? readinessRes.data.checklist.coursesWithoutGroups.length : 0,
            groupsWithoutAdviser: Array.isArray(readinessRes.data?.checklist?.groupsWithoutAdviser) ? readinessRes.data.checklist.groupsWithoutAdviser.length : 0,
            groupsWithoutMembers: Array.isArray(readinessRes.data?.checklist?.groupsWithoutMembers) ? readinessRes.data.checklist.groupsWithoutMembers.length : 0,
            groupsWithoutConsultation: Array.isArray(readinessRes.data?.checklist?.groupsWithoutConsultation) ? readinessRes.data.checklist.groupsWithoutConsultation.length : 0,
          })
          setAvailability({
            selectedTerm: String(availabilityRes.data?.selectedTerm || ''),
            totalAdvisers: Number(availabilityRes.data?.summary?.totalAdvisers || 0),
            assignedAdvisers: Number(availabilityRes.data?.summary?.assignedAdvisers || 0),
            availableAdvisers: Number(availabilityRes.data?.summary?.availableAdvisers || 0),
            totalGroupsInTerm: Number(availabilityRes.data?.summary?.totalGroupsInTerm || 0),
            unassignedGroupsInTerm: Number(availabilityRes.data?.summary?.unassignedGroupsInTerm || 0),
          })
          setInsights({
            totalGroups: Number(readinessRes.data?.summary?.groupsInTerm || 0),
            consultationLogs: Number(integrityRes.data?.consultationLogs || 0),
            groupWithoutConsultation: Array.isArray(readinessRes.data?.checklist?.groupsWithoutConsultation) ? readinessRes.data.checklist.groupsWithoutConsultation.length : 0,
            journalEntries: Number(integrityRes.data?.journalEntries || 0),
            upcomingSlots,
            riskGroups: parseRiskGroups(followUpItems),
            followUps: parseFollowUps(followUpItems),
            actionItems: buildActionItems(followUpItems),
            dataIntegrityIssues: integrityIssues.length > 0 ? integrityIssues : [
              ...(Number(readinessRes.data?.checklist?.groupsWithoutAdviser?.length || 0) > 0 ? [`${readinessRes.data.checklist.groupsWithoutAdviser.length} group(s) missing assigned adviser.`] : []),
              ...(Number(readinessRes.data?.checklist?.coursesWithoutGroups?.length || 0) > 0 ? [`${readinessRes.data.checklist.coursesWithoutGroups.length} course(s) have no groups.`] : [])
            ]
          })
        } else if (scholarRole === 'Adviser') {
          const [followupsRes, slotsRes] = await Promise.all([
            apiClient.get('/dashboard/adviser-followups'),
            apiClient.get(`/consultation/slots/adviser/${user.id}`)
          ])
          if (!isMounted) return
          const normalizedItems = normalize(Array.isArray(followupsRes.data?.items) ? followupsRes.data.items : [])
          const now = Date.now()
          const slots = Array.isArray(slotsRes.data?.slots) ? slotsRes.data.slots : []
          const upcomingSlots = slots.filter((s: any) => new Date(s.slot_date || s.slot_date_only || 0).getTime() >= now).length
          setInsights({
            totalGroups: normalizedItems.length, consultationLogs: normalizedItems.length,
            groupWithoutConsultation: normalizedItems.filter((i: any) => i.concern.toLowerCase().includes('no consultation logs')).length,
            journalEntries: normalizedItems.filter((i: any) => i.action.length > 0).length,
            upcomingSlots,
            riskGroups: parseRiskGroups(normalizedItems), followUps: parseFollowUps(normalizedItems),
            actionItems: buildActionItems(normalizedItems),
            dataIntegrityIssues: normalizedItems.filter((i: any) => i.concern.toLowerCase().includes('no consultation logs')).map((i: any) => `${i.groupName} has no consultation logs yet.`)
          })
        } else {
          const myGroupsRes = await apiClient.get('/my-groups')
          const myGroups = Array.isArray(myGroupsRes.data?.groups) ? myGroupsRes.data.groups : []
          if (isMounted) setInsights({ ...emptyInsights, totalGroups: myGroups.length })
        }
      } catch (err) { console.error('Failed to fetch academic data:', err) }
    }

    loadAcademicData()
    return () => { isMounted = false }
  }, [hasScholarProfile, scholarRole, user])

  // ─── Guards ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  const handleOrgChange = (org: Organization) => {
    setSelectedOrg(org)
    localStorage.setItem('selectedOrganization', JSON.stringify(org))
  }

  if (!selectedOrg) {
    return <OrganizationGateway user={user} organizations={organizations} onSelectOrg={handleOrgChange} />
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isTeacher = selectedOrg.role === 'admin' || selectedOrg.role === 'manager'
  const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done' || t.status === 'completed').length / tasks.length) * 100) : 0
  const checkpointRate = teamData && teamData.checkpoints.total > 0
    ? Math.round((teamData.checkpoints.completed / teamData.checkpoints.total) * 100) : 0

  const isScholarAdmin = scholarRole === 'Admin'
  const isScholarAdviser = scholarRole === 'Adviser'
  const isScholarStudent = scholarRole === 'Student'

  const heroLinks = isScholarAdmin
    ? [
        { href: '/scholar/admin/accounts', title: 'Accounts', subtitle: `${accounts.length} records tracked`, icon: Shield },
        { href: '/scholar/admin/semester-readiness', title: 'Readiness', subtitle: `${readiness.readinessScore}% semester readiness`, icon: CheckCircle2 },
        { href: '/scholar/admin/adviser-availability', title: 'Availability', subtitle: `${availability.unassignedGroupsInTerm} unassigned group(s)`, icon: UserCheck },
        { href: '/scholar/admin/data-integrity', title: 'Integrity', subtitle: `${insights.dataIntegrityIssues.length} issue(s) surfaced`, icon: AlertTriangle }
      ]
    : isScholarAdviser
      ? [
          { href: '/scholar/schedule', title: 'Consultation slots', subtitle: `${insights.upcomingSlots} upcoming slot(s)`, icon: Calendar },
          { href: '/scholar/courses', title: 'Follow-up review', subtitle: `${insights.followUps.length} live follow-up item(s)`, icon: ClipboardList },
          { href: '/drive', title: 'Drive access', subtitle: 'Open shared academic files', icon: FolderKanban },
          { href: '/calendar', title: 'Calendar', subtitle: 'See the week at a glance', icon: Clock }
        ]
      : [
          { href: '/scholar/booking', title: 'Book consultation', subtitle: 'Find an available adviser slot', icon: Calendar },
          { href: '/scholar/courses', title: 'Course history', subtitle: `${courses.length} enrolled course(s)`, icon: BookOpen },
          { href: '/calendar', title: 'Calendar', subtitle: `${insights.upcomingSlots} upcoming slot(s)`, icon: Clock },
          { href: '/drive', title: 'Shared resources', subtitle: 'Open course files and notes', icon: FolderKanban }
        ]

  const storyCards = isScholarAdmin
    ? [
        { title: 'Integrity feed', icon: AlertTriangle, tone: 'from-amber-500/15 to-rose-500/10',
          items: insights.dataIntegrityIssues.length > 0 ? insights.dataIntegrityIssues.slice(0, 4) : ['No active integrity issues detected.'] },
        { title: 'Risk groups', icon: Activity, tone: 'from-rose-500/15 to-orange-500/10',
          items: insights.riskGroups.length > 0 ? insights.riskGroups.slice(0, 4).map(i => `${i.groupName} · ${i.courseCode} — ${i.reason}`) : ['No critical groups flagged right now.'] }
      ]
    : isScholarAdviser
      ? [
          { title: 'Follow-up tracker', icon: ClipboardList, tone: 'from-cyan-500/15 to-blue-500/10',
            items: insights.followUps.length > 0 ? insights.followUps.slice(0, 4).map(i => `${i.groupName} · ${i.courseCode} — ${i.action || i.concern}`) : ['No follow-up items yet.'] },
          { title: 'At-risk groups', icon: AlertTriangle, tone: 'from-amber-500/15 to-rose-500/10',
            items: insights.riskGroups.length > 0 ? insights.riskGroups.slice(0, 4).map(i => `${i.groupName} · ${i.courseCode} — ${i.reason}`) : ['No flagged groups in the latest scan.'] }
        ]
      : [
          { title: 'Action item checklist', icon: CheckCircle2, tone: 'from-emerald-500/15 to-teal-500/10',
            items: insights.actionItems.length > 0 ? insights.actionItems.slice(0, 6) : ['No action items yet. Submit or attend a consultation first.'] },
          { title: 'Progress snapshot', icon: Sparkles, tone: 'from-sky-500/15 to-cyan-500/10',
            items: [`${insights.consultationLogs} consultation log(s) recorded.`, `${insights.journalEntries} journal entry/entries submitted.`, `${insights.groupWithoutConsultation} scanned group(s) have no consultations yet.`] }
        ]

  const coursePreview = courses.slice(0, 6)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={handleOrgChange}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ═══════════ HEADER ═══════════ */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Dashboard</h1>
          <p className="mt-2 text-lg" style={{ color: 'var(--color-text)' }}>
            Welcome back, {user.name}
            {selectedOrg.role !== 'member' && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full capitalize">{selectedOrg.role}</span>
            )}
            {hasScholarProfile && scholarRole && (
              <span className="ml-1.5 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full">{scholarRole}</span>
            )}
          </p>
        </div>

        {/* ═══════════ STATS ═══════════ */}
        <div className={`grid grid-cols-2 ${hasScholarProfile ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'} gap-4 mb-8`}>
          <StatCard icon={<Users className="w-5 h-5 text-white" />} gradient="from-purple-500 to-pink-500" label="Teams" value={teamData?.totalTeams ?? 0} sub={`${teamData?.totalMembers ?? members.length} members`} />
          <StatCard icon={<CheckSquare className="w-5 h-5 text-white" />} gradient="from-green-500 to-emerald-500" label="Checkpoints" value={teamData?.checkpoints.completed ?? 0} sub={`${teamData?.checkpoints.total ?? 0} total • ${checkpointRate}%`} />
          <StatCard icon={<MessageSquare className="w-5 h-5 text-white" />} gradient="from-blue-500 to-cyan-500" label="Discussions" value={teamData?.totalComments ?? 0} sub="Team comments" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-white" />} gradient="from-orange-500 to-red-500" label="Tasks" value={tasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.status !== 'archived').length} sub={`${tasks.length} total • ${completionRate}%`} />
          {hasScholarProfile && (
            <>
              <StatCard icon={<BookOpen className="w-5 h-5 text-white" />} gradient="from-sky-500 to-cyan-500" label="Courses" value={courses.length} sub="Active courses" />
              <StatCard icon={<ClipboardList className="w-5 h-5 text-white" />} gradient="from-indigo-500 to-blue-500" label="Consultations" value={insights.consultationLogs} sub={`${insights.journalEntries} journal entries`} />
            </>
          )}
        </div>

        {/* ═══════════ QUICK ACTIONS ═══════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <QuickAction href="/boards" icon={<FolderKanban className="w-4 h-4" />} label="Project Boards" color="blue" />
          <QuickAction href="/team" icon={<Users className="w-4 h-4" />} label="Team Members" color="cyan" />
          <QuickAction href="/gantt" icon={<Calendar className="w-4 h-4" />} label="Timeline" color="cyan" />
          <QuickAction href="/reports" icon={<FileText className="w-4 h-4" />} label="Reports" color="orange" />
          <QuickAction href="/integrations" icon={<Plug className="w-4 h-4" />} label="Integrations" color="violet" />
          {hasScholarProfile && <QuickAction href="/scholar/courses" icon={<BookOpen className="w-4 h-4" />} label="Courses" color="purple" />}
          {hasScholarProfile && !isScholarStudent && <QuickAction href="/scholar/schedule" icon={<Calendar className="w-4 h-4" />} label="Schedule" color="purple" />}
          {hasScholarProfile && isScholarStudent && <QuickAction href="/scholar/booking" icon={<Clock className="w-4 h-4" />} label="Consultation" color="purple" />}
          {isTeacher && <QuickAction href="/analytics" icon={<BarChart3 className="w-4 h-4" />} label="AI Analytics" color="indigo" />}
          {isTeacher && <QuickAction href="/billing" icon={<CreditCard className="w-4 h-4" />} label="Billing" color="indigo" />}
        </div>

        {/* ═══════════ MAIN GRID ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* ─── LEFT COLUMN (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* My Courses */}
            {hasScholarProfile && coursePreview.length > 0 && (
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <BookOpen className="w-5 h-5 text-sky-500" /> My Courses
                  </h2>
                  <Link href="/scholar/courses" className="text-sm text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {coursePreview.map(course => (
                    <Link key={course.id} href={`/scholar/courses/${course.id}`}
                      className="bg-gray-50/80 dark:bg-slate-700/50 rounded-xl p-4 hover:bg-blue-50/50 transition-colors group">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{course.courseSection}</span>
                      </div>
                      <p className="font-bold text-sm leading-snug group-hover:text-blue-600 transition-colors" style={{ color: 'var(--color-text)' }}>
                        {course.courseName}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                        {course.courseCode} · {course.courseTerm}
                      </p>
                      <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                        <Users className="w-3.5 h-3.5" /> {course.courseAmount || 0} student(s)
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Team Overview */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
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
                      <div key={team.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/80 dark:bg-slate-700/50 hover:bg-blue-50/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{team.proposed_project || team.name}</div>
                          <div className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{team.member_count} members • {team.comment_count} discussions</div>
                        </div>
                        <div className="w-28 flex-shrink-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: 'var(--color-textSecondary)' }}>Progress</span>
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
                <div className="text-center py-8" style={{ color: 'var(--color-textSecondary)' }}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {isScholarStudent ? "No teams assigned yet. Once your instructor adds you to a team, it will appear here." : "No teams yet. Create teams from the Boards page to get started."}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-5" style={{ color: 'var(--color-text)' }}>
                <MessageSquare className="w-5 h-5 text-blue-500" /> Recent Activity
              </h2>
              {teamData && teamData.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {teamData.recentActivity.slice(0, 5).map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-slate-700/50">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: `hsl(${(activity.user_name.charCodeAt(0) * 37) % 360}, 60%, 50%)` }}>
                        {activity.user_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-blue-600">{activity.user_name}</span>
                          <span className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>in {activity.team_name}</span>
                        </div>
                        <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--color-text)' }}>{activity.content}</p>
                        <span className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{new Date(activity.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6" style={{ color: 'var(--color-textSecondary)' }}>
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN (1/3) ─── */}
          <div className="space-y-6">

            {/* AI Summary (admin/manager only) */}
            {isTeacher && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 backdrop-blur-xl rounded-2xl p-6 border border-indigo-100 dark:border-indigo-800/40 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
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
                        <div className="text-xs font-semibold text-indigo-600 mb-1">Key Insight</div>
                        <p className="text-xs text-gray-600">{aiInsights.keyInsight}</p>
                      </div>
                    )}
                    {aiInsights.recommendations?.length > 0 && (
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

            {/* Role Workbench (scholar only) */}
            {hasScholarProfile && (
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <Target className="w-5 h-5 text-emerald-500" /> Role Workbench
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-medium">{scholarRole}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {heroLinks.map(item => (
                    <Link key={item.href} href={item.href}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-slate-700/50 hover:bg-blue-50/50 transition-colors group">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                        <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{item.subtitle}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Story Cards (scholar only) */}
            {hasScholarProfile && storyCards.map(card => (
              <div key={card.title} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${card.tone}`}>
                    <card.icon className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{card.title}</h3>
                </div>
                <div className="space-y-2">
                  {card.items.map((item, index) => (
                    <div key={`${card.title}-${index}`} className="bg-gray-50/80 dark:bg-slate-700/50 rounded-xl p-3">
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Checkpoint Summary */}
            {teamData && teamData.checkpoints.total > 0 && (
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/40 shadow-lg">
                <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--color-text)' }}>
                  <Target className="w-5 h-5 text-blue-500" /> Checkpoints
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Completed</span><span className="text-sm font-bold text-green-600">{teamData.checkpoints.completed}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">In Progress</span><span className="text-sm font-bold text-blue-600">{teamData.checkpoints.in_progress}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Pending</span><span className="text-sm font-bold text-gray-500">{teamData.checkpoints.pending}</span></div>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl mb-4 shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Welcome back, {user?.name?.split(' ')[0]}!</h2>
              <p className="text-gray-600 dark:text-gray-400">Select a workspace to continue</p>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {organizations.map(org => (
                <button key={org.id}
                  onClick={() => { setSelectingOrgId(org.id); setSelectedOrg(org); localStorage.setItem('selectedOrganization', JSON.stringify(org)); setTimeout(() => { setShowOrgSelector(false); setSelectingOrgId(null) }, 300) }}
                  disabled={selectingOrgId === org.id}
                  className="w-full group flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl transition-all duration-200 disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">{org.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 group-hover:text-blue-600">{org.name}</p>
                      <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                    </div>
                  </div>
                  {selectingOrgId === org.id ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />}
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button className="text-sm text-blue-500 hover:text-blue-700 font-medium">+ Create new workspace</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, gradient, label, value, sub }: { icon: React.ReactNode; gradient: string; label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 dark:border-slate-700/40 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 bg-gradient-to-br ${gradient} rounded-xl shadow-md`}>{icon}</div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <p className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  const gradientMap: Record<string, string> = {
    blue: 'linear-gradient(to right, #3b82f6, #06b6d4)',
    indigo: 'linear-gradient(to right, #6366f1, #a855f7)',
    purple: 'linear-gradient(to right, #a855f7, #ec4899)',
    cyan: 'linear-gradient(to right, #06b6d4, #14b8a6)',
    orange: 'linear-gradient(to right, #f97316, #ef4444)',
    violet: 'linear-gradient(to right, #7c3aed, #a855f7)',
  }
  const gradient = gradientMap[color] ?? gradientMap.blue
  return (
    <a href={href}
      className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:border-transparent"
      onMouseEnter={e => { e.currentTarget.style.background = gradient; e.currentTarget.style.color = '#fff'; e.currentTarget.querySelectorAll('span').forEach(s => ((s as HTMLElement).style.color = '#fff')) }}
      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; e.currentTarget.querySelectorAll('span').forEach(s => ((s as HTMLElement).style.color = '')) }}>
      <span>{icon}</span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </a>
  )
}
