"use client"

import { CheckCircle2, Circle, Clock, TrendingUp } from "lucide-react"

interface Checkpoint {
    id: string
    title: string
    description: string | null
    status: string
    due_date: string | null
    completed_at: string | null
    member_name: string | null
    member_id: string | null
}

interface Member {
    id: string
    name: string
    member_number: number
    is_leader: boolean
}

interface TeamProgressChartsProps {
    checkpoints: Checkpoint[]
    members: Member[]
}

export default function TeamProgressCharts({ checkpoints, members }: TeamProgressChartsProps) {
    // Overall stats
    const totalCheckpoints = checkpoints.length
    const completedCheckpoints = checkpoints.filter(c => c.status === 'completed').length
    const inProgressCheckpoints = checkpoints.filter(c => c.status === 'in_progress').length
    const pendingCheckpoints = checkpoints.filter(c => c.status === 'pending').length
    const overallProgress = totalCheckpoints > 0 ? Math.round((completedCheckpoints / totalCheckpoints) * 100) : 0

    // Per-member progress
    const memberProgress = members.map(member => {
        const memberCheckpoints = checkpoints.filter(c => c.member_id === member.id)
        const completed = memberCheckpoints.filter(c => c.status === 'completed').length
        const total = memberCheckpoints.length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { ...member, completed, total, progress }
    })

    // Team-level checkpoints (no specific member)
    const teamLevelCheckpoints = checkpoints.filter(c => !c.member_id)

    const getProgressColor = (pct: number) => {
        if (pct >= 75) return '#16a34a'
        if (pct >= 40) return '#d97706'
        return '#dc2626'
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Overall Progress Ring */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center shadow-sm">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
                    Team Progress
                </div>

                {/* Circular progress indicator */}
                <div className="relative w-[120px] h-[120px] mx-auto mb-4">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="10" />
                        <circle
                            cx="60" cy="60" r="50"
                            fill="none"
                            stroke={getProgressColor(overallProgress)}
                            strokeWidth="10"
                            strokeDasharray={`${overallProgress * 3.14} ${314 - overallProgress * 3.14}`}
                            strokeDashoffset="78.5"
                            strokeLinecap="round"
                            className="transition-[stroke-dasharray] duration-1000 ease-in-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[28px] font-extrabold" style={{ color: getProgressColor(overallProgress) }}>
                            {overallProgress}%
                        </span>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex justify-center gap-6">
                    <div className="text-center">
                        <div className="text-xl font-bold text-green-600 dark:text-green-500">{completedCheckpoints}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">Done</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-amber-600 dark:text-amber-500">{inProgressCheckpoints}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">In Progress</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-slate-400 dark:text-slate-500">{pendingCheckpoints}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">Pending</div>
                    </div>
                </div>
            </div>

            {/* Member progress bars */}
            {memberProgress.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                    <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
                        Individual Progress
                    </div>
                    <div className="flex flex-col gap-4">
                        {memberProgress.map(member => (
                            <div key={member.id}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, hsl(${member.member_number * 60}, 70%, 50%), hsl(${member.member_number * 60 + 30}, 70%, 40%))`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: '#fff',
                                        }}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                                            {member.name}
                                            {member.is_leader && (
                                                <span className="text-[10px] text-indigo-500 dark:text-indigo-400 ml-1.5">★ Leader</span>
                                            )}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold" style={{ color: getProgressColor(member.progress) }}>
                                        {member.progress}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                        style={{
                                            width: `${member.progress}%`,
                                            background: `linear-gradient(90deg, ${getProgressColor(member.progress)}, ${getProgressColor(member.progress)}cc)`,
                                        }} 
                                    />
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                    {member.completed}/{member.total} checkpoints
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Checkpoint list */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
                    Checkpoints
                </div>
                {checkpoints.length === 0 ? (
                    <div className="text-[13px] text-slate-400 dark:text-slate-500 text-center p-5">
                        No checkpoints yet
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {checkpoints.map(cp => (
                            <div key={cp.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                                cp.status === 'completed' ? 'bg-green-500/5 dark:bg-green-500/10' : 'bg-transparent'
                            }`}>
                                {cp.status === 'completed' ? (
                                    <CheckCircle2 size={16} className="text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                                ) : cp.status === 'in_progress' ? (
                                    <Clock size={16} className="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                                ) : (
                                    <Circle size={16} className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0" />
                                )}
                                <div className="flex-1">
                                    <div className={`text-[13px] font-medium ${
                                        cp.status === 'completed' ? 'text-green-600 dark:text-green-500 line-through' : 'text-slate-700 dark:text-slate-200'
                                    }`}>
                                        {cp.title}
                                    </div>
                                    {cp.member_name && (
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            Assigned to: {cp.member_name}
                                        </div>
                                    )}
                                    {cp.due_date && (
                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            Due: {new Date(cp.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
