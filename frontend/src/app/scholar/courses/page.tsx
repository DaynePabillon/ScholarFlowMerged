'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client';
import { jwtDecode } from 'jwt-decode';
import {
    BookOpen,
    Plus,
    Search,
    Users,
    Copy,
    CheckCircle,
    X,
    KeyRound,
    Loader2,
    CalendarPlus,
    FolderKanban,
    ArrowRight,
    Sparkles
} from 'lucide-react';

type Course = {
    id?: number;
    courseName: string;
    courseCode: string;
    courseKey: string;
    courseAmount: number;
    courseSection: string;
    courseAdviser: string;
    courseImportedBy?: string;
    courseTerm: string;
};

export default function CoursesPage() {
    const [user, setUser] = useState<any>(null);
    const [organizations, setOrganizations] = useState<any[]>([])
    const [selectedOrg, setSelectedOrg] = useState<any>(null)
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [canCreate, setCanCreate] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [successKey, setSuccessKey] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [enrollKey, setEnrollKey] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [courseName, setCourseName] = useState('');
    const [courseCode, setCourseCode] = useState('');
    const [courseSection, setCourseSection] = useState('');
    const [courseTerm, setCourseTerm] = useState('First Semester');

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

  
  // Load org context for unified AppLayout sidebar
  useEffect(() => {
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) { router.push('/login'); return; }
        try {
            const decoded: any = jwtDecode(token);
            setUser(decoded);
            if (decoded.role === 'Admin') setCanCreate(true);
            fetchCourses();
        } catch (err) { router.push('/login'); }
    }, [router]);

    const fetchCourses = async () => {
        try {
            const res = await apiClient.get('/courses');
            setCourses(res.data);
        } catch (err) { console.error('Failed to load courses'); }
        finally { setLoading(false); }
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiClient.post('/courses', { 
                courseName, courseCode, courseSection, courseTerm 
            });
            setCourses([res.data, ...courses]);
            setSuccessKey(res.data.courseKey);
        } catch (err: any) { 
            showToast(err.response?.data?.error || 'Failed to create course', 'error'); 
        }
        finally { setSubmitting(false); }
    };

    const resetModal = () => {
        setIsModalOpen(false);
        setSuccessKey(null);
        setCourseName(''); setCourseCode(''); setCourseSection(''); setCourseTerm('First Semester');
    };

    const handleEnroll = async () => {
        if (!enrollKey) return;
        setEnrolling(true);
        try {
            await apiClient.post('/enroll', { courseKey: enrollKey });
            showToast('Successfully enrolled!');
            setEnrollKey('');
            fetchCourses();
        } catch (err: any) { 
            showToast(err.response?.data?.error || 'Failed to enroll. Check your key.', 'error'); 
        }
        finally { setEnrolling(false); }
    };

    const filteredCourses = courses.filter(c =>
        c.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.courseCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                </div>
            </AppLayout>
        );
    }

    const isAdmin = user?.role === 'Admin';
    const isStudent = user?.role === 'Student';
    const isAdviser = String(user?.role || '').toLowerCase() === 'adviser';

    return (
        <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6 space-y-4">
                <section className="portal-panel-strong p-5 sm:p-6 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/8" />
                    <div className="relative grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
                        <div className="space-y-3">
                            <span className="scholar-hero-kicker text-xs">Academic Catalog</span>
                            <div>
                                <h1 className="scholar-display text-3xl sm:text-4xl" style={{ color: 'var(--color-text)' }}>Courses</h1>
                                <p className="mt-2 text-sm sm:text-base max-w-2xl" style={{ color: 'var(--color-textSecondary)' }}>
                                    {isAdmin ? 'Oversee course creation and assignment health from a cleaner catalog view.' : isAdviser ? 'Track your assigned courses and open consultation workflows faster.' : 'Browse the courses you belong to and enroll with less friction.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {canCreate && (
                                    <button onClick={() => setIsModalOpen(true)} className="portal-button portal-button-primary text-xs">
                                        <Plus className="w-3.5 h-3.5" /> Create
                                    </button>
                                )}
                                {isAdviser && (
                                    <button onClick={() => router.push('/scholar/schedule')} className="portal-button portal-button-secondary text-xs">
                                        <CalendarPlus className="w-3.5 h-3.5" /> Schedule
                                    </button>
                                )}
                                {isStudent && (
                                    <div className="flex items-center gap-1 portal-panel p-1">
                                        <input
                                            type="text"
                                            value={enrollKey}
                                            onChange={e => setEnrollKey(e.target.value)}
                                            placeholder="Key"
                                            className="portal-input text-xs w-40 border-0 bg-transparent px-2 py-1"
                                        />
                                        <button onClick={handleEnroll} disabled={enrolling || !enrollKey} className="portal-button portal-button-primary text-xs disabled:opacity-50">
                                            {enrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="scholar-metric">
                                <p className="scholar-metric-label text-xs">Visible</p>
                                <p className="scholar-metric-value text-xl">{filteredCourses.length}</p>
                                <p className="mt-1 text-xs" style={{ color: 'var(--color-textSecondary)' }}>Matching filters</p>
                            </div>
                            <div className="scholar-metric">
                                <p className="scholar-metric-label text-xs">Groups</p>
                                <p className="scholar-metric-value text-xl">{new Set(filteredCourses.map((course) => course.courseCode)).size}</p>
                                <p className="mt-1 text-xs" style={{ color: 'var(--color-textSecondary)' }}>By code</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="portal-panel p-3 sm:p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--color-textSecondary)' }} />
                            <input
                                type="text"
                                placeholder="Search by name or code"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="portal-input pl-9 pr-3 py-2 text-xs"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="portal-chip text-xs">
                                <FolderKanban className="w-3 h-3" />
                                Roster
                            </span>
                            <span className="portal-chip text-xs">
                                <Sparkles className="w-3 h-3" />
                                {isAdmin ? 'Admin' : isAdviser ? 'Adviser' : 'Student'}
                            </span>
                        </div>
                    </div>
                </section>

                {filteredCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(
                            filteredCourses.reduce((acc, course) => {
                                const code = course.courseCode || 'Other Section';
                                if (!acc[code]) acc[code] = [];
                                acc[code].push(course);
                                return acc;
                            }, {} as Record<string, Course[]>)
                        ).map(([code, coursesInCode]) => (
                            <section key={code} className="portal-panel-strong px-3 py-3 sm:px-3 sm:py-4">
                                <div className="flex flex-col gap-2 mb-3">
                                    <div>
                                        <span className="portal-chip mb-1.5 text-xs">{coursesInCode.length} course{coursesInCode.length === 1 ? '' : 's'}</span>
                                        <h2 className="scholar-section-heading text-base" style={{ color: 'var(--color-text)' }}>{code}</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {coursesInCode.map((course, idx) => (
                                        <Link
                                            href={`/scholar/courses/${course.id}`}
                                            key={idx}
                                            className="portal-panel p-4 group hover:shadow-md transition-all duration-300 hover:scale-105"
                                        >
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                <div className="h-10 w-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mx-auto" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                                                    <BookOpen className="w-5 h-5 text-white" />
                                                </div>

                                                <h3 className="text-sm font-bold leading-tight group-hover:opacity-85 line-clamp-2" style={{ color: 'var(--color-text)' }}>
                                                    {course.courseName}
                                                </h3>
                                                <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{course.courseCode}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>{course.courseSection}</p>

                                                <div className="mt-2 pt-2 w-full border-t" style={{ borderColor: 'var(--color-border)' }}>
                                                    <div className="flex items-center justify-center gap-1 text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                                                        <Users className="w-3 h-3 flex-shrink-0" />
                                                        <span>{course.courseAmount || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="portal-panel p-12 text-center">
                        <div className="mx-auto mb-4 h-16 w-16 rounded-3xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                            <BookOpen className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>No courses found</h3>
                        <p className="mt-2" style={{ color: 'var(--color-textSecondary)' }}>
                            {searchQuery ? 'Try a different search term.' : isAdviser ? 'Create a course or wait for an import.' : isAdmin ? 'No courses are available yet.' : 'Enroll using a course key.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Create Course Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="portal-panel-strong max-w-md w-full p-8 relative animate-fade-in">
                        <button onClick={resetModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-black/5">
                            <X className="w-5 h-5" />
                        </button>

                        {successKey ? (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'color-mix(in srgb, var(--color-success) 14%, transparent)' }}>
                                    <CheckCircle className="w-8 h-8" style={{ color: 'var(--color-success)' }} />
                                </div>
                                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Course Created!</h2>
                                <p className="mb-6" style={{ color: 'var(--color-textSecondary)' }}>Share this key with your students:</p>
                                <div className="portal-empty rounded-2xl p-4 mb-6">
                                    <span className="text-3xl font-mono font-bold tracking-widest text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }}>{successKey}</span>
                                </div>
                                <button onClick={resetModal} className="portal-button portal-button-primary w-full">
                                    Done
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="portal-chip mb-3">New course</span>
                                <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>Create New Course</h2>
                                <form onSubmit={handleCreateCourse} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textSecondary)' }}>Course Name</label>
                                        <input type="text" required value={courseName} onChange={e => setCourseName(e.target.value)}
                                            className="portal-input text-sm"
                                            placeholder="e.g. Introduction to Programming" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textSecondary)' }}>Course Code</label>
                                            <input type="text" required value={courseCode} onChange={e => setCourseCode(e.target.value)}
                                                className="portal-input text-sm"
                                                placeholder="e.g. CS101" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textSecondary)' }}>Section</label>
                                            <input type="text" required value={courseSection} onChange={e => setCourseSection(e.target.value)}
                                                className="portal-input text-sm"
                                                placeholder="e.g. A" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-textSecondary)' }}>Term</label>
                                        <select value={courseTerm} onChange={e => setCourseTerm(e.target.value)}
                                            className="portal-input text-sm">
                                            <option>First Semester</option>
                                            <option>Second Semester</option>
                                            <option>Summer</option>
                                        </select>
                                    </div>
                                    <button type="submit" disabled={submitting}
                                        className="portal-button portal-button-primary w-full mt-4 disabled:opacity-50">
                                        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Course'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
                    }`}>
                    {toast.message}
                </div>
            )}
        </AppLayout>
    );
}
