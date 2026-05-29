'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { X, Link2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Task { id: string; title: string; wbs_code: string; status: string; }
interface Dependency {
  id: string;
  task_id: string;
  task_title?: string;
  depends_on_task_id?: string;
  dependency_type: string;
}

interface Props {
  taskId: string;
  taskTitle: string;
  projectId: string;
  onClose: () => void;
}

const DEPENDENCY_TYPES = [
  { value: 'finish_to_start', label: 'Finish → Start (FS)' },
  { value: 'start_to_start', label: 'Start → Start (SS)' },
  { value: 'finish_to_finish', label: 'Finish → Finish (FF)' },
  { value: 'start_to_finish', label: 'Start → Finish (SF)' },
];

export default function DependencyDialog({ taskId, taskTitle, projectId, onClose }: Props) {
  const [blocking, setBlocking] = useState<Dependency[]>([]);
  const [blockedBy, setBlockedBy] = useState<Dependency[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [depType, setDepType] = useState('finish_to_start');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDeps = async () => {
    const [depsRes, tasksRes] = await Promise.all([
      apiClient.get(`/tasks/${taskId}/dependencies`),
      apiClient.get(`/tasks?project_id=${projectId}`)
    ]);
    setBlocking(depsRes.data.blocking);
    setBlockedBy(depsRes.data.blockedBy);
    // GET /api/tasks returns a flat array; guard against both shapes
    const taskList: Task[] = Array.isArray(tasksRes.data)
      ? tasksRes.data
      : (tasksRes.data.tasks || []);
    setAllTasks(taskList.filter((t: Task) => t.id !== taskId));
    setLoading(false);
  };

  useEffect(() => { loadDeps(); }, [taskId]);

  const handleAdd = async () => {
    if (!selectedTask) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.post(`/tasks/${taskId}/dependencies`, {
        depends_on_task_id: selectedTask,
        dependency_type: depType
      });
      setSuccess('Dependency added');
      setSelectedTask('');
      await loadDeps();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add dependency');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (depId: string) => {
    try {
      await apiClient.delete(`/dependencies/${depId}`);
      await loadDeps();
    } catch {
      setError('Failed to remove dependency');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/40">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-sky-500" />
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Dependencies</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{taskTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Blocked by */}
          <section>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Blocked By</h3>
            {loading ? (
              <div className="text-xs text-slate-400">Loading...</div>
            ) : blockedBy.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No blockers – this task can start freely.</div>
            ) : (
              <ul className="space-y-2">
                {blockedBy.map(dep => (
                  <li key={dep.id} className="flex items-center justify-between bg-red-50/80 backdrop-blur-sm rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{dep.task_title || dep.task_id}</span>
                      <span className="ml-2 text-xs text-slate-400">{DEPENDENCY_TYPES.find(d => d.value === dep.dependency_type)?.label}</span>
                    </div>
                    <button onClick={() => handleDelete(dep.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Blocking */}
          <section>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Blocking</h3>
            {!loading && blocking.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Not blocking any other tasks.</div>
            ) : (
              <ul className="space-y-2">
                {blocking.map(dep => (
                  <li key={dep.id} className="flex items-center justify-between bg-amber-50/70 backdrop-blur-sm rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{dep.task_title || dep.task_id}</span>
                    <span className="text-xs text-slate-400">{DEPENDENCY_TYPES.find(d => d.value === dep.dependency_type)?.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Add new dependency */}
          <section className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Add Dependency</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">This task depends on</label>
                <select
                  value={selectedTask}
                  onChange={e => setSelectedTask(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Select a task…</option>
                  {allTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.wbs_code ? `[${t.wbs_code}] ` : ''}{t.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Dependency Type</label>
                <select
                  value={depType}
                  onChange={e => setDepType(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  {DEPENDENCY_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-emerald-600 text-xs bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={!selectedTask || saving}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-300"
              >
                {saving ? 'Adding…' : 'Add Dependency'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
