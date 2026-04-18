"use client"

import { Cloud, GraduationCap, ArrowRight, Sparkles, BookOpen, LayoutDashboard, AlertTriangle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { apiClient, API_URL } from "@/lib/api/client"

function RootPortalContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [backendError, setBackendError] = useState<string | null>(null)

  // Detect ?error= param from backend OAuth callback failure
  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      setBackendError(err)
      setIsLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token")
      let storedUser = localStorage.getItem("user")
      
      if (!token) {
        console.warn("No token found in portal, redirecting to landing")
        router.push("/landing")
        return
      }

      // Ensure both tokens are set if only one was found (unification)
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);

      // If no local user data, or just to verify the session is active
      try {
        const response = await apiClient.get('/auth/me');
        const data = response.data;
        const { organizations, onboarding_data, ...baseUser } = data;
        
        const updatedUser = { ...baseUser, onboarding_data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        localStorage.setItem('organizations', JSON.stringify(organizations || []));
        
        setUser(updatedUser);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to verify session in portal:', err);
        // Fallback to local data if available and not a 401
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsLoading(false);
        } else {
          router.push("/landing");
        }
      }
    }
    
    checkAuth()
  }, [router])

  const modules = [
    {
      id: "skyflow",
      title: "Project Management",
      subtitle: "SkyFlow",
      description: "Manage projects, tasks, and team collaboration with AI-powered insights.",
      icon: Cloud,
      color: "from-blue-500 to-cyan-500",
      href: "/dashboard",
      action: "Open Workspace"
    },
    {
      id: "scholar",
      title: "Academic Portal",
      subtitle: "ScholarSync",
      description: "Sync courses, manage academic teams, and handle consultation bookings.",
      icon: GraduationCap,
      color: "from-indigo-600 to-purple-600",
      href: "/scholar/dashboard",
      action: "Open Academy"
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  // Backend OAuth callback error — show it instead of silently going to /landing
  if (backendError) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 font-mono flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Backend Auth Error</h1>
              <p className="text-xs text-gray-400">The backend OAuth callback failed and redirected here</p>
            </div>
          </div>
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 mb-4">
            <p className="text-xs text-gray-400">Error param:</p>
            <p className="text-red-300 font-bold mt-1">{backendError}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-gray-400 mb-4">
            <p className="mb-2">This means the backend's <code className="text-yellow-300">/api/auth/google/callback</code> handler threw an exception.</p>
            <p>Check the backend Render logs for the full error. Common causes:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
              <li>Database connection failure</li>
              <li>Google OAuth code already used (replay)</li>
              <li>Missing env var (JWT_SECRET, DATABASE_URL)</li>
              <li>GOOGLE_REDIRECT_URI mismatch</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <a href="/debug" className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white transition-colors">
              → Open Debug Panel
            </a>
            <a href="/login" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors">
              Back to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl animate-bounce-slow"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ScholarFlow
            </h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-gray-600 text-lg">Select a module to continue your work</p>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => router.push(module.href)}
              className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/40 shadow-xl hover:shadow-2xl transition-all duration-500 text-left overflow-hidden transform hover:-translate-y-2"
            >
              {/* Card Background Gradient Pattern */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${module.color} opacity-5 rounded-bl-full transition-all duration-500 group-hover:w-40 group-hover:h-40`} />

              <div className="relative z-10">
                <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${module.color} rounded-2xl mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-500`}>
                  <module.icon className="w-8 h-8 text-white" />
                </div>

                <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 block">Module</span>
                  <h3 className="text-2xl font-bold text-gray-800 mb-1">{module.title}</h3>
                  <p className={`text-sm font-semibold bg-gradient-to-r ${module.color} bg-clip-text text-transparent`}>{module.subtitle}</p>
                </div>

                <p className="text-gray-600 mb-8 leading-relaxed">
                  {module.description}
                </p>

                <div className="flex items-center gap-2 text-gray-800 font-bold group-hover:translate-x-2 transition-transform duration-300">
                  {module.action} <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Hover highlight border */}
              <div className={`absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r ${module.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />
            </button>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-gray-500 font-medium">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Unified Authentication
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Shared Database
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            AI-Enhanced Workflow
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RootPortal() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    }>
      <RootPortalContent />
    </Suspense>
  )
}

