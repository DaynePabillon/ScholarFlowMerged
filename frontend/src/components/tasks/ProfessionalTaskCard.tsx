"use client"
import { useState, memo } from 'react'

import { Clock, CheckCircle2, AlertCircle, User, Calendar, Flag, Trash2, Archive, MessageSquare, Lock } from 'lucide-react'

interface Task {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    due_date?: string
    project_name?: string
    assigned_to_name?: string
    comment_count?: number
    is_absolute?: boolean
    wbs_code?: string
    progress_percent?: number
}

interface ProfessionalTaskCardProps {
    task: Task
    onClick?: () => void
    onStatusChange?: (taskId: string, status: string) => void
    onDelete?: (taskId: string) => void
    onArchive?: (taskId: string) => void
    onProgressChange?: (taskId: string, progress: number) => void
    role?: 'admin' | 'student' | 'manager'
}

const ProfessionalTaskCard = memo(({ 
    task, 
    onClick, 
    onStatusChange, 
    onDelete, 
    onArchive,
    onProgressChange,
    role = 'student'
}: ProfessionalTaskCardProps) => {
    const isAdmin = role === 'admin' || role === 'manager';
    const [localProgress, setLocalProgress] = useState(task.progress_percent || 0);

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30'
            case 'high': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30'
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30'
            case 'low': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30'
            default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done':
            case 'completed': return 'bg-green-500'
            case 'in_progress':
            case 'in-progress': return 'bg-blue-500'
            case 'review': return 'bg-purple-500'
            case 'blocked': return 'bg-red-500'
            default: return 'bg-gray-400'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'todo': return 'To Do'
            case 'in_progress':
            case 'in-progress': return 'In Progress'
            case 'review': return 'Review'
            case 'done':
            case 'completed': return 'Done'
            case 'blocked': return 'Blocked'
            default: return status
        }
    }

    const getWbsColor = (wbs?: string) => {
        if (!wbs) return 'text-gray-400 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 border-gray-100 dark:border-slate-600 font-bold'
        const level = wbs.split('.').length
        switch (level) {
            case 1: return 'text-white bg-slate-700 dark:bg-slate-600 border-slate-800 dark:border-slate-500 font-extrabold' // Module
            case 2: return 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 font-bold' // Transaction
            case 3: return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-600 font-medium' // Task
            default: return 'text-gray-400 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 border-gray-100 dark:border-slate-600 font-normal' // Subtask
        }
    }

    const formatDate = (date: string) => {
        const d = new Date(date)
        const now = new Date()
        const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true }
        if (diffDays === 0) return { text: 'Due today', isOverdue: false }
        if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false }
        return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false }
    }

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newVal = parseInt(e.target.value);
        setLocalProgress(newVal);
        onProgressChange?.(task.id, newVal);
    };

    const dueInfo = task.due_date ? formatDate(task.due_date) : null

    return (
        <div
            onClick={onClick}
            className="group relative bg-white/95 dark:bg-slate-900/60 backdrop-blur-md rounded-[2rem] border border-gray-100 dark:border-slate-700/50 p-6 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/40 transition-all duration-500 cursor-grab overflow-hidden group/card active:cursor-grabbing"
        >
            {/* Glossy Overlay Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/[0.02] dark:from-white/[0.05] to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Quick Actions (Hover) - Restricted to Admin/Manager */}
            {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover/card:opacity-100 transition-all translate-x-4 group-hover/card:translate-x-0 duration-500">
                    {onArchive && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onArchive(task.id); }}
                            className="p-2.5 bg-white/90 dark:bg-slate-900/80 hover:bg-emerald-500 rounded-xl shadow-xl transition-all border border-gray-200 dark:border-white/10 group/btn"
                            title="Archive"
                        >
                            <Archive className="w-4 h-4 text-white group-hover/btn:scale-110 transition-transform" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                            className="p-2.5 bg-white/90 dark:bg-slate-900/80 hover:bg-rose-500 rounded-xl shadow-xl transition-all border border-gray-200 dark:border-white/10 group/btn"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4 text-white group-hover/btn:scale-110 transition-transform" />
                        </button>
                    )}
                </div>
            )}
            
            {/* Header / Category */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {task.wbs_code && (
                        <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1 rounded-full border shadow-inner ${getWbsColor(task.wbs_code)}`}>
                            {task.wbs_code}
                        </span>
                    )}
                    {task.is_absolute && (
                        <div className="p-1 bg-amber-500/10 rounded-lg" title="Immutable Sync">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                    )}
                </div>
                <div className={`w-3 h-3 rounded-full shadow-sm ring-4 ring-gray-100 dark:ring-black/20 ${getStatusColor(task.status)}`} />
            </div>

            {/* Title */}
            <h3 className="text-sm font-black text-gray-900 dark:text-slate-100 group-hover/card:text-emerald-600 dark:group-hover/card:text-emerald-400 transition-colors uppercase leading-tight tracking-tight mb-3 line-clamp-2">
                {task.title}
            </h3>

            {/* Description preview */}
            {task.description && (
                <p className="text-xs text-gray-500 dark:text-slate-400/80 mb-6 line-clamp-2 leading-relaxed font-medium italic">
                    {task.description}
                </p>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className={`flex flex-col gap-1 p-3 rounded-2xl border ${getPriorityColor(task.priority)}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Priority</span>
                    <span className="text-[10px] font-bold uppercase">{task.priority}</span>
                </div>

                {dueInfo && (
                    <div className={`flex flex-col gap-1 p-3 rounded-2xl border ${dueInfo.isOverdue ? 'border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400' : 'border-gray-200 dark:border-white/5 text-gray-500 dark:text-slate-400'}`}>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Timeline</span>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <Calendar className="w-3 h-3" />
                            {dueInfo.text}
                        </div>
                    </div>
                )}
            </div>

            {/* Interactive Progress Segment */}
            <div className="bg-gray-50 dark:bg-black/20 rounded-3xl p-4 border border-gray-200 dark:border-white/5 group/progress">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-3">
                    <span className="text-gray-500 dark:text-slate-500">Progress</span>
                    <span className={localProgress === 100 ? 'text-emerald-400' : 'text-blue-400'}>{localProgress}%</span>
                </div>
                <div className="relative h-2.5 w-full bg-gray-200 dark:bg-slate-950 rounded-full overflow-hidden shadow-inner border border-gray-300 dark:border-white/5">
                    <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                            localProgress === 100 
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-400' 
                                : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                        }`}
                        style={{ width: `${localProgress}%` }}
                    />
                    {/* Progress slider overlay — only intercepts double-click so it
                        doesn't block the parent card's HTML5 drag on single-click */}
                    <input 
                        type="range"
                        min="0"
                        max="100"
                        value={localProgress}
                        onChange={handleProgressChange}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => e.preventDefault()}
                        draggable={false}
                        className="absolute inset-0 opacity-0 cursor-pointer accent-emerald-500 pointer-events-none group-hover/progress:pointer-events-auto"
                        title="Hover and slide to update task weight"
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                {/* Assignee */}
                {task.assigned_to_name ? (
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-[10px] font-black shadow-md shadow-emerald-500/20 rotate-3 group-hover/card:rotate-0 transition-transform">
                            {task.assigned_to_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight text-gray-500 dark:text-slate-400 group-hover/card:text-gray-900 dark:group-hover/card:text-white transition-colors">
                            {task.assigned_to_name.split(' ')[0]}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-gray-400 dark:text-slate-600">
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic opacity-50">Unassigned</span>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {(task.comment_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-black">{task.comment_count}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
});

export default ProfessionalTaskCard;
