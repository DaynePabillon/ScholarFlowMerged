"use client"

import { CheckCircle2, Clock, AlertCircle, TrendingUp, Users, FolderKanban, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Task {
    id: string
    status: string
    priority: string
    due_date?: string
}

interface Project {
    id: string
    name: string
    status: string
}

interface ProfessionalDashboardProps {
    tasks: Task[]
    projects: Project[]
    organizationName?: string
    userName?: string
}

export default function ProfessionalDashboard({ tasks, projects, organizationName, userName }: ProfessionalDashboardProps) {
    // Calculate metrics
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed').length
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length
    const overdueTasks = tasks.filter(t => {
        if (!t.due_date || t.status === 'done' || t.status === 'completed') return false
        return new Date(t.due_date) < new Date()
    }).length

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    const activeProjects = projects.filter(p => p.status === 'active').length

    const metrics = [
        {
            label: 'Tasks Completed',
            value: completedTasks,
            total: totalTasks,
            icon: CheckCircle2,
            color: 'bg-emerald-500',
            bgColor: 'bg-emerald-50/50 dark:bg-emerald-500/10',
            borderColor: 'border-emerald-100 dark:border-emerald-500/20',
            textColor: 'text-emerald-700 dark:text-emerald-400',
            trend: '+12%',
            trendUp: true
        },
        {
            label: 'In Progress',
            value: inProgressTasks,
            icon: Clock,
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50/50 dark:bg-blue-500/10',
            borderColor: 'border-blue-100 dark:border-blue-500/20',
            textColor: 'text-blue-700 dark:text-blue-400',
            trend: '+5%',
            trendUp: true
        },
        {
            label: 'Overdue',
            value: overdueTasks,
            icon: AlertCircle,
            color: 'bg-rose-500',
            bgColor: 'bg-rose-50/50 dark:bg-rose-500/10',
            borderColor: 'border-rose-100 dark:border-rose-500/20',
            textColor: 'text-rose-700 dark:text-rose-400',
            trend: '-3%',
            trendUp: false
        },
        {
            label: 'Active Projects',
            value: activeProjects,
            total: projects.length,
            icon: FolderKanban,
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50/50 dark:bg-purple-500/10',
            borderColor: 'border-purple-100 dark:border-purple-500/20',
            textColor: 'text-purple-700 dark:text-purple-400',
        }
    ]

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Welcome Header */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700 p-8 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            Welcome back{userName ? `, ${userName.split(' ')[0]}` : ''}!
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 mt-2 font-medium">
                            Here's what's happening with your projects today.
                        </p>
                    </div>
                    {organizationName && (
                        <div className="px-4 py-2 bg-gray-100 dark:bg-slate-700/50 rounded-xl border border-transparent dark:border-slate-600">
                            <span className="text-sm font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">{organizationName}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric, index) => (
                    <div key={index} className={`${metric.bgColor} ${metric.borderColor} backdrop-blur-sm rounded-2xl p-6 border transition-all hover:scale-[1.02] duration-300`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2.5 ${metric.color} rounded-xl shadow-lg shadow-black/5`}>
                                <metric.icon className="w-5 h-5 text-white" />
                            </div>
                            {metric.trend && (
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${metric.trendUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                    {metric.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {metric.trend}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">
                                {metric.value}
                                {metric.total !== undefined && (
                                    <span className="text-sm font-bold text-gray-400 dark:text-slate-500">/{metric.total}</span>
                                )}
                            </p>
                            <p className={`text-xs font-black uppercase tracking-widest ${metric.textColor}`}>{metric.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Completion Progress */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-700 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Overall Progress</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Aggregated completion rate across all active tasks</p>
                    </div>
                    <span className="text-4xl font-black text-blue-600 dark:text-blue-400 italic tracking-tighter">{completionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-900/50 rounded-full h-4 p-1 border border-gray-200 dark:border-slate-700">
                    <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                        style={{ width: `${completionRate}%` }}
                    />
                </div>
                <div className="flex justify-between mt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{completedTasks} completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{totalTasks - completedTasks} remaining</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700 p-6 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-2xl group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">Productivity</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Daily completion rate</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700 p-6 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-2xl group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">Team Activity</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Current collaboration level</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700 p-6 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-2xl group-hover:scale-110 transition-transform">
                            <FolderKanban className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">Project Status</h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Active project lifecycle</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
