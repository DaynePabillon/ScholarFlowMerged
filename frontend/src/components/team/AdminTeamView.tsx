"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { Users, UserPlus, Search, Mail, Shield, MoreVertical, Crown, Briefcase, User, Settings, X, Copy, Check } from "lucide-react"
import RoleManagement from "./RoleManagement"

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'member'
  joined_at: string
  status: string
}

interface AdminTeamViewProps {
  user: any
  organization: {
    id: string
    name: string
    role: string
  }
}

export default function AdminTeamView({ user, organization }: AdminTeamViewProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("member")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [organization.id])

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/organizations/${organization.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        setMembers([])
        setIsLoading(false)
        return
      }

      const data = await response.json()
      setMembers(data.members || [])
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching members:', error)
      setMembers([])
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/members/${memberId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: newRole })
        }
      )

      if (response.ok) {
        fetchMembers() // Refresh member list
      }
    } catch (error) {
      console.error('Error changing role:', error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.ok) {
        fetchMembers() // Refresh member list
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviteLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/api/organizations/${organization.id}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole })
        }
      )

      if (response.ok) {
        const data = await response.json()
        setInviteUrl(data.inviteUrl)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert('Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeInviteModal = () => {
    setIsInviteModalOpen(false)
    setInviteEmail('')
    setInviteRole('member')
    setInviteUrl(null)
    setCopied(false)
  }

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Crown className="w-4 h-4" />
    if (role === 'manager') return <Briefcase className="w-4 h-4" />
    return <User className="w-4 h-4" />
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
      manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
      member: { label: 'Member', color: 'bg-green-100 text-green-700' }
    }
    return badges[role as keyof typeof badges] || badges.member
  }

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterRole === 'all' || member.role === filterRole
    return matchesSearch && matchesFilter
  })

  // Don't show anything during initial load to avoid flash
  if (isLoading) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Team Members</h1>
            <p className="text-gray-600 mt-1">Manage members in {organization.name}</p>
          </div>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
          >
            <UserPlus className="w-5 h-5" />
            <span className="font-medium">Invite Member</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Crown className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Admins</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {members.filter(m => m.role === 'admin').length}
          </p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Managers</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {members.filter(m => m.role === 'manager').length}
          </p>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Members</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {members.filter(m => m.role === 'member').length}
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50/50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-800">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(member.role).color}`}>
                      {getRoleIcon(member.role)}
                      {getRoleBadge(member.role).label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-blue-600">No members found</p>
          </div>
        )}
      </div>

      {/* Role Management Section */}
      <div className="mt-6">
        <RoleManagement
          members={members.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role
          }))}
          organizationId={organization.id}
          currentUserId={user.id}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMember}
        />
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                👋 Invite Team Member
              </h2>
              <button onClick={closeInviteModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!inviteUrl ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="member">👤 Member</option>
                    <option value="manager">💼 Manager</option>
                    <option value="admin">👑 Admin</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail || inviteLoading}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 hover:from-blue-600 hover:to-cyan-600"
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-green-700 font-medium mb-2">✅ Invitation Created!</p>
                  <p className="text-sm text-green-600">Share this link with {inviteEmail}:</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${copied
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={closeInviteModal}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
