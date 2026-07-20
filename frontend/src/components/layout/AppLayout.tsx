"use client"

import { useState, useEffect, useRef } from "react"
import { Cloud, LogOut, Menu, X, Calendar, FileText, FolderOpen, BarChart3, Users, FolderKanban, CheckSquare, Building2, ChevronDown, Plus, UserPlus, Settings, LayoutDashboard, RefreshCw, Bug, Plug, CreditCard, GraduationCap, BookOpen, ClipboardList, Shield, AlertTriangle, Layers } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "@/contexts/ThemeContext"
import NotificationBell from "@/components/notifications/NotificationBell"
import BugReportModal from "@/components/reports/BugReportModal"
import ThemeToggle from "@/components/shared/ThemeToggle"
import InteractiveGuide, { RateUsButton } from "@/components/onboarding/InteractiveGuide"
import AnnouncementBanner from "@/components/announcements/AnnouncementBanner"

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member' | 'adviser'
}

interface AppLayoutProps {
  user?: any
  organizations?: Organization[]
  selectedOrg?: Organization | null
  onOrgChange?: (org: Organization) => void
  children: React.ReactNode
}

export default function AppLayout({ user, organizations = [], selectedOrg = null, onOrgChange = () => {}, children }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setRole } = useTheme()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false)
  const [showBugReport, setShowBugReport] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const onScholarPath = pathname?.startsWith('/scholar') ?? false
  const isAdviser = selectedOrg?.role === 'adviser'
  // ScholarFlow is ONE unified platform — the sidebar is organized by what a feature
  // *does* (Projects & Tasks / Academics / Tools & Integrations / Administration),
  // not by which legacy subsystem ("SkyFlow" vs. "ScholarSync") it originated from.
  // Advisers work primarily in the Academics area, so default their sidebar to that expanded.
  const [projectsOpen, setProjectsOpen] = useState(!onScholarPath && !isAdviser)
  const [academicsOpen, setAcademicsOpen] = useState(onScholarPath || isAdviser)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [adminOpen, setAdminOpen] = useState(false)
  const [scholarRole, setScholarRole] = useState('')

  // Update theme role when organization changes
  useEffect(() => {
    if (selectedOrg) {
      setRole(selectedOrg.role)
    }
  }, [selectedOrg, setRole])

  // Read ScholarSync role from cached profile
  useEffect(() => {
    const profile = localStorage.getItem('scholar_profile')
    if (profile) {
      try {
        const p = JSON.parse(profile)
        setScholarRole(p.scholarsyncRole || p.role || '')
      } catch {}
    }
  }, [])


  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOrgDropdownOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false)
      }
    }

    // Use 'click' instead of 'mousedown' to avoid interfering with button onClick
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOrgDropdownOpen])

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("organizations")
    localStorage.removeItem("selectedOrganization")

    // Redirect to login page
    router.push("/login")
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
      manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
      member: { label: 'Member', color: 'bg-green-100 text-green-700' },
      adviser: { label: 'Adviser', color: 'bg-purple-100 text-purple-700' }
    }
    return badges[role as keyof typeof badges] || badges.member
  }

  // Unified role label — combines the organization (project-management) role with
  // the academic role so a user's full identity within ScholarFlow as a single
  // platform (e.g. "Member & Student") is visible in one place.
  const combinedRoleLabel = (orgRole: string) => {
    const base = getRoleBadge(orgRole).label
    return scholarRole ? `${base} & ${scholarRole}` : base
  }

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500 bg-white/50 dark:bg-slate-950/20">
      <AnnouncementBanner />
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animate-float-slow opacity-20" style={{ backgroundColor: 'var(--color-primary)' }}></div>
        <div className="absolute top-40 right-20 w-96 h-96 rounded-full blur-3xl animate-bounce-slow opacity-20" style={{ backgroundColor: 'var(--color-secondary)' }}></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full blur-3xl animate-wave opacity-10" style={{ backgroundColor: 'var(--color-accent)' }}></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 shadow-lg backdrop-blur-xl transition-colors duration-300" style={{ 
        backgroundColor: 'var(--color-surface)', 
        borderBottom: `1px solid var(--color-border)` 
      }}>
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300"
                style={{
                  background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`
                }}
              >
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))`
                    }}
                  >ScholarFlow</h1>
                  <span className="text-xs font-bold" style={{ color: 'var(--color-textSecondary)' }}>v2</span>
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-textSecondary)' }}>Unified Platform</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {organizations.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-slate-800/70 rounded-xl border border-white/40 dark:border-slate-700 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {selectedOrg?.name || 'Select Team'}
                    </span>
                    {selectedOrg && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadge(selectedOrg.role).color}`}>
                        {combinedRoleLabel(selectedOrg.role)}
                      </span>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>

                  {isOrgDropdownOpen && (
                    <div className="absolute top-full mt-2 right-0 w-64 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 dark:border-slate-700 py-2 z-[9999]">
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Your Teams</p>
                      </div>
                      {organizations
                        .filter(org => org.id !== selectedOrg?.id)
                        .map((org) => (
                        <button
                          key={org.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            localStorage.setItem('selectedOrganization', JSON.stringify(org))
                            onOrgChange(org)
                            setIsOrgDropdownOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded-lg mx-1"
                        >
                          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{org.name}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadge(org.role).color}`}>
                            {combinedRoleLabel(org.role)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notification Bell */}
              <NotificationBell />

              {/* Theme Toggle */}
              <ThemeToggle />
            </div>


          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          <nav className="fixed top-0 left-0 bottom-0 w-72 shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out p-6" style={{ backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg dark:text-white">ScholarFlow <span className="text-xs font-semibold opacity-60">v2</span></span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-6 h-6 dark:text-gray-400" />
              </button>
            </div>

            {/* Organizations in Mobile Menu */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">Your Teams</p>
              <div className="space-y-1">
                {organizations
                  .filter(org => org.id !== selectedOrg?.id)
                  .map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      localStorage.setItem('selectedOrganization', JSON.stringify(org))
                      onOrgChange(org)
                      setIsMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm font-medium flex-1 text-left">{org.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getRoleBadge(org.role).color}`}>
                      {combinedRoleLabel(org.role)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation links */}
            <div className="space-y-1">
              <a href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </a>
              {/* Mobile Projects & Tasks group */}
              <button onClick={() => setProjectsOpen(o => !o)} className="w-full flex items-center justify-between px-2 py-2 mt-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                <span className="flex items-center gap-1.5"><FolderKanban className="w-3.5 h-3.5"/>Projects & Tasks</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${projectsOpen ? 'rotate-180' : ''}`} />
              </button>
              {projectsOpen && (
                <>
                  <a href="/boards" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <FolderKanban className="w-4 h-4" /><span className="text-sm font-medium">Boards</span>
                  </a>
                  <a href="/tasks" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <CheckSquare className="w-4 h-4" /><span className="text-sm font-medium">Tasks</span>
                  </a>
                  <a href="/projects" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <Layers className="w-4 h-4" /><span className="text-sm font-medium">Projects</span>
                  </a>
                  <a href="/team" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <Users className="w-4 h-4" /><span className="text-sm font-medium">Team</span>
                  </a>
                  <a href="/gantt" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <BarChart3 className="w-4 h-4" /><span className="text-sm font-medium">Timeline</span>
                  </a>
                  <a href="/reports" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <FileText className="w-4 h-4" /><span className="text-sm font-medium">Reports</span>
                  </a>
                </>
              )}

              {/* Mobile Academics group */}
              <button onClick={() => setAcademicsOpen(o => !o)} className="w-full flex items-center justify-between px-2 py-2 mt-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5"/>Academics</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${academicsOpen ? 'rotate-180' : ''}`} />
              </button>
              {academicsOpen && (
                <>
                  <a href="/scholar/courses" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <BookOpen className="w-4 h-4" /><span className="text-sm font-medium">Courses</span>
                  </a>
                  {scholarRole === 'Student' ? (
                    <a href="/scholar/booking" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                      <Calendar className="w-4 h-4" /><span className="text-sm font-medium">Consultation</span>
                    </a>
                  ) : (
                    <a href="/scholar/schedule" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                      <Calendar className="w-4 h-4" /><span className="text-sm font-medium">Schedule</span>
                    </a>
                  )}
                  {scholarRole !== 'Student' && (
                    <a href="/scholar/adviser/consultation-hub" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                      <ClipboardList className="w-4 h-4" /><span className="text-sm font-medium">Consultation Hub</span>
                    </a>
                  )}
                </>
              )}

              {/* Mobile Tools & Integrations group */}
              <button onClick={() => setToolsOpen(o => !o)} className="w-full flex items-center justify-between px-2 py-2 mt-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                <span className="flex items-center gap-1.5"><Plug className="w-3.5 h-3.5"/>Tools & Integrations</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {toolsOpen && (
                <>
                  <a href="/integrations" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <Plug className="w-4 h-4" /><span className="text-sm font-medium">Integrations</span>
                  </a>
                  <a href="/scholar/workspace-sync" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <RefreshCw className="w-4 h-4" /><span className="text-sm font-medium">Workspace Sync</span>
                  </a>
                  <a href="/calendar" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <Calendar className="w-4 h-4" /><span className="text-sm font-medium">Calendar</span>
                  </a>
                  <a href="/drive" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                    <FolderOpen className="w-4 h-4" /><span className="text-sm font-medium">Drive</span>
                  </a>
                  {selectedOrg?.role !== 'member' && (
                    <>
                      <a href="/sheets" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                        <FileText className="w-4 h-4" /><span className="text-sm font-medium">Sheets</span>
                      </a>
                      <a href="/analytics" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                        <BarChart3 className="w-4 h-4" /><span className="text-sm font-medium">Analytics</span>
                      </a>
                    </>
                  )}
                </>
              )}

              {/* Mobile Administration group — every admin tool unified in one place */}
              {(scholarRole === 'Admin' || selectedOrg?.role !== 'member') && (
                <>
                  <button onClick={() => setAdminOpen(o => !o)} className="w-full flex items-center justify-between px-2 py-2 mt-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                    <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5"/>Administration</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {adminOpen && (
                    <>
                      {scholarRole === 'Admin' && (
                        <>
                          <a href="/scholar/admin/accounts" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                            <Shield className="w-4 h-4" /><span className="text-sm font-medium">Accounts</span>
                          </a>
                          <a href="/scholar/admin/data-integrity" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                            <AlertTriangle className="w-4 h-4" /><span className="text-sm font-medium">Data Integrity</span>
                          </a>
                          <a href="/scholar/admin/adviser-availability" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                            <Users className="w-4 h-4" /><span className="text-sm font-medium">Adviser Availability</span>
                          </a>
                          <a href="/scholar/admin/semester-readiness" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                            <ClipboardList className="w-4 h-4" /><span className="text-sm font-medium">Semester Readiness</span>
                          </a>
                        </>
                      )}
                      {selectedOrg?.role !== 'member' && (
                        <a href="/billing" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all ml-2">
                          <CreditCard className="w-4 h-4" /><span className="text-sm font-medium">Billing</span>
                        </a>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="h-px bg-gray-100 dark:bg-slate-800 my-4" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Layout with Sidebar */}
      <div className="flex relative z-10">
        {/* Sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-64 backdrop-blur-xl min-h-[calc(100vh-73px)] sticky top-[73px] shadow-lg transition-colors duration-300" style={{
          backgroundColor: 'var(--color-surface)',
          borderRight: `1px solid var(--color-border)`
        }}>
          <div className="p-6 flex flex-col h-full">
            {/* Navigation Section */}
            <nav className="mb-6 space-y-2">
              <a href="/dashboard" className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundImage = 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundImage = 'none';
                }}
              >
                <LayoutDashboard className="w-5 h-5 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                <span>Dashboard</span>
              </a>
            </nav>

            {/* ── Projects & Tasks — unified project-management workspace ── */}
            <div className="pt-4" style={{ borderTop: `1px solid var(--color-border)` }}>
              <button
                onClick={() => setProjectsOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/30 transition-all duration-200 group"
                style={{ color: 'var(--color-textSecondary)' }}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                  <FolderKanban className="w-3.5 h-3.5" /> Projects & Tasks
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${projectsOpen ? 'rotate-180' : ''}`} />
              </button>
              {projectsOpen && (
                <nav className="space-y-1 mt-1 ml-1">
                  <a href="/boards" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <FolderKanban className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Boards</span>
                  </a>
                  <a href="/tasks" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <CheckSquare className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Tasks</span>
                  </a>
                  <a href="/projects" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <Layers className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Projects</span>
                  </a>
                  <a href="/team" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <Users className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Team</span>
                  </a>
                  <a href="/gantt" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <BarChart3 className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Timeline</span>
                  </a>
                  <a href="/reports" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <FileText className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Reports</span>
                  </a>
                </nav>
              )}
            </div>

            {/* ── Academics — courses, advising & consultations ── */}
            <div className="mt-3 pt-4" style={{ borderTop: `1px solid var(--color-border)` }}>
              <button
                onClick={() => setAcademicsOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/30 transition-all duration-200"
                style={{ color: 'var(--color-textSecondary)' }}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                  <GraduationCap className="w-3.5 h-3.5" /> Academics
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${academicsOpen ? 'rotate-180' : ''}`} />
              </button>
              {academicsOpen && (
                <nav className="space-y-1 mt-1 ml-1">
                  <a href="/scholar/courses" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <BookOpen className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Courses</span>
                  </a>
                  {scholarRole === 'Student' ? (
                    <a href="/scholar/booking" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                      <Calendar className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                      <span>Consultation</span>
                    </a>
                  ) : (
                    <a href="/scholar/schedule" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                      <Calendar className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                      <span>Schedule</span>
                    </a>
                  )}
                  {scholarRole !== 'Student' && (
                    <a href="/scholar/adviser/consultation-hub" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                      <ClipboardList className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                      <span>Consultation Hub</span>
                    </a>
                  )}
                </nav>
              )}
            </div>

            {/* ── Tools & Integrations — sync, scheduling & Google Workspace utilities ── */}
            <div className="mt-3 pt-4" style={{ borderTop: `1px solid var(--color-border)` }}>
              <button
                onClick={() => setToolsOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/30 transition-all duration-200"
                style={{ color: 'var(--color-textSecondary)' }}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                  <Plug className="w-3.5 h-3.5" /> Tools & Integrations
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {toolsOpen && (
                <nav className="space-y-1 mt-1 ml-1">
                  <a href="/integrations" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <Plug className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Integrations</span>
                  </a>
                  <a href="/scholar/workspace-sync" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <RefreshCw className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Workspace Sync</span>
                  </a>
                  <a href="/calendar" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <Calendar className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Calendar</span>
                  </a>
                  <a href="/drive" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <FolderOpen className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Drive</span>
                  </a>
                  {selectedOrg?.role !== 'member' && (
                    <>
                      <a href="/sheets" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                        <FileText className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                        <span>Sheets</span>
                      </a>
                      <a href="/analytics" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                        <BarChart3 className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                        <span>Analytics</span>
                      </a>
                    </>
                  )}
                </nav>
              )}
            </div>

            {/* ── Administration — every admin-facing tool lives in one place ── */}
            {(scholarRole === 'Admin' || selectedOrg?.role !== 'member') && (
              <div className="mt-3 pt-4" style={{ borderTop: `1px solid var(--color-border)` }}>
                <button
                  onClick={() => setAdminOpen(o => !o)}
                  className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/30 transition-all duration-200"
                  style={{ color: 'var(--color-textSecondary)' }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5" /> Administration
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${adminOpen ? 'rotate-180' : ''}`} />
                </button>
                {adminOpen && (
                  <nav className="space-y-1 mt-1 ml-1">
                    {scholarRole === 'Admin' && (
                      <>
                        <a href="/scholar/admin/accounts" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                          <Shield className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                          <span>Accounts</span>
                        </a>
                        <a href="/scholar/admin/data-integrity" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                          <AlertTriangle className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                          <span>Data Integrity</span>
                        </a>
                        <a href="/scholar/admin/adviser-availability" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                          <Users className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                          <span>Adviser Availability</span>
                        </a>
                        <a href="/scholar/admin/semester-readiness" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                          <ClipboardList className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                          <span>Semester Readiness</span>
                        </a>
                      </>
                    )}
                    {selectedOrg?.role !== 'member' && (
                      <a href="/billing" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                        <CreditCard className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                        <span>Billing</span>
                      </a>
                    )}
                  </nav>
                )}
              </div>
            )}

            {/* Logout button */}
            <div className="pt-3 mt-3" style={{ borderTop: `1px solid var(--color-border)` }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-red-50/60 transition-all duration-200"
                style={{ color: '#ef4444' }}
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </button>
            </div>

            {/* Settings + Creator Notes */}
            {selectedOrg?.role !== 'member' && (
              <div className="mt-3 pt-4" style={{ borderTop: `1px solid var(--color-border)` }}>
                <nav className="space-y-1">
                  <a href="/settings" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-gray-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md" style={{ color: 'var(--color-text)' }}>
                    <Settings className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: 'var(--color-text)' }} />
                    <span>Settings</span>
                  </a>
                  {user?.email === 'waynepabillon667@gmail.com' && (
                    <a href="/creator-notes" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-purple-700 rounded-xl hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-md bg-purple-50">
                      <Bug className="w-4 h-4 group-hover:text-white transition-colors" />
                      <span>Creator Notes</span>
                    </a>
                  )}
                </nav>
              </div>
            )}

            {/* User Info Footer */}
            <div className="mt-auto pt-6" style={{ borderTop: `1px solid var(--color-border)` }}>
              <div className="flex flex-col">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{user?.name || 'Loading...'}</p>
                {selectedOrg && (
                  <span className={`text-xs px-2 py-1 rounded-md inline-block w-fit mt-2 ${getRoleBadge(selectedOrg.role).color}`}>
                    {combinedRoleLabel(selectedOrg.role)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1" style={{ background: 'var(--color-background)', transition: 'background 0.3s ease' }}>
          {children}
        </main>
      </div>

      {/* Floating Bug Report Button */}
      <button
        onClick={() => setShowBugReport(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center z-50 group"
        title="Report a bug or issue"
      >
        <Bug className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>

      {/* RPG-Style Interactive Guide */}
      <InteractiveGuide />
      <RateUsButton />

      {/* Bug Report Modal */}
      <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
    </div>
  )
}
