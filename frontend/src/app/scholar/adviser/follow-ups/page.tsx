'use client';

import { useEffect, useMemo, useState } from 'react';
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client';
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Search, Sparkles } from 'lucide-react';

type Course = {
  id: number;
  courseName: string;
  courseCode: string;
};

type Group = {
  id: string;
  groupName: string;
  courseId: number;
  courseCode: string;
};

type QueueItem = {
  id: string;
  groupId: string;
  groupName: string;
  courseId: number;
  courseCode: string;
  concern: string;
  action: string;
  status: 'overdue' | 'open' | 'resolved';
  updatedAt: string;
};

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser';
  return 'Student';
};

const formatDate = (value: string): string => {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '-';
  return new Date(ts).toLocaleString();
};

const daysSince = (value: string): number => {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 999;
  const diff = Date.now() - ts;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export default function AdviserFollowUpsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'open' | 'resolved'>('all');


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
    const load = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const meRes = await apiClient.get('/auth/me');
        const role = normalizeRole(meRes.data?.scholarsyncRole || meRes.data?.role);
        if (role !== 'Adviser' && role !== 'Admin') {
          router.push('/scholar/dashboard');
          return;
        }

        const queueRes = await apiClient.get('/dashboard/adviser-followups');
        const queueItems = Array.isArray(queueRes.data?.items) ? queueRes.data.items : [];
        setItems(queueItems as QueueItem[]);
      } catch (error) {
        console.error('Failed to load follow-up queue:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.groupName.toLowerCase().includes(q) ||
        item.courseCode.toLowerCase().includes(q) ||
        item.concern.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const summary = useMemo(() => {
    return {
      overdue: items.filter((i) => i.status === 'overdue').length,
      open: items.filter((i) => i.status === 'open').length,
      resolved: items.filter((i) => i.status === 'resolved').length
    };
  }, [items]);

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
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Follow-up Queue</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--color-textSecondary)' }}>
            Adviser queue for unresolved concerns and pending consultation action items.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Overdue</p>
            <p className="text-4xl font-black text-red-700 mt-2">{summary.overdue}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Open</p>
            <p className="text-4xl font-black text-amber-700 mt-2">{summary.open}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Resolved</p>
            <p className="text-4xl font-black text-green-700 mt-2">{summary.resolved}</p>
          </div>
        </div>

        <div className="glass-card p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-gray-400 absolute top-3.5 left-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by group, course code, concern, or action"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" /> Queue Items
          </h2>

          {filteredItems.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5" /> No pending follow-ups in the selected filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-gray-900">{item.groupName} · {item.courseCode}</p>
                      <p className="text-xs text-gray-500 mt-1">Updated: {formatDate(item.updatedAt)}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      item.status === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : item.status === 'open'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-gray-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
                      <span>{item.concern}</span>
                    </p>
                    <p className="text-gray-700 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 mt-0.5 text-blue-600" />
                      <span>{item.action}</span>
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <Link href={`/scholar/courses/${item.courseId}`} className="text-sm text-blue-600 font-bold inline-flex items-center gap-1">
                      Open Course
                    </Link>
                    <Link href={`/scholar/courses/${item.courseId}?groupId=${encodeURIComponent(item.groupId)}`} className="text-sm text-blue-600 font-bold inline-flex items-center gap-1">
                      Open Group Page
                    </Link>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> {daysSince(item.updatedAt)} day(s) since update
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
