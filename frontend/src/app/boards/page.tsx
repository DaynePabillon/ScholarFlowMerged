"use client"

import apiClient, { API_URL } from '@/lib/api/client'
import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import ProfessionalKanban from "@/components/tasks/ProfessionalKanban"
import ChartWidget from "@/components/widgets/ChartWidget"
import ChartWidgetPicker from "@/components/widgets/ChartWidgetPicker"
import TeamCardGrid from "@/components/teams/TeamCardGrid"
import TeamDetailModal from "@/components/teams/TeamDetailModal"
import SheetTemplateModal from "@/components/teams/SheetTemplateModal"
import {
    CheckSquare, Plus, Search, LayoutGrid, Table, X, Calendar, AlertCircle,
    User, Users, Edit3, Archive, RotateCcw, ChevronDown, ChevronRight,
    FileText, BarChart3, ChevronUp, FolderKanban, FileSpreadsheet, ShieldCheck,
    Clock, MessageSquare, Send, Trash2
} from "lucide-react"
import AdvisorWBSExplorer from "@/components/tasks/AdvisorWBSExplorer"
import KanbanView from "@/components/boards/KanbanView"
import TeamsView from "@/components/boards/TeamsView"
import AdvisorView from "@/components/boards/AdvisorView"
import TeamSelector from "@/components/shared/TeamSelector"
import GoogleSheetImportModal from "@/components/tasks/GoogleSheetImportModal"

interface Task {
    id: string
    title: string
    description: string
    status: 'todo' | 'in-progress' | 'in_progress' | 'review' | 'done' | 'archived'
    priority: 'low' | 'medium' | 'high'
    assigned_to: string | null
    assigned_to_name?: string
    due_date: string | null
    created_at: string
    project_id: string | null
    project_name?: string
    synced?: boolean
    sheet_name?: string
    comment_count?: number
    is_absolute?: boolean
    complexity_weight?: number
    wbs_code?: string
}

interface SyncedSheet {
    id: string
    sheet_id: string
    sheet_name: string
    task_count: number
    team_id: string | null
}

interface TeamMember {
    id: string
    name: string
    email: string
    role: string
}

interface Organization {
    id: string
    name: string
    role: 'admin' | 'manager' | 'member'
}

interface TaskComment {
    id: string
    comment: string
    user_name: string
    user_id: string
    created_at: string
}

interface Widget {
    id: string
    type: string
    title: string
}

interface TeamGroup {
    id: string
    team_code: string | null
    team_number: number
    name: string
    description: string | null
    adviser_name: string | null
    leader_name: string | null
    status: string
    organization_id: string
    member_count: number
    total_checkpoints: number
    completed_checkpoints: number
    proposed_project: string | null
}

function BoardsContent() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [syncedSheets, setSyncedSheets] = useState<SyncedSheet[]>([])
    const [members, setMembers] = useState<TeamMember[]>([])
    const [mounted, setMounted] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<string>('all')
    const [widgets, setWidgets] = useState<Widget[]>([])
    const [showWidgetPicker, setShowWidgetPicker] = useState(false)
    const [widgetsExpanded, setWidgetsExpanded] = useState(true)
    const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [taskComments, setTaskComments] = useState<TaskComment[]>([])
    const [newComment, setNewComment] = useState('')
    const [isEditingTask, setIsEditingTask] = useState(false)
    const [editedTask, setEditedTask] = useState<Partial<Task>>({})
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high',
        due_date: '',
        assigned_to: '',
        start_date: '',
        is_absolute: false,
        complexity_weight: 1,
        parent_task_id: '' as string | null
    })

    const [searchQuery, setSearchQuery] = useState('');
    const [boardView, setBoardView] = useState<'teams' | 'kanban'>('teams');
    const [boardSubView, setBoardSubView] = useState<'team' | 'advisor' | 'explorer'>('team');
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    // Team Board state
    const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([])
    const [selectedTeamGroup, setSelectedTeamGroup] = useState<TeamGroup | null>(null)
    const [showCreateTeam, setShowCreateTeam] = useState(false)
    const [showSheetTemplate, setShowSheetTemplate] = useState(false)
    const [newTeam, setNewTeam] = useState({ team_number: 1, name: '', description: '', adviser_name: '' })
    const [isResyncing, setIsResyncing] = useState(false)

    const searchParams = useSearchParams()

    useEffect(() => {
        const initAuth = async () => {
            console.log('=== BOARDS PAGE INIT AUTH START ===')
            
            // Check for token in URL (from ScholarSync)
            const urlToken = searchParams.get('token')
            console.log('URL token:', urlToken ? 'Found' : 'Not found')
            
            if (urlToken) {
                localStorage.setItem('token', urlToken)
                console.log('✅ Token received from ScholarSync and stored')
                // Remove token from URL for security
                window.history.replaceState({}, '', '/boards')
            }

            let storedUser = localStorage.getItem('user')
            let storedOrgs = localStorage.getItem('organizations')
            const storedSelectedOrg = localStorage.getItem('selectedOrganization')
            const storedWidgets = localStorage.getItem('boardWidgets')
            const token = localStorage.getItem('token')

            console.log('LocalStorage check:', {
                hasToken: !!token,
                hasUser: !!storedUser,
                hasOrgs: !!storedOrgs,
                hasSelectedOrg: !!storedSelectedOrg
            })

            // If we have token but no user data, fetch from backend
            if (token && !storedUser) {
                try {
                    console.log('📡 Fetching user data from backend via apiClient...')
                    const response = await apiClient.get('/auth/me');
                    
                    if (response.data) {
                        const data = response.data;
                        console.log('User data received:', { email: data.email, organizations: data.organizations?.length })
                        
                        const { organizations, onboarding_data, ...userData } = data
                        
                        // Store user data
                        localStorage.setItem('user', JSON.stringify({ ...userData, onboarding_data }))
                        localStorage.setItem('organizations', JSON.stringify(organizations || []))
                        
                        storedUser = JSON.stringify({ ...userData, onboarding_data })
                        storedOrgs = JSON.stringify(organizations || [])
                        console.log('✅ User data fetched and stored successfully')
                    }
                } catch (error) {
                    console.error('❌ Error fetching user data:', error)
                    console.log('Redirecting to /')
                    router.push('/')
                    return
                }
            }

            if (storedUser) {
                console.log('✅ Setting user data')
                setUser(JSON.parse(storedUser))
            }
            
            if (storedOrgs) {
                const orgs = JSON.parse(storedOrgs)
                console.log('Organizations found:', orgs.length)
                setOrganizations(orgs)
                
                // Auto-select organization
                if (storedSelectedOrg) {
                    const org = JSON.parse(storedSelectedOrg)
                    console.log('✅ Using stored organization:', org.name)
                    setSelectedOrg(org)
                    fetchData(org.id)
                } else if (orgs && orgs.length > 0) {
                    // Auto-select first organization if none selected
                    const firstOrg = orgs[0]
                    console.log('✅ Auto-selected first organization:', firstOrg.name)
                    setSelectedOrg(firstOrg)
                    localStorage.setItem('selectedOrganization', JSON.stringify(firstOrg))
                    fetchData(firstOrg.id)
                }
            } else {
                console.log('⚠️ No organizations found')
            }
            
            if (storedWidgets) setWidgets(JSON.parse(storedWidgets))

            console.log('✅ Setting mounted to true')
            setMounted(true)
            console.log('=== BOARDS PAGE INIT AUTH COMPLETE ===')
        }

        initAuth()
    }, [])

    // Token check removed - handled in initAuth function

    useEffect(() => {
        if (selectedOrg) {
            fetchTasks(selectedOrg.id)
        }
    }, [selectedTeam])

    const fetchData = async (orgId: string) => {
        await Promise.all([
            fetchTasks(orgId),
            fetchSyncedSheets(orgId),
            fetchMembers(orgId),
            fetchTeamGroups(orgId)
        ])
    }

    const fetchTeamGroups = useCallback(async (orgId: string) => {
        try {
            const response = await apiClient.get(`/organizations/${orgId}/team-groups`)
            if (response.data) {
                setTeamGroups(response.data.teams || [])
            }
        } catch (error) {
            console.error('Error fetching team groups:', error)
        }
    }, [])

    const handleCreateTeam = async () => {
        if (!newTeam.name || !selectedOrg) return
        try {
            const response = await apiClient.post(`/organizations/${selectedOrg.id}/team-groups`, newTeam)
            if (response.data) {
                setShowCreateTeam(false)
                setNewTeam({ team_number: teamGroups.length + 2, name: '', description: '', adviser_name: '' })
                fetchTeamGroups(selectedOrg.id)
            }
        } catch (error) {
            console.error('Error creating team:', error)
        }
    }

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm('Delete this team and all its data?')) return
        try {
            await apiClient.delete(`/team-groups/${teamId}`)
            if (selectedOrg) fetchTeamGroups(selectedOrg.id)
        } catch (error) {
            console.error('Error deleting team:', error)
        }
    }

    const fetchTasks = useCallback(async (orgId: string) => {
        try {
            const url = selectedTeam 
                ? `/organizations/${orgId}/tasks?team_id=${selectedTeam}`
                : `/organizations/${orgId}/tasks`
            
            const response = await apiClient.get(url)
            if (response.data) {
                const normalizedTasks = (response.data.tasks || []).map((task: Task) => ({
                    ...task,
                    status: normalizeStatus(task.status)
                }))
                setTasks(normalizedTasks)
            }
        } catch (error) {
            console.error('Error fetching tasks:', error)
        }
    }, [selectedTeam])

    const fetchSyncedSheets = useCallback(async (orgId: string) => {
        try {
            const response = await apiClient.get(`/organizations/${orgId}/synced-sheets`)
            if (response.data) {
                setSyncedSheets(response.data.syncedSheets || [])
            }
        } catch (error) {
            console.error('Error fetching synced sheets:', error)
        }
    }, [])

    const fetchMembers = useCallback(async (orgId: string) => {
        try {
            const response = await apiClient.get(`/organizations/${orgId}/members`)
            if (response.data) {
                const data = response.data;
                setMembers(Array.isArray(data) ? data : (data.members || []))
            }
        } catch (error) {
            console.error('Error fetching members:', error)
        }
    }, [])

    const normalizeStatus = (status: string): Task['status'] => {
        const statusMap: Record<string, Task['status']> = {
            'in_progress': 'in-progress',
            'in-progress': 'in-progress',
            'in progress': 'in-progress',
            'todo': 'todo',
            'review': 'review',
            'done': 'done',
            'completed': 'done',
            'archived': 'archived'
        }
        return statusMap[status] || status as Task['status']
    }

    const handleCreateTask = async () => {
        if (!newTask.title || !selectedOrg) return
        try {
            const response = await apiClient.post(`/organizations/${selectedOrg.id}/tasks`, {
                title: newTask.title,
                description: newTask.description,
                status: 'todo',
                priority: newTask.priority,
                due_date: newTask.due_date || null,
                assigned_to: newTask.assigned_to || null,
                start_date: newTask.start_date || null,
                is_absolute: newTask.is_absolute,
                complexity_weight: newTask.complexity_weight,
                parent_task_id: newTask.parent_task_id || null
            })

            if (response.data) {
                fetchData(selectedOrg.id)
                setIsCreateModalOpen(false)
                setNewTask({ 
                    title: '', 
                    description: '', 
                    priority: 'medium', 
                    due_date: '', 
                    assigned_to: '',
                    start_date: '',
                    is_absolute: false,
                    complexity_weight: 1,
                    parent_task_id: null
                })
            }
        } catch (error) {
            console.error('Error creating task:', error)
        }
    }

    const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
        const taskToUpdate = tasks.find(t => t.id === taskId)
        if (!taskToUpdate) return

        const previousTasks = [...tasks]
        const updatedTasks = tasks.map(t => 
            t.id === taskId ? { ...t, status: normalizeStatus(newStatus) } : t
        )
        setTasks(updatedTasks)

        try {
            const response = await apiClient.patch(`/tasks/${taskId}/status`, { status: newStatus })
            if (response.status !== 200 && response.status !== 204) {
                setTasks(previousTasks)
            } else if (selectedOrg) {
                fetchTasks(selectedOrg.id)
            }
        } catch (error: any) {
            console.error('Error updating status:', error)
            setTasks(previousTasks)
        }
    }, [tasks, selectedOrg, fetchTasks]);

    const handleProgressChange = useCallback(async (taskId: string, newProgress: number) => {
        const previousTasks = [...tasks]
        const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, progress_percent: newProgress } : t)
        setTasks(updatedTasks)

        try {
            await apiClient.patch(`/tasks/${taskId}`, { progress_percent: newProgress })
        } catch (error: any) {
            console.error('Error updating progress:', error)
            setTasks(previousTasks)
        }
    }, [tasks]);

    const handleDeleteTask = useCallback(async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return
        try {
            const response = await apiClient.delete(`/tasks/${taskId}`)
            if (response.status === 200 || response.status === 204) {
                setTasks(prev => prev.filter(t => t.id !== taskId))
            }
        } catch (error: any) {
            console.error('Error deleting task:', error)
        }
    }, []);

    const handleArchiveTask = useCallback(async (taskId: string) => {
        try {
            await apiClient.post(`/tasks/${taskId}/archive`)
            setTasks(prev => prev.filter(t => t.id !== taskId))
        } catch (error) {
            console.error('Error archiving task:', error)
        }
    }, []);

    const handleAddWidget = (type: string, title: string) => {
        const newWidget = { id: Date.now().toString(), type, title }
        const updated = [...widgets, newWidget]
        setWidgets(updated)
        localStorage.setItem('boardWidgets', JSON.stringify(updated))
        setShowWidgetPicker(false)
    }

    const handleRemoveWidget = (widgetId: string) => {
        const updated = widgets.filter(w => w.id !== widgetId)
        setWidgets(updated)
        localStorage.setItem('boardWidgets', JSON.stringify(updated))
    }

    const handleOrgChange = (org: Organization) => {
        setSelectedOrg(org)
        localStorage.setItem('selectedOrganization', JSON.stringify(org))
        fetchData(org.id)
    }

    const handleResync = async () => {
        if (!selectedOrg) return
        setIsResyncing(true)
        try {
            // Get workspaces for this org
            const wsRes = await apiClient.get(`/workspaces?organizationId=${selectedOrg.id}`)
            if (wsRes.data) {
                const workspaces = wsRes.data.workspaces || []
                // Trigger sync on each workspace
                for (const ws of workspaces) {
                    await apiClient.post(`/workspaces/${ws.id}/sync`)
                }
            }
            // Refresh tasks after sync
            await fetchData(selectedOrg.id)
        } catch (error) {
            console.error('Error re-syncing:', error)
        } finally {
            setIsResyncing(false)
        }
    }

    const handleTaskClick = async (task: Task) => {
        setSelectedTask(task)
        setEditedTask(task)
        setIsEditingTask(false)
        setTaskComments([]) // Clear old comments immediately
        // Fetch comments for this task
        try {
            const res = await apiClient.get(`/tasks/${task.id}/comments`)
            if (res.data) {
                setTaskComments(res.data.comments || [])
            }
        } catch (error) {
            console.error('Error fetching comments:', error)
            setTaskComments([])
        }
    }

    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedTask) return
        try {
            const res = await apiClient.post(`/tasks/${selectedTask.id}/comments`, { comment: newComment })
            if (res.data) {
                setTaskComments([...taskComments, res.data.comment])
                setNewComment('')
            }
        } catch (error) {
            console.error('Error adding comment:', error)
        }
    }

    const handleUpdateTask = async () => {
        if (!selectedTask) return
        try {
            await apiClient.patch(`/tasks/${selectedTask.id}`, editedTask)
            setSelectedTask({ ...selectedTask, ...editedTask } as Task)
            setIsEditingTask(false)
            if (selectedOrg) fetchTasks(selectedOrg.id)
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    const handleDeleteSelectedTask = async () => {
        if (!selectedTask) return
        await handleDeleteTask(selectedTask.id)
        setSelectedTask(null)
    }

    const getUserRole = (): 'admin' | 'manager' | 'member' => {
        return selectedOrg?.role || 'member'
    }

    const canEdit = () => {
        if (['admin', 'manager'].includes(getUserRole())) return true
        // Members can edit team board tasks (non-absolute) but not advisor tasks
        if (getUserRole() === 'member' && selectedTask && !selectedTask.is_absolute) return true
        return false
    }
    const canDelete = () => {
        if (['admin', 'manager'].includes(getUserRole())) return true
        // Members can delete team board tasks (non-absolute) but not advisor tasks
        if (getUserRole() === 'member' && selectedTask && !selectedTask.is_absolute) return true
        return false
    }

    // Filter tasks based on active tab - Memoized for performance
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (task.status === 'archived') return false
            if (activeTab === 'all') return true
            if (activeTab === 'general') return !task.synced && !task.sheet_name
            // For sheet tabs, filter by sheet name
            if (task.sheet_name && activeTab === task.sheet_name) return true
            return false
        })
    }, [tasks, activeTab]);

    const generalTaskCount = useMemo(() => {
        return tasks.filter(t => !t.synced && !t.sheet_name && t.status !== 'archived').length
    }, [tasks]);

    if (!mounted || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (!selectedOrg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
                <p className="text-gray-600">No organization selected</p>
            </div>
        )
    }

    return (
        <AppLayout
            user={user}
            organizations={organizations}
            selectedOrg={selectedOrg}
            onOrgChange={handleOrgChange}
        >
            <div className="p-10 min-h-screen bg-transparent backdrop-blur-3xl transition-colors duration-500">
                {/* Header */}
                <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[1.5rem] shadow-xl shadow-blue-500/20 rotate-3">
                                <FolderKanban className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                                    Project <span className="text-blue-500">Boards</span>
                                </h1>
                                <p className="text-gray-500 dark:text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1 opacity-70">
                                    {boardView === 'teams'
                                        ? `Team Overview • ${teamGroups.length} Teams`
                                        : `Task Board • ${filteredTasks.length} Tasks`}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* View Toggle */}
                            <div className="flex bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl p-1.5 border border-gray-200 dark:border-white/5 shadow-inner">
                                <button
                                    onClick={() => setBoardView('teams')}
                                    className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${boardView === 'teams'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <Users className="w-4 h-4" />
                                    Teams
                                </button>
                                <button
                                    onClick={() => setBoardView('kanban')}
                                    className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${boardView === 'kanban'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                    Kanban
                                </button>
                             </div>

                            {boardView === 'kanban' && (
                                <>
                                    {/* Team Selector */}
                                    {selectedOrg && (
                                        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/5 shadow-md dark:shadow-xl">
                                            <TeamSelector
                                                organizationId={selectedOrg.id}
                                                selectedTeamId={selectedTeam}
                                                onTeamChange={setSelectedTeam}
                                                userRole={selectedOrg.role}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Board Sub-View Toggle */}
                                    <div className="flex bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/5 p-1.5 shadow-inner">
                                        <button
                                            onClick={() => setBoardSubView('team')}
                                            className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${boardSubView === 'team'
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <Users className="w-4 h-4" />
                                            Team Board
                                        </button>
                                        <button
                                            onClick={() => setBoardSubView('advisor')}
                                            className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${boardSubView === 'advisor'
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            Advisor Board
                                        </button>
                                        {(getUserRole() === 'admin' || getUserRole() === 'manager') && (
                                            <button
                                                onClick={() => setBoardSubView('explorer')}
                                                className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${boardSubView === 'explorer'
                                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                <LayoutGrid className="w-4 h-4" />
                                                WBS Explorer
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}

                            {boardView === 'kanban' && (
                                <div className="flex items-center gap-4">
                                    {(getUserRole() === 'admin' || getUserRole() === 'manager') && (
                                        <div className="relative group/tool">
                                            <button
                                                onClick={() => {
                                                    if (!selectedTeam) {
                                                        alert('⚠️ Please select a specific team first!\n\nYou cannot sync to "All Teams". Select a team from the dropdown to sync tasks to that team\'s board.');
                                                        return;
                                                    }
                                                    setIsGoogleSyncModalOpen(true);
                                                }}
                                                disabled={!selectedTeam}
                                                className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 shadow-md dark:shadow-xl border-2 ${
                                                    !selectedTeam 
                                                        ? 'bg-gray-100 dark:bg-slate-900/20 border-gray-200 dark:border-white/5 text-gray-400 dark:text-slate-700 cursor-not-allowed' 
                                                        : 'bg-emerald-50 dark:bg-slate-900/60 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/40'
                                                }`}
                                            >
                                                <FileSpreadsheet className={`w-5 h-5 ${!selectedTeam ? 'opacity-30' : 'animate-pulse'}`} />
                                                <span className="font-black text-xs uppercase tracking-widest">WBS Sync</span>
                                            </button>
                                            {!selectedTeam && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/tool:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-[100] shadow-2xl scale-90 group-hover/tool:scale-100">
                                                    Select a team first
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-rose-600"></div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(getUserRole() === 'admin' || getUserRole() === 'manager') && syncedSheets.length > 0 && (
                                        <button
                                            onClick={handleResync}
                                            disabled={isResyncing}
                                            className="flex items-center justify-center p-3 rounded-2xl border-2 border-gray-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 text-gray-400 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-500/40 transition-all duration-300 shadow-md dark:shadow-xl disabled:opacity-30 group"
                                            title="Re-sync"
                                        >
                                            <RotateCcw className={`w-5 h-5 ${isResyncing ? 'animate-spin text-emerald-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                        </button>
                                    )}
                                    {(boardSubView !== 'advisor' || getUserRole() !== 'member') && (
                                        <button
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span className="font-medium">New Task</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Conditional View: Teams or Kanban */}
                {boardView === 'teams' ? (
                    <TeamsView
                        teams={teamGroups}
                        userRole={getUserRole()}
                        onTeamClick={(team) => setSelectedTeamGroup(team as any)}
                        onCreateTeam={() => setShowCreateTeam(true)}
                        onShowTemplate={() => setShowSheetTemplate(true)}
                        onSyncAll={handleResync}
                        isResyncing={isResyncing}
                    />
                ) : (
                    <div className="space-y-6">
                        {boardSubView === 'explorer' && (getUserRole() === 'admin' || getUserRole() === 'manager') ? (
                            <AdvisorView 
                                selectedSheetId={selectedSheetId} 
                                organizationId={selectedOrg?.id || ''} 
                            />
                        ) : boardSubView === 'advisor' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700/50 rounded-full">
                                            <ShieldCheck className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                                            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Advisor Board</span>
                                            <span className="text-xs bg-indigo-500 text-white rounded-full px-2 py-0.5">
                                                {filteredTasks.filter(t => t.is_absolute).length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">High-integrity tasks synced from Google Sheets (Locked for students)</p>
                                    </div>
                                </div>
                                <KanbanView
                                    tasks={filteredTasks.filter(t => t.is_absolute).map(t => ({
                                        ...t,
                                        id: t.id.toString(),
                                        status: normalizeStatus(t.status)
                                    } as any))}
                                    onTaskClick={(t: any) => handleTaskClick(t)}
                                    onAddTask={getUserRole() !== 'member' ? () => setIsGoogleSyncModalOpen(true) : () => {}}
                                    onDeleteTask={getUserRole() !== 'member' ? handleDeleteTask : undefined as any}
                                    onArchiveTask={getUserRole() !== 'member' ? handleArchiveTask : undefined as any}
                                    onStatusChange={handleStatusChange}
                                    onProgressChange={handleProgressChange}
                                    role={getUserRole() === 'member' ? 'student' : getUserRole() as any}
                                    members={members}
                                />
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700/50 rounded-full">
                                            <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                                            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Team Board</span>
                                            <span className="text-xs bg-blue-500 text-white rounded-full px-2 py-0.5">
                                                {filteredTasks.filter(t => !t.is_absolute).length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Internal tasks that team members can freely manage</p>
                                    </div>
                                </div>
                                <KanbanView
                                    tasks={filteredTasks.filter(t => !t.is_absolute).map(t => ({
                                        ...t,
                                        id: t.id.toString(),
                                        status: normalizeStatus(t.status)
                                    } as any))}
                                    onTaskClick={(t: any) => handleTaskClick(t)}
                                    onAddTask={() => setIsCreateModalOpen(true)}
                                    onDeleteTask={handleDeleteTask}
                                    onArchiveTask={handleArchiveTask}
                                    onStatusChange={handleStatusChange}
                                    onProgressChange={handleProgressChange}
                                    role={getUserRole() === 'member' ? 'manager' : getUserRole() as any}
                                    members={members}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom Tab Bar — only show in kanban view */}
                {boardView === 'kanban' && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
                        <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-full shadow-xl border border-gray-200 dark:border-slate-700 px-2 py-1">
                            <button
                                onClick={() => {
                                    setActiveTab('all');
                                    setSelectedTeam(null);
                                    setSelectedSheetId(null);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'all'
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <CheckSquare className="w-4 h-4" />
                                All Tasks
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('general');
                                    setSelectedTeam(null);
                                    setSelectedSheetId(null);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'general'
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <FolderKanban className="w-4 h-4" />
                                General Tasks
                                <span className="text-xs opacity-80">{generalTaskCount}</span>
                            </button>
                            {syncedSheets.map(sheet => (
                                <div key={sheet.id} className="relative group/sheet">
                                    <button
                                        onClick={() => {
                                            setActiveTab(sheet.sheet_name);
                                            setSelectedTeam(sheet.team_id);
                                            setSelectedSheetId(sheet.id);
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === sheet.sheet_name
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                                            }`}
                                    >
                                        <FileSpreadsheet className="w-4 h-4" />
                                        {sheet.sheet_name}
                                        <span className="text-xs opacity-80">{sheet.task_count || 0}</span>
                                    </button>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete synced sheet "${sheet.sheet_name}" and all its tasks?`)) {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    const res = await fetch(`${API_URL}/api/workspaces/sheets/${sheet.id}`, {
                                                        method: 'DELETE',
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    });
                                                    if (res.ok) {
                                                        // Immediately update local state for fast UI
                                                        setSyncedSheets(prev => prev.filter(s => s.id !== sheet.id));
                                                        if (selectedOrg) fetchData(selectedOrg.id);
                                                        if (activeTab === sheet.sheet_name) {
                                                            setActiveTab('all');
                                                            setSelectedTeam(null);
                                                            setSelectedSheetId(null);
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.error('Delete error:', err);
                                                }
                                            }
                                        }}
                                        className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover/sheet:opacity-100 transition-opacity shadow-lg hover:bg-rose-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => router.push('/workspace-sync')}
                                className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Widget Picker Modal */}
            {showWidgetPicker && (
                <ChartWidgetPicker
                    isOpen={showWidgetPicker}
                    onSelectWidget={handleAddWidget}
                    onClose={() => setShowWidgetPicker(false)}
                />
            )}

            {/* Create Task Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-xl border border-gray-200 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Create New Task</h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title *</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    placeholder="Enter task title"
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    rows={3}
                                    placeholder="Enter task description"
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        <option value="low">🟢 Low</option>
                                        <option value="medium">🟡 Medium</option>
                                        <option value="high">🔴 High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Complexity Weight</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={newTask.complexity_weight}
                                        onChange={(e) => setNewTask({ ...newTask, complexity_weight: parseInt(e.target.value) || 1 })}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={newTask.start_date}
                                        onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.due_date}
                                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Task (for WBS Hierarchy)</label>
                                <select
                                    value={newTask.parent_task_id || ''}
                                    onChange={(e) => setNewTask({ ...newTask, parent_task_id: e.target.value || null })}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="">None (Root Task)</option>
                                    {tasks.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.wbs_code ? `${t.wbs_code} - ` : ''}{t.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="is_absolute"
                                    checked={newTask.is_absolute}
                                    onChange={(e) => setNewTask({ ...newTask, is_absolute: e.target.checked })}
                                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-400"
                                />
                                <label htmlFor="is_absolute" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Mark as Absolute Task (Locked for members)
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                                <select
                                    value={newTask.assigned_to}
                                    onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="">Unassigned</option>
                                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTask}
                                disabled={!newTask.title}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
                            >
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700/50 transform animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${selectedTask.status === 'done' ? 'bg-green-500' :
                                    selectedTask.status === 'in_progress' || selectedTask.status === 'in-progress' ? 'bg-blue-500' :
                                        selectedTask.status === 'review' ? 'bg-purple-500' : 'bg-gray-400'
                                    }`} />
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Task Details</h2>
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Task Title & Description */}
                            <div className="mb-6">
                                {isEditingTask && canEdit() ? (
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            value={editedTask.title || ''}
                                            onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                                            className="w-full text-xl font-bold text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-2"
                                        />
                                        <textarea
                                            value={editedTask.description || ''}
                                            onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                                            className="w-full h-24 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 resize-none"
                                            placeholder="Task description..."
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{selectedTask.title}</h3>
                                        <p className="text-gray-600 dark:text-slate-400">{selectedTask.description || 'No description'}</p>
                                    </>
                                )}
                            </div>

                            {/* Task Meta Info */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                                        {isEditingTask && canEdit() ? (
                                            <input
                                                type="date"
                                                value={editedTask.due_date?.split('T')[0] || ''}
                                                onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                                                className="text-sm font-medium text-gray-800 dark:text-gray-100 border dark:border-slate-600 dark:bg-slate-800 rounded px-2 py-1"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                                {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'Not set'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                    <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Assigned to</p>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{selectedTask.assigned_to_name || 'Unassigned'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${selectedTask.priority === 'high' ? 'bg-red-100 text-red-700' :
                                        selectedTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {selectedTask.priority} priority
                                    </span>
                                </div>
                                {selectedTask.wbs_code && (
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <div>
                                            <p className="text-xs text-blue-500 dark:text-blue-400">WBS Code</p>
                                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{selectedTask.wbs_code}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedTask.complexity_weight && selectedTask.complexity_weight > 1 && (
                                    <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                        <BarChart3 className="w-4 h-4 text-purple-500" />
                                        <div>
                                            <p className="text-xs text-purple-500 dark:text-purple-400">Complexity</p>
                                            <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{selectedTask.complexity_weight}/10</p>
                                        </div>
                                    </div>
                                )}
                                {selectedTask.is_absolute && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg col-span-2">
                                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">🔒 Absolute Task — Members cannot modify this task</span>
                                    </div>
                                )}
                                {selectedTask.sheet_name && (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                                        <span className="text-xs text-green-700 dark:text-green-400">From: {selectedTask.sheet_name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="border-t border-gray-100 pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">Comments ({taskComments.length})</h4>
                                </div>

                                {/* Comments List */}
                                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                                    {taskComments.length === 0 ? (
                                        <p className="text-gray-400 text-sm text-center py-4">No comments yet</p>
                                    ) : (
                                        taskComments.map((comment) => (
                                            <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <span className="text-white text-xs font-bold">
                                                        {comment.user_name?.charAt(0).toUpperCase() || '?'}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm text-gray-800 dark:text-gray-100">{comment.user_name}</span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(comment.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-slate-400">{comment.comment}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Add Comment Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                        placeholder="Add a comment..."
                                        className="flex-1 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        disabled={!newComment.trim()}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer - Actions */}
                        <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50">
                            <div className="flex gap-2">
                                {canDelete() && (
                                    <button
                                        onClick={handleDeleteSelectedTask}
                                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {canEdit() && (
                                    isEditingTask ? (
                                        <>
                                            <button
                                                onClick={() => setIsEditingTask(false)}
                                                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleUpdateTask}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                            >
                                                Save Changes
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditingTask(true)}
                                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            Edit Task
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Detail Modal */}
            {selectedTeamGroup && selectedOrg && (
                <TeamDetailModal
                    team={{ ...selectedTeamGroup, organization_id: selectedOrg.id }}
                    userRole={getUserRole()}
                    onClose={() => setSelectedTeamGroup(null)}
                    onTeamUpdated={() => selectedOrg && fetchTeamGroups(selectedOrg.id)}
                />
            )}

            {/* Create Team Modal */}
            {showCreateTeam && (
                <div className="fixed inset-0 bg-black/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-slate-700/50 transform animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Create New Team</h3>
                            <button
                                onClick={() => setShowCreateTeam(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Number *</label>
                                <input
                                    type="number"
                                    value={newTeam.team_number}
                                    onChange={(e) => setNewTeam({ ...newTeam, team_number: parseInt(e.target.value) || 1 })}
                                    min={1}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team / Project Name *</label>
                                <input
                                    type="text"
                                    value={newTeam.name}
                                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                                    placeholder="Enter team or project name"
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={newTeam.description}
                                    onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                                    placeholder="Brief description"
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adviser Name</label>
                                <input
                                    type="text"
                                    value={newTeam.adviser_name}
                                    onChange={(e) => setNewTeam({ ...newTeam, adviser_name: e.target.value })}
                                    placeholder="Adviser's name"
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateTeam(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTeam}
                                disabled={!newTeam.name}
                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
                            >
                                Create Team
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sheet Template Modal */}
            {showSheetTemplate && (
                <SheetTemplateModal onClose={() => setShowSheetTemplate(false)} />
            )}

            {/* Google Sheet Sync Modal */}
            <GoogleSheetImportModal
                isOpen={isGoogleSyncModalOpen}
                onClose={() => setIsGoogleSyncModalOpen(false)}
                organizationId={selectedOrg?.id || ''}
                onImportComplete={() => selectedOrg && fetchData(selectedOrg.id)}
                teamId={selectedTeam}
            />
        </AppLayout>
    )
}

export default function BoardsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        }>
            <BoardsContent />
        </Suspense>
    )
}
