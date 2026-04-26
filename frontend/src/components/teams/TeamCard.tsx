"use client"

import { Users, User, Award, BarChart3 } from "lucide-react"

interface TeamCardProps {
    team: {
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
    }
    onClick: () => void
}

export default function TeamCard({ team, onClick }: TeamCardProps) {
    const progress = team.total_checkpoints > 0
        ? Math.round((team.completed_checkpoints / team.total_checkpoints) * 100)
        : 0

    const progressColor = progress >= 75 ? 'bg-green-600' : progress >= 40 ? 'bg-amber-500' : 'bg-red-600'
    const progressTextColor = progress >= 75 ? 'text-green-600 dark:text-green-500' : progress >= 40 ? 'text-amber-600 dark:text-amber-500' : 'text-red-600 dark:text-red-500'

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="group relative overflow-hidden cursor-pointer p-8 rounded-[2.5rem] bg-white/95 dark:bg-slate-900/60 backdrop-blur-2xl border border-gray-100 dark:border-slate-700/50 shadow-lg dark:shadow-2xl transition-all duration-700 hover:scale-[1.03] hover:border-blue-500/40 hover:shadow-blue-500/10 active:scale-[0.98] animate-in zoom-in-95"
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/[0.02] dark:from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                    <div className="text-[10px] font-black text-blue-500 tracking-[0.2em] uppercase opacity-70">
                        Team {String(team.team_number).padStart(2, '0')}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tighter group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                        {team.proposed_project || team.name}
                    </h3>
                    {team.proposed_project && (
                        <div className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest">
                            {team.name}
                        </div>
                    )}
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-md ${
                    team.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5' :
                    team.status === 'completed' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-blue-500/5' :
                    'bg-slate-800/40 border-white/5 text-slate-500'
                }`}>
                    {team.status}
                </div>
            </div>

            {/* Info Metrics */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                {team.adviser_name && (
                    <div className="flex items-center gap-4 bg-gray-100/50 dark:bg-slate-950/40 p-3 rounded-2xl border border-gray-200 dark:border-slate-700/50 group/metric">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Award className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest">Adviser</span>
                            <span className="text-[11px] text-gray-700 dark:text-slate-200 font-bold uppercase">{team.adviser_name}</span>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-4 bg-gray-100/50 dark:bg-slate-950/40 p-3 rounded-2xl border border-gray-200 dark:border-slate-700/50">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest">Team Members</span>
                        <span className="text-[11px] text-gray-700 dark:text-slate-200 font-bold uppercase">{team.member_count} Members</span>
                    </div>
                </div>
            </div>

            {/* Progress Engine */}
            <div className="bg-gray-100/50 dark:bg-slate-950/40 rounded-[2.5rem] p-5 border border-gray-200 dark:border-slate-700/50">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-slate-500" />
                        <span className="text-[9px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-[0.2em]">Progress</span>
                    </div>
                    <span className={`text-xs font-black tracking-tighter ${progressTextColor}`}>
                        {progress}%
                    </span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-slate-950 rounded-full overflow-hidden shadow-inner border border-gray-300 dark:border-white/5 relative">
                    <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(0,0,0,0.5)] ${progressColor}`}
                        style={{ width: `${progress}%` }} 
                    />
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[9px] font-black text-gray-500 dark:text-slate-600 uppercase tracking-widest">
                        {team.completed_checkpoints}/{team.total_checkpoints} Checkpoints
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-800 animate-pulse" />
                </div>
            </div>
        </div>
    )
}
