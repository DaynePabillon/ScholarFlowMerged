"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import AdminTaskView from "@/components/tasks/AdminTaskView"
import ManagerTaskView from "@/components/tasks/ManagerTaskView"
import MemberTaskView from "@/components/tasks/MemberTaskView"

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member'
}

export default function TasksPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedOrgs = localStorage.getItem('organizations')
    const storedSelectedOrg = localStorage.getItem('selectedOrganization')

    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    if (storedOrgs) {
      setOrganizations(JSON.parse(storedOrgs))
    }
    if (storedSelectedOrg) {
      setSelectedOrg(JSON.parse(storedSelectedOrg))
    }

    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/")
      return
    }

    // If no cached data, fetch from API
    if (!user) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.ok ? res.json() : Promise.reject('Auth failed'))
        .then(data => {
          const { organizations: orgs, ...userData } = data
          setUser(userData)
          setOrganizations(orgs || [])
          if (orgs && orgs.length > 0 && !selectedOrg) {
            setSelectedOrg(orgs[0])
          }
        })
        .catch(err => console.error('Auth error:', err))
    }
  }, [mounted, router, user, selectedOrg])

  // Show nothing until mounted to prevent hydration mismatch
  if (!mounted || !user) {
    return null
  }

  if (!selectedOrg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No organization selected</p>
        </div>
      </div>
    )
  }

  let content
  if (selectedOrg.role === 'admin') {
    content = <AdminTaskView user={user} organization={selectedOrg} />
  } else if (selectedOrg.role === 'manager') {
    content = <ManagerTaskView user={user} organization={selectedOrg} />
  } else {
    content = <MemberTaskView user={user} organization={selectedOrg} />
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={setSelectedOrg}
    >
      {content}
    </AppLayout>
  )
}
