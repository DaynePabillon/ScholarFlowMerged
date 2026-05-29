'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, API_URL } from '@/lib/api/client';
import { BookOpen, Users, UserPlus, CheckCircle2, AlertCircle, RefreshCw, Pencil } from 'lucide-react';

interface Course { id: string; name: string; section?: string; enrollmentCode?: string; }
interface Student { userId: string; profile?: { name?: { fullName?: string }; emailAddress?: string }; }
interface Props { organizationId: string; }

export default function ClassroomIntegrationPanel({ organizationId }: Props) {
  const [connected, setConnected] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // Manual email overrides for students whose Classroom profile has no emailAddress
  const [manualEmails, setManualEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check Google auth status — if user is logged in via Google they have tokens
    apiClient.get('/auth/google/status').then(r => {
      const isConnected = r.data.connected || false;
      setConnected(isConnected);
      if (isConnected) loadCourses();
      else setLoading(false);
    }).catch(() => {
      // Status endpoint unavailable — try fetching courses directly as a fallback
      loadCourses();
    });
  }, []);

  const loadCourses = async () => {
    setLoadingCourses(true);
    setScopeError(false);
    try {
      const res = await apiClient.get('/classroom/courses');
      setCourses(res.data.courses || []);
      setConnected(true);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        // No Google token at all
        setConnected(false);
      } else if (status === 403 || (err.response?.data?.details || '').toLowerCase().includes('scope')) {
        // Token exists but lacks classroom scopes — need re-auth with classroom scopes
        setConnected(true);
        setScopeError(true);
      } else {
        // Other error — still treat as connected since user has Google account
        setConnected(true);
      }
    } finally {
      setLoadingCourses(false);
      setLoading(false);
    }
  };

  const handleCourseSelect = async (courseId: string) => {
    setSelectedCourse(courseId);
    setRoster([]);
    setConfirmed(false);
    setManualEmails({});
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
      // Build the definitive student list so the backend doesn't have to re-fetch.
      // Each entry merges the Classroom profile email with any admin-entered manual email.
      const students = roster.map(s => ({
        userId: s.userId,
        name: s.profile?.name?.fullName || '',
        email: s.profile?.emailAddress || manualEmails[s.userId] || ''
      }));

      const res = await apiClient.post('/classroom/import', {
        organization_id: organizationId,
        students
      });
      setFeedback({
        type: 'success',
        message: [
          `Imported ${res.data.imported || 0} student(s) from Google Classroom`,
          res.data.skipped ? ` · ${res.data.skipped} skipped (no email)` : ''
        ].join('')
      });
      setConfirmed(false);
      setManualEmails({});
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  // Students whose email we already know (from Classroom API or manual entry)
  const withEmail = roster.filter(s => s.profile?.emailAddress || manualEmails[s.userId]);
  // Students still missing an email (no Classroom email AND no manual entry yet)
  const noEmail   = roster.filter(s => !s.profile?.emailAddress && !manualEmails[s.userId]);

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
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-[#1a73e8]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-6 w-6 text-[#1a73e8]" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              Connect your Google account to import courses and students from Google Classroom.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('post_login_redirect', '/integrations');
                window.location.href = `${API_URL}/api/auth/google`;
              }}
              className="inline-flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1565c0] text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              Connect Google Account
            </button>
          </div>
        ) : scopeError ? (
          /* Connected but missing classroom API scopes — need re-auth */
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Classroom permissions required</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-xs mx-auto">
              Your Google account is connected but needs classroom access. Click below to grant permission — you'll be returned here automatically.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('post_login_redirect', '/integrations');
                window.location.href = `${API_URL}/api/auth/google`;
              }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              Grant Classroom Access
            </button>
          </div>
        ) : (
          <>
            {/* Course selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Select Course</label>
              {loadingCourses ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading courses…
                </div>
              ) : (
                <select
                  value={selectedCourse}
                  onChange={e => handleCourseSelect(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Choose a course…</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.section ? ` (${c.section})` : ''}</option>
                  ))}
                </select>
              )}
              {!loadingCourses && courses.length === 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">No active courses found in your Classroom account.</p>
                  <button onClick={loadCourses} className="text-xs text-sky-600 hover:text-sky-700 underline flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}
            </div>

            {/* Roster */}
            {loadingRoster ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading roster…
              </div>
            ) : roster.length > 0 ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-sky-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{roster.length} Students</span>
                    </div>
                    {withEmail.length < roster.length && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {withEmail.length}/{roster.length} have email
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl overflow-hidden border border-white/40">
                    <div className="bg-white/30 grid grid-cols-2 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                      <span>Name</span>
                      <span className="flex items-center gap-1">
                        Email
                        {noEmail.length > 0 && (
                          <span className="text-amber-500 normal-case font-normal ml-1">(type to add missing)</span>
                        )}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                      {roster.map((s, i) => {
                        const classroomEmail = s.profile?.emailAddress;
                        const manualEmail = manualEmails[s.userId] || '';
                        return (
                          <div key={s.userId || i} className="grid grid-cols-2 px-4 py-2 text-sm items-center gap-2">
                            <span className="text-slate-700 dark:text-slate-200 truncate">
                              {s.profile?.name?.fullName || '—'}
                            </span>
                            {classroomEmail ? (
                              <span className="text-slate-500 dark:text-slate-400 text-xs truncate">{classroomEmail}</span>
                            ) : (
                              <div className="relative flex items-center">
                                <Pencil className="absolute left-2 h-3 w-3 text-amber-400 pointer-events-none" />
                                <input
                                  type="email"
                                  placeholder="enter email…"
                                  value={manualEmail}
                                  onChange={e => setManualEmails(prev => ({ ...prev, [s.userId]: e.target.value }))}
                                  className="w-full pl-6 pr-2 py-1 text-xs rounded-lg border border-amber-200 bg-amber-50 text-slate-700 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info note about missing emails */}
                  {roster.some(s => !s.profile?.emailAddress) && (
                    <div className="flex items-start gap-2 bg-amber-50/80 rounded-xl border border-amber-200/60 p-3">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700">
                        <p className="font-medium mb-0.5">Some students don't have an email in Classroom</p>
                        <p>This happens with personal Gmail classrooms. Type each student's email in the orange fields above — or leave blank to skip them. School (Google Workspace) classrooms auto-populate emails.</p>
                      </div>
                    </div>
                  )}

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
                      I confirm importing {withEmail.length} student{withEmail.length !== 1 ? 's' : ''} into this organization
                      {noEmail.length > 0 ? ` (${noEmail.length} without email will be skipped)` : ''}.
                      Existing accounts will be matched by email.
                    </label>
                  </div>
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
              </>
            ) : selectedCourse ? (
              <div className="text-center text-slate-400 text-sm py-4">No students found in this course.</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
