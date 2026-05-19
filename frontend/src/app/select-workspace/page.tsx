"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Users, ArrowRight, Loader2 } from "lucide-react"

interface Organization {
  id: string
  name: string
  role: 'admin' | 'manager' | 'member'
  memberCount?: number
  logo_url?: string
}

export default function SelectWorkspacePage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")
    const storedOrgs = localStorage.getItem("organizations")

    if (!token) {
      router.push("/login")
      return
    }

    if (storedUser && storedOrgs) {
      try {
        const userData = JSON.parse(storedUser)
        const orgsData = JSON.parse(storedOrgs)
        setUser(userData)
        setOrganizations(orgsData)

        // If only one org, auto-select and redirect
        if (orgsData.length === 1) {
          localStorage.setItem('selectedOrganization', JSON.stringify(orgsData[0]))
          router.push("/")
          return
        }

        setIsLoading(false)
      } catch (e) {
        console.error('Error parsing stored data:', e)
        router.push("/login")
      }
    } else {
      router.push("/login")
    }
  }, [router])

  const handleSelectWorkspace = (orgId: string) => {
    setSelectedOrg(orgId)

    // Store selected organization
    const selected = organizations.find(org => org.id === orgId)
    if (selected) {
      localStorage.setItem('selectedOrganization', JSON.stringify(selected))

      // Smooth transition to dashboard
      setTimeout(() => {
        router.push("/")
      }, 300)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-700 border-purple-200',
      manager: 'bg-blue-100 text-blue-700 border-blue-200',
      member: 'bg-green-100 text-green-700 border-green-200'
    }
    return colors[role as keyof typeof colors] || colors.member
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl animate-bounce-slow"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl animate-wave"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-fantastic to-abyssal-anchorfish rounded-xl mb-6 shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-lg text-blue-600">
              Select a workspace to continue
            </p>
          </div>

          {/* Workspace Grid */}
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectWorkspace(org.id)}
                disabled={selectedOrg === org.id}
                className="group relative bg-white/70 backdrop-blur-xl rounded-xl p-6 border border-white/40 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 text-left disabled:opacity-50 shadow-lg"
              >
                {selectedOrg === org.id && (
                  <div className="absolute inset-0 bg-blue-fantastic/5 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-fantastic animate-spin" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-fantastic to-abyssal-anchorfish rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                        {org.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getRoleBadgeColor(org.role)}`}>
                          {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {org.memberCount && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{org.memberCount} members</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Create New Workspace */}
          <div className="mt-8 text-center">
            <button className="text-sm text-blue-500 hover:text-blue-700 transition-colors font-medium">
              + Create new workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
