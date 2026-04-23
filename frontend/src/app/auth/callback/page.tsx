"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Cloud, CheckCircle2 } from "lucide-react"

const normalizeScholarRole = (value: unknown): 'Admin' | 'Adviser' | 'Student' => {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'admin') return 'Admin'
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'Adviser'
  return 'Student'
}

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'authenticating' | 'resolving' | 'success' | 'error'>('authenticating')
  const [message, setMessage] = useState('Verifying your identity...')

  useEffect(() => {
    const token = searchParams.get("token")

    if (token) {
      // Ensure we never keep stale identity data while switching accounts.
      localStorage.removeItem('token')
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      localStorage.removeItem('organizations')
      localStorage.removeItem('scholar_profile')
      localStorage.removeItem('ss_user')

      // 1. Store token for both SkyFlow and ScholarSync
      localStorage.setItem("token", token);
      localStorage.setItem("auth_token", token);
      setStatus('resolving')
      setMessage('Finding your workspace...')

      fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch user data')
          }
          return res.json()
        })
        .then(data => {
          const { organizations, onboarding_data, ...userData } = data
          const normalizedScholarRole = normalizeScholarRole(data?.scholarsyncRole || data?.role)

          // 2. Store user data in formats expected by both modules
          const skyflowUser = { ...userData, onboarding_data };
          const scholarProfile = {
            ...data,
            scholarsyncRole: normalizedScholarRole,
            role: normalizedScholarRole,
          }
          localStorage.setItem('user', JSON.stringify(skyflowUser))
          localStorage.setItem('organizations', JSON.stringify(organizations || []))
          localStorage.setItem('scholar_profile', JSON.stringify(scholarProfile))
          localStorage.setItem('ss_user', JSON.stringify(scholarProfile)); // For ScholarSync compatibility if needed

          // Store onboarding preferences for easy access
          if (onboarding_data) {
            localStorage.setItem('onboardingPreferences', JSON.stringify(onboarding_data))
          }

          setStatus('success')
          setMessage('Welcome to SkyFlow!')

          const postLoginRedirect = localStorage.getItem('post_login_redirect') || '/'
          localStorage.removeItem('post_login_redirect')

          router.push(postLoginRedirect)
        })
        .catch(err => {
          console.error('Error fetching user data:', err)
          setStatus('error')
          setMessage('Authentication failed')

          // Clear invalid token
          localStorage.removeItem('token')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
          localStorage.removeItem('organizations')
          localStorage.removeItem('scholar_profile')
          localStorage.removeItem('ss_user')

          router.push("/login")
        })
    } else {
      router.push("/login")
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-slate-600/80 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl">
            {status === 'success' ? (
              <CheckCircle2 className="w-16 h-16 text-white animate-bounce-slow" />
            ) : (
              <Cloud className="w-16 h-16 text-white animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {status === 'success' ? 'All Set!' : 'Signing You In'}
          </h2>
          <p className="text-gray-600">{message}</p>
        </div>

        {status !== 'success' && status !== 'error' && (
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-600 mt-4">Redirecting to login...</p>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Cloud className="w-16 h-16 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
