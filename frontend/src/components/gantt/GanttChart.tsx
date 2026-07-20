'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/api/client';
import { ChevronDown, ChevronRight, Filter, ZoomIn, ZoomOut, Calendar } from 'lucide-react';
import { format, addDays, differenceInDays, startOfWeek, parseISO, isValid } from 'date-fns';

interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  wbs_code: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  assignee_names: string[];
  parent_task_id: string | null;
}

interface Dependency {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
}

interface Member { id: string; name: string; }

interface Props {
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-500',
  in_progress: 'bg-blue-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500'
};

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-4 border-red-500',
  high: 'border-l-4 border-orange-500',
  medium: 'border-l-4 border-yellow-500',
  low: 'border-l-4 border-sky-400'
};

const DAY_WIDTH = { day: 64, week: 48, month: 16 };
type ZoomLevel = 'day' | 'week' | 'month';

export default function GanttChart({ projectId }: Props) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const params = new URLSearchParams();
    if (filterPriority) params.set('priority', filterPriority);
    if (filterAssignee) params.set('assignee', filterAssignee);

    setLoading(true);
    setError(null);
    apiClient.get(`/projects/${projectId}/gantt?${params}`)
      .then(r => {
        setTasks(r.data.tasks || []);
        setDependencies(r.data.dependencies || []);
        setMembers(r.data.members || []);
      })
      .catch(err => {
        console.error('Gantt fetch error:', err);
        const msg = err?.response?.data?.error || 'Failed to load Gantt data';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [projectId, filterPriority, filterAssignee]);

  const { chartStart, chartEnd, dayCount } = useMemo(() => {
    const datesWithTasks = tasks.flatMap(t => [
      t.start_date ? parseISO(t.start_date) : null,
      t.due_date ? parseISO(t.due_date) : null
    ]).filter((d): d is Date => d !== null && isValid(d));

    if (datesWithTasks.length === 0) {
      const today = new Date();
      return { chartStart: today, chartEnd: addDays(today, 30), dayCount: 30 };
    }

    const minDate = addDays(new Date(Math.min(...datesWithTasks.map(d => d.getTime()))), -3);
    const maxDate = addDays(new Date(Math.max(...datesWithTasks.map(d => d.getTime()))), 7);
    const dayCount = differenceInDays(maxDate, minDate);
    return { chartStart: minDate, chartEnd: maxDate, dayCount };
  }, [tasks]);

  const dw = DAY_WIDTH[zoom];

  const getBarProps = (task: GanttTask) => {
    if (!task.start_date && !task.due_date) return null;
    const start = task.start_date ? parseISO(task.start_date) : parseISO(task.due_date!);
    const end = task.due_date ? parseISO(task.due_date) : addDays(start, 1);
    const left = Math.max(0, differenceInDays(start, chartStart)) * dw;
    const width = Math.max(dw, differenceInDays(end, start) * dw);
    return { left, width };
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const visibleTasks = tasks.filter(t => {
    if (!t.parent_task_id) return true;
    return !collapsed.has(t.parent_task_id);
  });

  const hasChildren = (id: string) => tasks.some(t => t.parent_task_id === id);

  // Build column headers
  const columns: { label: string; days: number }[] = useMemo(() => {
    const cols: { label: string; days: number }[] = [];
    if (zoom === 'day') {
      for (let i = 0; i < dayCount; i++) {
        cols.push({ label: format(addDays(chartStart, i), 'MMM d'), days: 1 });
      }
    } else if (zoom === 'week') {
      let cur = startOfWeek(chartStart);
      while (cur < chartEnd) {
        cols.push({ label: format(cur, 'MMM d'), days: 7 });
        cur = addDays(cur, 7);
      }
    } else {
      let cur = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
      while (cur < chartEnd) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        cols.push({ label: format(cur, 'MMM yyyy'), days: differenceInDays(next, cur) });
        cur = next;
      }
    }
    return cols;
  }, [zoom, chartStart, chartEnd, dayCount]);

  const totalWidth = dayCount * dw;

  // Pre-compute left offset for each column so rows don't redo it
  const colOffsets = useMemo(() =>
    columns.map((_, i) => columns.slice(0, i).reduce((s, c) => s + c.days * dw, 0)),
    [columns, dw]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mr-3" />
        Loading Gantt chart...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg p-8 text-center">
        <p className="text-red-500 font-medium mb-2">Failed to load Gantt data</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <p className="text-slate-400 text-xs mt-3">
          If you see a database column error, restart the backend to apply pending migrations.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 dark:border-slate-700/40 bg-white/30 dark:bg-slate-800/30 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-sky-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Timeline</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority filter */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/40 dark:border-slate-700/40 overflow-hidden p-0.5">
            {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`text-xs px-3 py-1.5 capitalize rounded-lg transition-all duration-200 ${zoom === z
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/60'}`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto bg-white dark:bg-slate-900" style={{ maxHeight: 'calc(100vh - 220px)', minHeight: '400px' }}>
        <div className="flex min-h-full">
          {/* Left panel: task list — sticky so it doesn't scroll away horizontally */}
          <div className="min-w-[300px] w-[300px] border-r border-slate-200 dark:border-slate-700 flex-shrink-0 sticky left-0 z-10 bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="h-12 px-3 flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 sticky top-0 z-20">
              Task
            </div>
            {visibleTasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">No tasks found for this project.</div>
            ) : (
              visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className={`h-12 flex items-center border-b border-slate-100 dark:border-slate-800 text-sm gap-1 ${PRIORITY_BORDER[task.priority] || ''}`}
                  style={{ paddingLeft: task.parent_task_id ? 28 : 8 }}
                >
                  {hasChildren(task.id) ? (
                    <button onClick={() => toggleCollapse(task.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                      {collapsed.has(task.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="w-3.5 flex-shrink-0" />
                  )}
                  <span className="text-xs text-slate-400 w-10 flex-shrink-0 font-mono">{task.wbs_code}</span>
                  <span className="truncate text-slate-700 dark:text-slate-200 text-xs font-medium pr-2">{task.title}</span>
                </div>
              ))
            )}
          </div>

          {/* Right panel: Gantt bars */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: Math.max(totalWidth, 800), position: 'relative' }}>
              {/* Column headers — sticky top */}
              <div className="h-12 flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center"
                    style={{ width: col.days * dw }}
                  >
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">{col.label}</span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {visibleTasks.map(task => {
                const bar = getBarProps(task);
                const colorClass = STATUS_COLORS[task.status] || 'bg-slate-500';

                return (
                  <div
                    key={task.id}
                    className="h-12 border-b border-slate-100 dark:border-slate-800 relative"
                    style={{ width: Math.max(totalWidth, 800) }}
                  >
                    {/* Alternating row background */}
                    <div className="absolute inset-0 bg-white dark:bg-slate-900" />

                    {/* Grid column lines */}
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-r border-slate-100/80 dark:border-slate-800"
                        style={{ left: colOffsets[i], width: col.days * dw }}
                      />
                    ))}

                    {/* Task bar */}
                    {bar && (
                      <div
                        className={`absolute top-2.5 h-7 rounded-md flex items-center overflow-hidden ${colorClass} shadow`}
                        style={{ left: bar.left + 2, width: Math.max(bar.width - 4, 40) }}
                        title={`${task.title} — ${task.status.replace('_', ' ')} (${task.progress || 0}%)`}
                      >
                        {/* Progress fill overlay */}
                        <div
                          className="absolute left-0 top-0 h-full bg-white/25 rounded-l-md"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                        <span className="relative text-white text-xs font-medium px-2.5 truncate z-10 drop-shadow-sm">{task.title}</span>
                      </div>
                    )}

                    {/* No-date indicator */}
                    {!bar && (
                      <div className="absolute inset-y-0 left-2 flex items-center">
                        <span className="text-xs text-slate-300 dark:text-slate-700 italic">no dates set</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dependency arrows SVG overlay — drawn on top of all rows */}
              {dependencies.length > 0 && (() => {
                const ROW_H = 48;    // h-12
                const HEADER_H = 48; // header row height
                const totalH = HEADER_H + visibleTasks.length * ROW_H;
                const chartW = Math.max(totalWidth, 800);

                return (
                  <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ width: chartW, height: totalH }}
                    overflow="visible"
                  >
                    <defs>
                      <marker
                        id="dep-arrowhead"
                        markerWidth="8"
                        markerHeight="6"
                        refX="7"
                        refY="3"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        <polygon points="0 0, 8 3, 0 6" fill="#818cf8" fillOpacity="0.9" />
                      </marker>
                    </defs>
                    {dependencies.map((dep) => {
                      const fromIdx = visibleTasks.findIndex(t => t.id === dep.depends_on_task_id);
                      const toIdx   = visibleTasks.findIndex(t => t.id === dep.task_id);
                      if (fromIdx === -1 || toIdx === -1) return null;

                      const fromBar = getBarProps(visibleTasks[fromIdx]);
                      const toBar   = getBarProps(visibleTasks[toIdx]);
                      if (!fromBar || !toBar) return null;

                      // Start: right edge of predecessor bar centre
                      const x1 = fromBar.left + fromBar.width + 2;
                      const y1 = HEADER_H + fromIdx * ROW_H + ROW_H / 2;
                      // End: left edge of successor bar centre
                      const x2 = toBar.left + 2;
                      const y2 = HEADER_H + toIdx * ROW_H + ROW_H / 2;

                      // Bézier control points — stretch horizontally by 25% of the span
                      // or at least 50px so the curve is visible even when bars are on the same date
                      const spread = Math.max(50, Math.abs(x2 - x1) * 0.4);
                      const cp1x = x1 + spread;
                      const cp2x = x2 - spread;
                      const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

                      return (
                        <path
                          key={`${dep.task_id}-${dep.depends_on_task_id}`}
                          d={d}
                          fill="none"
                          stroke="#818cf8"
                          strokeWidth="1.5"
                          strokeOpacity="0.8"
                          strokeLinecap="round"
                          markerEnd="url(#dep-arrowhead)"
                        />
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/40 dark:border-slate-700/40 bg-white/30 dark:bg-slate-800/30 flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
        {dependencies.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <svg width="36" height="14" className="flex-shrink-0" overflow="visible">
              <defs>
                <marker id="leg-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                  <polygon points="0 0, 8 3, 0 6" fill="#818cf8" fillOpacity="0.9" />
                </marker>
              </defs>
              <path d="M 2 7 C 12 7, 18 7, 28 7" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.8" markerEnd="url(#leg-arrow)" />
            </svg>
            <span className="text-xs text-slate-400">{dependencies.length} dependenc{dependencies.length !== 1 ? 'ies' : 'y'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
