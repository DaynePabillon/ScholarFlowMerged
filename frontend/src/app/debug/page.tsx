"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react'

interface Check {
  label: string
  status: 'idle' | 'loading' | 'ok' | 'error'
  detail?: string
  raw?: string
}

export default function DebugPage() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'Frontend env — NEXT_PUBLIC_API_URL', status: 'idle' },
    { label: 'Backend reachable — GET /api/auth/me (no token)', status: 'idle' },
    { label: 'Backend health — GET /api/health (or /)', status: 'idle' },
  ])
  const [lsState, setLsState] = useState<Record<string, string>>({})
  const [manualToken, setManualToken] = useState('')
  const [manualResult, setManualResult] = useState<string | null>(null)
  const [manualLoading, setManualLoading] = useState(false)

  const setCheck = (i: number, patch: Partial<Check>) =>
    setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  const runChecks = async () => {
    // reset
    setChecks([
      { label: 'Frontend env — NEXT_PUBLIC_API_URL', status: 'loading' },
      { label: 'Backend reachable — GET /api/auth/me (no token)', status: 'loading' },
      { label: 'Backend health — GET / or /api/health', status: 'loading' },
    ])

    // Check 1: env
    setCheck(0, {
      status: 'ok',
      detail: `API_URL = "${API_URL}"  (should be https://api.wildcatinnovationlabs.com)`
    })

    // Check 2: /api/auth/me without token — expect 401 (reachable) not network error
    try {
      const r = await fetch(`${API_URL}/api/auth/me`, { method: 'GET' })
      const body = await r.text()
      if (r.status === 401) {
        setCheck(1, { status: 'ok', detail: `HTTP 401 — backend is reachable and responding correctly`, raw: body })
      } else {
        setCheck(1, { status: 'error', detail: `Unexpected HTTP ${r.status} ${r.statusText}`, raw: body })
      }
    } catch (e: any) {
      setCheck(1, { status: 'error', detail: `Network error / CORS: ${e?.message}` })
    }

    // Check 3: root endpoint
    try {
      const r = await fetch(`${API_URL}/`, { method: 'GET' })
      const body = await r.text()
      setCheck(2, { status: r.ok ? 'ok' : 'error', detail: `HTTP ${r.status} ${r.statusText}`, raw: body.slice(0, 200) })
    } catch (e: any) {
      // try /api/health
      try {
        const r2 = await fetch(`${API_URL}/api/health`)
        const body2 = await r2.text()
        setCheck(2, { status: r2.ok ? 'ok' : 'error', detail: `HTTP ${r2.status} ${r2.statusText}`, raw: body2.slice(0, 200) })
      } catch (e2: any) {
        setCheck(2, { status: 'error', detail: `Network error: ${e2?.message}` })
      }
    }

    // localStorage
    const snap: Record<string, string> = {}
    const keys = ['token', 'auth_token', 'user', 'organizations', 'ss_user']
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k)
        snap[k] = v ? `✓ "${v.slice(0, 80)}${v.length > 80 ? '...' : ''}"` : '✗ not set'
      } catch {
        snap[k] = '✗ error reading'
      }
    }
    setLsState(snap)
  }

  const testManualToken = async () => {
    if (!manualToken.trim()) return
    setManualLoading(true)
    setManualResult(null)
    try {
      const r = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${manualToken.trim()}` }
      })
      const body = await r.text()
      setManualResult(`HTTP ${r.status} ${r.statusText}\n\n${body}`)
    } catch (e: any) {
      setManualResult(`Network error: ${e?.message}`)
    }
    setManualLoading(false)
  }

  useEffect(() => { runChecks() }, [])

  const icon = (s: Check['status']) => {
    if (s === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
    if (s === 'error') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
    if (s === 'loading') return <Loader2 className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
    return <div className="w-4 h-4 rounded-full border border-gray-600 shrink-0" />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">🔍 Auth Debug Panel</h1>
            <p className="text-xs text-gray-500 mt-1">No login required — runs checks directly</p>
          </div>
          <button
            onClick={runChecks}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Re-run
          </button>
        </div>

        {/* Quick links */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            [`${API_URL}/api/auth/google`, 'Test Login (triggers OAuth)'],
            [`${API_URL}/api/auth/me`, '/api/auth/me (no token → expect 401)'],
          ].map(([url, label]) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-blue-900/40 border border-blue-700 rounded text-xs text-blue-300 hover:bg-blue-900/70 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {label}
            </a>
          ))}
        </div>

        {/* Automated checks */}
        <section className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Automated Checks</h2>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className={`rounded-lg border p-3 ${
                c.status === 'error' ? 'border-red-800 bg-red-950/30' :
                c.status === 'ok' ? 'border-emerald-800 bg-emerald-950/20' :
                'border-gray-800 bg-gray-900/30'
              }`}>
                <div className="flex items-center gap-2">
                  {icon(c.status)}
                  <span className="text-sm text-gray-200">{c.label}</span>
                </div>
                {c.detail && (
                  <p className={`mt-1 ml-6 text-xs ${c.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                    {c.detail}
                  </p>
                )}
                {c.raw && (
                  <pre className="mt-1 ml-6 text-xs text-gray-500 bg-gray-900 rounded p-2 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                    {c.raw}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* localStorage */}
        <section className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">localStorage State</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-1.5">
            {Object.keys(lsState).length === 0 ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : Object.entries(lsState).map(([k, v]) => (
              <div key={k} className="flex gap-3 text-xs">
                <span className="text-gray-500 w-28 shrink-0">{k}</span>
                <span className={v.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}>{v}</span>
              </div>
            ))}
            <button
              onClick={() => {
                ['token','auth_token','user','organizations','ss_user','onboardingPreferences'].forEach(k => localStorage.removeItem(k))
                runChecks()
              }}
              className="mt-3 px-2 py-1 bg-red-900/40 border border-red-700 rounded text-xs text-red-300 hover:bg-red-900/70 transition-colors"
            >
              Clear all auth keys
            </button>
          </div>
        </section>

        {/* Manual token test */}
        <section className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Manual Token Test</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-3">
              Paste a JWT (from URL after OAuth) to test if the backend accepts it:
            </p>
            <textarea
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="w-full h-20 p-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-600 resize-none outline-none focus:border-blue-600"
            />
            <button
              onClick={testManualToken}
              disabled={manualLoading || !manualToken.trim()}
              className="mt-2 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded text-xs text-white transition-colors"
            >
              {manualLoading ? 'Testing...' : 'Test Token →'}
            </button>
            {manualResult && (
              <pre className="mt-3 p-3 bg-gray-800 rounded text-xs text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {manualResult}
              </pre>
            )}
          </div>
        </section>

        {/* OAuth flow link */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Trigger OAuth (observe redirect)</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-xs text-gray-400">
            <p className="mb-2">Click below — after Google login, check what URL the backend sends you to:</p>
            <a
              href={`${API_URL}/api/auth/google`}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Start Google OAuth Flow
            </a>
            <p className="mt-3 text-gray-500">
              Expected redirect after Google login:<br />
              <span className="text-yellow-400">https://scholarflow.wildcatinnovationlabs.com/auth/callback?token=eyJ...</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
