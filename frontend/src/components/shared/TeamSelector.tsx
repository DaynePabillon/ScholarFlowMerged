"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Users, ChevronDown } from 'lucide-react'
import apiClient from '@/lib/api/client'

interface Team {
    id: string
    team_code: string
    team_number: number
    name: string
    member_count?: number
}

interface TeamSelectorProps {
    organizationId: string
    selectedTeamId: string | null
    onTeamChange: (teamId: string | null) => void
    userRole: 'admin' | 'manager' | 'member'
    className?: string
}

export default function TeamSelector({
    organizationId,
    selectedTeamId,
    onTeamChange,
    userRole,
    className = ''
}: TeamSelectorProps) {
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        fetchTeams()
    }, [organizationId])

    const fetchTeams = useCallback(async () => {
        try {
            const response = await apiClient.get(`/organizations/${organizationId}/teams`)

            if (response.data) {
                const data = response.data
                setTeams(data.teams || [])
                
                // For students (members), auto-select their team if they only have one
                if (userRole === 'member' && data.teams.length === 1) {
                    onTeamChange(data.teams[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching teams:', error)
        } finally {
            setLoading(false)
        }
    }, [organizationId, userRole, onTeamChange])

    const selectedTeam = useMemo(() => teams.find(t => t.id === selectedTeamId), [teams, selectedTeamId])

    // For students, if they only have one team, don't show the selector
    if (userRole === 'member' && teams.length <= 1) {
        return null
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading || teams.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg hover:bg-white hover:border-blue-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                    {loading ? 'Loading...' : selectedTeam ? selectedTeam.name : 'All Teams'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && teams.length > 0 && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-[90]" 
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100] max-h-80 overflow-y-auto">
                        {/* All Teams option (for admin/manager only) */}
                        {(userRole === 'admin' || userRole === 'manager') && (
                            <button
                                onClick={() => {
                                    onTeamChange(null)
                                    setIsOpen(false)
                                }}
                                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 ${
                                    !selectedTeamId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium">All Teams</div>
                                    <div className="text-xs text-gray-500">{teams.length} teams</div>
                                </div>
                            </button>
                        )}

                        {/* Divider */}
                        {(userRole === 'admin' || userRole === 'manager') && (
                            <div className="border-t border-gray-100 my-1" />
                        )}

                        {/* Team list */}
                        {teams.map((team) => (
                            <button
                                key={team.id}
                                onClick={() => {
                                    onTeamChange(team.id)
                                    setIsOpen(false)
                                }}
                                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 ${
                                    selectedTeamId === team.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                    {team.team_number}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{team.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {team.team_code} • {team.member_count || 0} members
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
