'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SidebarLayout from '@/components/scholar/SidebarLayout';
import apiClient from '@/lib/api/client';
import { AlertTriangle, CheckCircle2, Shield, Users, BookOpen, ArrowRight } from 'lucide-react';

type Course = {
  id: number;
  courseName: string;
  courseCode: string;
  courseSection: string;
};

type Group = {
  id: string;
  groupName: string;
  adviser?: string;
  members?: Array<{ name: string; email: string }>;
};

type IntegrityIssue = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  courseId?: number;
};

const normalizeRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser';
  return 'Student';
};

export default function AdminDataIntegrityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);

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
        if (role !== 'Admin') {
          router.push('/scholar/dashboard');
          return;
        }

        const res = await apiClient.get('/dashboard/admin-data-integrity');
        setCourses(Array.isArray(res.data?.courses) ? res.data.courses : []);
        setAccounts(Array.isArray(res.data?.accounts) ? res.data.accounts : []);
        setIssues(Array.isArray(res.data?.issues) ? res.data.issues : []);
      } catch (error) {
        console.error('Failed to load data integrity page:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const summary = useMemo(() => {
    const high = issues.filter((i) => i.severity === 'high').length;
    const medium = issues.filter((i) => i.severity === 'medium').length;
    const low = issues.filter((i) => i.severity === 'low').length;
    return { high, medium, low };
  }, [issues]);

  const roleBreakdown = useMemo(() => {
    const counts = { Admin: 0, Adviser: 0, Student: 0 };
    for (const account of accounts) {
      counts[normalizeRole(account?.accountRole || account?.role)] += 1;
    }
    return counts;
  }, [accounts]);

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
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Data Integrity</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--color-textSecondary)' }}>
            Admin quality checks for roles, groups, consultations, and academic records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Courses</p>
            <p className="text-4xl font-black text-blue-700 mt-2">{courses.length}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">High Severity</p>
            <p className="text-4xl font-black text-red-700 mt-2">{summary.high}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Medium Severity</p>
            <p className="text-4xl font-black text-amber-700 mt-2">{summary.medium}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400">Low Severity</p>
            <p className="text-4xl font-black text-blue-700 mt-2">{summary.low}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="glass-card p-6">
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" /> Role Distribution
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex justify-between"><span>Admin</span><span className="font-bold">{roleBreakdown.Admin}</span></div>
              <div className="flex justify-between"><span>Adviser</span><span className="font-bold">{roleBreakdown.Adviser}</span></div>
              <div className="flex justify-between"><span>Student</span><span className="font-bold">{roleBreakdown.Student}</span></div>
            </div>
            <Link href="/scholar/admin/accounts" className="mt-5 inline-flex items-center gap-2 text-blue-600 text-sm font-bold">
              Manage Accounts <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="glass-card p-6 lg:col-span-2">
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" /> Course Integrity Snapshot
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.slice(0, 8).map((course) => {
                const courseIssues = issues.filter((issue) => issue.courseId === course.id).length;
                return (
                  <Link
                    key={course.id}
                    href={`/scholar/courses/${course.id}`}
                    className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <p className="font-bold text-gray-800">{course.courseCode}</p>
                    <p className="text-xs text-gray-500">{course.courseName}</p>
                    <p className="text-xs mt-2 font-semibold text-blue-700">{courseIssues} integrity issue(s)</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-xl font-black text-gray-900 mb-4">Detected Issues</h2>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5" /> No integrity issues detected.
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <div key={`${issue.title}-${index}`} className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${issue.severity === 'high' ? 'text-red-600' : issue.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'}`} />
                    {issue.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{issue.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 glass-card p-6">
          <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Quality Review Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-xl p-4">1. Fix role/access mismatches in Accounts.</div>
            <div className="border border-gray-200 rounded-xl p-4">2. Open flagged courses and complete group adviser/member mapping.</div>
            <div className="border border-gray-200 rounded-xl p-4">3. Ensure each active group has at least one consultation record.</div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
