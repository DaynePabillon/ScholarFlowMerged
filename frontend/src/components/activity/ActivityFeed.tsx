"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { Clock, User, MessageSquare, CheckCircle2, ArrowRight, Plus, Trash2 } from 'lucide-react'

interface Activity {
    id: string
    user_name: string
    action: string
    entity_type: string
    entity_name: string
    details?: Record<string, any>
    created_at: string
}

interface ActivityFeedProps {
    organizationId: string
    limit?: number
}

export default function ActivityFeed({ organizationId, limit = 20 }: ActivityFeedProps) {
    const [activities, setActivities] = useState<Activity[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchActivities()
    }, [organizationId])

    const fetchActivities = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/organizations/${organizationId}/activity?limit=${limit}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                setActivities(data.activities || [])
            }
        } catch (error) {
            console.error('Error fetching activities:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created': return <Plus className="w-3 h-3 text-green-500" />
            case 'deleted': return <Trash2 className="w-3 h-3 text-red-500" />
            case 'commented': return <MessageSquare className="w-3 h-3 text-blue-500" />
            case 'status_changed': return <ArrowRight className="w-3 h-3 text-purple-500" />
            case 'assigned': return <User className="w-3 h-3 text-cyan-500" />
            default: return <CheckCircle2 className="w-3 h-3 text-gray-500" />
        }
    }

    const getActionText = (activity: Activity) => {
        const { action, entity_type, entity_name, details } = activity
        switch (action) {
            case 'created': return `created ${entity_type} "${entity_name}"`
            case 'deleted': return `deleted ${entity_type} "${entity_name}"`
            case 'commented': return `commented on "${entity_name}"`
            case 'status_changed':
                return `changed status of "${entity_name}" to ${details?.new_status || 'updated'}`
            case 'assigned': return `assigned "${entity_name}" to ${details?.assignee || 'someone'}`
            default: return `updated "${entity_name}"`
        }
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        return date.toLocaleDateString()
    }

    if (isLoading) {
        return (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/40">
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            <div className="flex-1 h-4 bg-gray-200 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Activity
                </h3>
            </div>

            <div className="max-h-80 overflow-y-auto">
                {activities.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No recent activity</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    {getActionIcon(activity.action)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800">
                                        <span className="font-medium">{activity.user_name}</span>{' '}
                                        <span className="text-gray-600">{getActionText(activity)}</span>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">{formatTime(activity.created_at)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
