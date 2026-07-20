"use client"

import {
  GraduationCap, ArrowRight, Sparkles, FolderKanban,
  CheckSquare, Users, BookOpen, Calendar, BarChart3, FileText,
  Plug, AlertTriangle, ChevronLeft, ChevronRight, LayoutDashboard, RefreshCw
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import { apiClient } from "@/lib/api/client"
import InteractiveGuide from "@/components/onboarding/InteractiveGuide"

// ── Feature data ────────────────────────────────────────────────────────────

const FEATURES = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard'      },
  { href: '/boards',                 icon: FolderKanban,    label: 'Boards'         },
  { href: '/tasks',                  icon: CheckSquare,     label: 'Tasks'          },
  { href: '/team',                   icon: Users,           label: 'Team'           },
  { href: '/gantt',                  icon: BarChart3,       label: 'Timeline'       },
  { href: '/reports',                icon: FileText,        label: 'Reports'        },
  { href: '/scholar/courses',        icon: BookOpen,        label: 'Courses'        },
  { href: '/scholar/booking',        icon: Calendar,        label: 'Consultation'   },
  { href: '/integrations',           icon: Plug,            label: 'Integrations'   },
  { href: '/scholar/workspace-sync', icon: RefreshCw,       label: 'Workspace Sync' },
]

// ── FeatureCarousel ──────────────────────────────────────────────────────────

type Feature = { href: string; icon: React.ElementType; label: string }

function FeatureCarousel({
  features,
  onNavigate,
}: {
  features: Feature[]
  onNavigate: (href: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 176 : -176, behavior: 'smooth' })
  }

  return (
    <div className="relative mt-5">
      {/* Left arrow */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-7 h-7 bg-white/25 hover:bg-white/40 rounded-full flex items-center justify-center transition-all shadow-sm"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-6 py-1"
      >
        {features.map((f) => (
          <button
            key={f.href}
            onClick={(e) => { e.stopPropagation(); onNavigate(f.href) }}
            className="snap-start flex-shrink-0 flex flex-col items-center gap-2 w-[72px] sm:w-20 p-3 bg-white/15 hover:bg-white/30 rounded-2xl transition-all duration-200 active:scale-95"
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <f.icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-white text-[10px] sm:text-[11px] font-medium text-center leading-tight">
              {f.label}
            </span>
          </button>
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-7 h-7 bg-white/25 hover:bg-white/40 rounded-full flex items-center justify-center transition-all shadow-sm"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function RootPortalContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const err = searchParams?.get('error')
      const detail = searchParams?.get('detail')
      if (err) {
        setBackendError(err + (detail ? ` — ${decodeURIComponent(detail)}` : ''))
        setIsLoading(false)
        return
      }
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('user')

      if (!token) { router.push('/login'); return }

      localStorage.setItem('token', token)
      localStorage.setItem('auth_token', token)

      try {
        const response = await apiClient.get('/auth/me')
        const { organizations, onboarding_data, ...baseUser } = response.data
        const updatedUser = { ...baseUser, onboarding_data }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        localStorage.setItem('organizations', JSON.stringify(organizations || []))
        setUser(updatedUser)
      } catch {
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        } else {
          router.push('/login'); return
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [router, searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (backendError) {
    setTimeout(() => { window.location.href = '/login' }, 3000)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Sign In Failed</h2>
          <p className="text-gray-500 text-sm mb-6">Something went wrong during authentication.</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 relative overflow-hidden flex flex-col items-center justify-center p-5 sm:p-6">
      {/* Subtle decorative rings */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full border border-blue-200/20 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full border border-indigo-200/15 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl">

        {/* ── Header ── */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ScholarFlow
            </h1>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
            {greeting}, {firstName}
          </h2>
          <p className="text-gray-400 text-sm">Where would you like to go today?</p>
        </div>

        {/* ── Unified workspace ── */}
        <div className="space-y-4 mb-7">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 sm:p-6 shadow-2xl border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-tight">ScholarFlow</p>
                  <p className="text-blue-200 text-xs">Projects, Courses &amp; Collaboration</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all group flex-shrink-0"
              >
                Open Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <FeatureCarousel features={FEATURES} onNavigate={(href) => router.push(href)} />
          </div>
        </div>

      </div>
    </div>
  )
}

export default function RootPortal() {
  return (
    <>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }>
        <RootPortalContent />
      </Suspense>
      <InteractiveGuide />
    </>
  )
}
