'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
    Cloud, 
    LogOut, 
    Menu, 
    X, 
    Calendar, 
    BarChart3, 
    Users, 
    FolderKanban, 
    ChevronDown, 
    Shield,
    Home,
    LayoutDashboard,
    RefreshCw,
    Bug,
    ClipboardList,
    AlertTriangle,
    Sparkles
} from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import ThemeToggle from './shared/ThemeToggle';
import { useTheme } from '@/contexts/scholar/ThemeContext';
import apiClient from '@/lib/api/client';
import BugReportModal from '@/components/reports/BugReportModal';
import InteractiveGuide, { RateUsButton } from '@/components/onboarding/InteractiveGuide';
import AnnouncementBanner from '@/components/announcements/AnnouncementBanner';

const normalizeScholarRole = (value: unknown): string => {
    const role = String(value || '').trim()
    const lowerRole = role.toLowerCase()

    if (lowerRole === 'admin') return 'Admin'
    if (lowerRole === 'adviser' || lowerRole === 'advisers' || lowerRole === 'manager') return 'Adviser'
    if (lowerRole === 'student') return 'Student'
    if (lowerRole === 'member') return 'member'

    return role
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
    // Sidebar is permanently expanded for simplicity — collapsing removed
    const [isSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRole, setUserRole] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [hasHydrated, setHasHydrated] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { toggleMode, setRole, mode } = useTheme();
    const [showBugReport, setShowBugReport] = useState(false);

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (token) {
            try {
                const decoded: any = jwtDecode(token);

                // Use cached ScholarSync profile FIRST to prevent role flicker
                const cachedProfile = localStorage.getItem('scholar_profile');
                if (cachedProfile) {
                    try {
                        const cached = JSON.parse(cachedProfile);
                    const cachedRole = normalizeScholarRole(cached.scholarsyncRole || cached.role || '');
                        setUserRole(cachedRole);
                        setIsAdmin(cachedRole === 'Admin');
                        setUserEmail(String(cached.email || decoded.email || ''));
                        setUserName(String(cached.name || decoded.name || ''));
                        if (cachedRole === 'Admin') setRole('admin');
                        else if (cachedRole === 'Adviser' || cachedRole === 'Advisers') setRole('manager');
                        else setRole('member');
                    } catch { /* ignore parse errors, will refresh below */ }
                } else {
                    // No cache yet — use JWT as temporary fallback
                    setUserEmail(decoded.email || '');
                    setUserName(decoded.name || '');
                    const decodedRole = normalizeScholarRole(decoded.role || '');
                    setUserRole(decodedRole);
                    setIsAdmin(decodedRole === 'Admin');
                    if (decodedRole === 'Admin') setRole('admin');
                    else if (decodedRole === 'Adviser') setRole('manager');
                    else setRole('member');
                }

                // Refresh profile from ScholarSync /me endpoint and cache it
                        apiClient.get('/auth/me')
                    .then((res) => {
                        const profile = res.data;
                        if (!profile) return;
                        
                        // Cache the ScholarSync profile to prevent flicker on next navigation
                        localStorage.setItem('scholar_profile', JSON.stringify(profile));
                        
                            const refreshedRole = normalizeScholarRole(profile.scholarsyncRole || profile.role || decoded.role || '');
                        
                        setUserRole(refreshedRole);
                        setIsAdmin(refreshedRole === 'Admin');
                        setUserEmail(String(profile.email || decoded.email || ''));
                        setUserName(String(profile.name || decoded.name || ''));

                        if (refreshedRole === 'Admin') setRole('admin');
                        else if (refreshedRole === 'Adviser' || refreshedRole === 'Advisers') setRole('manager');
                        else setRole('member');
                    })
                    .catch(() => {
                        // keep cached/decoded token fallback
                    });
            } catch (e) {
                console.error('Failed to decode token:', e);
            }
        }
    }, [setRole]);

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('scholar_profile');
        router.push('/login');
    };

    const displayRole = useMemo(() => {
        if (!hasHydrated) return '';
        return userRole || (isAdmin ? 'Admin' : 'Student');
    }, [hasHydrated, userRole, isAdmin]);

    const normalizedRole = String(userRole || '').toLowerCase();
    const isAdviser = normalizedRole === 'adviser' || normalizedRole === 'advisers' || normalizedRole === 'manager';
    const isStudent = normalizedRole === 'student' || normalizedRole === 'member';

    const portalItem = { href: '/', label: 'Academic Home', icon: Home };

    const dashboardItems = [
        { href: '/scholar/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ];

    const courseItems = [
        { href: '/scholar/courses', label: 'Courses', icon: FolderKanban },
    ];

    const scheduleItems = [
        ...(normalizedRole === 'admin' || isAdviser ? [{ href: '/scholar/schedule', label: 'My Schedule', icon: Calendar }] : []),
        ...(isStudent ? [{ href: '/scholar/booking', label: 'Consultation Schedule', icon: Calendar }] : []),
    ];

    const googleItems = [
        { href: '/scholar/calendar', label: 'Calendar', icon: Calendar },
        ...(userRole === 'Admin' ? [{ href: '/scholar/workspace-sync', label: 'Workspace Sync', icon: RefreshCw }] : []),
    ];

    const adminPanelItems = [
        { href: '/scholar/admin/accounts', label: 'Accounts', icon: Shield },
        { href: '/scholar/admin/data-integrity', label: 'Data Integrity', icon: AlertTriangle },
        { href: '/scholar/admin/adviser-availability', label: 'Adviser Availability', icon: Users },
        { href: '/scholar/admin/semester-readiness', label: 'Semester Readiness', icon: ClipboardList },
    ];

    const academicItems = [
        ...dashboardItems,
        ...courseItems,
        ...scheduleItems,
    ];

    const navSections = [
        { title: 'Academic', items: academicItems },
        { title: 'Google Workspace', items: googleItems },
        ...(isAdmin ? [{ title: 'Admin', items: adminPanelItems }] : []),
    ].filter((section) => section.items.length > 0);

    const isActive = (path: string) => pathname === path;
    const compactIconColor = mode === 'dark' ? '#ffffff' : 'var(--color-primary)';
    const compactIconBackground = mode === 'dark'
        ? 'rgba(255, 255, 255, 0.10)'
        : 'color-mix(in srgb, var(--color-primary) 18%, white)';

    // Sidebar scroll preservation
    const navScrollRef = useRef<HTMLDivElement | null>(null);
    const latestScrollRef = useRef<number>(0);
    const mainRef = useRef<HTMLElement | null>(null);

    const saveSidebarScroll = () => {
        if (navScrollRef.current) latestScrollRef.current = navScrollRef.current.scrollTop;
    };

    // keep latest scroll updated as the user scrolls the sidebar
    const handleNavScroll = () => {
        if (navScrollRef.current) latestScrollRef.current = navScrollRef.current.scrollTop;
    };

    useEffect(() => {
        // restore scroll position after navigation and prevent focus-driven jump
        const restore = () => {
            if (navScrollRef.current) {
                const el = navScrollRef.current;
                const max = el.scrollHeight - el.clientHeight;
                el.scrollTop = Math.min(latestScrollRef.current, Math.max(0, max));
            }

            // move focus to main content without scrolling the page
            try {
                if (mainRef.current) mainRef.current.focus({ preventScroll: true } as any);
            } catch (e) {
                // some browsers may not support the option; ignore
            }
        };

        // run on next animation frame to ensure layout settled
        const id = window.requestAnimationFrame(() => setTimeout(restore, 8));
        return () => window.cancelAnimationFrame(id);
    }, [pathname]);

    const NavLink = ({ href, label, icon: Icon, compact = false }: { href: string; label: string; icon: any; compact?: boolean }) => {
        const active = isActive(href);

        return (
            <Link
                href={href}
                className={`scholar-nav-item flex items-center ${compact ? 'gap-2 px-2 py-2' : 'gap-3 px-3 py-3'} ${active ? 'scholar-nav-item-active' : ''}`}
                title={label}
                onClick={() => saveSidebarScroll()}
            >
                <span
                    className={`scholar-nav-icon flex items-center justify-center rounded-xl transition-colors ${compact ? 'h-8 w-8' : 'h-9 w-9'} ${active ? 'bg-white/16' : ''}`}
                    style={{
                        color: compactIconColor,
                        backgroundColor: active ? (mode === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'color-mix(in srgb, var(--color-primary) 24%, white)') : compactIconBackground,
                    }}
                >
                    <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 stroke-[2.5]`} style={{ color: compactIconColor }} />
                </span>
                <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold leading-none`}>{label}</span>
            </Link>
        );
    };

    const RolePill = ({ compact = false }: { compact?: boolean }) => (
        <div className={`portal-chip ${compact ? 'w-full justify-center' : ''}`}>
            <Shield className="w-3.5 h-3.5" />
            {!compact && <span>{displayRole || 'Student'}</span>}
        </div>
    );

    return (
        <div className="min-h-screen relative overflow-hidden font-sans transition-colors duration-300" style={{ backgroundColor: 'var(--color-background)' }}>
            <AnnouncementBanner />
            {/* Animated Background Elements (SkyFlow Style) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-12 left-8 w-80 h-80 rounded-full blur-3xl animate-float-slow" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 70%)', opacity: 0.52 }} />
                <div className="absolute top-28 right-4 w-[30rem] h-[30rem] rounded-full blur-3xl animate-bounce-slow" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 16%, transparent), transparent 72%)', opacity: 0.4 }} />
                <div className="absolute bottom-0 left-1/3 w-[34rem] h-[34rem] rounded-full blur-3xl animate-wave" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 72%)', opacity: 0.3 }} />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-20 border-b backdrop-blur-2xl transition-colors duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)', borderBottomColor: 'color-mix(in srgb, var(--color-border) 92%, white)' }}>
                <div className="px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Link href="/scholar/dashboard" className="flex items-center gap-3 group">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transform group-hover:scale-105 transition-transform duration-200" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                                        <Cloud className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h1 className="scholar-display text-lg leading-none text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }}>
                                            ScholarSync
                                        </h1>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 justify-end">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex relative z-30">
                {/* Desktop Sidebar */}
                <aside className={`hidden lg:flex lg:flex-col sticky top-[81px] h-[calc(100vh-81px)] backdrop-blur-2xl transition-all duration-300 shadow-xl w-[19rem] overflow-x-hidden scholar-sidebar-compact`} style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)', borderRight: '1px solid color-mix(in srgb, var(--color-border) 92%, white)' }}>
                    <div className="p-4 flex flex-col h-full gap-4 overflow-x-hidden min-w-0">
                        <nav ref={navScrollRef} onScroll={handleNavScroll} className="flex-1 overflow-y-hidden overflow-x-hidden custom-scrollbar min-w-0">
                            <div className="scholar-sidebar-list min-w-0">
                                <div className="scholar-sidebar-group">
                                    <div className="scholar-sidebar-group-heading">
                                        <h3 className="scholar-hero-kicker">Academic Home</h3>
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-textSecondary)' }}>
                                            shortcuts
                                        </span>
                                    </div>
                                    <NavLink {...portalItem} compact />
                                </div>

                                {navSections.map((section) => (
                                    <div key={section.title} className="scholar-sidebar-group scholar-sidebar-group-divider">
                                        <div className="scholar-sidebar-group-heading">
                                            <h3 className="scholar-hero-kicker">{section.title}</h3>
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-textSecondary)' }}>
                                                {section.items.length} links
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                            {section.items.map((item) => (
                                                <NavLink key={item.href} {...item} compact />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </nav>

                        <div className="portal-panel p-4 min-w-0 overflow-x-hidden">
                            <p className="scholar-metric-label">Signed in as</p>
                            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>{userName || userEmail.split('@')[0] || 'User'}</p>
                            <p className="mt-1 text-xs" style={{ color: 'var(--color-textSecondary)' }}>{displayRole || 'Student'}</p>
                            <div className="mt-3">
                                <button onClick={handleLogout} className="portal-button portal-button-primary w-full">
                                    <LogOut className="w-4 h-4" />
                                    Sign out
                                </button>
                            </div>
                        </div>

                    </div>
                </aside>

                {/* Mobile Sidebar Overlay */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/22 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-[19rem] backdrop-blur-2xl shadow-2xl p-5 flex flex-col animate-in slide-in-from-left duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 96%, transparent)' }}>
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                                        <Cloud className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="scholar-hero-kicker">Academic Portal</p>
                                        <span className="block mt-2 text-2xl font-bold text-transparent bg-clip-text scholar-display" style={{ backgroundImage: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }}>
                                            ScholarSync
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="portal-button portal-button-secondary px-3 py-2">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="portal-panel p-4 mb-4">
                                <p className="scholar-metric-label">Signed in as</p>
                                <p className="mt-2 text-base font-bold" style={{ color: 'var(--color-text)' }}>{userName || userEmail.split('@')[0] || 'User'}</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--color-textSecondary)' }}>{displayRole || 'Student'}</p>
                            </div>

                            <nav className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                <div className="portal-panel p-3">
                                    <NavLink {...portalItem} />
                                </div>

                                {navSections.map((section, sectionIndex) => (
                                    <div key={`mobile-section-${sectionIndex}`} className="portal-panel p-3">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="scholar-hero-kicker">{section.title}</h3>
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-textSecondary)' }}>{section.items.length} links</span>
                                        </div>
                                        <div className="space-y-2">
                                            {section.items.map((item) => (
                                                <NavLink key={item.href} {...item} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                
                                {isAdmin && (
                                    <div className="portal-panel p-3">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="scholar-hero-kicker">Admin</h3>
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-textSecondary)' }}>controls</span>
                                        </div>
                                        <div className="space-y-2">
                                            {adminPanelItems.map((item) => (
                                                <NavLink key={item.href} {...item} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </nav>

                            <div className="mt-4 portal-panel p-4">
                                <button onClick={handleLogout} className="portal-button portal-button-primary w-full">
                                    <LogOut className="w-4 h-4" />
                                    Sign out
                                </button>
                            </div>

                        </aside>
                    </div>
                )}

                {/* Main Content Area */}
                <main ref={mainRef as any} tabIndex={-1} className="flex-1 h-[calc(100vh-81px)] overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>

            {/* Floating Bug Report Button */}
            <button
                onClick={() => setShowBugReport(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center z-50 group"
                title="Report a bug or issue"
            >
                <Bug className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            </button>

            {/* Bug Report Modal */}
            <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />

            {/* Context-Aware Tutorial Guide */}
            <InteractiveGuide />
            <RateUsButton />
        </div>
    );
}
