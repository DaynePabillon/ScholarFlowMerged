"use client"

import { useState } from "react"
import { FolderKanban, ChevronDown, ChevronRight, User, Calendar, Plus, Trash2, UserPlus } from "lucide-react"

interface Task {
    id: string
    title: string
    description: string
    status: 'todo' | 'in-progress' | 'review' | 'done' | 'archived'
    priority: 'low' | 'medium' | 'high'
    assigned_to: string | null
    assigned_to_name?: string
    due_date: string | null
    created_at: string
    project_id: string | null
    project_name?: string
}

interface Project {
    id: string
    name: string
    description?: string
    status: string
    task_count?: number
}

interface TeamMember {
    id: string
    name: string
    email: string
    role: string
}

interface ProjectBoardViewProps {
    tasks: Task[]
    projects: Project[]
    members: TeamMember[]
    onAssignMember: (taskId: string, memberId: string | null) => void
    onStatusChange: (taskId: string, status: Task['status']) => void
    onDeleteTask: (taskId: string) => void
    onAddTask: (projectId: string) => void
    userRole: string
}

export default function ProjectBoardView({
    tasks,
    projects,
    members,
    onAssignMember,
    onStatusChange,
    onDeleteTask,
    onAddTask,
    userRole
}: ProjectBoardViewProps) {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(projects.map(p => p.id)))
    const [assigningTask, setAssigningTask] = useState<string | null>(null)

    const canAssign = userRole === 'admin' || userRole === 'manager'

    const toggleProject = (projectId: string) => {
        setExpandedProjects(prev => {
            const next = new Set(prev)
            if (next.has(projectId)) {
                next.delete(projectId)
            } else {
                next.add(projectId)
            }
            return next
        })
    }

    const getTasksByProject = (projectId: string) => {
        return tasks.filter(task => task.project_id === projectId)
    }

    const getPriorityColor = (priority: string) => {
        const colors = {
            high: 'bg-red-100 text-red-700 border-red-200',
            medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            low: 'bg-green-100 text-green-700 border-green-200'
        }
        return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-700'
    }

    const getStatusColor = (status: string) => {
        const colors = {
            'todo': 'bg-gray-100 text-gray-700',
            'in-progress': 'bg-blue-100 text-blue-700',
            'review': 'bg-purple-100 text-purple-700',
            'done': 'bg-green-100 text-green-700',
            'archived': 'bg-gray-200 text-gray-500'
        }
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'
    }

    // Group unassigned tasks (tasks with no project or project not in list)
    const unassignedTasks = tasks.filter(task =>
        !task.project_id || !projects.find(p => p.id === task.project_id)
    )

    return (
        <div className="space-y-6">
            {/* Projects with their tasks */}
            {projects.map((project) => {
                const projectTasks = getTasksByProject(project.id)
                const isExpanded = expandedProjects.has(project.id)

                return (
                    <div
                        key={project.id}
                        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden"
                    >
                        {/* Project Header */}
                        <button
                            onClick={() => toggleProject(project.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-500" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-500" />
                                )}
                                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                                    <FolderKanban className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold text-gray-800">{project.name}</h3>
                                    <p className="text-xs text-gray-500">{projectTasks.length} tasks</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full ${project.status === 'active' ? 'bg-green-100 text-green-700' :
                                        project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                            project.status === 'on-hold' ? 'bg-orange-100 text-orange-700' :
                                                'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {project.status}
                                </span>
                            </div>
                        </button>

                        {/* Tasks List */}
                        {isExpanded && (
                            <div className="border-t border-gray-100">
                                {projectTasks.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        <p className="text-sm">No tasks in this project yet</p>
                                        {canAssign && (
                                            <button
                                                onClick={() => onAddTask(project.id)}
                                                className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add a task
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {projectTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                className="p-4 hover:bg-gray-50/50 transition-colors group"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                                                                {task.priority}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                                                                {task.status.replace('-', ' ')}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-medium text-gray-800 truncate">{task.title}</h4>
                                                        {task.description && (
                                                            <p className="text-sm text-gray-500 truncate mt-0.5">{task.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            {task.due_date && (
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(task.due_date).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Assignee section */}
                                                    <div className="flex items-center gap-2">
                                                        {assigningTask === task.id ? (
                                                            <select
                                                                autoFocus
                                                                value={task.assigned_to || ''}
                                                                onChange={(e) => {
                                                                    onAssignMember(task.id, e.target.value || null)
                                                                    setAssigningTask(null)
                                                                }}
                                                                onBlur={() => setAssigningTask(null)}
                                                                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {members.map((member) => (
                                                                    <option key={member.id} value={member.id}>{member.name}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <button
                                                                onClick={() => canAssign && setAssigningTask(task.id)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${task.assigned_to_name
                                                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'
                                                                    } ${canAssign ? 'cursor-pointer hover:bg-blue-100' : 'cursor-default'}`}
                                                                disabled={!canAssign}
                                                            >
                                                                {task.assigned_to_name ? (
                                                                    <>
                                                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                                                            {task.assigned_to_name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <span className="text-sm">{task.assigned_to_name}</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserPlus className="w-4 h-4" />
                                                                        <span className="text-sm">Assign</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}

                                                        {/* Delete button */}
                                                        {canAssign && (
                                                            <button
                                                                onClick={() => onDeleteTask(task.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add task button at the bottom */}
                                        {canAssign && (
                                            <button
                                                onClick={() => onAddTask(project.id)}
                                                className="w-full p-3 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add task to {project.name}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Unassigned tasks section */}
            {unassignedTasks.length > 0 && (
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-500 rounded-lg">
                                <FolderKanban className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">General Tasks</h3>
                                <p className="text-xs text-gray-500">{unassignedTasks.length} tasks without a project</p>
                            </div>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {unassignedTasks.map((task) => (
                            <div key={task.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                                                {task.status.replace('-', ' ')}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-gray-800">{task.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {assigningTask === task.id ? (
                                            <select
                                                autoFocus
                                                value={task.assigned_to || ''}
                                                onChange={(e) => {
                                                    onAssignMember(task.id, e.target.value || null)
                                                    setAssigningTask(null)
                                                }}
                                                onBlur={() => setAssigningTask(null)}
                                                className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                                            >
                                                <option value="">Unassigned</option>
                                                {members.map((member) => (
                                                    <option key={member.id} value={member.id}>{member.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <button
                                                onClick={() => canAssign && setAssigningTask(task.id)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${task.assigned_to_name
                                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                        : 'bg-gray-50 border-gray-200 text-gray-500'
                                                    } ${canAssign ? 'cursor-pointer hover:bg-blue-100' : 'cursor-default'}`}
                                                disabled={!canAssign}
                                            >
                                                {task.assigned_to_name ? (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                                            {task.assigned_to_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm">{task.assigned_to_name}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-4 h-4" />
                                                        <span className="text-sm">Assign</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {canAssign && (
                                            <button
                                                onClick={() => onDeleteTask(task.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {projects.length === 0 && tasks.length === 0 && (
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-12 text-center border border-white/40 shadow-lg">
                    <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">No projects yet</h3>
                    <p className="text-gray-600">Create a project first, then add tasks to it</p>
                </div>
            )}
        </div>
    )
}
