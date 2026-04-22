"use client"

import React, { useRef, useState, useEffect, useMemo, useCallback, memo, DragEvent } from 'react'
import { Plus, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import ProfessionalTaskCard from './ProfessionalTaskCard'

interface Task {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    due_date?: string
    project_name?: string
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
    canDrag?: boolean
    role?: 'admin' | 'student' | 'manager'
    theme?: 'admin' | 'manager' | 'advisor'
}

export default function ProfessionalKanban({
    tasks,
    onTaskClick,
    onStatusChange,
    onAddTask,
    onDeleteTask,
    onArchiveTask,
    onProgressChange,
    canDrag = true,
    role = 'student',
    theme = 'admin'
}: ProfessionalKanbanProps) {
    const isManager = theme === 'manager';
    const accentColor = isManager ? 'indigo' : 'blue';
    const secondaryColor = isManager ? 'violet' : 'cyan';

    const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

    const columns = [
        { id: 'todo', label: 'To Do', color: 'bg-slate-400', headerBg: 'from-slate-500 to-slate-600' },
        { id: 'in_progress', label: 'In Progress', color: `bg-${accentColor}-500`, headerBg: `from-${accentColor}-500 to-${secondaryColor}-500` },
        { id: 'review', label: 'Review', color: 'bg-purple-500', headerBg: 'from-purple-500 to-indigo-500' },
        { id: 'done', label: 'Done', color: 'bg-emerald-500', headerBg: 'from-emerald-500 to-teal-500' }
    ]

    const [draggedTask, setDraggedTask] = useState<Task | null>(null)
    const draggedTaskRef = useRef<Task | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<{col: string, module: string} | null>(null)

    // Helper: Extract numeric WBS code
    const extractWbs = useCallback((code: string): string => {
        const m = code.match(/^(\d+(?:\.\d+)*)/);
        return m ? m[1] : code;
    }, []);

    // Grouping Tasks by Module
    const moduleGroups = useMemo(() => {
        return tasks.reduce((acc: Record<string, Task[]>, task: Task) => {
            const wbs = task.wbs_code ? extractWbs(task.wbs_code) : '';
            const moduleCode = wbs.split('.')[0] || 'Uncategorized';
            if (!acc[moduleCode]) acc[moduleCode] = [];
            acc[moduleCode].push({ ...task, wbs_code: wbs });
            return acc;
        }, {});
    }, [tasks, extractWbs]);

    const sortedModuleCodes = useMemo(() => {
        return Object.keys(moduleGroups).sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true })
        );
    }, [moduleGroups]);

    const handleDragStart = (e: DragEvent<HTMLDivElement>, task: Task) => {
        if (!canDrag) return
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
        draggedTaskRef.current = task
        // Don't set React state here — it triggers a re-render mid-drag that
        // can cancel the drag operation. Browser's native drag ghost is enough.
    }

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        setDragOverColumn(null)
        const task = draggedTaskRef.current
        if (task && onStatusChange) {
            const currentStatus = (task.status || '').toLowerCase().replace(/[- ]/g, '_')
            if (currentStatus !== newStatus) {
                onStatusChange(task.id, newStatus)
            }
        }
        draggedTaskRef.current = null
        setDraggedTask(null)
    }

    // Always clean up drag state, even if drop is cancelled (outside any column)
    const handleDragEnd = () => {
        draggedTaskRef.current = null
        setDraggedTask(null)
        setDragOverColumn(null)
    }

    const toggleModule = (code: string) => {
        const newCollapsed = new Set(collapsedModules);
        if (newCollapsed.has(code)) newCollapsed.delete(code);
        else newCollapsed.add(code);
        setCollapsedModules(newCollapsed);
    }

    // Priority ordering — critical tasks bubble to the top of each column.
    const priorityRank = (p?: string) => {
        const v = (p || '').toLowerCase();
        if (v === 'critical') return 0;
        if (v === 'high') return 1;
        if (v === 'medium') return 2;
        if (v === 'low') return 3;
        return 4;
    };

    const sortByPriorityThenWbs = (a: any, b: any) => {
        const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (pDiff !== 0) return pDiff;
        return (a.wbs_code || '').localeCompare(b.wbs_code || '', undefined, { numeric: true });
    };

    const buildTaskTree = useCallback((taskList: Task[]): any[] => {
        const nodes = taskList.map(t => ({ ...t, children: [] as any[] }));
        const nodeMap: Record<string, any> = {};
        nodes.forEach(n => nodeMap[n.id] = n);

        const roots: any[] = [];
        nodes.forEach(n => {
            if (n.parent_task_id && nodeMap[n.parent_task_id]) {
                nodeMap[n.parent_task_id].children.push(n);
            } else {
                roots.push(n);
            }
        });

        // Sort children too so priority ordering is recursive
        Object.values(nodeMap).forEach((n: any) => {
            if (n.children && n.children.length > 0) {
                n.children.sort(sortByPriorityThenWbs);
            }
        });

        return roots.sort(sortByPriorityThenWbs);
    }, []);

    const renderTask = useCallback((task: any, depth: number = 0) => (
        <div key={task.id} className="relative">
            <div
                draggable={canDrag}
                onDragStart={(e) => handleDragStart(e, task)}
                onDragEnd={handleDragEnd}
            >
                <ProfessionalTaskCard
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    onStatusChange={onStatusChange}
                    onDelete={onDeleteTask}
                    onArchive={onArchiveTask}
                    onProgressChange={onProgressChange}
                    role={role}
                />
            </div>
            {task.children && task.children.length > 0 && (
                <div className="mt-4 ml-6 space-y-4 border-l-2 border-gray-100 dark:border-white/5 pl-6">
                    {task.children.map((child: any) => renderTask(child, depth + 1))}
                </div>
            )}
        </div>
    ), [canDrag, onTaskClick, onStatusChange, onDeleteTask, onArchiveTask, onProgressChange, role]);

    const boardData = useMemo(() => {
        return sortedModuleCodes.map(code => {
            const moduleTasks = moduleGroups[code] || [];
            const columnData = columns.map(col => {
                const colTasks = moduleTasks.filter((t: Task) => {
                    const nStatus = (t.status || '').toLowerCase().replace(/[- ]/g, '_');
                    if (col.id === 'done') return nStatus === 'done' || nStatus === 'completed';
                    return nStatus === col.id;
                });
                return {
                    ...col,
                    tree: buildTaskTree(colTasks),
                    taskCount: colTasks.length,
                    tasks: colTasks
                };
            });
            return { code, columns: columnData };
        });
    }, [sortedModuleCodes, moduleGroups, columns, buildTaskTree]);

    // Refactored KanbanColumn for atomic re-renders
    const KanbanColumn = memo(({ 
        col, 
        moduleCode, 
        isOver, 
        onDragOver, 
        onDragLeave, 
        onDrop, 
        onAddTask, 
        renderTask,
        role: columnRole 
    }: any) => (
        <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`min-h-[200px] p-5 rounded-[2rem] transition-all duration-500 border-2 border-transparent relative overflow-hidden ${
                isOver ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/40 scale-[1.02] shadow-2xl shadow-emerald-500/10 z-10' : 'bg-gray-50/50 dark:bg-slate-800/20 hover:bg-gray-100/50 dark:hover:bg-slate-800/30'
            }`}
        >
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/[0.01] dark:from-white/[0.02] to-transparent pointer-events-none" />
            
            <div className="space-y-6 relative z-10">
                {col.tree.map((task: any) => renderTask(task))}
                {col.taskCount === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center opacity-20 dark:opacity-10 transition-all duration-700">
                        <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-400 mb-3 rotate-45 transition-transform duration-1000" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-400">Idle</span>
                    </div>
                )}
            </div>
            
            {columnRole !== 'student' && (
                <button
                    onClick={() => onAddTask?.(col.id)}
                    className="w-full mt-6 group/btn flex items-center justify-center gap-3 py-3 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/5 hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-all duration-300"
                >
                    <div className="p-1 bg-gray-100 dark:bg-white/5 rounded-lg group-hover/btn:bg-emerald-500 group-hover/btn:text-white transition-colors">
                        <Plus className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 group-hover/btn:text-emerald-500 dark:group-hover/btn:text-emerald-400">Add Task</span>
                </button>
            )}
        </div>
    ));

    const [lastDragOverUpdate, setLastDragOverUpdate] = useState(0);
    const throttledSetDragOverColumn = useCallback((data: any) => {
        const now = Date.now();
        if (now - lastDragOverUpdate > 50 || data === null) {
            setDragOverColumn(data);
            setLastDragOverUpdate(now);
        }
    }, [lastDragOverUpdate]);

    return (
        <div className="flex flex-col h-full bg-white/95 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.5rem] border border-gray-200 dark:border-slate-700/50 overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/40">
            {/* Sticky Header Row */}
            <div className="grid grid-cols-4 gap-6 p-8 bg-gray-50/80 dark:bg-slate-950/60 border-b border-gray-200 dark:border-slate-700/50 z-30 sticky top-0 backdrop-blur-md">
                {columns.map(col => (
                    <div key={col.id} className="flex items-center justify-between px-3">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${col.color} shadow-sm ring-4 ring-gray-100 dark:ring-white/5`} />
                            <h3 className="font-black text-gray-700 dark:text-slate-100 text-[10px] uppercase tracking-[0.2em]">{col.label}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Scrollable Swimlane Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                {boardData.map((moduleData) => {
                    const isCollapsed = collapsedModules.has(moduleData.code);
                    const moduleTasks = moduleGroups[moduleData.code] || [];
                    const moduleTitleTask = moduleTasks.find(t => t.wbs_code === moduleData.code) || moduleTasks[0];
                    
                    return (
                        <div key={moduleData.code} className="group/swimlane animate-in slide-in-from-bottom-4 duration-500">
                            {/* Swimlane Header */}
                            <div 
                                onClick={() => toggleModule(moduleData.code)}
                                className="flex items-center justify-between mb-8 cursor-pointer group/header"
                            >
                                <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/10 dark:from-emerald-500/20 via-emerald-500/5 to-transparent pl-4 pr-10 py-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 backdrop-blur-xl shadow-lg shadow-emerald-500/5">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 tracking-[0.1em] uppercase opacity-70">
                                            Phase {moduleData.code}
                                        </span>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-md uppercase tracking-tight">
                                            {moduleTitleTask.title}
                                        </h4>
                                    </div>
                                    <div className={`ml-4 w-6 h-6 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 transition-all ${isCollapsed ? '' : 'rotate-90 bg-emerald-500/20 border-emerald-500/30'}`}>
                                        <ChevronRight className={`w-4 h-4 ${isCollapsed ? 'text-gray-400 dark:text-slate-500' : 'text-emerald-500 dark:text-emerald-400'}`} />
                                    </div>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 via-gray-200 dark:via-white/5 to-transparent" />
                            </div>

                            {!isCollapsed && (
                                <div className="grid grid-cols-4 gap-6 items-start">
                                    {moduleData.columns.map(col => (
                                        <KanbanColumn
                                            key={col.id}
                                            col={col}
                                            moduleCode={moduleData.code}
                                            isOver={dragOverColumn?.col === col.id && dragOverColumn?.module === moduleData.code}
                                            onDragOver={(e: any) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                                throttledSetDragOverColumn({ col: col.id, module: moduleData.code });
                                            }}
                                            onDragLeave={(e: any) => {
                                                // Only clear drop-target state when the cursor truly
                                                // leaves the column — not when crossing into a
                                                // child element (task cards, gradient overlay, etc.)
                                                const relatedTarget = e.relatedTarget as Node | null;
                                                if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
                                                throttledSetDragOverColumn(null);
                                            }}
                                            onDrop={(e: any) => handleDrop(e, col.id)}
                                            onAddTask={onAddTask}
                                            renderTask={renderTask}
                                            role={role}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

