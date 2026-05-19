"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Briefcase, Check, ChevronRight, LogOut, Trash2, Plus, X, Building2, AlertTriangle } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'

interface Organization {
    id: string
    name: string
    role: 'admin' | 'manager' | 'member'
}

export default function SettingsPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Workspace management state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [deleteConfirmOrg, setDeleteConfirmOrg] = useState<Organization | null>(null)
    const [leaveConfirmOrg, setLeaveConfirmOrg] = useState<Organization | null>(null)

    const fetchOrganizations = async () => {
        const token = localStorage.getItem('token')
        const orgsRes = await fetch(`${API_URL}/api/organizations`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (orgsRes.ok) {
            const orgsData = await orgsRes.json()
            setOrganizations(orgsData)
            if (orgsData.length > 0 && !selectedOrg) {
                setSelectedOrg(orgsData[0])
            }
        }
    }

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        const fetchData = async () => {
            try {
                // Fetch user
                const userRes = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (!userRes.ok) throw new Error('Not authenticated')
                const userData = await userRes.json()
                setUser(userData)

                // Fetch organizations
                await fetchOrganizations()
            } catch (error) {
                console.error('Error fetching data:', error)
                router.push('/login')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [router])

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) return
        setIsCreating(true)
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: newWorkspaceName.trim() })
            })
            if (response.ok) {
                setNewWorkspaceName('')
                setIsCreateModalOpen(false)
                await fetchOrganizations()
            }
        } catch (error) {
            console.error('Error creating workspace:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleLeaveWorkspace = async (org: Organization) => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/organizations/${org.id}/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (response.ok) {
                setLeaveConfirmOrg(null)
                await fetchOrganizations()
                // Reset selected org if we left the current one
                if (selectedOrg?.id === org.id) {
                    setSelectedOrg(organizations.find(o => o.id !== org.id) || null)
                }
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to leave workspace')
            }
        } catch (error) {
            console.error('Error leaving workspace:', error)
        }
    }

    const handleDeleteWorkspace = async (org: Organization) => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/organizations/${org.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            if (response.ok) {
                setDeleteConfirmOrg(null)
                await fetchOrganizations()
                if (selectedOrg?.id === org.id) {
                    setSelectedOrg(organizations.find(o => o.id !== org.id) || null)
                }
            } else {
                const data = await response.json()
                alert(data.error || 'Failed to delete workspace')
            }
        } catch (error) {
            console.error('Error deleting workspace:', error)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-cyan-50/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-600">Loading settings...</p>
                </div>
            </div>
        )
    }

    return (
        <AppLayout
            user={user}
            organizations={organizations}
            selectedOrg={selectedOrg}
            onOrgChange={setSelectedOrg}
        >
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
                            <Settings className="w-6 h-6 text-gray-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    </div>
                    <p className="text-gray-500">Customize your SkyFlow experience</p>
                </div>

                {/* Account Section */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">Account</h2>
                        <p className="text-sm text-gray-500 mt-1">Your account information</p>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center gap-4">
                            {user?.profile_picture ? (
                                <img src={user.profile_picture} alt="" className="w-16 h-16 rounded-full" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold">
                                    {user?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                            <div>
                                <h3 className="font-semibold text-gray-900">{user?.name}</h3>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Workspace Management Section */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Workspaces</h2>
                            <p className="text-sm text-gray-500 mt-1">Manage your workspaces</p>
                        </div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Workspace
                        </button>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {organizations.map((org) => (
                            <div key={org.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                        {org.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{org.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${org.role === 'admin'
                                            ? 'bg-red-100 text-red-700'
                                            : org.role === 'manager'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setLeaveConfirmOrg(org)}
                                        className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                        title="Leave Workspace"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                    {org.role === 'admin' && (
                                        <button
                                            onClick={() => setDeleteConfirmOrg(org)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Workspace"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {organizations.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No workspaces yet. Create one to get started!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Workspace Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Create New Workspace</h3>
                                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                placeholder="Workspace name"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateWorkspace}
                                    disabled={!newWorkspaceName.trim() || isCreating}
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leave Confirmation Modal */}
                {leaveConfirmOrg && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-100 rounded-full">
                                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Leave Workspace?</h3>
                            </div>
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to leave <strong>{leaveConfirmOrg.name}</strong>? You will lose access to all projects and tasks in this workspace.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setLeaveConfirmOrg(null)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleLeaveWorkspace(leaveConfirmOrg)}
                                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                >
                                    Leave Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirmOrg && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-full">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Workspace?</h3>
                            </div>
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to permanently delete <strong>{deleteConfirmOrg.name}</strong>? This action cannot be undone and will delete all projects, tasks, and member associations.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmOrg(null)}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteWorkspace(deleteConfirmOrg)}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                >
                                    Delete Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
