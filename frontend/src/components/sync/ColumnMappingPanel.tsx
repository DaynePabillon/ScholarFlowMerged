'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Columns, Plus, Trash2, Save, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';

const KANBAN_COLUMNS = ['todo', 'in_progress', 'review', 'done', 'blocked'];

interface Mapping { sheet_column: string; kanban_column: string; id?: string; }

interface Props {
  projectId: string;
  syncedSheetId?: string;
  sheetColumns: string[];
  onSaved?: () => void;
}

export default function ColumnMappingPanel({ projectId, syncedSheetId, sheetColumns, onSaved }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>([{ sheet_column: '', kanban_column: 'todo' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (syncedSheetId) params.set('synced_sheet_id', syncedSheetId);
    else params.set('project_id', projectId);

    apiClient.get(`/column-mappings?${params}`)
      .then(r => {
        if (r.data.mappings.length > 0) {
          setMappings(r.data.mappings.map((m: any) => ({
            id: m.id,
            sheet_column: m.sheet_column,
            kanban_column: m.kanban_column
          })));
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, syncedSheetId]);

  const addRow = () => setMappings(prev => [...prev, { sheet_column: '', kanban_column: 'todo' }]);

  const updateRow = (i: number, field: keyof Mapping, value: string) => {
    setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const removeRow = (i: number) => setMappings(prev => prev.filter((_, idx) => idx !== i));

  const validate = (): string[] => {
    const errs: string[] = [];
    const sheetCols = new Set<string>();
    const kanbanCols = new Set<string>();
    mappings.forEach((m, i) => {
      if (!m.sheet_column) errs.push(`Row ${i + 1}: sheet column is empty`);
      if (sheetCols.has(m.sheet_column)) errs.push(`Row ${i + 1}: duplicate sheet column "${m.sheet_column}"`);
      if (kanbanCols.has(m.kanban_column)) errs.push(`Row ${i + 1}: duplicate Kanban target "${m.kanban_column}"`);
      sheetCols.add(m.sheet_column);
      kanbanCols.add(m.kanban_column);
    });
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    try {
      await apiClient.post('/column-mappings', {
        project_id: projectId,
        synced_sheet_id: syncedSheetId || null,
        mappings: mappings.filter(m => m.sheet_column)
      });
      setSuccess('Mappings saved successfully');
      onSaved?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const details = err.response?.data?.details || [err.response?.data?.error || 'Save failed'];
      setErrors(details);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-24 text-slate-400 text-sm">Loading mappings...</div>;
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 bg-white/30">
        <div className="flex items-center gap-2">
          <Columns className="h-4 w-4 text-sky-500" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Column Mapping</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-600 rounded px-2 py-1"
          >
            <Eye className="h-3.5 w-3.5" />
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={addRow}
            disabled={preview}
            className="flex items-center gap-1 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-md disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-all duration-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          <span>Sheet Column</span>
          <span>Kanban Column</span>
          <span />
        </div>

        {mappings.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
            {preview ? (
              <>
                <div className="bg-slate-50 dark:bg-slate-800 rounded px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">{m.sheet_column}</div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 capitalize">{m.kanban_column.replace('_', ' ')}</div>
              </>
            ) : (
              <>
                {sheetColumns.length > 0 ? (
                  <select
                    value={m.sheet_column}
                    onChange={e => updateRow(i, 'sheet_column', e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select column…</option>
                    {sheetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    value={m.sheet_column}
                    onChange={e => updateRow(i, 'sheet_column', e.target.value)}
                    placeholder="e.g. Status"
                    className="border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  />
                )}
                <select
                  value={m.kanban_column}
                  onChange={e => updateRow(i, 'kanban_column', e.target.value)}
                  className="border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  {KANBAN_COLUMNS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </>
            )}
            {!preview && (
              <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 flex items-center justify-center">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-1">
            {errors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {e}
              </div>
            ))}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Save button */}
        {!preview && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-300"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save & Apply Mapping'}
          </button>
        )}
      </div>
    </div>
  );
}
