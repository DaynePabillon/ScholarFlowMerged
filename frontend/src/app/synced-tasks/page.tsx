'use client';

import { API_URL } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  X,
  Maximize2
} from 'lucide-react';

interface SheetTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_email: string;
  due_date: string;
  sheet_name: string;
  google_sheet_id: string;
  synced_at: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'todo': { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: <Circle className="w-4 h-4" /> },
  'in-progress': { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Loader2 className="w-4 h-4" /> },
  'review': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <AlertCircle className="w-4 h-4" /> },
  'done': { bg: 'bg-green-500/20', text: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4" /> }
};

const priorityColors: Record<string, string> = {
  'low': 'border-slate-500',
  'medium': 'border-blue-500',
  'high': 'border-orange-500',
  'critical': 'border-red-500'
};

export default function SyncedTasksPage() {
  const [tasks, setTasks] = useState<SheetTask[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Embedded sheet viewer modal
  const [showEmbeddedSheet, setShowEmbeddedSheet] = useState(false);
  const [embeddedSheetId, setEmbeddedSheetId] = useState('');
  const [embeddedSheetName, setEmbeddedSheetName] = useState('');

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchTasks();
    }
  }, [selectedWorkspaceId]);

  const fetchWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;

      const res = await fetch(`${API_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orgsData = await res.json();

      if (orgsData.organizations?.length > 0) {
        const orgId = orgsData.organizations[0].id;
        const wsRes = await fetch(`${API_URL}/api/workspaces?organizationId=${orgId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const wsData = await wsRes.json();
        setWorkspaces(wsData.workspaces || []);
        if (wsData.workspaces?.length > 0) {
          setSelectedWorkspaceId(wsData.workspaces[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/workspaces/${selectedWorkspaceId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const syncWorkspace = async () => {
    if (!selectedWorkspaceId) return;
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/workspaces/${selectedWorkspaceId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTasks();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee_email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Synced Tasks</h1>
              <p className="text-slate-400 text-sm">Tasks from connected Google Sheets</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>

            <button
              onClick={syncWorkspace}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-400"
          />

          <div className="flex items-center gap-2">
            {['all', 'todo', 'in-progress', 'review', 'done'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {['todo', 'in-progress', 'review', 'done'].map(status => {
            const count = tasks.filter(t => t.status === status).length;
            const colors = statusColors[status];
            return (
              <div key={status} className={`p-4 rounded-xl ${colors.bg} border border-slate-700/50`}>
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                  {colors.icon}
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                </div>
                <p className={`text-2xl font-bold ${colors.text}`}>{count}</p>
              </div>
            );
          })}
        </div>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-500" />
            <p className="text-slate-400">No tasks found</p>
            <p className="text-sm text-slate-500 mt-1">
              {tasks.length === 0 ? 'Connect a sheet to start syncing tasks' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Task</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Assignee</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Due Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const statusStyle = statusColors[task.status] || statusColors.todo;
                  const priorityBorder = priorityColors[task.priority] || 'border-slate-500';
                  return (
                    <tr key={task.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3">
                        <div className={`border-l-4 ${priorityBorder} pl-3`}>
                          <p className="text-white font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-slate-400 text-sm truncate max-w-md">{task.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.icon}
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm capitalize ${task.priority === 'critical' ? 'text-red-400' :
                          task.priority === 'high' ? 'text-orange-400' :
                            task.priority === 'medium' ? 'text-blue-400' :
                              'text-slate-400'
                          }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <User className="w-4 h-4 text-slate-500" />
                          {task.assignee_email || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          {formatDate(task.due_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setEmbeddedSheetId(task.google_sheet_id);
                            setEmbeddedSheetName(task.sheet_name);
                            setShowEmbeddedSheet(true);
                          }}
                          className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 rounded-lg"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          {task.sheet_name}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sync Info */}
        {tasks.length > 0 && (
          <div className="mt-4 text-center text-sm text-slate-500">
            <Clock className="w-4 h-4 inline mr-1" />
            Last synced: {formatDate(tasks[0]?.synced_at)}
          </div>
        )}
      </div>

      {/* Embedded Sheet Viewer Modal */}
      {showEmbeddedSheet && embeddedSheetId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-green-900/30 to-emerald-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{embeddedSheetName}</h2>
                  <p className="text-xs text-slate-400">Embedded Google Sheet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://docs.google.com/spreadsheets/d/${embeddedSheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  <Maximize2 className="w-4 h-4" />
                  Open Full Screen
                </a>
                <button
                  onClick={() => {
                    setShowEmbeddedSheet(false);
                    setEmbeddedSheetId('');
                    setEmbeddedSheetName('');
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Sheet Iframe */}
            <div className="flex-1 bg-white relative">
              <iframe
                src={`https://docs.google.com/spreadsheets/d/${embeddedSheetId}/edit?rm=minimal`}
                className="w-full h-full border-0"
                title={embeddedSheetName}
                allow="clipboard-write"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                💡 Tip: Click "Sync Now" after making changes to update your tasks
              </p>
              <button
                onClick={() => {
                  setShowEmbeddedSheet(false);
                  setEmbeddedSheetId('');
                  setEmbeddedSheetName('');
                }}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
