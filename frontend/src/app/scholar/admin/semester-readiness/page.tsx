'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client';
import { CheckCircle2, AlertTriangle, Calendar, ClipboardList, Users } from 'lucide-react';

type ReadinessData = {
  terms: string[];
  selectedTerm: string;
  summary: {
    coursesInTerm: number;
    groupsInTerm: number;
    advisersInSystem: number;
    assignedAdvisersInTerm: number;
    availableAdvisersInTerm: number;
    readinessScore: number;
  };
  checklist: {
    coursesWithoutGroups: Array<{
      courseId: number;
      courseCode: string;
      courseSection: string;
      courseName: string;
    }>;
    groupsWithoutAdviser: Array<{
      groupId: string;
      groupName: string;
      courseId: number;
      courseCode: string;
      courseSection: string;
    }>;
    groupsWithoutMembers: Array<{
      groupId: string;
      groupName: string;
      courseId: number;
      courseCode: string;
      courseSection: string;
      memberCount: number;
    }>;
    groupsWithoutConsultation: Array<{
      groupId: string;
      groupName: string;
      courseId: number;
      courseCode: string;
      courseSection: string;
    }>;
  };
};

const emptyData: ReadinessData = {
  terms: [],
  selectedTerm: '',
  summary: {
    coursesInTerm: 0,
    groupsInTerm: 0,
    advisersInSystem: 0,
    assignedAdvisersInTerm: 0,
    availableAdvisersInTerm: 0,
    readinessScore: 100
  },
  checklist: {
    coursesWithoutGroups: [],
    groupsWithoutAdviser: [],
    groupsWithoutMembers: [],
    groupsWithoutConsultation: []
  }
};

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser';
  return 'Student';
};

export default function SemesterReadinessPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [data, setData] = useState<ReadinessData>(emptyData);
  const [selectedTerm, setSelectedTerm] = useState('');

  const fetchData = async (term?: string) => {
    setLoadingData(true);
    try {
      const params = term ? `?term=${encodeURIComponent(term)}` : '';
      const res = await apiClient.get(`/dashboard/semester-readiness${params}`);
      const payload: ReadinessData = {
        ...emptyData,
        ...res.data,
        summary: { ...emptyData.summary, ...(res.data?.summary || {}) },
        checklist: { ...emptyData.checklist, ...(res.data?.checklist || {}) }
      };
      setData(payload);
      setSelectedTerm(payload.selectedTerm || term || '');
    } catch (error) {
      console.error('Failed to load semester readiness data:', error);
    } finally {
      setLoadingData(false);
      setLoading(false);
    }
  };


// Load user + org context for unified AppLayout sidebar
  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) { try { setUser(JSON.parse(u)) } catch {} }
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const meRes = await apiClient.get('/auth/me');
        const role = normalizeRole(meRes.data?.scholarsyncRole || meRes.data?.role);
        if (role !== 'Admin') {
          router.push('/scholar/dashboard');
          return;
        }

        await fetchData();
      } catch {
        router.push('/scholar/dashboard');
      }
    };

    init();
  }, [router]);

  if (loading) {
    return (
      <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const readinessColor =
    data.summary.readinessScore >= 85
      ? 'text-emerald-700'
      : data.summary.readinessScore >= 60
        ? 'text-amber-700'
        : 'text-red-700';

  const checklistItems = [
    {
      title: 'Courses Without Groups',
      count: data.checklist.coursesWithoutGroups.length,
      entries: data.checklist.coursesWithoutGroups.map((course) => ({
        key: `course-${course.courseId}`,
        href: `/scholar/courses/${course.courseId}`,
        primary: `${course.courseCode} · ${course.courseSection}`,
        secondary: course.courseName
      }))
    },
    {
      title: 'Groups Without Adviser',
      count: data.checklist.groupsWithoutAdviser.length,
      entries: data.checklist.groupsWithoutAdviser.map((group) => ({
        key: `group-adviser-${group.groupId}`,
        href: `/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`,
        primary: `${group.groupName}`,
        secondary: `${group.courseCode} · ${group.courseSection}`
      }))
    },
    {
      title: 'Groups Without Members',
      count: data.checklist.groupsWithoutMembers.length,
      entries: data.checklist.groupsWithoutMembers.map((group) => ({
        key: `group-members-${group.groupId}`,
        href: `/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`,
        primary: `${group.groupName}`,
        secondary: `${group.courseCode} · ${group.courseSection}`
      }))
    },
    {
      title: 'Groups Without Consultation',
      count: data.checklist.groupsWithoutConsultation.length,
      entries: data.checklist.groupsWithoutConsultation.map((group) => ({
        key: `group-consult-${group.groupId}`,
        href: `/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`,
        primary: `${group.groupName}`,
        secondary: `${group.courseCode} · ${group.courseSection}`
      }))
    }
  ];

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="portal-panel-strong p-6 sm:p-8 mb-6">
          <span className="portal-chip mb-3">Semester Planning</span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>Semester Readiness Checklist</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--color-textSecondary)' }}>
            Admin checklist for semester setup and adviser/group consultation readiness.
          </p>
        </div>

        <div className="portal-panel p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--color-textSecondary)' }}>Semester</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--color-textSecondary)' }} />
                <select
                  value={selectedTerm}
                  onChange={(e) => {
                    const term = e.target.value;
                    setSelectedTerm(term);
                    void fetchData(term);
                  }}
                  className="portal-input text-sm"
                >
                  {data.terms.length === 0 ? (
                    <option value="">No semester found</option>
                  ) : (
                    data.terms.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Readiness Score</p>
              <p className="text-5xl font-black" style={{ color: readinessColor === 'text-emerald-700' ? 'var(--color-success)' : readinessColor === 'text-amber-700' ? 'var(--color-warning)' : 'var(--color-error)' }}>{data.summary.readinessScore}%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Courses</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'var(--color-primary)' }}>{data.summary.coursesInTerm}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Groups</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'var(--color-primary)' }}>{data.summary.groupsInTerm}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Adviser</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'var(--color-primary)' }}>{data.summary.advisersInSystem}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Assigned</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'var(--color-success)' }}>{data.summary.assignedAdvisersInTerm}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Available</p>
            <p className="text-3xl font-black mt-1" style={{ color: 'var(--color-warning)' }}>{data.summary.availableAdvisersInTerm}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Loading</p>
            <p className="text-sm font-black mt-2" style={{ color: 'var(--color-textSecondary)' }}>{loadingData ? 'Refreshing...' : 'Ready'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {checklistItems.map((item) => (
            <div key={item.title} className="portal-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <ClipboardList className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  {item.title}
                </h2>
                <span
                  className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: item.count === 0 ? 'color-mix(in srgb, var(--color-success) 14%, transparent)' : 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                    color: item.count === 0 ? 'var(--color-success)' : 'var(--color-warning)'
                  }}
                >
                  {item.count}
                </span>
              </div>

              {item.count === 0 ? (
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete
                </div>
              ) : (
                <div className="space-y-2">
                  {item.entries.slice(0, 12).map((entry) => (
                    <Link key={entry.key} href={entry.href} className="block p-2.5 rounded-lg portal-panel hover:-translate-y-0.5 transition-all">
                      <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{entry.primary}</p>
                      <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{entry.secondary}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 portal-panel p-6">
          <h2 className="text-xl font-black mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Users className="w-5 h-5" style={{ color: 'var(--color-primary)' }} /> Suggested Admin Flow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="portal-panel p-4">1. Resolve courses without groups.</div>
            <div className="portal-panel p-4">2. Assign advisers and verify member rosters.</div>
            <div className="portal-panel p-4">3. Ensure each group has at least one consultation record.</div>
          </div>

          {(data.checklist.groupsWithoutAdviser.length > 0 || data.checklist.coursesWithoutGroups.length > 0) && (
            <div className="mt-4 p-3 rounded-xl text-sm flex items-start gap-2 portal-panel" style={{ color: 'var(--color-warning)' }}>
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>
                You can also review adviser capacity in
                {' '}
                <Link href="/scholar/admin/adviser-availability" className="font-bold underline" style={{ color: 'var(--color-primary)' }}>Adviser Availability</Link>
                {' '}
                before assigning missing groups.
              </span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
