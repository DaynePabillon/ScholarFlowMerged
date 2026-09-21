'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { RefreshCw, Clock, AlertCircle, CheckCircle2, History } from 'lucide-react';

interface SyncLog {
  id: string;
  status: string;
  synced_count: number;
  triggered_by_name: string;
  created_at: string;
  error_message: string | null;
}

interface Props {
  projectId: string;
}

export default function SyncControlPanel({ projectId }: Props) {
  const [onCooldown, setOnCooldown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [lastSync, setLastSync] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiClient.get(`/sync/status?project_id=${projectId}`);
      setOnCooldown(res.data.onCooldown);
      setRemainingSeconds(res.data.remainingSeconds);
      setLastSync(res.data.lastSync);
    } catch {}
  }, [projectId]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await apiClient.get(`/sync/logs?project_id=${projectId}`);
      setLogs(res.data.logs);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    loadStatus();
    loadLogs();
  }, [loadStatus, loadLogs]);

  // Countdown timer
  useEffect(() => {
    if (!onCooldown || remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds(s => {
        if (s <= 1) {
          setOnCooldown(false);
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onCooldown, remainingSeconds]);

  const handleSyncClick = () => {
    if (onCooldown) {
      setShowWarning(true);
      return;
    }
    triggerSync();
  };

  const triggerSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await apiClient.post('/sync/trigger', { project_id: projectId });
      const count = res.data.syncedCount ?? 0;
      setFeedback({
        type: 'success',
        message: count === 0
          ? (res.data.message || 'No sheets are connected to this project yet.')
          : `Sync complete — ${count} sheet(s) synced`
      });
      await loadStatus();
      await loadLogs();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Sync failed';
      setFeedback({ type: 'error', message: msg });
      if (err.response?.status === 429) {
        setOnCooldown(true);
        setRemainingSeconds(err.response.data.remainingSeconds || 30);
        setShowWarning(true);
      }
    } finally {
      setSyncing(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      success: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
      rate_limited: 'bg-amber-100 text-amber-700',
      in_progress: 'bg-sky-100 text-sky-700'
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 dark:border-slate-700/40 bg-white/30 dark:bg-slate-800/30">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-sky-500" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Manual Sync</span>
        </div>
        <button
          onClick={() => { setShowLogs(l => !l); if (!showLogs) loadLogs(); }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-600 rounded px-2 py-1"
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Last sync info */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          {lastSync ? (
            <span>
              Last synced <strong>{new Date(lastSync.created_at).toLocaleString()}</strong>
              {lastSync.triggered_by_name && ` by ${lastSync.triggered_by_name}`}
            </span>
          ) : (
            <span>Never synced</span>
          )}
        </div>

        {/* Sync button */}
        <button
          onClick={handleSyncClick}
          disabled={syncing}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            onCooldown
              ? 'bg-amber-100 text-amber-700 border border-amber-200 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:shadow-lg hover:scale-[1.02] text-white'
          } disabled:opacity-60`}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : onCooldown ? `Wait ${remainingSeconds}s` : 'Sync Now'}
        </button>

        {/* Feedback banner */}
        {feedback && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600'
          }`}>
            {feedback.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* Cooldown warning modal */}
        {showWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 dark:border-slate-700/40 p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sync Rate Limit</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                A sync was triggered recently. Please wait <strong>{remainingSeconds} seconds</strong> before syncing again to avoid overloading the service.
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] text-white py-2.5 rounded-xl text-sm font-medium transition-all duration-300"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Sync history */}
        {showLogs && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Recent Syncs</p>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No sync history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-gray-50/80 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={log.status} />
                      <span>{log.synced_count} synced</span>
                    </div>
                    <span className="text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
