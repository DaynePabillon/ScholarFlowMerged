'use client';

import { useEffect, useMemo, useState } from 'react';
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client';
import { Users, UserCheck, UserX, AlertTriangle, Search, Calendar } from 'lucide-react';

type AssignedGroup = {
  groupId: number;
  groupName: string;
  courseId: number;
  courseCode: string;
  courseSection: string;
  courseTerm: string;
};

type AdviserAvailability = {
  accountId: number;
  name: string;
  email: string;
  role: string;
  assignedCount: number;
  availabilityStatus: 'Assigned' | 'Available';
  assignedGroups: AssignedGroup[];
};

type AvailabilityResponse = {
  terms: string[];
  selectedTerm: string;
  advisers: AdviserAvailability[];
  summary: {
    totalAdvisers: number;
    assignedAdvisers: number;
    availableAdvisers: number;
    totalGroupsInTerm: number;
    unassignedGroupsInTerm: number;
    mappedGroupsInTerm: number;
  };
  unassignedGroups: Array<{
    groupId: number;
    groupName: string;
    courseId: number;
    courseCode: string;
    courseSection: string;
    adviserLabel: string;
  }>;
  unmappedAdviserLabels: string[];
};

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser';
  return 'Student';
};

const emptyData: AvailabilityResponse = {
  terms: [],
  selectedTerm: '',
  advisers: [],
  summary: {
    totalAdvisers: 0,
    assignedAdvisers: 0,
    availableAdvisers: 0,
    totalGroupsInTerm: 0,
    unassignedGroupsInTerm: 0,
    mappedGroupsInTerm: 0
  },
  unassignedGroups: [],
  unmappedAdviserLabels: []
};

export default function AdviserAvailabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [data, setData] = useState<AvailabilityResponse>(emptyData);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [query, setQuery] = useState('');

  const loadData = async (term?: string) => {
    setLoadingData(true);
    try {
      const params = term ? `?term=${encodeURIComponent(term)}` : '';
      const res = await apiClient.get(`/dashboard/adviser-availability${params}`);
      const payload: AvailabilityResponse = {
        ...emptyData,
        ...res.data,
        summary: { ...emptyData.summary, ...(res.data?.summary || {}) }
      };

      setData(payload);
      setSelectedTerm(payload.selectedTerm || term || '');
    } catch (error) {
      console.error('Failed to load adviser availability:', error);
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

        await loadData();
      } catch {
        router.push('/scholar/dashboard');
      }
    };

    init();
  }, [router]);

  const filteredAdvisers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.advisers;
    return data.advisers.filter((adviser) => {
      const inAdviser = adviser.name.toLowerCase().includes(q) || adviser.email.toLowerCase().includes(q);
      const inGroups = adviser.assignedGroups.some(
        (group) =>
          group.groupName.toLowerCase().includes(q) ||
          group.courseCode.toLowerCase().includes(q) ||
          group.courseSection.toLowerCase().includes(q)
      );
      return inAdviser || inGroups;
    });
  }, [data.advisers, query]);

  if (loading) {
    return (
      <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="portal-panel-strong p-6 sm:p-8 mb-6">
          <span className="portal-chip mb-3">Adviser Oversight</span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>Adviser Availability</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--color-textSecondary)' }}>
            Admin view of adviser and their assigned groups for the selected semester.
          </p>
        </div>

        <div className="portal-panel p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--color-textSecondary)' }}>Semester</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--color-textSecondary)' }} />
                <select
                  value={selectedTerm}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedTerm(next);
                    void loadData(next);
                  }}
                  className="portal-input text-sm"
                >
                  {data.terms.length === 0 ? (
                    <option value="">No semesters found</option>
                  ) : (
                    data.terms.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--color-textSecondary)' }}>Search Adviser or Group</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute top-3 left-3" style={{ color: 'var(--color-textSecondary)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type adviser name, email, group, or course"
                  className="portal-input pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="portal-stat">
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Total Adviser</p>
            <p className="text-4xl font-black mt-2 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}><Users className="w-6 h-6" />{data.summary.totalAdvisers}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Assigned</p>
            <p className="text-4xl font-black mt-2 flex items-center gap-2" style={{ color: 'var(--color-success)' }}><UserCheck className="w-6 h-6" />{data.summary.assignedAdvisers}</p>
          </div>
          <div className="portal-stat">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-textSecondary)' }}>Available</p>
            <p className="text-4xl font-black mt-2 flex items-center gap-2" style={{ color: 'var(--color-warning)' }}><UserX className="w-6 h-6" />{data.summary.availableAdvisers}</p>
          </div>
        </div>

        <div className="portal-panel p-6 mb-8">
          <h2 className="text-xl font-black mb-4" style={{ color: 'var(--color-text)' }}>Adviser Assignment List</h2>
          {loadingData ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: 'var(--color-primary)' }} />
            </div>
          ) : filteredAdvisers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>No adviser matches the current filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredAdvisers.map((adviser) => (
                <div key={adviser.accountId} className="portal-panel p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{adviser.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{adviser.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: adviser.assignedCount > 0 ? 'color-mix(in srgb, var(--color-success) 14%, transparent)' : 'color-mix(in srgb, var(--color-warning) 14%, transparent)',
                          color: adviser.assignedCount > 0 ? 'var(--color-success)' : 'var(--color-warning)'
                        }}
                      >
                        {adviser.availabilityStatus}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-textSecondary)' }}>{adviser.assignedCount} group(s)</span>
                    </div>
                  </div>

                  {adviser.assignedGroups.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {adviser.assignedGroups.map((group) => (
                        <Link
                          key={`${adviser.accountId}-${group.groupId}`}
                          href={`/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`}
                          className="text-xs p-2.5 rounded-lg portal-panel hover:-translate-y-0.5 transition-all"
                        >
                          <p className="font-bold" style={{ color: 'var(--color-text)' }}>{group.groupName}</p>
                          <p style={{ color: 'var(--color-textSecondary)' }}>{group.courseCode} · {group.courseSection}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs" style={{ color: 'var(--color-textSecondary)' }}>No assigned groups in this semester.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="portal-panel p-6">
            <h2 className="text-xl font-black mb-3" style={{ color: 'var(--color-text)' }}>Unassigned Groups</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-textSecondary)' }}>Groups with no adviser label in team data.</p>
            {data.unassignedGroups.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-success)' }}>All groups have adviser labels for this semester.</p>
            ) : (
              <div className="space-y-2">
                {data.unassignedGroups.slice(0, 20).map((group) => (
                  <Link
                    key={`unassigned-${group.groupId}`}
                    href={`/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`}
                    className="block p-2.5 rounded-lg text-xs portal-panel hover:-translate-y-0.5 transition-all"
                  >
                    <p className="font-bold" style={{ color: 'var(--color-warning)' }}>{group.groupName}</p>
                    <p style={{ color: 'var(--color-textSecondary)' }}>{group.courseCode} · {group.courseSection}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="portal-panel p-6">
            <h2 className="text-xl font-black mb-3" style={{ color: 'var(--color-text)' }}>Unmapped Adviser Labels</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-textSecondary)' }}>Labels used in groups but not found in Adviser accounts.</p>
            {data.unmappedAdviserLabels.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-success)' }}>No unmapped adviser labels found.</p>
            ) : (
              <ul className="space-y-2">
                {data.unmappedAdviserLabels.map((label) => (
                  <li key={label} className="text-xs p-2.5 rounded-lg flex items-start gap-2 portal-panel" style={{ color: 'var(--color-error)' }}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
