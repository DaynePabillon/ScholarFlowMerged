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
  Clock
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
          const normalizedItems = items.map((item: any) => ({
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

  const readinessTone =
    readiness.readinessScore >= 85
      ? 'text-emerald-300'
      : readiness.readinessScore >= 60
        ? 'text-amber-300'
        : 'text-rose-300';

  const adminQuickLinks = [
    {
      href: '/scholar/admin/accounts',
      title: 'Account Access',
      subtitle: `${accounts.length} account(s)`,
      icon: Shield,
      tone: 'border-slate-200 bg-white'
    },
    {
      href: '/scholar/admin/data-integrity',
      title: 'Data Integrity',
      subtitle: `${insights.dataIntegrityIssues.length} issue(s) flagged`,
      icon: AlertTriangle,
      tone: 'border-slate-200 bg-white'
    },
    {
      href: '/scholar/admin/semester-readiness',
      title: 'Semester Readiness',
      subtitle: `${readiness.readinessScore}% readiness score`,
      icon: CheckCircle2,
      tone: 'border-slate-200 bg-white'
    },
    {
      href: '/scholar/admin/adviser-availability',
      title: 'Adviser Availability',
      subtitle: `${availability.unassignedGroupsInTerm} unassigned group(s)`,
      icon: UserCheck,
      tone: 'border-slate-200 bg-white'
    },
    {
      href: '/scholar/courses',
      title: 'Course Insights',
      subtitle: 'Inspect groups, logs, and AI synthesis by course',
      icon: Sparkles,
      tone: 'border-slate-200 bg-white'
    },
    {
      href: '/scholar/schedule',
      title: 'Consultation Schedule',
      subtitle: `${insights.upcomingSlots} upcoming slot(s) in your feed`,
      icon: Calendar,
      tone: 'border-slate-200 bg-white'
    }
  ];

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        {isAdmin ? (
          <div className="space-y-8 sm:space-y-10">
            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:p-8 lg:p-10 shadow-sm">
              <div>
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div>
                    <p className="text-[11px] sm:text-xs uppercase tracking-[0.28em] font-black text-slate-400 mb-3">ScholarSync Dashboard</p>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-slate-900">
                      Admin Dashboard
                    </h1>
                    <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl">
                      Track readiness, adviser distribution, and group progress in one place.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 min-w-[260px]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Signed in as</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{user.name || user.email?.split('@')[0]}</p>
                    <p className="text-xs text-slate-600 mt-1">Role: {effectiveRole}</p>
                    <p className="text-xs text-slate-600">Term: {readiness.selectedTerm || availability.selectedTerm || 'N/A'}</p>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-black">Readiness Score</p>
                    <p className={`mt-2 text-3xl font-black ${readinessTone}`}>{readiness.readinessScore}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-black">Courses</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{courses.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-black">Groups</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{insights.totalGroups}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-black">At-risk Groups</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{insights.riskGroups.length}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">Quick Actions</h2>
                    <span className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400">Primary Actions</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {adminQuickLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-2xl border p-4 ${item.tone} hover:shadow-sm transition-all group`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <item.icon className="w-5 h-5 text-slate-800" />
                          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-800" />
                        </div>
                        <p className="mt-4 text-sm font-black text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{item.subtitle}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">Group Signals</h2>
                    <span className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400">Live Monitoring</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] font-black text-rose-700 mb-3">Priority Groups</p>
                      {insights.riskGroups.length === 0 ? (
                        <p className="text-sm text-rose-700/80">No critical groups flagged right now.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {insights.riskGroups.slice(0, 5).map((item, index) => (
                            <div key={`${item.groupName}-${index}`} className="rounded-xl border border-rose-200 bg-white p-3">
                              <p className="text-xs font-black text-rose-700">{item.groupName} · {item.courseCode}</p>
                              <p className="text-xs text-slate-700 mt-1">{item.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] font-black text-amber-700 mb-3">Latest Follow-ups</p>
                      {insights.followUps.length === 0 ? (
                        <p className="text-sm text-amber-700/80">No recent follow-up action logs.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {insights.followUps.slice(0, 5).map((item, index) => (
                            <div key={`${item.groupName}-${index}`} className="rounded-xl border border-amber-200 bg-white p-3">
                              <p className="text-xs font-black text-amber-700">{item.groupName} · {item.courseCode}</p>
                              <p className="text-xs text-slate-700 mt-1">{item.action || item.concern || 'No action details provided.'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-4 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-lg font-black text-slate-900">AI Insights</h2>
                    <Sparkles className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-700">At-risk groups</p>
                      <p className="text-slate-900 font-black mt-1">{insights.riskGroups.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-700">Follow-up items</p>
                      <p className="text-slate-900 font-black mt-1">{insights.followUps.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Recommended Actions</p>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        <li>Assign advisers to all unassigned groups in the active term.</li>
                        <li>Prioritize groups with blocker or risk concerns for check-ins.</li>
                        <li>Prompt first consultation for groups with no consultation logs.</li>
                      </ul>
                    </div>
                  </div>
                  <Link href="/scholar/courses" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-slate-900 mt-4">
                    Open course-level AI analysis
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-4">Readiness Matrix</h2>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Courses without groups</span>
                      <span className="font-black text-slate-900">{readiness.coursesWithoutGroups}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Groups without adviser</span>
                      <span className="font-black text-slate-900">{readiness.groupsWithoutAdviser}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Groups without members</span>
                      <span className="font-black text-slate-900">{readiness.groupsWithoutMembers}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Groups without consultation</span>
                      <span className="font-black text-slate-900">{readiness.groupsWithoutConsultation}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-4">Resource Balance</h2>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-cyan-800">Assigned advisers</span>
                      <span className="font-black text-cyan-900">{availability.assignedAdvisers}/{availability.totalAdvisers}</span>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-emerald-800">Available advisers</span>
                      <span className="font-black text-emerald-900">{availability.availableAdvisers}</span>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                      <span className="font-semibold text-amber-800">Unassigned groups</span>
                      <span className="font-black text-amber-900">{availability.unassignedGroupsInTerm}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-4">Integrity Feed</h2>
                  {insights.dataIntegrityIssues.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      No active integrity issues detected.
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {insights.dataIntegrityIssues.slice(0, 5).map((issue, index) => (
                        <div key={`${issue}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">Course Overview</h2>
                  <p className="text-sm text-slate-500 mt-1">High-level access to your active academic units.</p>
                </div>
                <Link href="/scholar/courses" className="inline-flex items-center gap-2 text-sm font-black text-cyan-700 hover:text-cyan-800">
                  Open full course index
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {courses.slice(0, 9).map((course) => (
                    <Link
                      key={course.id}
                      href={`/scholar/courses/${course.id}`}
                      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 hover:shadow-md hover:border-cyan-300 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
                          <BookOpen className="w-5 h-5 text-cyan-200" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.16em] px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                          {course.courseSection}
                        </span>
                      </div>
                      <p className="font-black text-slate-900 leading-snug group-hover:text-cyan-800">{course.courseName}</p>
                      <p className="text-sm text-slate-600 mt-1">{course.courseCode} · {course.courseTerm}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <Users className="w-4 h-4" />
                        {course.courseAmount || 0} student(s)
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="font-semibold text-slate-700">No courses available yet.</p>
                  <p className="text-sm text-slate-500 mt-1">Create or import courses to populate your dashboard.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            <div className="mb-12 animate-fade-in">
              <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {isAdviser ? 'Adviser Workspace' : 'Student Workspace'}
              </h1>
              <p className="mt-3 text-2xl" style={{ color: 'var(--color-text)' }}>
                Welcome back, <span className="font-semibold">{user.name || user.email?.split('@')[0]}</span>
                <span style={{ color: 'var(--color-textSecondary)' }}> · {effectiveRole}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
              {statCards.map((card) => (
                <div key={card.label} className="glass-card p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 bg-gradient-to-br ${card.color} rounded-xl shadow-md`}>
                      <card.icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{card.label}</span>
                  </div>
                  <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass-card p-8 mb-12">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-8">Role Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isAdviser && (
                  <>
                    <Link href="/scholar/schedule" className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group">
                      <Calendar className="w-7 h-7 text-blue-600" />
                      <div>
                        <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Consultation Slot Management</p>
                        <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>{insights.upcomingSlots} upcoming slot(s)</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                    </Link>
                    <Link href="/scholar/courses" className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group">
                      <Stethoscope className="w-7 h-7 text-blue-600" />
                      <div>
                        <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Consultation Prep Workspace</p>
                        <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Review journals, concerns, and actions</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                    </Link>
                  </>
                )}

                {isStudent && (
                  <>
                    <Link href="/scholar/booking" className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group">
                      <Calendar className="w-7 h-7 text-blue-600" />
                      <div>
                        <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Book Consultation</p>
                        <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Find available adviser slots</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                    </Link>
                    <Link href="/scholar/courses" className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group">
                      <ClipboardList className="w-7 h-7 text-blue-600" />
                      <div>
                        <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Journal and Consultation History</p>
                        <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Track entries and adviser feedback</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                    </Link>
                    <Link href="/scholar/courses" className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group">
                      <UserCheck className="w-7 h-7 text-blue-600" />
                      <div>
                        <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Action Items</p>
                        <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Follow adviser guidance and next steps</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                    </Link>
                  </>
                )}

                <Link
                  href="/scholar/courses"
                  className="flex items-center gap-4 p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <BookOpen className="w-7 h-7 text-blue-600" />
                  <div>
                    <p className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Courses</p>
                    <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>Open course and group views</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-400 ml-auto" />
                </Link>
              </div>
            </div>

            {isAdviser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">Follow-up Tracker</h2>
              {insights.followUps.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>No follow-ups recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {insights.followUps.slice(0, 5).map((item, index) => (
                    <div key={`${item.groupName}-${index}`} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-bold text-gray-800">{item.groupName} · {item.courseCode}</p>
                      {item.concern && <p className="text-xs text-amber-700 mt-1">Concern: {item.concern}</p>}
                      {item.action && <p className="text-xs text-blue-700 mt-1">Action: {item.action}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">At-risk Groups</h2>
              {insights.riskGroups.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>No flagged groups in the latest scan.</p>
              ) : (
                <div className="space-y-4">
                  {insights.riskGroups.slice(0, 5).map((item, index) => (
                    <div key={`${item.groupName}-${index}`} className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-sm font-bold text-red-700">{item.groupName} · {item.courseCode}</p>
                      <p className="text-xs text-red-600 mt-1">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            )}

            {isStudent && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">Action Item Checklist</h2>
              {insights.actionItems.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>No action items yet. Submit or attend a consultation first.</p>
              ) : (
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text)' }}>
                  {insights.actionItems.slice(0, 8).map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">Progress Snapshot</h2>
              <div className="space-y-3 text-sm" style={{ color: 'var(--color-text)' }}>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /><span>{insights.consultationLogs} consultation log(s) recorded.</span></div>
                <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-600" /><span>{insights.journalEntries} journal entry/entries submitted.</span></div>
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><span>{insights.groupWithoutConsultation} of scanned groups have no consultations yet.</span></div>
              </div>
            </div>
          </div>
            )}

            <div className="glass-card p-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-8">
                {isStudent ? 'Enrolled Courses' : 'Courses'}
              </h2>
              {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.slice(0, 9).map((course) => (
                    <Link key={course.id} href={`/scholar/courses/${course.id}`} className="p-6 border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all duration-300 group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg"><BookOpen className="w-6 h-6 text-white" /></div>
                        <span className="text-sm font-medium px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full">{course.courseSection}</span>
                      </div>
                      <h3 className="font-semibold text-base transition-colors group-hover:text-blue-600 mb-2" style={{ color: 'var(--color-text)' }}>{course.courseName}</h3>
                      <p className="text-base" style={{ color: 'var(--color-textSecondary)' }}>{course.courseCode} · {course.courseTerm}</p>
                      <div className="flex items-center gap-2 mt-4 text-sm text-gray-500"><Users className="w-5 h-5" /><span>{course.courseAmount || 0} students</span></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                  <p className="text-gray-700 font-medium text-lg">No courses yet</p>
                  <p className="text-base text-gray-600 mt-2">Use course enrollment or course creation to get started.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
