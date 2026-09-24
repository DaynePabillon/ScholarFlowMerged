"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Users, CheckCircle2, AlertCircle } from "lucide-react"

function JoinPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'already_member' | 'error'>('loading')
  const [message, setMessage] = useState('Joining organization...')
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    const code = searchParams?.get("code")
    if (!code) {
      setStatus('error')
      setMessage('No join code provided.')
      return
    }

    const token = localStorage.getItem('token') || localStorage.getItem('auth_token')

    if (!token) {
      // Not logged in — save code and redirect to login
      localStorage.setItem('pendingJoinCode', code)
      localStorage.setItem('post_login_redirect', `/join?code=${code}`)
      router.push('/login')
      return
    }

    // Authenticated — redeem immediately
    fetch(`${API_URL}/api/join-codes/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    })
      .then(res => res.json())
      .then(async data => {
        if (data.success || data.error === 'You are already a member of this organization') {
          const org = data.organization
          setOrgName(org?.name || 'the organization')

          // Refresh user/org data in localStorage
          const meRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (meRes.ok) {
            const meData = await meRes.json()
            const { organizations, onboarding_data, ...userData } = meData
            localStorage.setItem('user', JSON.stringify({ ...userData, onboarding_data }))
            localStorage.setItem('organizations', JSON.stringify(organizations || []))
            // Select the newly joined org
            const joined = (organizations || []).find((o: any) => o.id === org?.id)
            if (joined) localStorage.setItem('selectedOrganization', JSON.stringify(joined))
          }

          setStatus(data.error ? 'already_member' : 'success')
          setMessage(data.error ? `You're already in ${org?.name || 'this organization'}.` : `Welcome to ${org?.name || 'the organization'}!`)

          setTimeout(() => router.push('/dashboard'), 2000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Failed to join organization.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      })
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto px-6">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-700/80 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl">
            {status === 'success' ? (
              <CheckCircle2 className="w-12 h-12 text-green-400 animate-bounce" />
            ) : status === 'error' ? (
              <AlertCircle className="w-12 h-12 text-red-400" />
            ) : (
              <Users className="w-12 h-12 text-white animate-pulse" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            {status === 'success' ? 'You\'re in!' : status === 'already_member' ? 'Already a Member' : status === 'error' ? 'Something went wrong' : 'Joining...'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{message}</p>
        </div>

        {(status === 'success' || status === 'already_member') && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting to dashboard...</p>
        )}

        {status === 'error' && (
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        )}

        {status === 'loading' && (
          <div className="flex justify-center gap-2 mt-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <Users className="w-12 h-12 text-gray-400 animate-pulse" />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  )
}
