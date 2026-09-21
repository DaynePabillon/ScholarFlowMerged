"use client"

import { useState, useMemo } from 'react'
import { 
    Plus, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'
import ProfessionalTaskCard from './ProfessionalTaskCard'

interface Task {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    due_date?: string
    project_name?: string
    team_name?: string
    assigned_to?: string | null
    assigned_to_name?: string
    comment_count?: number
    wbs_code?: string
    parent_task_id?: string | null
    is_absolute?: boolean
    progress_percent?: number
}

interface ProfessionalKanbanProps {
    tasks: Task[]
    onTaskClick?: (task: Task) => void
    onStatusChange?: (taskId: string, newStatus: string) => void
    onAddTask?: (status: string) => void
    onDeleteTask?: (taskId: string) => void
    onArchiveTask?: (taskId: string) => void
    onProgressChange?: (taskId: string, progress: number) => void
    onDependency?: (task: Task) => void
    canDrag?: boolean
    role?: 'admin' | 'student' | 'manager'
    theme?: string
}

const COLUMNS = [
    { id: 'todo', title: 'To Do', color: 'text-gray-500' },
    { id: 'in_progress', title: 'In Progress', color: 'text-blue-500' },
    { id: 'review', title: 'Review', color: 'text-indigo-500' },
    { id: 'done', title: 'Completed', color: 'text-emerald-500' }
]

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low']
const PRIORITY_STYLES: any = {
    critical: { label: 'Critical', bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20', iconColor: 'text-rose-500' },
    high: { label: 'High Priority', bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', iconColor: 'text-orange-500' },
    medium: { label: 'Medium Priority', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', iconColor: 'text-blue-500' },
    low: { label: 'Low Priority', bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/20', iconColor: 'text-slate-500' }
}

export default function ProfessionalKanban({
    tasks,
    onTaskClick,
    onStatusChange,
    onAddTask,
    onDeleteTask,
    onArchiveTask,
    onProgressChange,
    onDependency,
    canDrag = true,
    role = 'student'
}: ProfessionalKanbanProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
    const [overColumnId, setOverColumnId] = useState<string | null>(null)
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
    }

    // Group by Priority -> tasks (flat, no assignee sub-grouping)
    const groupedData = useMemo(() => {
        const priorityGroups: any = {}

        PRIORITY_ORDER.forEach(p => {
            priorityGroups[p] = { priority: p, tasks: [] as any[] }
        })

        tasks.forEach(task => {
            const p = task.priority?.toLowerCase() || 'medium'
            const priorityKey = PRIORITY_ORDER.includes(p) ? p : 'medium'
            priorityGroups[priorityKey].tasks.push(task)
        })

        return priorityGroups
    }, [tasks])

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        if (!canDrag) return
        setDraggedTaskId(taskId)
        e.dataTransfer.setData('taskId', taskId)
        e.dataTransfer.effectAllowed = 'move'
        
        const target = e.target as HTMLElement
        target.style.opacity = '0.4'
    }

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedTaskId(null)
        setOverColumnId(null)
        const target = e.target as HTMLElement
        target.style.opacity = '1'
    }

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        if (!canDrag) return
        e.preventDefault()
        setOverColumnId(colId)
    }

    const handleDrop = (e: React.DragEvent, colId: string) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId && onStatusChange) {
            onStatusChange(taskId, colId)
        }
        setOverColumnId(null)
        setDraggedTaskId(null)
    }

    return (
        <div className="w-full space-y-12">
            {PRIORITY_ORDER.map(priority => {
                const group = groupedData[priority]
                if (group.tasks.length === 0) return null

                const isPriorityCollapsed = collapsedSections[`p-${priority}`]
                const style = PRIORITY_STYLES[priority]

                return (
                    <div key={priority} className="space-y-4">
                        {/* Priority Swimlane Header */}
                        <div
                            onClick={() => toggleSection(`p-${priority}`)}
                            className={`flex items-center justify-between p-4 rounded-3xl border-2 ${style.border} ${style.bg} cursor-pointer group hover:shadow-lg transition-all duration-300`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 shadow-sm ${style.iconColor}`}>
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className={`text-sm font-black uppercase tracking-widest ${style.text}`}>
                                        {style.label}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight opacity-70">
                                        {group.tasks.length} Total Tasks
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {isPriorityCollapsed ? <ChevronDown className="w-5 h-5 opacity-40" /> : <ChevronUp className="w-5 h-5 opacity-40" />}
                            </div>
                        </div>

                        {!isPriorityCollapsed && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                                {COLUMNS.map(column => {
                                    const columnTasks = group.tasks.filter((t: any) => {
                                        const s = t.status?.toLowerCase().replace('-', '_')
                                        return s === column.id
                                    })
                                    const isOver = overColumnId === `${priority}-${column.id}`

                                    return (
                                        <div
                                            key={column.id}
                                            onDragOver={(e) => handleDragOver(e, `${priority}-${column.id}`)}
                                            onDragLeave={() => setOverColumnId(null)}
                                            onDrop={(e) => handleDrop(e, column.id)}
                                            className={`flex flex-col gap-4 p-4 rounded-3xl border-2 transition-all duration-300 ${
                                                isOver
                                                    ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-500/30 shadow-inner'
                                                    : 'bg-transparent border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between px-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${column.color} opacity-60`}>
                                                    {column.title}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {columnTasks.length}
                                                </span>
                                            </div>

                                            <div className="space-y-4">
                                                {columnTasks.map((task: any) => (
                                                    <div
                                                        key={task.id}
                                                        draggable={canDrag}
                                                        onDragStart={(e) => handleDragStart(e, task.id)}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        <ProfessionalTaskCard
                                                            task={task}
                                                            onClick={() => onTaskClick?.(task)}
                                                            onArchive={onArchiveTask}
                                                            onDelete={onDeleteTask}
                                                            onDependency={onDependency ? () => onDependency(task) : undefined}
                                                            role={role}
                                                        />
                                                    </div>
                                                ))}
                                                {columnTasks.length === 0 && (
                                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl opacity-30">
                                                        <Plus className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
