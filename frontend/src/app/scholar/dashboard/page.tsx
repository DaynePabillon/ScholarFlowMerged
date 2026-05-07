'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/scholar/SidebarLayout';
import Link from 'next/link';
import apiClient from '@/lib/api/client';
import {
  BookOpen,
  Users,
  Shield,
  Stethoscope,
  ClipboardList,
  Calendar,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Activity,
  UserCheck,
  ArrowRight,
  Clock,
  FolderKanban
} from 'lucide-react';

type Course = {
  id: number;
  courseName: string;
  courseCode: string;
  courseSection: string;
  courseTerm: string;
  courseAmount?: number;
};

type Group = {
  id: string;
  groupName: string;
  adviser?: string;
  members?: Array<{ name: string; email: string }>;
  courseId: number;
  courseCode: string;
};

type ConsultationLog = {
  conID?: number;
  conDate?: string;
  conAction?: string;
  conConcerns?: string;
  submitted_at?: string;
  updated_at?: string;
  created_at?: string;
  groupName?: string;
  attendance_data?: Record<string, string>;
  participation_data?: Record<string, string>;
};

type DashboardInsights = {
  totalGroups: number;
  consultationLogs: number;
  groupWithoutConsultation: number;
  journalEntries: number;
  upcomingSlots: number;
  riskGroups: Array<{ groupName: string; courseCode: string; reason: string }>;
  followUps: Array<{ groupName: string; courseCode: string; action: string; concern: string }>;
  actionItems: string[];
  dataIntegrityIssues: string[];
};

type ReadinessSummary = {
  selectedTerm: string;
  readinessScore: number;
  coursesWithoutGroups: number;
  groupsWithoutAdviser: number;
  groupsWithoutMembers: number;
  groupsWithoutConsultation: number;
};

type AvailabilitySummary = {
  selectedTerm: string;
  totalAdvisers: number;
  assignedAdvisers: number;
  availableAdvisers: number;
  totalGroupsInTerm: number;
  unassignedGroupsInTerm: number;
};

type AdviserFollowUpItem = {
  groupName: string;
  courseCode: string;
  concern: string;
  action: string;
  status: string;
};

const emptyInsights: DashboardInsights = {
  totalGroups: 0,
  consultationLogs: 0,
  groupWithoutConsultation: 0,
  journalEntries: 0,
  upcomingSlots: 0,
  riskGroups: [],
  followUps: [],
  actionItems: [],
  dataIntegrityIssues: []
};

const emptyReadiness: ReadinessSummary = {
  selectedTerm: '',
  readinessScore: 100,
  coursesWithoutGroups: 0,
  groupsWithoutAdviser: 0,
  groupsWithoutMembers: 0,
  groupsWithoutConsultation: 0
};

const emptyAvailability: AvailabilitySummary = {
  selectedTerm: '',
  totalAdvisers: 0,
  assignedAdvisers: 0,
  availableAdvisers: 0,
  totalGroupsInTerm: 0,
  unassignedGroupsInTerm: 0
};

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser';
  return 'Student';
};

const parseActionItems = (value: unknown): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/\n|;|\.|,/)
    .map((part) => part.trim())
    .filter((part) => part.length > 6)
    .slice(0, 3);
};

const getTimestamp = (log: ConsultationLog): number => {
  return new Date(log.submitted_at || log.updated_at || log.created_at || log.conDate || 0).getTime();
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [insights, setInsights] = useState<DashboardInsights>(emptyInsights);
  const [readiness, setReadiness] = useState<ReadinessSummary>(emptyReadiness);
  const [availability, setAvailability] = useState<AvailabilitySummary>(emptyAvailability);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadSupplementalData = async (effectiveRole: 'Admin' | 'Adviser' | 'Student', me: any, fetchedCourses: Course[]) => {
      const parseRiskGroups = (items: Array<{ groupName: string; courseCode: string; concern: string; action: string; status: string }>) => {
        return items
          .filter((item) => {
            const concern = item.concern.toLowerCase();
            return item.status !== 'resolved' || concern.includes('blocker') || concern.includes('delay') || concern.includes('risk');
          })
          .slice(0, 6)
          .map((item) => ({
            groupName: item.groupName,
            courseCode: item.courseCode,
            reason: item.concern || item.action || 'Follow-up required.'
          }));
      };

      const parseFollowUps = (items: Array<{ groupName: string; courseCode: string; concern: string; action: string; status: string }>) => {
        return items
          .filter((item) => item.action || item.concern)
          .slice(0, 8)
          .map((item) => ({
            groupName: item.groupName,
            courseCode: item.courseCode,
            action: item.action,
            concern: item.concern
          }));
      };

      const buildActionItems = (items: Array<{ action: string; concern: string }>) => {
        return items.flatMap((item) => parseActionItems(item.action)).slice(0, 10);
      };

      if (effectiveRole === 'Admin') {
        try {
          const [integrityRes, readinessRes, availabilityRes, followupsRes, slotsRes] = await Promise.all([
            apiClient.get('/dashboard/admin-data-integrity'),
            apiClient.get('/dashboard/semester-readiness'),
            apiClient.get('/dashboard/adviser-availability'),
            apiClient.get('/dashboard/adviser-followups'),
            apiClient.get(`/consultation/slots/adviser/${me.id}`)
          ]);

          if (!isMounted) return;

          const integrityAccounts = Array.isArray(integrityRes.data?.accounts) ? integrityRes.data.accounts : [];
          const integrityCourses = Array.isArray(integrityRes.data?.courses) ? integrityRes.data.courses : [];
          const integrityIssues = Array.isArray(integrityRes.data?.issues)
            ? integrityRes.data.issues.map((issue: any) => String(issue.detail || issue.title || '').trim()).filter(Boolean)
            : [];
          const followUpItems = Array.isArray(followupsRes.data?.items) ? followupsRes.data.items : [];
          const normalizedFollowUps = followUpItems.map((item: any) => ({
            groupName: String(item.groupName || 'Unnamed Group'),
            courseCode: String(item.courseCode || 'Course'),
            concern: String(item.concern || '').trim(),
            action: String(item.action || '').trim(),
            status: String(item.status || '').trim().toLowerCase()
          }));
          const now = Date.now();
          const slots = Array.isArray(slotsRes.data?.slots) ? slotsRes.data.slots : [];
          const upcomingSlots = slots.filter((slot: any) => new Date(slot.slot_date || slot.slot_date_only || 0).getTime() >= now).length;

          setAccounts(integrityAccounts);
          setCourses(integrityCourses);
          setReadiness({
            selectedTerm: String(readinessRes.data?.selectedTerm || ''),
            readinessScore: Number(readinessRes.data?.summary?.readinessScore || 0),
            coursesWithoutGroups: Array.isArray(readinessRes.data?.checklist?.coursesWithoutGroups) ? readinessRes.data.checklist.coursesWithoutGroups.length : 0,
            groupsWithoutAdviser: Array.isArray(readinessRes.data?.checklist?.groupsWithoutAdviser) ? readinessRes.data.checklist.groupsWithoutAdviser.length : 0,
            groupsWithoutMembers: Array.isArray(readinessRes.data?.checklist?.groupsWithoutMembers) ? readinessRes.data.checklist.groupsWithoutMembers.length : 0,
            groupsWithoutConsultation: Array.isArray(readinessRes.data?.checklist?.groupsWithoutConsultation) ? readinessRes.data.checklist.groupsWithoutConsultation.length : 0
          });
          setAvailability({
            selectedTerm: String(availabilityRes.data?.selectedTerm || ''),
            totalAdvisers: Number(availabilityRes.data?.summary?.totalAdvisers || 0),
            assignedAdvisers: Number(availabilityRes.data?.summary?.assignedAdvisers || 0),
            availableAdvisers: Number(availabilityRes.data?.summary?.availableAdvisers || 0),
            totalGroupsInTerm: Number(availabilityRes.data?.summary?.totalGroupsInTerm || 0),
            unassignedGroupsInTerm: Number(availabilityRes.data?.summary?.unassignedGroupsInTerm || 0)
          });

          const riskGroups = parseRiskGroups(normalizedFollowUps);
          const followUps = parseFollowUps(normalizedFollowUps);
          const actionItems = buildActionItems(normalizedFollowUps);

          setInsights({
            totalGroups: Number(readinessRes.data?.summary?.groupsInTerm || 0),
            consultationLogs: Number(integrityRes.data?.consultationLogs || 0),
            groupWithoutConsultation: Array.isArray(readinessRes.data?.checklist?.groupsWithoutConsultation) ? readinessRes.data.checklist.groupsWithoutConsultation.length : 0,
            journalEntries: Number(integrityRes.data?.journalEntries || 0),
            upcomingSlots,
            riskGroups,
            followUps,
            actionItems,
            dataIntegrityIssues: integrityIssues.length > 0 ? integrityIssues : [
              ...(Number(readinessRes.data?.checklist?.groupsWithoutAdviser?.length || 0) > 0 ? [`${Number(readinessRes.data?.checklist?.groupsWithoutAdviser.length || 0)} group(s) missing assigned adviser.`] : []),
              ...(Number(readinessRes.data?.checklist?.coursesWithoutGroups?.length || 0) > 0 ? [`${Number(readinessRes.data?.checklist?.coursesWithoutGroups.length || 0)} course(s) have no groups.`] : [])
            ]
          });

          return;
        } catch (err) {
          console.error('Failed to fetch admin scholar dashboard data:', err);
        }
      }

      if (effectiveRole === 'Adviser') {
        try {
          const [followupsRes, slotsRes] = await Promise.all([
            apiClient.get('/dashboard/adviser-followups'),
            apiClient.get(`/consultation/slots/adviser/${me.id}`)
          ]);

          if (!isMounted) return;

          const items = Array.isArray(followupsRes.data?.items) ? followupsRes.data.items : [];
          const normalizedItems: AdviserFollowUpItem[] = items.map((item: any) => ({
            groupName: String(item.groupName || 'Unnamed Group'),
            courseCode: String(item.courseCode || 'Course'),
            concern: String(item.concern || '').trim(),
            action: String(item.action || '').trim(),
            status: String(item.status || '').trim().toLowerCase()
          }));
          const now = Date.now();
          const slots = Array.isArray(slotsRes.data?.slots) ? slotsRes.data.slots : [];
          const upcomingSlots = slots.filter((slot: any) => new Date(slot.slot_date || slot.slot_date_only || 0).getTime() >= now).length;

          setInsights({
            totalGroups: normalizedItems.length,
            consultationLogs: normalizedItems.length,
            groupWithoutConsultation: normalizedItems.filter((item: any) => item.concern.toLowerCase().includes('no consultation logs')).length,
            journalEntries: normalizedItems.filter((item: any) => item.action.length > 0).length,
            upcomingSlots,
            riskGroups: parseRiskGroups(normalizedItems),
            followUps: parseFollowUps(normalizedItems),
            actionItems: buildActionItems(normalizedItems),
            dataIntegrityIssues: normalizedItems.filter((item: any) => item.concern.toLowerCase().includes('no consultation logs')).map((item: any) => `${item.groupName} has no consultation logs yet.`)
          });
        } catch (err) {
          console.error('Failed to fetch adviser dashboard data:', err);
        }
        return;
      }

      if (effectiveRole === 'Student') {
        try {
          const myGroupsRes = await apiClient.get('/my-groups');
          const myGroups = Array.isArray(myGroupsRes.data?.groups) ? myGroupsRes.data.groups : [];
          if (isMounted) {
            setInsights({
              ...emptyInsights,
              totalGroups: myGroups.length,
            });
          }
        } catch {
          if (isMounted) setInsights(emptyInsights);
        }
        return;
      }
    };

    const checkAuth = async () => {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Sync tokens
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);

      try {
        const [coursesRes, meRes] = await Promise.all([
          apiClient.get('/courses'),
          apiClient.get('/auth/me')
        ]);

        const fetchedCourses: Course[] = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const me = meRes.data || {};
        const effectiveRole = normalizeRole(me.scholarsyncRole || me.role);

        if (!isMounted) {
          return;
        }

        setCourses(fetchedCourses);
        setUser({ ...me, role: effectiveRole, scholarsyncRole: effectiveRole });
        localStorage.setItem('scholar_profile', JSON.stringify({ ...me, role: effectiveRole, scholarsyncRole: effectiveRole }));


        setLoading(false);
        void loadSupplementalData(effectiveRole, me, fetchedCourses);
      } catch (err) {
        console.error('Failed to fetch scholar dashboard data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!user || loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      </SidebarLayout>
    );
  }

  const effectiveRole = normalizeRole(user.scholarsyncRole || user.role);
  const isAdmin = effectiveRole === 'Admin';
  const isAdviser = effectiveRole === 'Adviser';
  const isStudent = effectiveRole === 'Student';

  const statCards = [
    { label: 'Courses', value: courses.length, icon: BookOpen, color: 'from-blue-600 to-cyan-600' },
    { label: 'Groups', value: insights.totalGroups, icon: Users, color: 'from-emerald-600 to-teal-600' },
    { label: 'Consultation Logs', value: insights.consultationLogs, icon: ClipboardList, color: 'from-indigo-600 to-blue-600' },
    { label: 'Journal Entries', value: insights.journalEntries, icon: Activity, color: 'from-amber-600 to-orange-600' }
  ];

  const workspaceTitle = isAdmin ? 'Academic Hub' : isAdviser ? 'Adviser Hub' : 'Student Hub';
  const workspaceLead = isAdmin
    ? 'Monitor readiness, assignment health, and integrity signals across the academic term.'
    : isAdviser
      ? 'Review consultations, upcoming slots, and groups that need immediate follow-up.'
      : 'Track your courses, consultation activity, and the next actions that matter most.';

  const heroLinks = isAdmin
    ? [
        { href: '/scholar/admin/accounts', title: 'Accounts', subtitle: `${accounts.length} records tracked`, icon: Shield },
        { href: '/scholar/admin/semester-readiness', title: 'Readiness', subtitle: `${readiness.readinessScore}% semester readiness`, icon: CheckCircle2 },
        { href: '/scholar/admin/adviser-availability', title: 'Availability', subtitle: `${availability.unassignedGroupsInTerm} unassigned group(s)`, icon: UserCheck },
        { href: '/scholar/admin/data-integrity', title: 'Integrity', subtitle: `${insights.dataIntegrityIssues.length} issue(s) surfaced`, icon: AlertTriangle }
      ]
    : isAdviser
      ? [
          { href: '/scholar/schedule', title: 'Consultation slots', subtitle: `${insights.upcomingSlots} upcoming slot(s)`, icon: Calendar },
          { href: '/scholar/courses', title: 'Follow-up review', subtitle: `${insights.followUps.length} live follow-up item(s)`, icon: ClipboardList },
          { href: '/scholar/drive', title: 'Drive access', subtitle: 'Open shared academic files', icon: FolderKanban },
          { href: '/scholar/calendar', title: 'Calendar', subtitle: 'See the week at a glance', icon: Clock }
        ]
      : [
          { href: '/scholar/booking', title: 'Book consultation', subtitle: 'Find an available adviser slot', icon: Calendar },
          { href: '/scholar/courses', title: 'Course history', subtitle: `${courses.length} enrolled course(s)`, icon: BookOpen },
          { href: '/scholar/calendar', title: 'Calendar', subtitle: `${insights.upcomingSlots} upcoming slot(s)`, icon: Clock },
          { href: '/scholar/drive', title: 'Shared resources', subtitle: 'Open course files and notes', icon: FolderKanban }
        ];

  const secondaryFocus = isAdmin
    ? [
        { label: 'Readiness score', value: `${readiness.readinessScore}%`, detail: readiness.selectedTerm || availability.selectedTerm || 'Current term' },
        { label: 'Risk groups', value: String(insights.riskGroups.length), detail: 'Require immediate follow-up' },
        { label: 'Follow-up items', value: String(insights.followUps.length), detail: 'Recent adviser action logs' },
        { label: 'Integrity issues', value: String(insights.dataIntegrityIssues.length), detail: 'Data quality alerts' }
      ]
    : isAdviser
      ? [
          { label: 'Upcoming slots', value: String(insights.upcomingSlots), detail: 'Future consultations on the calendar' },
          { label: 'Follow-up items', value: String(insights.followUps.length), detail: 'Open concerns and actions' },
          { label: 'Risk groups', value: String(insights.riskGroups.length), detail: 'Groups needing attention' },
          { label: 'Consultation logs', value: String(insights.consultationLogs), detail: 'Recent activity recorded' }
        ]
      : [
          { label: 'Course load', value: String(courses.length), detail: 'Active enrolled courses' },
          { label: 'Consultation logs', value: String(insights.consultationLogs), detail: 'Logs already recorded' },
          { label: 'Journal entries', value: String(insights.journalEntries), detail: 'Completed entries' },
          { label: 'Action items', value: String(insights.actionItems.length), detail: 'Suggested next steps' }
        ];

  const storyCards = isAdmin
    ? [
        {
          title: 'Integrity feed',
          icon: AlertTriangle,
          tone: 'from-amber-500/15 to-rose-500/10',
          items: insights.dataIntegrityIssues.length > 0 ? insights.dataIntegrityIssues.slice(0, 4) : ['No active integrity issues detected.']
        },
        {
          title: 'Risk groups',
          icon: Activity,
          tone: 'from-rose-500/15 to-orange-500/10',
          items: insights.riskGroups.length > 0
            ? insights.riskGroups.slice(0, 4).map((item) => `${item.groupName} · ${item.courseCode} — ${item.reason}`)
            : ['No critical groups flagged right now.']
        }
      ]
    : isAdviser
      ? [
          {
            title: 'Follow-up tracker',
            icon: ClipboardList,
            tone: 'from-cyan-500/15 to-blue-500/10',
            items: insights.followUps.length > 0
              ? insights.followUps.slice(0, 4).map((item) => `${item.groupName} · ${item.courseCode} — ${item.action || item.concern}`)
              : ['No follow-up items yet.']
          },
          {
            title: 'At-risk groups',
            icon: AlertTriangle,
            tone: 'from-amber-500/15 to-rose-500/10',
            items: insights.riskGroups.length > 0
              ? insights.riskGroups.slice(0, 4).map((item) => `${item.groupName} · ${item.courseCode} — ${item.reason}`)
              : ['No flagged groups in the latest scan.']
          }
        ]
      : [
          {
            title: 'Action item checklist',
            icon: CheckCircle2,
            tone: 'from-emerald-500/15 to-teal-500/10',
            items: insights.actionItems.length > 0 ? insights.actionItems.slice(0, 6) : ['No action items yet. Submit or attend a consultation first.']
          },
          {
            title: 'Progress snapshot',
            icon: Sparkles,
            tone: 'from-sky-500/15 to-cyan-500/10',
            items: [
              `${insights.consultationLogs} consultation log(s) recorded.`,
              `${insights.journalEntries} journal entry/entries submitted.`,
              `${insights.groupWithoutConsultation} scanned group(s) have no consultations yet.`
            ]
          }
        ];

  const coursePreview = courses.slice(0, 9);

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 space-y-8">
        <section className="portal-panel-strong relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/55 via-transparent to-transparent dark:from-white/8" />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_.9fr] p-6 sm:p-8 lg:p-10">
            <div className="space-y-5">
              <span className="scholar-hero-kicker">Academic Dashboard</span>
              <div>
                <h1 className="scholar-display text-4xl sm:text-5xl lg:text-6xl" style={{ color: 'var(--color-text)' }}>
                  {workspaceTitle}
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg" style={{ color: 'var(--color-textSecondary)' }}>
                  {workspaceLead}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/scholar/courses" className="portal-button portal-button-primary">
                  <BookOpen className="w-4 h-4" />
                  Open courses
                </Link>
                {isAdmin && (
                  <Link href="/scholar/admin/semester-readiness" className="portal-button portal-button-secondary">
                    <CheckCircle2 className="w-4 h-4" />
                    Review readiness
                  </Link>
                )}
                {isAdviser && (
                  <Link href="/scholar/schedule" className="portal-button portal-button-secondary">
                    <Calendar className="w-4 h-4" />
                    Open schedule
                  </Link>
                )}
                {isStudent && (
                  <Link href="/scholar/booking" className="portal-button portal-button-secondary">
                    <Clock className="w-4 h-4" />
                    Book consultation
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="portal-panel p-5">
                <p className="scholar-metric-label">Signed in as</p>
                <p className="mt-2 text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {user.name || user.email?.split('@')[0]}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                  Role: {effectiveRole}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                  Term: {readiness.selectedTerm || availability.selectedTerm || 'N/A'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {secondaryFocus.map((item) => (
                  <div key={item.label} className="scholar-metric">
                    <p className="scholar-metric-label">{item.label}</p>
                    <p className="scholar-metric-value">{item.value}</p>
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--color-textSecondary)' }}>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_.9fr]">
          <div className="space-y-6">
            <div className="portal-panel p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="scholar-section-heading text-2xl sm:text-3xl" style={{ color: 'var(--color-text)' }}>
                    Role Workbench
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                    The most relevant actions for your current role.
                  </p>
                </div>
                <span className="portal-chip">Live actions</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {heroLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="portal-panel p-4 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                          <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                          <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>{item.subtitle}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 mt-1 text-[var(--color-textSecondary)] transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="portal-panel p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="scholar-section-heading text-2xl sm:text-3xl" style={{ color: 'var(--color-text)' }}>
                    Courses
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                    Fast access to the active course set.
                  </p>
                </div>
                <Link href="/scholar/courses" className="text-sm font-bold text-[var(--color-primary)] hover:opacity-80 inline-flex items-center gap-2">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {coursePreview.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {coursePreview.map((course) => (
                    <Link key={course.id} href={`/scholar/courses/${course.id}`} className="portal-panel p-5 group">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 95%, white), var(--color-secondary))' }}>
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <span className="portal-chip">{course.courseSection}</span>
                      </div>
                      <p className="font-bold text-lg leading-snug group-hover:opacity-80" style={{ color: 'var(--color-text)' }}>
                        {course.courseName}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
                        {course.courseCode} · {course.courseTerm}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                        <Users className="w-4 h-4" />
                        {course.courseAmount || 0} student(s)
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="portal-empty rounded-2xl p-8 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-textSecondary)' }} />
                  <p className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>No courses available yet.</p>
                  <p className="text-sm mt-2" style={{ color: 'var(--color-textSecondary)' }}>Create or import courses to populate your dashboard.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {storyCards.map((card) => (
              <div key={card.title} className="portal-panel p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center bg-gradient-to-br ${card.tone}`}>
                      <card.icon className="w-5 h-5" style={{ color: 'var(--color-text)' }} />
                    </div>
                    <h3 className="scholar-section-heading text-xl" style={{ color: 'var(--color-text)' }}>{card.title}</h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {card.items.map((item, index) => (
                    <div key={`${card.title}-${index}`} className="portal-panel p-3">
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="portal-panel p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="scholar-section-heading text-xl" style={{ color: 'var(--color-text)' }}>Space Snapshot</h3>
                <span className="portal-chip">At a glance</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--color-border)_88%,white)] bg-[color-mix(in_srgb,var(--color-surface)_94%,white)] px-4 py-3">
                  <span style={{ color: 'var(--color-textSecondary)' }}>Courses</span>
                  <span className="font-bold" style={{ color: 'var(--color-text)' }}>{courses.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--color-border)_88%,white)] bg-[color-mix(in_srgb,var(--color-surface)_94%,white)] px-4 py-3">
                  <span style={{ color: 'var(--color-textSecondary)' }}>Groups</span>
                  <span className="font-bold" style={{ color: 'var(--color-text)' }}>{insights.totalGroups}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--color-border)_88%,white)] bg-[color-mix(in_srgb,var(--color-surface)_94%,white)] px-4 py-3">
                  <span style={{ color: 'var(--color-textSecondary)' }}>Consultation logs</span>
                  <span className="font-bold" style={{ color: 'var(--color-text)' }}>{insights.consultationLogs}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--color-border)_88%,white)] bg-[color-mix(in_srgb,var(--color-surface)_94%,white)] px-4 py-3">
                  <span style={{ color: 'var(--color-textSecondary)' }}>Journal entries</span>
                  <span className="font-bold" style={{ color: 'var(--color-text)' }}>{insights.journalEntries}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
