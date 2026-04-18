'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SidebarLayout from '@/components/scholar/SidebarLayout';
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
      <SidebarLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        <div className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Adviser Availability</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--color-textSecondary)' }}>
            Admin view of adviser and their assigned groups for the selected semester.
          </p>
        </div>

        <div className="glass-card p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Semester</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedTerm}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedTerm(next);
                    void loadData(next);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Search Adviser or Group</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute top-3 left-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type adviser name, email, group, or course"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
              <p className="text-xs uppercase tracking-widest text-gray-400">Total Adviser</p>
            <p className="text-4xl font-black text-blue-700 mt-2 flex items-center gap-2"><Users className="w-6 h-6" />{data.summary.totalAdvisers}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Assigned</p>
            <p className="text-4xl font-black text-emerald-700 mt-2 flex items-center gap-2"><UserCheck className="w-6 h-6" />{data.summary.assignedAdvisers}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Available</p>
            <p className="text-4xl font-black text-amber-700 mt-2 flex items-center gap-2"><UserX className="w-6 h-6" />{data.summary.availableAdvisers}</p>
          </div>
        </div>

        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-black text-gray-900 mb-4">Adviser Assignment List</h2>
          {loadingData ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : filteredAdvisers.length === 0 ? (
            <p className="text-sm text-gray-500">No adviser matches the current filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredAdvisers.map((adviser) => (
                <div key={adviser.accountId} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-gray-900">{adviser.name}</p>
                      <p className="text-xs text-gray-500">{adviser.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${adviser.assignedCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {adviser.availabilityStatus}
                      </span>
                      <span className="text-xs text-gray-600 font-semibold">{adviser.assignedCount} group(s)</span>
                    </div>
                  </div>

                  {adviser.assignedGroups.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {adviser.assignedGroups.map((group) => (
                        <Link
                          key={`${adviser.accountId}-${group.groupId}`}
                          href={`/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`}
                          className="text-xs p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <p className="font-bold text-gray-800">{group.groupName}</p>
                          <p className="text-gray-500">{group.courseCode} · {group.courseSection}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">No assigned groups in this semester.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-6">
            <h2 className="text-xl font-black text-gray-900 mb-3">Unassigned Groups</h2>
            <p className="text-xs text-gray-500 mb-3">Groups with no adviser label in team data.</p>
            {data.unassignedGroups.length === 0 ? (
              <p className="text-sm text-green-700">All groups have adviser labels for this semester.</p>
            ) : (
              <div className="space-y-2">
                {data.unassignedGroups.slice(0, 20).map((group) => (
                  <Link
                    key={`unassigned-${group.groupId}`}
                    href={`/scholar/courses/${group.courseId}?groupId=${encodeURIComponent(group.groupId)}`}
                    className="block p-2.5 border border-amber-200 bg-amber-50 rounded-lg text-xs"
                  >
                    <p className="font-bold text-amber-800">{group.groupName}</p>
                    <p className="text-amber-700">{group.courseCode} · {group.courseSection}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl font-black text-gray-900 mb-3">Unmapped Adviser Labels</h2>
            <p className="text-xs text-gray-500 mb-3">Labels used in groups but not found in Adviser accounts.</p>
            {data.unmappedAdviserLabels.length === 0 ? (
              <p className="text-sm text-green-700">No unmapped adviser labels found.</p>
            ) : (
              <ul className="space-y-2">
                {data.unmappedAdviserLabels.map((label) => (
                  <li key={label} className="text-xs p-2.5 border border-red-200 bg-red-50 rounded-lg text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
