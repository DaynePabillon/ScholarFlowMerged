"use client"

import { useState } from "react"
import { Plus, Search, Users, FileSpreadsheet, RotateCcw, ChevronDown } from "lucide-react"
import TeamCard from "./TeamCard"

interface TeamGroup {
    id: string
    team_code: string | null
    team_number: number
    name: string
    description: string | null
    adviser_name: string | null
    leader_name: string | null
    status: string
    member_count: number
    total_checkpoints: number
    completed_checkpoints: number
    proposed_project: string | null
    project_id?: string | null
    project_name?: string | null
}

interface TeamCardGridProps {
    teams: TeamGroup[]
    userRole: string
    onTeamClick: (team: TeamGroup) => void
    onCreateTeam: () => void
    onShowTemplate?: () => void
    onSyncAll?: () => void
    isResyncing?: boolean
}

export default function TeamCardGrid({ teams, userRole, onTeamClick, onCreateTeam, onShowTemplate, onSyncAll, isResyncing }: TeamCardGridProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("all")

    const filteredTeams = teams.filter(team => {
        const matchesSearch = !searchQuery ||
            team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.adviser_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.leader_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(team.team_number).includes(searchQuery)

        const matchesStatus = filterStatus === "all" || team.status === filterStatus

        return matchesSearch && matchesStatus
    })

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-6 bg-white/90 dark:bg-slate-900/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-gray-200 dark:border-slate-700/50 shadow-lg dark:shadow-2xl transition-colors duration-500">
                {/* Search */}
                <div className="flex-1 min-w-[320px] relative group/search">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/search:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search Teams..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-100/50 dark:bg-slate-950/40 border-2 border-gray-200 dark:border-slate-700/50 rounded-2xl text-gray-900 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-blue-500/40 focus:bg-white dark:focus:bg-slate-900/60 transition-all outline-none font-black text-xs uppercase tracking-widest shadow-inner placeholder:font-black placeholder:uppercase"
                    />
                </div>

                {/* Status filter */}
                <div className="relative group/filter">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="appearance-none pl-6 pr-12 py-3.5 bg-gray-50 dark:bg-slate-950/40 border-2 border-gray-200 dark:border-white/5 rounded-2xl text-gray-700 dark:text-slate-300 font-black text-xs uppercase tracking-widest outline-none focus:border-emerald-500/40 cursor-pointer shadow-inner"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-focus-within/filter:rotate-180 transition-transform" />
                </div>

                {/* Action buttons (admin only) */}
                {userRole === 'admin' && (
                    <div className="flex items-center gap-4">
                        {onShowTemplate && (
                            <button
                                onClick={onShowTemplate}
                                className="group/btn flex items-center gap-3 px-6 py-3.5 bg-emerald-50 dark:bg-slate-900/40 border-2 border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-100 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all duration-300 shadow-md dark:shadow-xl"
                            >
                                <FileSpreadsheet className="w-4 h-4 group-hover/btn:scale-110 transition-transform text-emerald-500" />
                                Sheet Template
                            </button>
                        )}
                        {onSyncAll && (
                            <button
                                onClick={onSyncAll}
                                disabled={isResyncing}
                                className="group/btn flex items-center gap-3 px-6 py-3.5 bg-blue-50 dark:bg-slate-900/40 border-2 border-blue-200 dark:border-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-400 font-extrabold text-[10px] uppercase tracking-[0.2em] hover:bg-blue-100 dark:hover:bg-blue-500/10 hover:border-blue-300 dark:hover:border-blue-500/40 transition-all duration-300 shadow-md dark:shadow-xl disabled:opacity-30"
                            >
                                <RotateCcw className={`w-4 h-4 group-hover/btn:rotate-180 transition-transform duration-700 text-blue-500 ${isResyncing ? 'animate-spin' : ''}`} />
                                {isResyncing ? 'Syncing...' : 'Re-sync'}
                            </button>
                        )}
                        <button
                            onClick={onCreateTeam}
                            className="group/btn flex items-center gap-3 px-8 py-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border border-white/10"
                        >
                            <Plus className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                            Create Team
                        </button>
                    </div>
                )}
            </div>

            {/* Grid */}
            {filteredTeams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredTeams.map(team => (
                        <div key={team.id} className="animate-in zoom-in-95 duration-500">
                            <TeamCard
                                team={team}
                                onClick={() => onTeamClick(team)}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-gray-50 dark:bg-slate-900/20 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-white/5 space-y-6">
                    <div className="p-8 bg-gray-100 dark:bg-slate-900/60 rounded-[2rem] border border-gray-200 dark:border-white/5 shadow-lg dark:shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                        <Users className="w-16 h-16 text-gray-300 dark:text-slate-700 opacity-30" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest">
                            {searchQuery ? 'No Results' : userRole === 'admin' ? 'No Teams Yet' : 'No Team Assigned'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-600 font-bold uppercase tracking-widest mt-2">
                            {searchQuery
                                ? 'No teams match your search'
                                : userRole === 'admin'
                                    ? 'Create your first team to get started'
                                    : 'You have not been added to a team yet — contact your admin'}
                        </p>
                    </div>
                    {userRole === 'admin' && !searchQuery && (
                        <button
                            onClick={onCreateTeam}
                            className="px-8 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                        >
                            Create First Team
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
