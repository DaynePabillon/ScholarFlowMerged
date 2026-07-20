"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { MessageSquare, Send, User, ChevronDown, ChevronUp, Circle, GitCommit, Clock, UserPlus, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'

interface Comment {
    id: string
    user_id: string
    user_name: string
    comment: string
    created_at: string
}

interface Activity {
    id: string
    action: string
    user_name: string
    entity_name?: string
    details?: Record<string, any>
    created_at: string
}

interface TaskInfo {
    id: string
    title: string
    description: string
    status: string
    priority: string
    due_date: string | null
    created_at: string
    creator_name: string
    creator_email: string
    assignee_name: string | null
    assignee_email: string | null
}

interface TaskTimelineProps {
    taskId: string
    currentUserId?: string
    onClose?: () => void
}

export default function TaskTimeline({ taskId, currentUserId, onClose }: TaskTimelineProps) {
    const [task, setTask] = useState<TaskInfo | null>(null)
    const [activities, setActivities] = useState<Activity[]>([])
    const [comments, setComments] = useState<Comment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newComment, setNewComment] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showAllComments, setShowAllComments] = useState(false)
    const MAX_VISIBLE_COMMENTS = 3

    useEffect(() => {
        fetchTaskActivity()
    }, [taskId])

    const fetchTaskActivity = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/tasks/${taskId}/activity`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                setTask(data.task)
                setActivities(data.activities || [])
                setComments(data.comments || [])
            }
        } catch (error) {
            console.error('Error fetching task activity:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/tasks/${taskId}/comments`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ comment: newComment.trim() })
                }
            )

            if (response.ok) {
                setNewComment('')
                fetchTaskActivity()
            }
        } catch (error) {
            console.error('Error adding comment:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteComment = async (commentId: string) => {
        try {
            const token = localStorage.getItem('token')
            await fetch(
                `${API_URL}/api/comments/${commentId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )
            fetchTaskActivity()
        } catch (error) {
            console.error('Error deleting comment:', error)
        }
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'No due date'
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created': return <Circle className="w-3 h-3 text-green-500 fill-green-500" />
            case 'assigned': return <UserPlus className="w-3 h-3 text-blue-500" />
            case 'status_changed': return <CheckCircle2 className="w-3 h-3 text-purple-500" />
            case 'updated': return <GitCommit className="w-3 h-3 text-orange-500" />
            case 'commented': return <MessageSquare className="w-3 h-3 text-cyan-500" />
            default: return <Circle className="w-3 h-3 text-gray-400" />
        }
    }

    const getActionText = (activity: Activity) => {
        switch (activity.action) {
            case 'created': return `created this task`
            case 'assigned': return `assigned to ${activity.details?.assignee_name || 'someone'}`
            case 'status_changed': return `changed status to "${activity.details?.new_status || 'unknown'}"`
            case 'updated': return `updated the task`
            case 'commented': return `commented`
            default: return activity.action
        }
    }

    const visibleComments = showAllComments ? comments : comments.slice(-MAX_VISIBLE_COMMENTS)
    const hiddenCommentsCount = comments.length - MAX_VISIBLE_COMMENTS

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            </div>
        )
    }

    if (!task) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                <p className="text-gray-500 dark:text-gray-400 text-center">Task not found</p>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-500 to-cyan-500">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <GitCommit className="w-5 h-5" />
                    Task Timeline
                </h3>
                <p className="text-blue-100 text-sm mt-1 truncate">{task.title}</p>
            </div>

            {/* Timeline Content */}
            <div className="p-5 max-h-[500px] overflow-y-auto">
                {/* Task Creation Entry - Always shown first */}
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />

                    {/* Creation node */}
                    <div className="relative flex gap-4 pb-4">
                        <div className="relative z-10 w-6 h-6 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                            <Circle className="w-2.5 h-2.5 text-green-500 fill-green-500" />
                        </div>
                        <div className="flex-1 pt-0.5">
                            <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-100 dark:border-green-800/30">
                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                    <span className="font-semibold text-green-700">Task created</span>
                                    <span className="text-gray-600 dark:text-gray-400"> by </span>
                                    <span className="font-medium">{task.creator_name || 'Unknown'}</span>
                                </p>
                                {task.assignee_name && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        <UserPlus className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                                        Assigned to <span className="font-medium">{task.assignee_name}</span>
                                    </p>
                                )}
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                                    Due: <span className="font-medium">{formatDate(task.due_date)}</span>
                                </p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 ml-1">{formatTime(task.created_at)}</p>
                        </div>
                    </div>

                    {/* Activity entries */}
                    {activities.filter(a => a.action !== 'created').map((activity, index) => (
                        <div key={activity.id} className="relative flex gap-4 pb-4">
                            <div className="relative z-10 w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                                {getActionIcon(activity.action)}
                            </div>
                            <div className="flex-1 pt-0.5">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">{activity.user_name}</span>
                                    <span className="text-gray-500 dark:text-gray-400"> {getActionText(activity)}</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{formatTime(activity.created_at)}</p>
                            </div>
                        </div>
                    ))}

                    {/* Show more comments button */}
                    {hiddenCommentsCount > 0 && !showAllComments && (
                        <div className="relative flex gap-4 pb-4">
                            <div className="relative z-10 w-6 h-6 flex items-center justify-center flex-shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1" />
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1" />
                            </div>
                            <button
                                onClick={() => setShowAllComments(true)}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                <ChevronDown className="w-4 h-4" />
                                Show {hiddenCommentsCount} more comment{hiddenCommentsCount > 1 ? 's' : ''}
                            </button>
                        </div>
                    )}

                    {/* Comments as timeline entries */}
                    {visibleComments.map((comment, index) => (
                        <div key={comment.id} className="relative flex gap-4 pb-4">
                            <div className="relative z-10 w-6 h-6 rounded-full bg-cyan-100 border-2 border-cyan-400 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="w-3 h-3 text-cyan-600" />
                            </div>
                            <div className="flex-1">
                                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-100 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                                <User className="w-3 h-3 text-white" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{comment.user_name}</span>
                                            <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
                                        </div>
                                        {comment.user_id === currentUserId && (
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.comment}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Collapse comments button */}
                    {showAllComments && hiddenCommentsCount > 0 && (
                        <div className="relative flex gap-4 pb-4">
                            <div className="w-6 flex-shrink-0" />
                            <button
                                onClick={() => setShowAllComments(false)}
                                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
                            >
                                <ChevronUp className="w-4 h-4" />
                                Show less
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="px-5 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800">
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 flex gap-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || isSubmitting}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-cyan-600 transition-all"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
