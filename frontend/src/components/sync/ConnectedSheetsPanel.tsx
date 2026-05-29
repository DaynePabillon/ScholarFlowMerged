'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  Link2, Link2Off, Plus, Search, FileSpreadsheet,
  CheckCircle2, AlertCircle, Loader2, ChevronDown, ExternalLink, Trash2, RefreshCw
} from 'lucide-react';

interface ConnectedSheet {
  id: string;
  sheet_id: string;
  sheet_name: string;
  last_synced_at: string | null;
  sync_status: string;
  task_count: number;
}

interface DriveSheet {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface Props {
  projectId: string;
  organizationId: string;
}

export default function ConnectedSheetsPanel({ projectId, organizationId }: Props) {
  const [sheets, setSheets] = useState<ConnectedSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinker, setShowLinker] = useState(false);
  const [linkerTab, setLinkerTab] = useState<'url' | 'browse'>('url');

  // URL tab state
  const [pastedUrl, setPastedUrl] = useState('');

  // Browse tab state
  const [driveSheets, setDriveSheets] = useState<DriveSheet[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriveSheet, setSelectedDriveSheet] = useState<DriveSheet | null>(null);

  // Shared flow state
  const [step, setStep] = useState<'input' | 'previewing' | 'preview_done' | 'connecting'>('input');
  const [preview, setPreview] = useState<{ name: string; taskCount: number; sheetId: string } | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const loadSheets = useCallback(async () => {
    try {
      const res = await apiClient.get(`/sync/sheets?project_id=${projectId}`);
      setSheets(res.data.sheets || []);
    } catch {
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  /** Get or create a default workspace for this org — mirrors GoogleSheetImportModal */
  const ensureWorkspace = async (): Promise<string | null> => {
    try {
      const res = await apiClient.get(`/workspaces?organizationId=${organizationId}`);
      const workspaces = res.data.workspaces || [];
      if (workspaces.length > 0) return workspaces[0].id;

      const createRes = await apiClient.post('/workspaces', {
        organizationId,
        folderId: 'root',
        folderName: 'SkyFlow Default'
      });
      return createRes.data.workspaceId || null;
    } catch {
      return null;
    }
  };

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const loadDriveSheets = useCallback(async () => {
    setDriveLoading(true);
    try {
      const res = await apiClient.get('/sheets/list');
      setDriveSheets(res.data.files || []);
    } catch {
      setDriveSheets([]);
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const handleTabChange = (tab: 'url' | 'browse') => {
    setLinkerTab(tab);
    setFeedback(null);
    setPreview(null);
    setStep('input');
    if (tab === 'browse' && driveSheets.length === 0) loadDriveSheets();
  };

  // ── Validate / Preview ───────────────────────────────────────────────────

  const handleValidate = async (sheetId: string, sheetName: string) => {
    setStep('previewing');
    setFeedback(null);
    try {
      const wsId = await ensureWorkspace();
      if (!wsId) throw new Error('Could not create workspace');
      setWorkspaceId(wsId);

      const res = await apiClient.post(`/workspaces/${wsId}/preview-sheet`, { sheetId });
      const p = res.data.preview;
      setPreview({ name: sheetName, taskCount: p?.totalTasks ?? 0, sheetId });
      setStep('preview_done');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Could not preview sheet — make sure it is shared (Anyone with the link)' });
      setStep('input');
    }
  };

  const handleValidateUrl = () => {
    const sheetId = extractSheetId(pastedUrl);
    if (!sheetId) {
      setFeedback({ type: 'error', message: 'Paste a valid Google Sheets URL (must contain /d/...)' });
      return;
    }
    handleValidate(sheetId, 'Google Sheet');
  };

  const handleSelectDrive = (sheet: DriveSheet) => {
    setSelectedDriveSheet(sheet);
    setPreview(null);
    setStep('input');
    setFeedback(null);
  };

  const handleValidateDrive = () => {
    if (!selectedDriveSheet) return;
    handleValidate(selectedDriveSheet.id, selectedDriveSheet.name);
  };

  // ── Connect ──────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!preview || !workspaceId) return;
    setStep('connecting');
    setFeedback(null);
    try {
      await apiClient.post(`/workspaces/${workspaceId}/connect-sheet`, {
        sheetId: preview.sheetId,
        sheetName: preview.name,
        projectId
      });
      setFeedback({ type: 'success', message: `"${preview.name}" connected — ${preview.taskCount} tasks imported` });
      setShowLinker(false);
      setPastedUrl('');
      setPreview(null);
      setSelectedDriveSheet(null);
      setStep('input');
      await loadSheets();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to connect sheet' });
      setStep('preview_done');
    }
  };

  // ── Unlink ───────────────────────────────────────────────────────────────

  const handleUnlink = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from this project? Tasks synced from it will also be deleted.`)) return;
    try {
      await apiClient.delete(`/sync/sheets/${id}`);
      setSheets(prev => prev.filter(s => s.id !== id));
    } catch {
      setFeedback({ type: 'error', message: 'Failed to unlink sheet' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const filteredDrive = driveSheets.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const busy = step === 'previewing' || step === 'connecting';

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/40 bg-white/30">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Connected Google Sheets</span>
          {sheets.length > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {sheets.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowLinker(l => !l); setFeedback(null); }}
          className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-500 to-purple-500 text-white px-3 py-1.5 rounded-lg font-medium hover:shadow-md hover:scale-[1.02] transition-all duration-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Link a Sheet
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showLinker ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="p-5 space-y-4">

        {/* Feedback banner */}
        {feedback && (
          <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}>
            {feedback.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* Connected sheets list */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : sheets.length === 0 && !showLinker ? (
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No sheets connected</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Link a Google Sheet to this project so you can sync tasks, detect conflicts, and map column values.
              </p>
            </div>
            <button
              onClick={() => setShowLinker(true)}
              className="text-xs text-violet-600 hover:text-violet-700 underline underline-offset-2"
            >
              Link your first sheet →
            </button>
          </div>
        ) : (
          sheets.length > 0 && (
            <div className="space-y-2">
              {sheets.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50/80 rounded-xl px-4 py-3 border border-white/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{s.sheet_name}</p>
                      <p className="text-xs text-slate-400">
                        {s.task_count} task{s.task_count !== 1 ? 's' : ''}
                        {s.last_synced_at && ` · Last synced ${new Date(s.last_synced_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.sync_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      s.sync_status === 'error' ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {s.sync_status || 'active'}
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${s.sheet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-sky-500 rounded-lg hover:bg-sky-50 transition-colors"
                      title="Open in Google Sheets"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleUnlink(s.id, s.sheet_name)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Unlink sheet"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Sheet linker — expands inline */}
        {showLinker && (
          <div className="border border-violet-100 rounded-2xl overflow-hidden bg-violet-50/30">
            {/* Tab switcher */}
            <div className="flex gap-1 p-3 border-b border-violet-100/60 bg-white/40">
              {(['url', 'browse'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    linkerTab === t
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white/60'
                  }`}
                >
                  {t === 'url' ? 'Paste URL' : 'Browse My Sheets'}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3">
              {/* ── URL tab ── */}
              {linkerTab === 'url' && (
                <>
                  <p className="text-xs text-slate-500">
                    Paste a Google Sheets URL. The sheet must be shared to <strong>"Anyone with the link"</strong> (Viewer or higher).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={pastedUrl}
                      onChange={e => { setPastedUrl(e.target.value); setPreview(null); setStep('input'); }}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                    <button
                      onClick={handleValidateUrl}
                      disabled={!pastedUrl.trim() || busy}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl disabled:opacity-50 hover:shadow-md transition-all duration-200"
                    >
                      {step === 'previewing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Validate
                    </button>
                  </div>
                </>
              )}

              {/* ── Browse tab ── */}
              {linkerTab === 'browse' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search your sheets…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                  </div>

                  {driveLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading your sheets…
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-100 bg-white/80">
                      {filteredDrive.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No sheets found</p>
                      ) : (
                        filteredDrive.map(s => (
                          <button
                            key={s.id}
                            onClick={() => handleSelectDrive(s)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50 transition-colors ${
                              selectedDriveSheet?.id === s.id ? 'bg-violet-50 border-l-2 border-violet-500' : ''
                            }`}
                          >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-slate-700 truncate">{s.name}</p>
                              <p className="text-xs text-slate-400">
                                Updated {new Date(s.modifiedTime).toLocaleDateString()}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedDriveSheet && step !== 'preview_done' && (
                    <button
                      onClick={handleValidateDrive}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl disabled:opacity-50 hover:shadow-md transition-all duration-200"
                    >
                      {step === 'previewing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Validate "{selectedDriveSheet.name}"
                    </button>
                  )}
                </>
              )}

              {/* ── Preview result ── */}
              {step === 'preview_done' && preview && (
                <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{preview.name}</p>
                      <p className="text-xs text-slate-500">{preview.taskCount} task{preview.taskCount !== 1 ? 's' : ''} detected</p>
                    </div>
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={step === 'connecting'}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl disabled:opacity-60 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                  >
                    {step === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Connect to Project
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
