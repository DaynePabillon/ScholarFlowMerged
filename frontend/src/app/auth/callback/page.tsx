"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

interface DebugStep {
  label: string
  status: 'pending' | 'running' | 'ok' | 'error'
  detail?: string
}

interface DebugInfo {
  tokenReceived: string | null
  apiUrl: string
  httpStatus?: number
  httpStatusText?: string
  responseBody?: string
  errorMessage?: string
  localStorage?: Record<string, string>
}

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [steps, setSteps] = useState<DebugStep[]>([
    { label: '1. Token received from backend', status: 'pending' },
    { label: '2. Token stored in localStorage', status: 'pending' },
    { label: `3. GET ${API_URL}/api/auth/me`, status: 'pending' },
    { label: '4. User data saved', status: 'pending' },
    { label: '5. Redirecting to portal', status: 'pending' },
  ])
  const [debug, setDebug] = useState<DebugInfo>({ tokenReceived: null, apiUrl: API_URL })
  const [showRaw, setShowRaw] = useState(false)
  const [done, setDone] = useState<'success' | 'error' | null>(null)

  const setStep = (index: number, status: DebugStep['status'], detail?: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, status, detail } : s))
  }

  useEffect(() => {
    const run = async () => {
      const token = searchParams.get("token")

      // Step 1: token received
      if (!token) {
        setStep(0, 'error', 'No ?token= param in URL — backend did not redirect here correctly')
        setDebug(d => ({ ...d, tokenReceived: null }))
        setDone('error')
        return
      }
      setStep(0, 'ok', `Token starts with: ${token.slice(0, 40)}...`)
      setDebug(d => ({ ...d, tokenReceived: token }))

      // Step 2: store token
      try {
        localStorage.setItem("token", token)
        localStorage.setItem("auth_token", token)
        setStep(1, 'ok', 'token + auth_token set in localStorage')
      } catch (e: any) {
        setStep(1, 'error', `localStorage write failed: ${e?.message}`)
        setDone('error')
        return
      }

      // Step 3: call /api/auth/me
      setStep(2, 'running', `Fetching ${API_URL}/api/auth/me ...`)
      let res: Response
      try {
        res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } catch (networkErr: any) {
        setStep(2, 'error', `Network error (CORS or offline?): ${networkErr?.message}`)
        setDebug(d => ({ ...d, errorMessage: networkErr?.message }))
        setDone('error')
        return
      }

      const bodyText = await res.text()
      setDebug(d => ({
        ...d,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        responseBody: bodyText,
      }))

      if (!res.ok) {
        setStep(2, 'error', `HTTP ${res.status} ${res.statusText}`)
        setStep(3, 'error', 'Skipped — API call failed')
        setDone('error')
        return
      }
      setStep(2, 'ok', `HTTP ${res.status} OK`)

      // Step 4: save user data
      try {
        const data = JSON.parse(bodyText)
        const { organizations, onboarding_data, ...userData } = data
        const skyflowUser = { ...userData, onboarding_data }

        localStorage.setItem('user', JSON.stringify(skyflowUser))
        localStorage.setItem('organizations', JSON.stringify(organizations || []))
        localStorage.setItem('ss_user', JSON.stringify(data))
        if (onboarding_data) {
          localStorage.setItem('onboardingPreferences', JSON.stringify(onboarding_data))
        }

        // Snapshot localStorage for debug display
        const snap: Record<string, string> = {}
        for (const key of ['token', 'auth_token', 'user', 'organizations', 'ss_user']) {
          const val = localStorage.getItem(key)
          snap[key] = val ? `✓ set (${val.slice(0, 60)}...)` : '✗ missing'
        }
        setDebug(d => ({ ...d, localStorage: snap }))
        setStep(3, 'ok', `User: ${userData.email} | Orgs: ${(organizations || []).length}`)
      } catch (parseErr: any) {
        setStep(3, 'error', `Failed to parse JSON: ${parseErr?.message}`)
        setDone('error')
        return
      }

      // Step 5: redirect
      setStep(4, 'running', 'Redirecting to portal in 2s...')
      setDone('success')
      setTimeout(() => router.push('/'), 2000)
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stepIcon = (s: DebugStep['status']) => {
    if (s === 'ok') return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
    if (s === 'error') return <XCircle className="w-5 h-5 text-red-500 shrink-0" />
    if (s === 'running') return <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono p-6 flex flex-col items-center justify-start pt-16">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          {done === 'success' && <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
          {done === 'error' && <XCircle className="w-8 h-8 text-red-400" />}
          {!done && <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />}
          <div>
            <h1 className="text-xl font-bold text-white">Auth Callback Debug</h1>
            <p className="text-xs text-gray-400">API: {API_URL}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                step.status === 'error' ? 'border-red-700 bg-red-950/40' :
                step.status === 'ok' ? 'border-emerald-800 bg-emerald-950/30' :
                step.status === 'running' ? 'border-blue-700 bg-blue-950/30' :
                'border-gray-800 bg-gray-900/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {stepIcon(step.status)}
                <span className={`text-sm ${step.status === 'error' ? 'text-red-300' : step.status === 'ok' ? 'text-emerald-300' : 'text-gray-300'}`}>
                  {step.label}
                </span>
              </div>
              {step.detail && (
                <p className={`mt-1 ml-8 text-xs ${step.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                  {step.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Error detail panel */}
        {done === 'error' && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-sm">Authentication Failed — Details</span>
            </div>
            <div className="space-y-2 text-xs">
              <div><span className="text-gray-400">API URL:</span> <span className="text-white">{debug.apiUrl}</span></div>
              <div><span className="text-gray-400">Token received:</span> <span className="text-white">{debug.tokenReceived ? `✓ Yes (${debug.tokenReceived.slice(0, 30)}...)` : '✗ No'}</span></div>
              {debug.httpStatus && (
                <div><span className="text-gray-400">HTTP Status:</span> <span className={debug.httpStatus >= 400 ? 'text-red-400' : 'text-white'}>{debug.httpStatus} {debug.httpStatusText}</span></div>
              )}
              {debug.errorMessage && (
                <div><span className="text-gray-400">Error:</span> <span className="text-red-300">{debug.errorMessage}</span></div>
              )}
            </div>

            {/* Raw response toggle */}
            {debug.responseBody && (
              <div className="mt-3">
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {showRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Raw response body
                </button>
                {showRaw && (
                  <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {debug.responseBody}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => window.location.href = '/login'}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white transition-colors"
              >
                ← Back to Login
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* localStorage state */}
        {debug.localStorage && (
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">localStorage State</h3>
            <div className="space-y-1">
              {Object.entries(debug.localStorage).map(([k, v]) => (
                <div key={k} className="flex gap-3 text-xs">
                  <span className="text-gray-500 w-28 shrink-0">{k}</span>
                  <span className={v.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center font-mono">
        <p className="text-gray-400">Loading auth callback...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
