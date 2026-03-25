"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, Mail, Users, ChevronRight, Loader2, UserPlus } from 'lucide-react'

interface Organization {
    id: string
    name: string
    role: 'admin' | 'manager' | 'member'
    member_count?: number
}

interface PendingInvite {
    id: string
    organization_name: string
    role: string
    inviter_name: string
    token: string
}

interface OrganizationGatewayProps {
    user: any
    organizations: Organization[]
    pendingInvites?: PendingInvite[]
    onSelectOrg: (org: Organization) => void
    onCreateOrg?: () => void
}

export default function OrganizationGateway({
    user,
    organizations,
    pendingInvites = [],
    onSelectOrg,
    onCreateOrg
}: OrganizationGatewayProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null)

    // Auto-select if only one organization
    useEffect(() => {
        if (organizations.length === 1) {
            handleSelectOrg(organizations[0])
        }
    }, [organizations])

    const handleSelectOrg = (org: Organization) => {
        setIsLoading(true)
        localStorage.setItem('selectedOrganization', JSON.stringify(org))
        onSelectOrg(org)
    }

    const handleAcceptInvite = async (invite: PendingInvite) => {
        setAcceptingInvite(invite.id)
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/invitations/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: invite.token })
            })

            if (response.ok) {
                // Refresh the page to reload organizations
                window.location.reload()
            }
        } catch (error) {
            console.error('Error accepting invite:', error)
        } finally {
            setAcceptingInvite(null)
        }
    }

    const handleCreateOrg = () => {
        if (onCreateOrg) {
            onCreateOrg()
        } else {
            router.push('/onboarding')
        }
    }

    // If we have exactly one org, show loading while auto-selecting
    if (organizations.length === 1 && isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-600">Loading workspace...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-lg">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {organizations.length > 0 ? 'Choose your workspace' : 'Get Started'}
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {organizations.length > 0
                            ? "You're part of multiple organizations. Select one to continue."
                            : "You're not part of any organization yet."}
                    </p>
                </div>

                {/* Organizations List */}
                {organizations.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Your Organizations
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {organizations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSelectOrg(org)}
                                    disabled={isLoading}
                                    className="w-full p-4 flex items-center justify-between hover:bg-blue-50 transition-colors text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold">
                                            {org.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{org.name}</p>
                                            <p className="text-xs text-gray-500 capitalize">{org.role}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                        <div className="p-4 border-b border-gray-100 bg-amber-50">
                            <h2 className="font-semibold text-amber-700 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Pending Invitations
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {pendingInvites.map((invite) => (
                                <div key={invite.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-800">{invite.organization_name}</p>
                                        <p className="text-xs text-gray-500">
                                            Invited by {invite.inviter_name} as {invite.role}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleAcceptInvite(invite)}
                                        disabled={acceptingInvite === invite.id}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
                                    >
                                        {acceptingInvite === invite.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Accept'
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State / Create New */}
                <div className="space-y-3">
                    <button
                        onClick={handleCreateOrg}
                        className="w-full p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl flex items-center justify-center gap-2 hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Create New Organization
                    </button>

                    {organizations.length === 0 && (
                        <p className="text-center text-gray-400 text-sm">
                            or ask someone to invite you to their organization
                        </p>
                    )}
                </div>

                {/* User Info */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-400">
                        Signed in as <span className="font-medium text-gray-600">{user?.email || user?.name}</span>
                    </p>
                    <button
                        onClick={() => {
                            localStorage.clear()
                            router.push('/')
                        }}
                        className="text-sm text-blue-500 hover:text-blue-600 mt-1"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    )
}
