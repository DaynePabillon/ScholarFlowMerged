'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/scholar/SidebarLayout';
import Link from 'next/link';
import apiClient, { API_URL } from '@/lib/api/client';
import {
  BookOpen,
  Users,
  Layers,
  TrendingUp,
  FolderOpen,
  FileSpreadsheet,
  ArrowRight,
  Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (!token) {
        router.push('/scholar/login');
        return;
      }

      // Sync tokens
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);

      try {
        // Fetch dashboard data using unified apiClient
        const res = await apiClient.get('/courses');
        setCourses(res.data || []);
        
        // Get user from ScholarSync /me endpoint (returns ss_account role)
        const meRes = await apiClient.get('/me');
        setUser(meRes.data);
        // Cache profile to prevent role flicker on navigation
        localStorage.setItem('scholar_profile', JSON.stringify(meRes.data));
      } catch (err) {
        console.error('Failed to fetch scholar dashboard data:', err);
        // If it's a 401, apiClient will handle redirect
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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

  const effectiveRole = user.scholarsyncRole || user.role || '';
  const isAdmin = effectiveRole === 'Admin';
  const isInstructor = effectiveRole === 'Admin' || effectiveRole === 'Advisers';

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        {/* Header */}
        <div className="mb-12 animate-fade-in">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="mt-3 text-2xl" style={{ color: 'var(--color-text)' }}>
            Welcome back, <span className="font-semibold">{user.email?.split('@')[0]}</span>
            <span style={{ color: 'var(--color-textSecondary)' }}> · {effectiveRole}</span>
          </p>
        </div>

        {/* Stats Grid */}
        {effectiveRole !== 'Student' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="glass-card p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-md">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Courses</span>
            </div>
            <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {courses.length}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-textSecondary)' }}>
              {isInstructor ? 'Courses managed' : 'Enrolled courses'}
            </p>
          </div>

          <div className="glass-card p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-md">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Students</span>
            </div>
            <p className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {courses.reduce((sum: number, c: any) => sum + (c.courseAmount || 0), 0)}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-textSecondary)' }}>Total enrolled</p>
          </div>

          <div className="glass-card p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-md">
                <Layers className="w-7 h-7 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Sections</span>
            </div>
            <p className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {new Set(courses.map((c: any) => c.courseSection)).size}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-textSecondary)' }}>Unique sections</p>
          </div>

          <div className="glass-card p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-md">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Term</span>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {courses[0]?.courseTerm || 'No Term'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-textSecondary)' }}>Current semester</p>
          </div>
        </div>
        )}

        {/* Quick Actions */}
        <div className="glass-card p-8 mb-12">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-8">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/scholar/courses"
              className="flex items-center gap-4 p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:border-transparent transition-all duration-300 group hover:shadow-md"
            >
              <BookOpen className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
              <div>
                <p className="font-semibold text-base transition-colors group-hover:text-white" style={{ color: 'var(--color-text)' }}>View Courses</p>
                <p className="text-sm transition-colors group-hover:text-white/80" style={{ color: 'var(--color-textSecondary)' }}>Manage your courses</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-white ml-auto transition-colors" />
            </Link>

            <Link
              href="/scholar/drive"
              className="flex items-center gap-4 p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:border-transparent transition-all duration-300 group hover:shadow-md"
            >
              <FolderOpen className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
              <div>
                <p className="font-semibold text-base text-gray-900 dark:text-gray-100 group-hover:text-white transition-colors">Google Drive</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/80 transition-colors">Browse your files</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-white ml-auto transition-colors" />
            </Link>

            <Link
              href="/scholar/sheets"
              className="flex items-center gap-4 p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:border-transparent transition-all duration-300 group hover:shadow-md"
            >
              <FileSpreadsheet className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
              <div>
                <p className="font-semibold text-base text-gray-900 dark:text-gray-100 group-hover:text-white transition-colors">Google Sheets</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/80 transition-colors">View spreadsheets</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-white ml-auto transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent Courses */}
        <div className="glass-card p-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-8">
            {isInstructor ? 'Your Courses' : 'Enrolled Courses'}
          </h2>
          {courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((course: any) => (
                <Link
                  key={course.id}
                  href={`/scholar/courses/${course.id}`}
                  className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-sm font-medium px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {course.courseSection}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-2" style={{ color: 'var(--color-text)' }}>
                    {course.courseName}
                  </h3>
                  <p className="text-base" style={{ color: 'var(--color-textSecondary)' }}>{course.courseCode} · {course.courseTerm}</p>
                  <div className="flex items-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <Users className="w-5 h-5" />
                    <span>{course.courseAmount || 0} students</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-6" />
              <p className="text-gray-700 dark:text-gray-300 font-medium text-lg">No courses yet</p>
              <p className="text-base text-gray-600 dark:text-gray-400 mt-2">
                {isInstructor ? 'Create your first course to get started' : 'Enroll in a course using a course key'}
              </p>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
