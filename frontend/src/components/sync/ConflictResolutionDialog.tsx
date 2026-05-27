'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { AlertTriangle, CheckCircle2, X, ClipboardList } from 'lucide-react';

interface Conflict {
  task_id: string;
  title: string;
  kanban_status: string;
  sheet_status: string;
  kanban_due_date: string | null;
  sheet_due_date: string | null;
}

interface LogEntry {
  id: string;
  task_title: string;
  field_name: string;
  resolution: string;
  resolved_by_name: string;
  resolved_at: string;
  sheet_value: string;
  kanban_value: string;
}

interface Props {
  projectId: string;
  onClose?: () => void;
}

type Resolution = 'keep_sheet' | 'keep_kanban' | 'merged';

export default function ConflictResolutionDialog({ projectId, onClose }: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [tab, setTab] = useState<'conflicts' | 'log'>('conflicts');
  const [mergeValues, setMergeValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  const load = async () => {
    const [conflictsRes, logRes] = await Promise.all([
      apiClient.get(`/conflicts?project_id=${projectId}`),
      apiClient.get(`/conflicts/log?project_id=${projectId}`)
    ]);
    setConflicts(conflictsRes.data.conflicts);
    setLog(logRes.data.log);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const resolve = async (conflict: Conflict, field: 'status' | 'due_date', resolution: Resolution) => {
    const key = `${conflict.task_id}-${field}`;
    setResolving(key);

    const sheetVal = field === 'status' ? conflict.sheet_status : conflict.sheet_due_date;
    const kanbanVal = field === 'status' ? conflict.kanban_status : conflict.kanban_due_date;

    try {
      await apiClient.post('/conflicts/resolve', {
        task_id: conflict.task_id,
        project_id: projectId,
        field_name: field,
        resolution,
        sheet_value: sheetVal,
        kanban_value: kanbanVal,
        merged_value: resolution === 'merged' ? (mergeValues[key] || kanbanVal) : undefined
      });
      setToast(`Resolved: ${conflict.title} — ${field}`);
      setTimeout(() => setToast(''), 3000);
      await load();
    } catch (err: any) {
      setToast(`Error: ${err.response?.data?.error || 'Resolution failed'}`);
    } finally {
      setResolving(null);
    }
  };

  const ResolutionBadge = ({ label, color }: { label: string; color: string }) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${color}`}>{label}</span>
  );

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 bg-white/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Conflict Resolution</h2>
          {conflicts.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {conflicts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/40 p-1 text-xs">
            <button
              onClick={() => setTab('conflicts')}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${tab === 'conflicts' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            >
              Conflicts
            </button>
            <button
              onClick={() => setTab('log')}
              className={`px-3 py-1.5 flex items-center gap-1 rounded-lg transition-all duration-200 ${tab === 'log' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Log
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 max-h-[70vh] overflow-y-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-8 text-sm">Detecting conflicts...</div>
        ) : tab === 'conflicts' ? (
          conflicts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-slate-500 text-sm">No conflicts detected. Sheet and Kanban are in sync.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map(conflict => (
                <div key={conflict.task_id} className="border border-amber-100/60 rounded-xl overflow-hidden bg-amber-50/70 backdrop-blur-sm">
                  <div className="px-4 py-2 font-medium text-sm text-slate-700 border-b border-amber-100/50">
                    {conflict.title}
                  </div>

                  {conflict.kanban_status !== conflict.sheet_status && (
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-semibold uppercase tracking-wide">Status Conflict</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Sheet Value</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{conflict.sheet_status}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Kanban Value</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{conflict.kanban_status}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {(['keep_sheet', 'keep_kanban', 'merged'] as Resolution[]).map(r => (
                          <button
                            key={r}
                            onClick={() => resolve(conflict, 'status', r)}
                            disabled={resolving === `${conflict.task_id}-status`}
                            className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 hover:text-sky-600 disabled:opacity-50 transition-colors"
                          >
                            {r === 'keep_sheet' ? 'Use Sheet' : r === 'keep_kanban' ? 'Use Kanban' : 'Merge'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {conflict.kanban_due_date !== conflict.sheet_due_date && conflict.sheet_due_date && (
                    <div className="p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-semibold uppercase tracking-wide">Due Date Conflict</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Sheet Value</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{conflict.sheet_due_date?.split('T')[0]}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Kanban Value</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{conflict.kanban_due_date?.split('T')[0] || '—'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => resolve(conflict, 'due_date', 'keep_sheet')} disabled={!!resolving} className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 hover:text-sky-600 disabled:opacity-50">Use Sheet</button>
                        <button onClick={() => resolve(conflict, 'due_date', 'keep_kanban')} disabled={!!resolving} className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 hover:text-sky-600 disabled:opacity-50">Use Kanban</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {log.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm">No resolution history yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wide">
                    <th className="text-left pb-2">Task</th>
                    <th className="text-left pb-2">Field</th>
                    <th className="text-left pb-2">Resolution</th>
                    <th className="text-left pb-2">By</th>
                    <th className="text-left pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(entry => (
                    <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{entry.task_title}</td>
                      <td className="py-2 pr-3 capitalize text-slate-500">{entry.field_name}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          entry.resolution === 'keep_kanban' ? 'bg-sky-100 text-sky-700' :
                          entry.resolution === 'keep_sheet' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {entry.resolution.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-xs">{entry.resolved_by_name}</td>
                      <td className="py-2 text-slate-400 text-xs">{new Date(entry.resolved_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="m-4 flex items-center gap-2 text-sm text-white bg-slate-700 rounded-lg px-4 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
