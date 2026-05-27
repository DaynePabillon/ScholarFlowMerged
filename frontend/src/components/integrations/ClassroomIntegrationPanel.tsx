'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { BookOpen, Users, UserPlus, CheckCircle2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';

interface Course { id: string; name: string; section?: string; enrollmentCode?: string; }
interface Student { userId: string; profile?: { name?: { fullName?: string }; emailAddress?: string }; }
interface Props { organizationId: string; }

export default function ClassroomIntegrationPanel({ organizationId }: Props) {
  const [connected, setConnected] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Check Google auth status (same OAuth as Drive/Sheets)
    apiClient.get('/auth/google/status').then(r => {
      setConnected(r.data.connected || false);
      if (r.data.connected) loadCourses();
    }).catch(() => setConnected(false)).finally(() => setLoading(false));
  }, []);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/classroom/courses');
      setCourses(res.data.courses || []);
    } catch {}
  };

  const handleCourseSelect = async (courseId: string) => {
    setSelectedCourse(courseId);
    setRoster([]);
    setConfirmed(false);
    if (!courseId) return;
    setLoadingRoster(true);
    try {
      const res = await apiClient.get(`/classroom/courses/${courseId}/students`);
      setRoster(res.data.students || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to load roster' });
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCourse || !confirmed) return;
    setImporting(true);
    setFeedback(null);
    try {
      const res = await apiClient.post('/classroom/import', {
        course_id: selectedCourse,
        organization_id: organizationId
      });
      setFeedback({
        type: 'success',
        message: `Imported ${res.data.imported || 0} student(s) from Google Classroom`
      });
      setConfirmed(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-24 text-slate-400 text-sm">Checking Classroom status...</div>;
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/40 bg-white/30">
        <div className="bg-[#1a73e8] p-1.5 rounded-lg">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Google Classroom</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Import roster and grades from Classroom</p>
        </div>
        {connected && (
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Connected</span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {!connected ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Connect your Google account to import courses and students from Google Classroom.
            </p>
            <a
              href="/api/auth/google"
              className="inline-block bg-[#1a73e8] hover:bg-[#1565c0] text-white text-sm font-medium px-5 py-2.5 rounded-lg"
            >
              Connect Google Account
            </a>
          </div>
        ) : (
          <>
            {/* Course selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Select Course</label>
              <select
                value={selectedCourse}
                onChange={e => handleCourseSelect(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">Choose a course…</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
                ))}
              </select>
              {courses.length === 0 && (
                <button onClick={loadCourses} className="text-xs text-sky-600 hover:text-sky-700 underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Refresh courses
                </button>
              )}
            </div>

            {/* Roster */}
            {loadingRoster ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading roster…
              </div>
            ) : roster.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{roster.length} Students</span>
                  </div>
                </div>

                <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl overflow-hidden border border-white/40">
                  <div className="bg-white/30 grid grid-cols-2 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                    <span>Name</span>
                    <span>Email</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                    {roster.map((s, i) => (
                      <div key={s.userId || i} className="grid grid-cols-2 px-4 py-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{s.profile?.name?.fullName || '—'}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{s.profile?.emailAddress || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirmation */}
                <div className="flex items-start gap-2 bg-amber-50/70 backdrop-blur-sm rounded-xl border border-amber-100/50 p-3">
                  <input
                    type="checkbox"
                    id="confirm-import"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="confirm-import" className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                    I confirm importing {roster.length} student(s) into this organization. Existing accounts will be matched by email.
                  </label>
                </div>

                {feedback && (
                  <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    feedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600'
                  }`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {feedback.message}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={!confirmed || importing}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-300"
                >
                  <UserPlus className="h-4 w-4" />
                  {importing ? 'Importing…' : 'Import Students'}
                </button>
              </div>
            ) : selectedCourse ? (
              <div className="text-center text-slate-400 text-sm py-4">No students found in this course.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
