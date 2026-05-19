"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Trash2, Clock, User, Users, Calendar, AlertCircle, CheckCircle2, Circle, Loader2, Bell, BellOff } from "lucide-react"
import TaskTimeline from "@/components/tasks/TaskTimeline"
import { useThemeMode } from "@/context/ThemeContext"

interface Assignee {
    user_id: string
    name: string
    email?: string
    profile_picture?: string
}

interface TaskDetails {
    id: string
    title: string
    description: string
    status: string
    priority: string
    due_date: string | null
    created_at: string
    project_name?: string
    assigned_to_name?: string
    created_by_name?: string
    assignees?: Assignee[]
}

export default function TaskDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { isProfessionalMode } = useThemeMode()
    const taskId = params.id as string

    const [task, setTask] = useState<TaskDetails | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [isFollowing, setIsFollowing] = useState(false)
    const [isTogglingFollow, setIsTogglingFollow] = useState(false)

    useEffect(() => {
        fetchTaskDetails()
        fetchCurrentUser()
        fetchFollowStatus()
    }, [taskId])

    const fetchCurrentUser = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setCurrentUserId(data.user?.id)
            }
        } catch (error) {
            console.error('Error fetching current user:', error)
        }
    }

    const fetchTaskDetails = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!response.ok) {
                throw new Error('Task not found')
            }

            const data = await response.json()
            setTask(data)
        } catch (error: any) {
            setError(error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this task?')) return

        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                router.back()
            }
        } catch (error) {
            console.error('Error deleting task:', error)
        }
    }

    const fetchFollowStatus = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/tasks/${taskId}/following`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setIsFollowing(data.following)
            }
        } catch (error) {
            console.error('Error fetching follow status:', error)
        }
    }

    const toggleFollow = async () => {
        setIsTogglingFollow(true)
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(`${API_URL}/api/tasks/${taskId}/follow`, {
                method: isFollowing ? 'DELETE' : 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
                const data = await response.json()
                setIsFollowing(data.following)
            }
        } catch (error) {
            console.error('Error toggling follow:', error)
        } finally {
            setIsTogglingFollow(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'todo': return 'bg-gray-100 text-gray-700 border-gray-300'
            case 'in_progress':
            case 'in-progress': return 'bg-blue-100 text-blue-700 border-blue-300'
            case 'review': return 'bg-purple-100 text-purple-700 border-purple-300'
            case 'completed':
            case 'done': return 'bg-green-100 text-green-700 border-green-300'
            default: return 'bg-gray-100 text-gray-700 border-gray-300'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'todo': return <Circle className="w-4 h-4" />
            case 'in_progress':
            case 'in-progress': return <Loader2 className="w-4 h-4 animate-spin" />
            case 'review': return <AlertCircle className="w-4 h-4" />
            case 'completed':
            case 'done': return <CheckCircle2 className="w-4 h-4" />
            default: return <Circle className="w-4 h-4" />
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
            case 'critical': return 'text-red-600'
            case 'medium': return 'text-yellow-600'
            case 'low': return 'text-green-600'
            default: return 'text-gray-600'
        }
    }

    const getPriorityLabel = (priority: string) => {
        if (isProfessionalMode) {
            switch (priority) {
                case 'high':
                case 'critical': return 'High Priority'
                case 'medium': return 'Medium Priority'
                case 'low': return 'Low Priority'
                default: return priority
            }
        } else {
            switch (priority) {
                case 'high':
                case 'critical': return 'First Class'
                case 'medium': return 'Business'
                case 'low': return 'Economy'
                default: return priority
            }
        }
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'No due date'
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                    <p className="text-gray-500">Loading task details...</p>
                </div>
            </div>
        )
    }

    if (error || !task) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Task Not Found</h2>
                    <p className="text-gray-500 mb-6">{error || "This task doesn't exist or you don't have access."}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back to Tasks</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleFollow}
                                disabled={isTogglingFollow}
                                className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors ${isFollowing
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    } disabled:opacity-50`}
                            >
                                {isFollowing ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium flex items-center gap-2 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Task Details */}
                    <div className="space-y-6">
                        {/* Task Header Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
                                <h1 className="text-2xl font-bold text-white">{task.title}</h1>
                                {task.project_name && (
                                    <p className="text-blue-100 mt-1">{task.project_name}</p>
                                )}
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Status & Priority */}
                                <div className="flex flex-wrap gap-4">
                                    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${getStatusColor(task.status)}`}>
                                        {getStatusIcon(task.status)}
                                        <span className="font-medium">{formatStatus(task.status)}</span>
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 font-medium ${getPriorityColor(task.priority)}`}>
                                        {getPriorityLabel(task.priority)}
                                    </div>
                                </div>

                                {/* Description */}
                                {task.description && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
                                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                                    </div>
                                )}

                                {/* Meta Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    {/* Due Date */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
                                            <p className="text-gray-800 font-medium">{formatDate(task.due_date)}</p>
                                        </div>
                                    </div>

                                    {/* Assigned To */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <Users className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Assignees</p>
                                            {task.assignees && task.assignees.length > 0 ? (
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {task.assignees.map(assignee => (
                                                        <span key={assignee.user_id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                                                            {assignee.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-800 font-medium">Unassigned</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Created By */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Created By</p>
                                            <p className="text-gray-800 font-medium">{task.created_by_name || 'Unknown'}</p>
                                        </div>
                                    </div>

                                    {/* Created At */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <Clock className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
                                            <p className="text-gray-800 font-medium">{formatDate(task.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Timeline */}
                    <div>
                        <TaskTimeline
                            taskId={taskId}
                            currentUserId={currentUserId || undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
