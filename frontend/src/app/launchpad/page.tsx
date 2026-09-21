"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// The launchpad is now the root portal — redirect there.
export default function LaunchpadPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/') }, [router])
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  )
}
