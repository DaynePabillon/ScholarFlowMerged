"use client"

import { useState, useEffect } from 'react'
import { X, Info, AlertTriangle, CheckCircle, Wrench, Megaphone } from 'lucide-react'
import { API_URL } from '@/lib/api/client'

interface Announcement {
  id: number
  message: string
  type: 'info' | 'warning' | 'success' | 'maintenance'
  is_active: boolean
  expires_at: string | null
  created_at: string
}

const typeStyles: Record<string, { bar: string; icon: string; text: string; close: string }> = {
  info:        { bar: 'bg-blue-600',   icon: 'text-blue-100',  text: 'text-white',      close: 'hover:bg-blue-700' },
  warning:     { bar: 'bg-amber-500',  icon: 'text-amber-100', text: 'text-white',      close: 'hover:bg-amber-600' },
  success:     { bar: 'bg-emerald-600',icon: 'text-emerald-100',text: 'text-white',     close: 'hover:bg-emerald-700' },
  maintenance: { bar: 'bg-slate-700',  icon: 'text-slate-300', text: 'text-slate-100',  close: 'hover:bg-slate-800' },
}

const TypeIcon = ({ type }: { type: string }) => {
  const cls = 'w-4 h-4 flex-shrink-0'
  if (type === 'warning')     return <AlertTriangle className={cls} />
  if (type === 'success')     return <CheckCircle className={cls} />
  if (type === 'maintenance') return <Wrench className={cls} />
  return <Info className={cls} />
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
    if (!token) return

    const dismissedId = sessionStorage.getItem('dismissed_announcement')

    // Read selected org for scoped announcements
    let orgId: string | null = null
    try {
      const stored = localStorage.getItem('selectedOrganization')
      if (stored) orgId = JSON.parse(stored)?.id || null
    } catch (_) {}

    const orgParam = orgId ? `&orgId=${orgId}` : ''

    // Initial fetch
    fetch(`${API_URL}/api/reports/announcement${orgId ? `?orgId=${orgId}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.announcement) {
          const ann = data.announcement as Announcement
          if (String(ann.id) !== dismissedId) setAnnouncement(ann)
        }
      })
      .catch(() => {})

    // SSE stream for live updates
    const es = new EventSource(`${API_URL}/api/sse/announcements?token=${token}${orgParam}`)
    es.addEventListener('announcement', (e) => {
      try {
        const ann: Announcement | null = JSON.parse((e as MessageEvent).data)
        if (!ann) {
          setAnnouncement(null)
          return
        }
        const currentDismissed = sessionStorage.getItem('dismissed_announcement')
        if (String(ann.id) !== currentDismissed) {
          setAnnouncement(ann)
          setDismissed(false)
        }
      } catch (_) {}
    })
    es.onerror = () => es.close()

    return () => es.close()
  }, [])

  const handleDismiss = () => {
    if (announcement) sessionStorage.setItem('dismissed_announcement', String(announcement.id))
    setDismissed(true)
  }

  if (!announcement || dismissed) return null

  const style = typeStyles[announcement.type] ?? typeStyles.info

  return (
    <div className={`w-full ${style.bar} px-4 py-2.5 flex items-center gap-3 shadow-sm z-[9990] relative`}>
      <Megaphone className={`w-4 h-4 flex-shrink-0 ${style.icon}`} />
      <TypeIcon type={announcement.type} />
      <p className={`flex-1 text-sm font-medium ${style.text} leading-snug`}>
        {announcement.message}
      </p>
      <button
        onClick={handleDismiss}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${style.close}`}
        title="Dismiss"
      >
        <X className={`w-4 h-4 ${style.text}`} />
      </button>
    </div>
  )
}
