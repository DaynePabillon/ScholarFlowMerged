"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { MessageSquare, Send, Trash2, User } from 'lucide-react'

interface Comment {
    id: string
    user_id: string
    user_name: string
    user_email?: string
    content: string
    created_at: string
}

interface CommentSectionProps {
    taskId: string
    currentUserId?: string
}

export default function CommentSection({ taskId, currentUserId }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchComments()
    }, [taskId])

    const fetchComments = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/tasks/${taskId}/comments`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                setComments(data.comments || [])
            }
        } catch (error) {
            console.error('Error fetching comments:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
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
                    body: JSON.stringify({ content: newComment.trim() })
                }
            )

            if (response.ok) {
                setNewComment('')
                fetchComments()
            }
        } catch (error) {
            console.error('Error adding comment:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (commentId: string) => {
        try {
            const token = localStorage.getItem('token')
            await fetch(
                `${API_URL}/api/comments/${commentId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )
            fetchComments()
        } catch (error) {
            console.error('Error deleting comment:', error)
        }
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Comments ({comments.length})
                </h4>
            </div>

            {/* Comments List */}
            <div className="max-h-60 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 text-center text-gray-400">Loading...</div>
                ) : comments.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {comments.map((comment) => (
                            <div key={comment.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm text-gray-800">{comment.user_name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
                                                {comment.user_id === currentUserId && (
                                                    <button
                                                        onClick={() => handleDelete(comment.id)}
                                                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isSubmitting}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    )
}
