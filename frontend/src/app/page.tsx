"use client"

import {
  Cloud, GraduationCap, ArrowRight, Sparkles, LayoutDashboard, FolderKanban,
  CheckSquare, Users, BookOpen, Calendar, BarChart3, FolderOpen, FileText,
  Plug, AlertTriangle
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { apiClient } from "@/lib/api/client"
import InteractiveGuide from "@/components/onboarding/InteractiveGuide"

const FEATURE_TILES = [
  { href: "/dashboard",        icon: LayoutDashboard, label: "Dashboard",   desc: "Project overview" },
  { href: "/boards",           icon: FolderKanban,    label: "Boards",      desc: "Kanban boards" },
  { href: "/tasks",            icon: CheckSquare,     label: "Tasks",       desc: "Task management" },
  { href: "/team",             icon: Users,           label: "Team",        desc: "Collaboration" },
  { href: "/scholar/courses",  icon: BookOpen,        label: "Courses",     desc: "Academic courses" },
  { href: "/scholar/schedule", icon: Calendar,        label: "Schedule",    desc: "Academic calendar" },
  { href: "/analytics",        icon: BarChart3,       label: "Analytics",   desc: "Data insights" },
  { href: "/reports",          icon: FileText,        label: "Reports",     desc: "Export & reports" },
  { href: "/drive",            icon: FolderOpen,      label: "Drive",       desc: "Google Drive" },
  { href: "/calendar",         icon: Calendar,        label: "Calendar",    desc: "Unified calendar" },
  { href: "/integrations",     icon: Plug,            label: "Integrations",desc: "MS365 & Classroom" },
]

function RootPortalContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [backendError, setBackendError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const err = searchParams?.get('error')
      const detail = searchParams?.get('detail')
      if (err) {
        setBackendError(err + (detail ? ` — ${decodeURIComponent(detail)}` : ''))
        setIsLoading(false)
        return
      }
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token")
      const storedUser = localStorage.getItem("user")

      if (!token) {
        router.push("/login")
        return
      }

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
          router.push("/login")
          return
        }
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [router, searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (backendError) {
    setTimeout(() => { window.location.href = '/login' }, 3000)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Sign In Failed</h2>
          <p className="text-gray-500 text-sm mb-6">Something went wrong during authentication. Please try again.</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium transition-colors">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Background blobs — one unified palette */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-bounce-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-blue-100/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-xl">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ScholarFlow
            </h1>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-gray-500 text-base">Your unified workspace — everything in one place</p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {FEATURE_TILES.map((tile) => (
            <button
              key={tile.href}
              onClick={() => router.push(tile.href)}
              className="group bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white/40 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300">
                <tile.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-gray-800 leading-tight">{tile.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{tile.desc}</p>
            </button>
          ))}
        </div>

        {/* Two destination buttons — same gradient, same style */}
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="group flex items-center justify-between bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">SkyFlow</p>
                <p className="text-xs text-gray-400">Project Management</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-200" />
          </button>

          <button
            onClick={() => router.push('/scholar/dashboard')}
            className="group flex items-center justify-between bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/40 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">ScholarSync</p>
                <p className="text-xs text-gray-400">Academic Portal</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-200" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RootPortal() {
  return (
    <>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }>
        <RootPortalContent />
      </Suspense>
      <InteractiveGuide />
    </>
  )
}
