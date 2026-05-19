"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { Search, Plus, MoreHorizontal, User, Clock, CheckCircle2, AlertCircle, Trash2, BarChart3 } from 'lucide-react'
import ChartWidgetPicker from '@/components/widgets/ChartWidgetPicker'
import ChartWidget from '@/components/widgets/ChartWidget'
import Portal from '@/components/ui/Portal'

interface Task {
    id: string
    title: string
    description: string
    status: string
    priority: string
    assigned_to: string | null
    assigned_to_name?: string
    due_date: string | null
    project_name?: string
}

interface TeamMember {
    id: string
    name: string
    email: string
    role: string
}

interface ProfessionalTeamBoardProps {
    tasks: Task[]
    members: TeamMember[]
    onAssignMember: (taskId: string, memberId: string | null) => void
    onStatusChange: (taskId: string, status: string) => void
    onDeleteTask: (taskId: string) => void
    onAddTask: () => void
    organizationName: string
    organizationId?: string
}

interface Widget {
    id: string
    widget_type: string
    title: string
}

const statusOptions = [
    { id: 'todo', label: 'To Do', color: 'bg-gray-400' },
    { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
    { id: 'review', label: 'Review', color: 'bg-purple-500' },
    { id: 'done', label: 'Done', color: 'bg-green-500' }
]

export default function ProfessionalTeamBoard({
    tasks,
    members,
    onAssignMember,
    onStatusChange,
    onDeleteTask,
    onAddTask,
    organizationName,
    organizationId
}: ProfessionalTeamBoardProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [widgets, setWidgets] = useState<Widget[]>([])
    const [showWidgetPicker, setShowWidgetPicker] = useState(false)

    // Fetch widgets on mount
    useEffect(() => {
        if (organizationId) {
            fetchWidgets()
        }
    }, [organizationId])

    const fetchWidgets = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/organizations/${organizationId}/widgets`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )
            if (response.ok) {
                const data = await response.json()
                setWidgets(data.widgets || [])
            }
        } catch (error) {
            console.error('Error fetching widgets:', error)
        }
    }

    const handleAddWidget = async (widgetType: string, title: string) => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/organizations/${organizationId}/widgets`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ widget_type: widgetType, title })
                }
            )
            if (response.ok) {
                fetchWidgets()
            }
        } catch (error) {
            console.error('Error adding widget:', error)
        }
    }

    const handleRemoveWidget = async (widgetId: string) => {
        try {
            const token = localStorage.getItem('token')
            await fetch(
                `${API_URL}/api/widgets/${widgetId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )
            fetchWidgets()
        } catch (error) {
            console.error('Error removing widget:', error)
        }
    }

    const filteredTasks = tasks.filter(task => {
        if (task.status === 'archived') return false
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = filterStatus === 'all' || task.status.replace('-', '_') === filterStatus
        return matchesSearch && matchesStatus
    })

    const getStatusColor = (status: string) => {
        const normalizedStatus = status.replace('-', '_')
        return statusOptions.find(s => s.id === normalizedStatus)?.color || 'bg-gray-400'
    }

    const getStatusLabel = (status: string) => {
        const normalizedStatus = status.replace('-', '_')
        return statusOptions.find(s => s.id === normalizedStatus)?.label || status
    }

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high': return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">High</span>
            case 'medium': return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Medium</span>
            case 'low': return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Low</span>
            default: return null
        }
    }

    const formatDate = (date: string | null) => {
        if (!date) return '—'
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-white font-bold text-lg tracking-wide">TEAM ASSIGNMENTS</h2>
                        <span className="text-blue-100 text-sm">{organizationName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 w-48"
                            />
                        </div>
                        {/* Filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                        >
                            <option value="all" className="text-gray-800">All Status</option>
                            {statusOptions.map(status => (
                                <option key={status.id} value={status.id} className="text-gray-800">{status.label}</option>
                            ))}
                        </select>
                        {/* Add Button */}
                        <button
                            onClick={onAddTask}
                            className="flex items-center gap-2 px-4 py-1.5 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-4">Task</div>
                <div className="col-span-2">Assignee</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Priority</div>
                <div className="col-span-2">Due Date</div>
                <div className="col-span-1"></div>
            </div>

            {/* Tasks List */}
            <div className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-400">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No tasks found</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/50 transition-colors items-center">
                            {/* Task Info */}
                            <div className="col-span-4">
                                <div className="font-medium text-gray-800">{task.title}</div>
                                {task.project_name && (
                                    <div className="text-xs text-gray-400 mt-0.5">{task.project_name}</div>
                                )}
                            </div>

                            {/* Assignee */}
                            <div className="col-span-2">
                                <select
                                    value={task.assigned_to || ''}
                                    onChange={(e) => onAssignMember(task.id, e.target.value || null)}
                                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="">Unassigned</option>
                                    {members.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status */}
                            <div className="col-span-2">
                                <select
                                    value={task.status.replace('-', '_')}
                                    onChange={(e) => onStatusChange(task.id, e.target.value)}
                                    className={`px-3 py-1 text-sm rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ${getStatusColor(task.status)}`}
                                >
                                    {statusOptions.map(status => (
                                        <option key={status.id} value={status.id} className="text-gray-800">{status.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority */}
                            <div className="col-span-1">
                                {getPriorityBadge(task.priority)}
                            </div>

                            {/* Due Date */}
                            <div className="col-span-2 text-sm text-gray-500">
                                {task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done' ? (
                                    <span className="flex items-center gap-1 text-red-500">
                                        <AlertCircle className="w-4 h-4" />
                                        Overdue
                                    </span>
                                ) : (
                                    formatDate(task.due_date)
                                )}
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex justify-end relative">
                                <button
                                    onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {/* Dropdown Menu */}
                                {openMenuId === task.id && (
                                    <div className="absolute right-0 top-8 z-50 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                        <button
                                            onClick={() => {
                                                onDeleteTask(task.id)
                                                setOpenMenuId(null)
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete Task
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{filteredTasks.length} tasks</span>
                    <div className="flex items-center gap-4">
                        {statusOptions.map(status => {
                            const count = filteredTasks.filter(t => t.status.replace('-', '_') === status.id).length
                            return (
                                <span key={status.id} className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${status.color}`} />
                                    {status.label}: {count}
                                </span>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Chart Widgets Area */}
            {organizationId && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" />
                            Dashboard Widgets
                        </h3>
                        <button
                            onClick={() => setShowWidgetPicker(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Widget
                        </button>
                    </div>

                    {widgets.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {widgets.map(widget => (
                                <ChartWidget
                                    key={widget.id}
                                    type={widget.widget_type}
                                    title={widget.title}
                                    tasks={tasks}
                                    members={members}
                                    onRemove={() => handleRemoveWidget(widget.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No widgets yet. Click "Add Widget" to get started.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Widget Picker Modal - using Portal to escape overflow:hidden */}
            <Portal>
                <ChartWidgetPicker
                    isOpen={showWidgetPicker}
                    onClose={() => setShowWidgetPicker(false)}
                    onSelectWidget={handleAddWidget}
                />
            </Portal>
        </div>
    )
}
