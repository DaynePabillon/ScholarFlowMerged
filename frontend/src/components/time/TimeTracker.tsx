"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2, Calendar } from 'lucide-react'

interface TimeEntry {
    id: string
    user_name: string
    hours: number
    date: string
    notes?: string
    created_at: string
}

interface TimeTrackerProps {
    taskId: string
    compact?: boolean
}

export default function TimeTracker({ taskId, compact = false }: TimeTrackerProps) {
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
    const [totalHours, setTotalHours] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [newEntry, setNewEntry] = useState({ hours: '', date: new Date().toISOString().split('T')[0], notes: '' })

    useEffect(() => {
        fetchTimeEntries()
    }, [taskId])

    const fetchTimeEntries = async () => {
        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/tasks/${taskId}/time-entries`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            )

            if (response.ok) {
                const data = await response.json()
                setTimeEntries(data.timeEntries || [])
                setTotalHours(data.totalHours || 0)
            }
        } catch (error) {
            console.error('Error fetching time entries:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newEntry.hours) return

        try {
            const token = localStorage.getItem('token')
            const response = await fetch(
                `${API_URL}/api/tasks/${taskId}/time-entries`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        hours: parseFloat(newEntry.hours),
                        date: newEntry.date,
                        notes: newEntry.notes || null
                    })
                }
            )

            if (response.ok) {
                setNewEntry({ hours: '', date: new Date().toISOString().split('T')[0], notes: '' })
                setShowForm(false)
                fetchTimeEntries()
            }
        } catch (error) {
            console.error('Error logging time:', error)
        }
    }

    const handleDelete = async (entryId: string) => {
        try {
            const token = localStorage.getItem('token')
            await fetch(
                `${API_URL}/api/time-entries/${entryId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            )
            fetchTimeEntries()
        } catch (error) {
            console.error('Error deleting time entry:', error)
        }
    }

    // Compact view for task cards
    if (compact) {
        return (
            <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{totalHours.toFixed(1)}h logged</span>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-medium text-gray-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Time Tracking
                    <span className="text-sm font-normal text-gray-500">({totalHours.toFixed(1)}h total)</span>
                </h4>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
                >
                    <Plus className="w-4 h-4" />
                    Log Time
                </button>
            </div>

            {/* Add Time Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="p-4 bg-purple-50/50 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
                            <input
                                type="number"
                                step="0.25"
                                min="0.25"
                                value={newEntry.hours}
                                onChange={(e) => setNewEntry({ ...newEntry, hours: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                placeholder="1.5"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input
                                type="date"
                                value={newEntry.date}
                                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <input
                                type="text"
                                value={newEntry.notes}
                                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                        >
                            Log Time
                        </button>
                    </div>
                </form>
            )}

            {/* Time Entries List */}
            <div className="max-h-40 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
                ) : timeEntries.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                        <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No time logged yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {timeEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-purple-600">{entry.hours}h</span>
                                    <span className="text-xs text-gray-500">{entry.user_name}</span>
                                    {entry.notes && (
                                        <span className="text-xs text-gray-400">- {entry.notes}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(entry.date).toLocaleDateString()}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
