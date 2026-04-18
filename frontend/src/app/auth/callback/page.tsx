"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Cloud, CheckCircle2, XCircle } from "lucide-react"

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    const run = async () => {
      const token = searchParams.get("token")

      if (!token) {
        router.push("/login")
        return
      }

      // Store token
      localStorage.setItem("token", token)
      localStorage.setItem("auth_token", token)

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        const { organizations, onboarding_data, ...userData } = data

        localStorage.setItem('user', JSON.stringify({ ...userData, onboarding_data }))
        localStorage.setItem('organizations', JSON.stringify(organizations || []))
        localStorage.setItem('ss_user', JSON.stringify(data))
        if (onboarding_data) {
          localStorage.setItem('onboardingPreferences', JSON.stringify(onboarding_data))
        }

        setStatus('success')
        setTimeout(() => router.push("/"), 1000)
      } catch (err: any) {
        setStatus('error')
        setErrorMsg(err?.message || 'Unknown error')
        // Clear any bad tokens
        localStorage.removeItem('token')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        localStorage.removeItem('organizations')
        localStorage.removeItem('ss_user')
        setTimeout(() => router.push("/login"), 2500)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-700/80 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl">
            {status === 'success' ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            ) : status === 'error' ? (
              <XCircle className="w-12 h-12 text-red-400" />
            ) : (
              <Cloud className="w-12 h-12 text-white animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {status === 'success' ? 'All Set!' : status === 'error' ? 'Sign In Failed' : 'Signing You In'}
          </h2>
          <p className="text-gray-500 text-sm">
            {status === 'success'
              ? 'Taking you to your portal...'
              : status === 'error'
              ? `${errorMsg} — redirecting to login...`
              : 'Setting up your account...'}
          </p>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
