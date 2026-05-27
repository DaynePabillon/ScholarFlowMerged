'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Grid3x3, Link2Off, RefreshCw, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';

interface Workbook { id: string; name: string; webUrl: string; }
interface Worksheet { id: string; name: string; }
interface Props { organizationId: string; projectId: string; }

export default function Microsoft365Settings({ organizationId, projectId }: Props) {
  const [status, setStatus] = useState<{ connected: boolean; configured: boolean; account?: any }>({ connected: false, configured: false });
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedWorkbook, setSelectedWorkbook] = useState('');
  const [selectedWorksheet, setSelectedWorksheet] = useState('');
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({ title: '', status: '', due_date: '' });
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/ms365/status?organization_id=${organizationId}`),
      apiClient.get(`/ms365/config?project_id=${projectId}`)
    ]).then(([statusRes, configRes]) => {
      setStatus(statusRes.data);
      if (configRes.data.config) {
        const c = configRes.data.config;
        setConfig(c);
        setSelectedWorkbook(c.workbook_id || '');
        setSelectedWorksheet(c.worksheet_id || '');
        setFieldMappings(c.field_mappings || { title: '', status: '', due_date: '' });
      }
    }).finally(() => setLoading(false));
  }, [organizationId, projectId]);

  const handleConnect = async () => {
    try {
      const res = await apiClient.get(`/ms365/auth?organization_id=${organizationId}`);
      window.location.href = res.data.url;
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to start authorization' });
    }
  };

  const handleDisconnect = async () => {
    await apiClient.delete(`/ms365/disconnect?organization_id=${organizationId}`);
    setStatus(s => ({ ...s, connected: false, account: null }));
    setWorkbooks([]);
    setWorksheets([]);
    setHeaders([]);
  };

  const loadWorkbooks = async () => {
    try {
      const res = await apiClient.get(`/ms365/workbooks?organization_id=${organizationId}`);
      setWorkbooks(res.data.workbooks);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to load workbooks' });
    }
  };

  const handleWorkbookChange = async (id: string) => {
    setSelectedWorkbook(id);
    setSelectedWorksheet('');
    setHeaders([]);
    if (!id) return;
    try {
      const res = await apiClient.get(`/ms365/worksheets?organization_id=${organizationId}&workbook_id=${id}`);
      setWorksheets(res.data.worksheets);
    } catch {}
  };

  const handleWorksheetChange = async (id: string) => {
    setSelectedWorksheet(id);
    setHeaders([]);
    if (!id) return;
    try {
      const res = await apiClient.get(`/ms365/headers?organization_id=${organizationId}&workbook_id=${selectedWorkbook}&worksheet_id=${id}`);
      setHeaders(res.data.headers);
    } catch {}
  };

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await apiClient.post('/ms365/sync', {
        organization_id: organizationId,
        project_id: projectId,
        workbook_id: selectedWorkbook,
        worksheet_id: selectedWorksheet,
        field_mappings: fieldMappings
      });
      setFeedback({ type: 'success', message: `Synced ${res.data.synced} task(s) from Excel` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-24 text-slate-400 text-sm">Checking Microsoft 365 status...</div>;
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 bg-white/30">
        <div className="flex items-center gap-3">
          <div className="bg-[#217346] p-1.5 rounded-lg">
            <Grid3x3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Microsoft 365 / Excel Online</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sync tasks from Excel workbooks</p>
          </div>
        </div>
        {status.connected && (
          <button onClick={handleDisconnect} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1">
            <Link2Off className="h-3.5 w-3.5" />
            Disconnect
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {!status.configured ? (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Microsoft 365 integration is not configured.</p>
            <p className="text-xs text-slate-400">Set MS365_CLIENT_ID and MS365_CLIENT_SECRET in environment variables.</p>
          </div>
        ) : !status.connected ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Connect your Microsoft 365 account to sync tasks from Excel Online.</p>
            <button onClick={handleConnect} className="bg-[#0078d4] hover:bg-[#006ac1] hover:shadow-lg hover:scale-[1.02] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-300">
              Connect Microsoft 365
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50/80 backdrop-blur-sm rounded-xl px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Connected as <strong>{status.account?.ms_user_email}</strong>
            </div>

            {/* Workbook selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Workbook</label>
                {workbooks.length === 0 && (
                  <button onClick={loadWorkbooks} className="text-xs text-sky-600 hover:text-sky-700 underline">Load workbooks</button>
                )}
              </div>
              <select
                value={selectedWorkbook}
                onChange={e => handleWorkbookChange(e.target.value)}
                disabled={workbooks.length === 0}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">Select a workbook…</option>
                {workbooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>

              {worksheets.length > 0 && (
                <select
                  value={selectedWorksheet}
                  onChange={e => handleWorksheetChange(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Select a worksheet…</option>
                  {worksheets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
            </div>

            {/* Field mapping */}
            {headers.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Field Mapping</p>
                {[
                  { key: 'title', label: 'Task Title (required)' },
                  { key: 'status', label: 'Status' },
                  { key: 'due_date', label: 'Due Date' }
                ].map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-2 gap-3 items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                    <select
                      value={fieldMappings[key] || ''}
                      onChange={e => setFieldMappings(m => ({ ...m, [key]: e.target.value }))}
                      className="border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {feedback && (
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                feedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600'
              }`}>
                {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {feedback.message}
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={!selectedWorkbook || !selectedWorksheet || !fieldMappings.title || syncing}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-300"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing from Excel…' : 'Sync Tasks from Excel'}
            </button>

            {config?.last_synced_at && (
              <p className="text-center text-xs text-slate-400">
                Last synced: {new Date(config.last_synced_at).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
