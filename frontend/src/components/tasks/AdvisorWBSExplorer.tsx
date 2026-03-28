"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
    ChevronRight, 
    ChevronDown, 
    FileText, 
    AlertCircle, 
    Search, 
    RefreshCw, 
    ExternalLink,
    Filter,
    Table as TableIcon
} from 'lucide-react'
import apiClient from '@/lib/api/client'

interface WBSTask {
    id: string
    title: string
    wbs_code: string
    status: string
    priority: string
    assignee_email: string
    progress_percent: number
    complexity_weight: number
    parent_task_id: string | null
    is_absolute: boolean
    sheet_row_index: number
}

interface AdvisorWBSExplorerProps {
    sheetId?: string | null
    organizationId: string
}

export default function AdvisorWBSExplorer({ sheetId, organizationId }: AdvisorWBSExplorerProps) {
    const [tasks, setTasks] = useState<WBSTask[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (sheetId) {
            fetchTasks()
        } else {
            setTasks([])
        }
    }, [sheetId])

    const fetchTasks = useCallback(async () => {
        if (!sheetId) return
        setLoading(true)
        setError(null)
        try {
            const response = await apiClient.get(`/workspaces/sheets/${sheetId}/tasks`)
            if (response.data) {
                const data = response.data
                const taskList = Array.isArray(data) ? data : (data.tasks || [])
                setTasks(taskList)
                // Expand all by default initially
                setExpandedRows(new Set(taskList.filter((t: any) => !t.parent_task_id).map((t: any) => t.id)))
            } else {
                setTasks([])
            }
        } catch (err) {
            setError('Failed to load WBS data')
        } finally {
            setLoading(false)
        }
    }, [sheetId])

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedRows(newExpanded)
    }

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'done': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            case 'in-progress': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            case 'review': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
        }
    }

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.wbs_code?.includes(searchQuery)
        )
    }, [tasks, searchQuery])

    // Helper to render hierarchical rows
    const renderRows = (parentId: string | null = null, depth = 0): JSX.Element[] => {
        const children = filteredTasks.filter(t => t.parent_task_id === parentId)
            .sort((a, b) => (a.wbs_code || '').localeCompare(b.wbs_code || ''))

        return children.flatMap(task => {
            const hasChildren = filteredTasks.some(t => t.parent_task_id === task.id)
            const isExpanded = expandedRows.has(task.id)

            return (
                <>
                    <tr 
                        key={task.id} 
                        className="group border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                        <td className="py-4 pl-4 pr-2">
                            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                                {hasChildren ? (
                                    <button 
                                        onClick={() => toggleRow(task.id)}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                                    >
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                ) : (
                                    <div className="w-6" />
                                )}
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 w-12 shrink-0">
                                    {task.wbs_code}
                                </span>
                                <span className={`font-bold text-sm ${depth === 0 ? 'text-slate-900 dark:text-white underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {task.title}
                                </span>
                            </div>
                        </td>
                        <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${getStatusColor(task.status)}`}>
                                    {task.status}
                                </span>
                            </div>
                        </td>
                        <td className="py-4 px-4">
                           <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden min-w-[100px]">
                               <div 
                                    className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500"
                                    style={{ width: `${task.progress_percent}%` }}
                               />
                           </div>
                           <span className="text-[10px] font-black text-slate-400 mt-1 block tracking-tighter">{task.progress_percent}% COMPLETE</span>
                        </td>
                        <td className="py-4 px-4">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {task.assignee_email || '—'}
                            </span>
                        </td>
                    </tr>
                    {hasChildren && isExpanded && renderRows(task.id, depth + 1)}
                </>
            )
        })
    }

    if (!sheetId) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Filter className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Select a Sheet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                    Choose a specific synced sheet from the bottom bar to explore its WBS hierarchy and audit progress integrity.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
            {/* Explorer Toolbar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-transparent flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <TableIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight shrink-0">WBS Explorer</h3>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">High Integrity Oversight</p>
                        </div>
                    </div>
                    
                    <div className="relative group w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                            type="text"
                            placeholder="Filter task or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchTasks}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-all active:rotate-180 duration-500"
                        title="Force Refresh Sync"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Explorer Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                {loading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Auditing Data Integrity...</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-slate-900 dark:text-slate-200 font-bold">No Synced WBS Found</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            This team hasn't linked a Google Sheet yet, or the sheet does not follow the required WBS schema.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
                            <tr>
                                <th className="py-4 pl-4 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Structural Breakdown (WBS)</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</th>
                                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Assignee</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderRows()}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
