"use client"

import { API_URL } from '@/lib/api/client'
import { useState, useEffect } from "react"
import { CheckSquare, Search, LayoutGrid, Table, AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import ProfessionalTaskCard from "./ProfessionalTaskCard"

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
  is_absolute?: boolean
}

interface MemberTaskViewProps {
  user: any
  organization: {
    id: string
    name: string
    role: string
  }
}

export default function MemberTaskView({ user, organization }: MemberTaskViewProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    fetchMyTasks()
  }, [organization.id])

  const fetchMyTasks = async () => {
    try {
      const token = localStorage.getItem('token')
      // Fetch all tasks and filter to user's assigned tasks
      const response = await fetch(`${API_URL}/api/organizations/${organization.id}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Filter to only tasks assigned to this user (by ID or by email for synced tasks)
        const myTasks = (data.tasks || []).filter((t: any) => 
          t.assigned_to === user.id || 
          (t.synced && t.assigned_to_name === user.email)
        )
        setTasks(myTasks)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    // Optimistic update
    const previousTasks = [...tasks]
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    )
    setTasks(updatedTasks)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        // Revert on failure
        setTasks(previousTasks)
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update status')
      } else {
        // Refresh to get any other updates
        fetchMyTasks()
      }
    } catch (error) {
      console.error('Error updating status:', error)
      setTasks(previousTasks)
    }
  }

  const filteredTasks = tasks.filter(task =>
    task.status !== 'archived' &&
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter(t => t.status === status)
  }

  const stats = {
    total: filteredTasks.length,
    todo: getTasksByStatus('todo').length,
    inProgress: getTasksByStatus('in-progress').length,
    review: getTasksByStatus('review').length,
    done: getTasksByStatus('done').length
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                My Tasks
              </h1>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full">
                Member
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Tasks assigned to you in {organization.name}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Can update status
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</div>
          </div>
          <div className="bg-gray-50/80 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{stats.todo}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">To Do</div>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800/50">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.inProgress}</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">In Progress</div>
          </div>
          <div className="bg-yellow-50/80 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800/50">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.review}</div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400">Review</div>
          </div>
          <div className="bg-green-50/80 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800/50">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.done}</div>
            <div className="text-sm text-green-600 dark:text-green-400">Completed</div>
          </div>
        </div>

        {/* Search + View Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search your tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
            />
          </div>
          <div className="flex bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-slate-700 p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'cards'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'table'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                }`}
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-12 text-center border border-white/40 dark:border-slate-700 shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            No Tasks Assigned
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have any tasks assigned to you yet.
          </p>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className="relative">
              <ProfessionalTaskCard
                task={task as any}
                onClick={() => { }}
                onStatusChange={(taskId, status) => handleStatusChange(taskId, status as Task['status'])}
              />
              {/* Status Update Overlay for Members */}
              <div className="absolute bottom-2 right-2">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                  disabled={task.is_absolute}
                  className={`text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 ${task.is_absolute ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && filteredTasks.length > 0 && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700 shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-500 to-cyan-500">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Task</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Priority</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Due Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800 dark:text-gray-200">{task.title}</div>
                    {task.project_name && <div className="text-xs text-gray-400 dark:text-gray-500">{task.project_name}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${task.status === 'done' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      task.status === 'review' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                        task.status === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}>
                      {task.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                      {task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {task.due_date ? (
                      <span className={new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-500 font-medium' : ''}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                      disabled={task.is_absolute}
                      className={`text-sm px-3 py-1.5 border border-gray-200 dark:border-slate-700 bg-transparent dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 ${task.is_absolute ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
