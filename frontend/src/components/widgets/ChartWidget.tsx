"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { X, TrendingUp, Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface Task {
    id: string
    title: string
    status: string
    priority: string
    assigned_to?: string | null
    assigned_to_name?: string | null
    due_date?: string | null
}

interface ChartWidgetProps {
    type: string
    title: string
    tasks: Task[]
    members?: Array<{ id: string; name: string }>
    onRemove?: () => void
}

const COLORS = {
    status: {
        todo: '#94a3b8',
        'in-progress': '#3b82f6',
        'in_progress': '#3b82f6',
        review: '#a855f7',
        done: '#22c55e'
    },
    priority: {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#22c55e'
    }
}

export default function ChartWidget({ type, title, tasks, members = [], onRemove }: ChartWidgetProps) {
    const activeTasks = tasks.filter(t => t.status !== 'archived')

    // Calculate data based on widget type
    const getData = () => {
        switch (type) {
            case 'pie_status': {
                const statusCounts: Record<string, number> = {}
                activeTasks.forEach(t => {
                    const status = t.status || 'todo'
                    statusCounts[status] = (statusCounts[status] || 0) + 1
                })
                return Object.entries(statusCounts).map(([name, value]) => ({
                    name: name.replace('_', ' ').replace('-', ' '),
                    value,
                    color: COLORS.status[name as keyof typeof COLORS.status] || '#94a3b8'
                }))
            }

            case 'pie_priority': {
                const priorityCounts: Record<string, number> = {}
                activeTasks.forEach(t => {
                    const priority = t.priority || 'medium'
                    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1
                })
                return Object.entries(priorityCounts).map(([name, value]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    value,
                    color: COLORS.priority[name as keyof typeof COLORS.priority] || '#94a3b8'
                }))
            }

            case 'bar_assignee': {
                const assigneeCounts: Record<string, number> = {}
                activeTasks.forEach(t => {
                    const assignee = t.assigned_to_name || 'Unassigned'
                    assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1
                })
                return Object.entries(assigneeCounts).map(([name, value]) => ({
                    name: name.length > 12 ? name.substring(0, 12) + '...' : name,
                    tasks: value
                }))
            }

            default:
                return []
        }
    }

    const renderPieChart = (data: any[]) => (
        <ResponsiveContainer width="100%" height={180}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip />
            </PieChart>
        </ResponsiveContainer>
    )

    const renderBarChart = (data: any[]) => (
        <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    )

    const renderNumberSummary = () => {
        const total = activeTasks.length
        const done = activeTasks.filter(t => t.status === 'done').length
        const overdue = activeTasks.filter(t => {
            if (!t.due_date || t.status === 'done') return false
            return new Date(t.due_date) < new Date()
        }).length
        const inProgress = activeTasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length

        return (
            <div className="grid grid-cols-2 gap-3 p-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{total}</div>
                    <div className="text-xs text-blue-500">Total</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{done}</div>
                    <div className="text-xs text-green-500">Done</div>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">{inProgress}</div>
                    <div className="text-xs text-purple-500">In Progress</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{overdue}</div>
                    <div className="text-xs text-red-500">Overdue</div>
                </div>
            </div>
        )
    }

    const renderCompletionRate = () => {
        const total = activeTasks.length
        const done = activeTasks.filter(t => t.status === 'done').length
        const rate = total > 0 ? Math.round((done / total) * 100) : 0

        return (
            <div className="flex flex-col items-center justify-center h-[180px]">
                <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#e5e7eb"
                            strokeWidth="12"
                            fill="none"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="url(#gradient)"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={`${rate * 3.52} 352`}
                            strokeLinecap="round"
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#22c55e" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-gray-800">{rate}%</span>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{done} of {total} completed</p>
            </div>
        )
    }

    const data = getData()

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h4 className="font-medium text-sm text-gray-700">{title}</h4>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Chart Content */}
            <div className="p-2">
                {type === 'pie_status' && renderPieChart(data)}
                {type === 'pie_priority' && renderPieChart(data)}
                {type === 'bar_assignee' && renderBarChart(data)}
                {type === 'bar_workload' && renderBarChart(data)}
                {type === 'number_summary' && renderNumberSummary()}
                {type === 'completion_rate' && renderCompletionRate()}
            </div>
        </div>
    )
}
