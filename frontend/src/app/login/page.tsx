"use client"

import { Cloud, ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

// Cloud SVG component for animated background
const CloudShape = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 200 100" className={className} style={style} fill="currentColor">
    <path d="M166.257,66.823c-0.135-1.96-0.453-3.869-0.969-5.692c1.909-3.743,2.988-7.994,2.988-12.49 c0-15.473-12.527-28.028-28-28.028c-5.48,0-10.601,1.586-14.93,4.314c-4.711-6.252-12.201-10.314-20.641-10.314 c-12.426,0-22.821,8.78-25.346,20.462c-1.749-0.449-3.576-0.691-5.463-0.691c-11.776,0-21.328,9.552-21.328,21.328 c0,0.233,0.008,0.464,0.016,0.695c-7.352,2.574-12.631,9.584-12.631,17.855c0,10.432,8.458,18.89,18.891,18.89h99.084 c13.186,0,23.875-10.689,23.875-23.874C181.802,77.968,175.234,69.432,166.257,66.823z" />
  </svg>
)

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`http://localhost:3001/api/auth/google`)
      const data = await response.json()
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Failed to initiate Google login:', error)
      alert('Failed to connect to authentication server. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Blur elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl animate-bounce-slow"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl animate-wave"></div>

        {/* Floating Cloud Shapes */}
        <CloudShape className="w-48 h-24 text-white/60 animate-cloud-1" style={{ position: 'absolute', top: '8%' }} />
        <CloudShape className="w-64 h-32 text-white/50 animate-cloud-2" style={{ position: 'absolute', top: '18%' }} />
        <CloudShape className="w-40 h-20 text-white/55 animate-cloud-3" style={{ position: 'absolute', top: '5%' }} />
        <CloudShape className="w-56 h-28 text-white/45 animate-cloud-4" style={{ position: 'absolute', top: '28%' }} />
        <CloudShape className="w-44 h-22 text-white/50 animate-cloud-5" style={{ position: 'absolute', top: '12%' }} />
        <CloudShape className="w-52 h-26 text-white/40 animate-cloud-6" style={{ position: 'absolute', top: '35%' }} />
        <CloudShape className="w-36 h-18 text-white/65 animate-cloud-7" style={{ position: 'absolute', top: '22%' }} />
        <CloudShape className="w-48 h-24 text-white/55 animate-cloud-8" style={{ position: 'absolute', top: '6%' }} />
      </div>

      {/* Back Button */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-8 left-8 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors z-20"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back</span>
      </button>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
          <div className="p-10">
            {/* Logo Section */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6 shadow-lg transform transition hover:scale-110 duration-300">
                <Cloud className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3 tracking-tight">
                SkyFlow
              </h1>
              <p className="text-gray-600 font-light">
                Sign in to your workspace
              </p>
            </div>

            {/* Login Button */}
            <div className="space-y-6">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>

              <p className="text-xs text-center text-gray-500 font-light">
                You'll be redirected to Google to sign in securely
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-8 font-light">
          © 2025 SkyFlow. Built for organizational excellence.
        </p>
      </div>
    </div>
  )
}
