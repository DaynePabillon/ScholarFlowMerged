'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'
import AIResultModal from '@/components/scholar/AIResultModal';
import { useAIStore } from '@/store/scholar/ai.store';
import { apiClient } from '@/lib/api/client';
import { jwtDecode } from 'jwt-decode';
import { Sparkles, TrendingUp, ChevronDown, ExternalLink } from 'lucide-react';

type Group = {
    smallgroupID: number;
    groupName: string;
    member1: string | null; roleOne: string | null;
    member2: string | null; roleTwo: string | null;
    member3: string | null; roleThree: string | null;
    member4: string | null; roleFour: string | null;
    member5: string | null; roleFive: string | null;
};

type SkyFlowTask = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    due_date: string | null;
    created_at: string;
    project_id: string;
    project_name: string | null;
    assignee_name: string | null;
    assignee_email: string | null;
    comment_count: number;
};

export default function GroupPage() {
    const params = useParams();
    const router = useRouter();

    const courseId = params.id as string;
    const groupId = params.groupId as string;

    const [user, setUser] = useState<any>(null);
    const [organizations, setOrganizations] = useState<any[]>([])
    const [selectedOrg, setSelectedOrg] = useState<any>(null)
    const [group, setGroup] = useState<Group | null>(null);
    const [tasks, setTasks] = useState<SkyFlowTask[]>([]);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [journals, setJournals] = useState<any[]>([]);
    const [consultationLogs, setConsultationLogs] = useState<any[]>([]);
    const [expandedConsultationId, setExpandedConsultationId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'tasks' | 'journals' | 'discussion' | 'consultations'>('tasks');
    const [selectedJournal, setSelectedJournal] = useState<any | null>(null);
    const { generate } = useAIStore();
    const [showAIModal, setShowAIModal] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Journal Details Loading State
    const [journalAttendance, setJournalAttendance] = useState<Record<string, string>>({});
    const [journalParticipation, setJournalParticipation] = useState<Record<string, string>>({});
    const [fetchingJournalDetails, setFetchingJournalDetails] = useState(false);
    const [exportingDocs, setExportingDocs] = useState(false);

    // Inline task creation state
    const [showAddTaskRow, setShowAddTaskRow] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [creatingTask, setCreatingTask] = useState(false);
    const [addTaskError, setAddTaskError] = useState<string | null>(null);
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

    const formatDateLabel = (value: any) => {
        if (!value) return 'No date';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatDateTimeLabel = (value: any) => {
        if (!value) return '-';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        return parsed.toLocaleString();
    };

    const formatTime12Hour = (value: any) => {
        const raw = String(value || '').trim().slice(0, 5);
        const [hRaw, mRaw] = raw.split(':');
        const h = Number(hRaw);
        const m = Number(mRaw);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return String(value || '-');
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    };

    const fetchGroupData = async () => {
        try {
            console.log("DEBUG: fetchGroupData for groupId:", groupId);
            const groupRes = await apiClient.get(`/groups/${groupId}`);
            setGroup(groupRes.data);

            const tasksRes = await apiClient.get(`/groups/${groupId}/tasks`);
            const tasksPayload = tasksRes.data;
            setTasks(Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks : []);
            setProjectId(tasksPayload?.project_id ?? null);

            const consRes = await apiClient.get(`/courses/${courseId}/consultations`);
            // Filter down to published consultations associated specifically with this exact group Name
            // Using robust comparison (trim and lowercase)
            const currentGroupName = groupRes.data.groupName?.trim().toLowerCase();
            const groupJournals = (consRes.data || []).filter((c: any) => 
                c.groupName?.trim().toLowerCase() === currentGroupName && !c.isDraft
            );
            setJournals(groupJournals);

            // Fetch consultation logs
            try {
                const logsRes = await apiClient.get(`/consultation/group/${groupId}/logs`);
                setConsultationLogs(logsRes.data?.logs || []);
            } catch (logErr: any) {
                console.error("Error fetching consultation logs:", logErr);
                setConsultationLogs([]);
            }
        } catch (err: any) {
            console.error("Fetch Group Error:", err);
            setError(`Failed to load group details: ${err.message}. Backend: ${err.response?.data?.error || 'None'}`);
        } finally {
            setLoading(false);
        }
    };

  
  // Load org context for unified AppLayout sidebar
  useEffect(() => {
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            const decoded = jwtDecode(token);
            setUser(decoded);
        } catch (err) {
            router.push('/login');
            return;
        }

        fetchGroupData();
    }, [groupId, router]);

  
  // Load org context for unified AppLayout sidebar
  useEffect(() => {
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedJournal) {
                setJournalAttendance({});
                setJournalParticipation({});
                return;
            }

            try {
                setFetchingJournalDetails(true);
                const [attRes, partRes] = await Promise.all([
                    apiClient.get(`/consultations/${selectedJournal.conID}/attendance`),
                    apiClient.get(`/consultations/${selectedJournal.conID}/participation`)
                ]);

                setJournalAttendance(attRes.data || {});
                setJournalParticipation(partRes.data || {});
            } catch (err) {
                console.error("Error fetching journal details:", err);
            } finally {
                setFetchingJournalDetails(false);
            }
        };

        fetchDetails();
    }, [selectedJournal]);

    const handleExportDocs = async () => {
        if (!selectedJournal) return;
        
        try {
            setExportingDocs(true);
            const res = await apiClient.post(`/consultations/${selectedJournal.conID}/export-docs`, {});

            if (res.data.url) {
                window.open(res.data.url, '_blank');
            }
        } catch (err: any) {
            console.error("Export error:", err);
            alert(err.response?.data?.error || "Failed to export to Google Docs. Make sure the advisor has linked their Google account.");
        } finally {
            setExportingDocs(false);
        }
    };

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setUpdatingTaskId(taskId);
        try {
            await apiClient.patch(`/tasks/${taskId}/status`, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to update status');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const handleAddTask = async () => {
        if (!newTaskTitle.trim() || !projectId) {
            setAddTaskError('Title is required and a project must be linked to this group.');
            return;
        }
        setCreatingTask(true);
        setAddTaskError(null);
        try {
            const res = await apiClient.post('/tasks', {
                project_id: projectId,
                title: newTaskTitle.trim(),
                priority: newTaskPriority,
                due_date: newTaskDueDate || undefined,
                status: 'todo',
            });
            setTasks(prev => [res.data, ...prev]);
            setNewTaskTitle('');
            setNewTaskPriority('medium');
            setNewTaskDueDate('');
            setShowAddTaskRow(false);
        } catch (err: any) {
            setAddTaskError(err.response?.data?.error || 'Failed to create task.');
        } finally {
            setCreatingTask(false);
        }
    };

    const handleAIGenerate = async (type: 'summary' | 'participation') => {
        if (!group) return;
        setShowAIModal(true);
        if (type === 'summary') {
            const context = journals.map(j => j.conSum).join('\n\n');
            await generate('summary', { context });
        } else {
            // Pick latest consultation ID for participation if available
            const conID = journals[0]?.conID;
            if (!conID) {
                alert("No consultation records found to analyze participation.");
                setShowAIModal(false);
                return;
            }
            await generate('participation', { conID });
        }
    };

    if (loading) return <div className="min-h-screen bg-white"></div>;

    if (error || !group) {
        return (
            <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
                <div className="min-h-screen bg-white text-gray-900 font-sans p-8 flex flex-col items-center justify-center">
                    <div className="text-red-500 font-bold mb-4">{error || "Group not found"}</div>
                    <button onClick={() => router.push(`/scholar/courses/${courseId}`)} className="text-blue-600 hover:underline">Return to Course</button>
                </div>
            </AppLayout>
        );
    }

    // Determine memberships
    const membersList = [
        { email: group.member1, role: group.roleOne },
        { email: group.member2, role: group.roleTwo },
        { email: group.member3, role: group.roleThree },
        { email: group.member4, role: group.roleFour },
        { email: group.member5, role: group.roleFive },
    ].filter(m => m.email); // Filter out empty slots

    const isLeader = membersList.some(m => m.email === user?.email && m.role === 'leader');
    const isAdmin = user?.role === 'Admin' || String(user?.role || '').toLowerCase() === 'adviser';
    const canUseAI = user?.role === 'Admin';
    const canCreateTasks = isLeader || isAdmin;

    return (
        <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
            <div className="h-full bg-slate-50 flex flex-col min-h-screen">
                <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
                    
                    {/* Header */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <button 
                                onClick={() => router.push(`/scholar/courses/${courseId}`)}
                                className="text-gray-500 text-sm font-semibold hover:text-indigo-600 mb-2 flex items-center gap-1"
                            >
                                ← Back to Course
                            </button>
                            <h1 className="text-3xl font-bold text-gray-900">{group.groupName}</h1>
                        </div>

                        {/* AI Action Buttons */}
                        {canUseAI && (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleAIGenerate('summary')}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-blue-100 transition-all border border-blue-100"
                            >
                                <Sparkles className="w-4 h-4" />
                                AI Summary
                            </button>
                            <button 
                                onClick={() => handleAIGenerate('participation')}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-purple-100 transition-all border border-purple-100"
                            >
                                <TrendingUp className="w-4 h-4" />
                                AI Insights
                            </button>
                        </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Left Container: Members */}
                        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="bg-[#4FB6DF] p-4 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="font-bold text-white text-lg">Members ({membersList.length}/5)</h2>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto w-full">
                                {membersList.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {membersList.map((member, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                <div className="flex flex-col truncate pr-2">
                                                    <span className="font-semibold text-sm text-gray-800 truncate" title={member.email!}>{member.email}</span>
                                                </div>
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${member.role === 'leader' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {member.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No members configured.</p>
                                )}
                            </div>
                        </div>

                        {/* Right Container: Tasks & Journals */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[400px]">
                            
                            <div className="bg-[#0095FF] flex justify-between items-center px-4 w-full">
                                <div className="flex items-center pt-2 flex-wrap">
                                    <button 
                                        onClick={() => setActiveTab('tasks')}
                                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'tasks' ? 'text-[#0095FF] bg-white rounded-t-lg' : 'text-white/80 hover:text-white'}`}
                                    >
                                        Group Tasks
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('journals')}
                                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'journals' ? 'text-[#0095FF] bg-white rounded-t-lg' : 'text-white/80 hover:text-white'}`}
                                    >
                                        Journals
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('discussion')}
                                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'discussion' ? 'text-[#0095FF] bg-white rounded-t-lg' : 'text-white/80 hover:text-white'}`}
                                    >
                                        Discussion
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('consultations')}
                                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'consultations' ? 'text-[#0095FF] bg-white rounded-t-lg' : 'text-white/80 hover:text-white'}`}
                                    >
                                        Consultation History
                                    </button>
                                </div>
                                {activeTab === 'tasks' && canCreateTasks && projectId && (
                                    <button
                                        onClick={() => { setShowAddTaskRow(true); setAddTaskError(null); }}
                                        className="bg-white text-[#0095FF] px-4 py-1.5 rounded text-sm font-bold shadow hover:bg-gray-50 transition-colors my-2"
                                    >
                                        + Add Task
                                    </button>
                                )}
                                {activeTab === 'journals' && (
                                    <div className="flex items-center gap-2 text-white/90 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                        {journals.length} Published
                                    </div>
                                )}
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto w-full max-h-[600px]">
                                {activeTab === 'tasks' && (
                                    <div className="flex flex-col gap-3">
                                        {/* No project linked */}
                                        {!projectId && (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="font-medium text-sm">No project linked to this group yet.</p>
                                                <p className="text-xs text-center max-w-xs">An admin or adviser can set up a project from the course Groups page.</p>
                                            </div>
                                        )}

                                        {/* Inline add task row */}
                                        {showAddTaskRow && projectId && (
                                            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex flex-col gap-3">
                                                <input
                                                    autoFocus
                                                    value={newTaskTitle}
                                                    onChange={e => setNewTaskTitle(e.target.value)}
                                                    placeholder="Task title..."
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                                                    onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setShowAddTaskRow(false); }}
                                                />
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <select
                                                        value={newTaskPriority}
                                                        onChange={e => setNewTaskPriority(e.target.value as any)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                                    >
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                    <input
                                                        type="date"
                                                        value={newTaskDueDate}
                                                        onChange={e => setNewTaskDueDate(e.target.value)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                                    />
                                                    <div className="flex gap-2 ml-auto">
                                                        <button onClick={() => setShowAddTaskRow(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                                        <button onClick={handleAddTask} disabled={creatingTask} className="px-4 py-1.5 text-xs font-bold bg-[#0095FF] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                                            {creatingTask ? 'Adding…' : 'Add'}
                                                        </button>
                                                    </div>
                                                </div>
                                                {addTaskError && <p className="text-xs text-red-600 font-semibold">{addTaskError}</p>}
                                            </div>
                                        )}

                                        {/* Task list */}
                                        {projectId && tasks.length === 0 && !showAddTaskRow && (
                                            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="font-medium text-sm">No tasks yet.</p>
                                            </div>
                                        )}

                                        {projectId && tasks.map(task => (
                                            <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white relative overflow-hidden">
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
                                                    task.status === 'completed' || task.status === 'done' ? 'bg-green-400' :
                                                    task.status === 'in_progress' ? 'bg-blue-400' :
                                                    task.status === 'review'      ? 'bg-purple-400' :
                                                    'bg-gray-300'
                                                }`} />
                                                <div className="flex items-start justify-between gap-3 mb-2 pl-2">
                                                    <h3 className="font-bold text-gray-800 text-sm leading-tight flex-1">{task.title}</h3>
                                                    {/* Inline status select */}
                                                    <select
                                                        value={task.status}
                                                        disabled={updatingTaskId === task.id}
                                                        onChange={e => handleStatusChange(task.id, e.target.value)}
                                                        className={`text-[11px] font-bold border rounded-full px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                                                            task.status === 'completed' || task.status === 'done' ? 'bg-green-50  text-green-700  border-green-200'  :
                                                            task.status === 'in_progress' ? 'bg-blue-50   text-blue-700   border-blue-200'   :
                                                            task.status === 'review'     ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            'bg-gray-50 text-gray-500 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="todo">Todo</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="review">Review</option>
                                                        <option value="completed">Done</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-3 flex-wrap pl-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                        task.priority === 'high'     ? 'bg-red-50    text-red-600'   :
                                                        task.priority === 'critical' ? 'bg-red-100   text-red-700'   :
                                                        task.priority === 'medium'   ? 'bg-amber-50  text-amber-600' :
                                                        'bg-gray-50 text-gray-500'
                                                    }`}>{task.priority}</span>
                                                    {task.due_date && (
                                                        <span className="text-[11px] text-gray-400 font-medium">{formatDateLabel(task.due_date)}</span>
                                                    )}
                                                    {task.assignee_name && (
                                                        <span className="text-[11px] font-bold text-[#0095FF] bg-blue-50 px-2 py-0.5 rounded-full">{task.assignee_name}</span>
                                                    )}
                                                    {task.comment_count > 0 && (
                                                        <span className="text-[11px] text-gray-400">{task.comment_count} comment{task.comment_count !== 1 ? 's' : ''}</span>
                                                    )}
                                                    <a
                                                        href={`/tasks?project_id=${task.project_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="ml-auto text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                                        title="Open in SkyFlow"
                                                    >
                                                        Open <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'journals' && (
                                    journals.length > 0 ? (
                                        <div className="grid gap-4 flex-col">
                                            {journals.map(journal => (
                                                <div 
                                                    key={journal.conID} 
                                                    onClick={() => setSelectedJournal(journal)}
                                                    className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-[#0095FF]/30 transition-all relative cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start border-b border-gray-200 pb-3 mb-3">
                                                        <div className="flex flex-col">
                                                            <h3 className="font-bold text-lg text-gray-800 tracking-tight">{journal.conMil}</h3>
                                                            <span className="text-xs font-bold text-[#0095FF] bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">{journal.conStat}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                {journal.conDate}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 mt-0.5">{journal.conType}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Milestone Description</h4>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{journal.conSum || <span className="italic text-gray-400 text-xs">No description logged.</span>}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </div>
                                            <p className="font-medium">No journals published for this group.</p>
                                            <p className="text-xs text-center max-w-[200px] mt-2">Publish consultations from the Adviser dashboard to see them here.</p>
                                        </div>
                                    )
                                )}

                                {activeTab === 'discussion' && (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                        </svg>
                                        <p className="font-medium">Discussion board coming soon</p>
                                        <p className="text-xs text-center max-w-[200px] mt-2">Group members can discuss project progress here.</p>
                                    </div>
                                )}

                                {activeTab === 'consultations' && (
                                    consultationLogs.length > 0 ? (
                                        <div className="grid gap-4">
                                            {consultationLogs.map((log) => (
                                                <div key={log.conID} className="bg-gray-50 border border-gray-200 rounded-lg hover:shadow-md transition-shadow overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedConsultationId(expandedConsultationId === log.conID ? null : log.conID)}
                                                        className="w-full p-5 flex items-start justify-between gap-4 text-left"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-800">
                                                                Consultation with {log.adviser_name || 'Adviser'}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                {formatDateLabel(log.conDate || log.slot_date)}
                                                                {log.start_time ? ` at ${formatTime12Hour(log.start_time)}` : ''}
                                                            </p>
                                                            {log.conMil && (
                                                                <p className="text-xs text-gray-500 mt-1">Topic: {log.conMil}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                                log.status === 'SUBMITTED'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : log.status === 'DRAFT'
                                                                        ? 'bg-amber-100 text-amber-700'
                                                                        : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {log.status || 'Unknown'}
                                                            </span>
                                                            <ChevronDown
                                                                className={`w-4 h-4 text-gray-500 transition-transform ${expandedConsultationId === log.conID ? 'rotate-180' : ''}`}
                                                            />
                                                        </div>
                                                    </button>

                                                    {expandedConsultationId === log.conID && (
                                                        <div className="px-5 pb-5 border-t border-gray-200">
                                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Consultation Date</p>
                                                                    <p className="text-gray-700">{log.conDate || '-'}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Milestone/Topic</p>
                                                                    <p className="text-gray-700">{log.conMil || '-'}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Group Name</p>
                                                                    <p className="text-gray-700">{log.groupName || '-'}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Course ID</p>
                                                                    <p className="text-gray-700">{log.courseID ?? '-'}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Slot ID</p>
                                                                    <p className="text-gray-700">{log.slot_id ?? '-'}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Submitted At</p>
                                                                    <p className="text-gray-700">{formatDateTimeLabel(log.submitted_at)}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Created At</p>
                                                                    <p className="text-gray-700">{formatDateTimeLabel(log.created_at)}</p>
                                                                </div>
                                                                <div className="bg-white rounded border border-gray-200 p-3">
                                                                    <p className="text-gray-500 font-bold uppercase tracking-wide mb-1">Updated At</p>
                                                                    <p className="text-gray-700">{formatDateTimeLabel(log.updated_at)}</p>
                                                                </div>
                                                            </div>

                                                            {log.conSum && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                                                                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                                                                        {log.conSum}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {log.conAction && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Action Items</h4>
                                                                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                                                                        {log.conAction}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {log.conConcerns && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Concerns</h4>
                                                                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                                                                        {log.conConcerns}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {log.adviser_notes && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Adviser Notes</h4>
                                                                    <p className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                                                                        {log.adviser_notes}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {log.attendance_data && Object.keys(log.attendance_data).length > 0 && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attendance & Participation</h4>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                        {Object.entries(log.attendance_data).map(([member, status]: [string, any], idx) => (
                                                                            <div key={idx} className="text-xs p-2 bg-white rounded border border-gray-200">
                                                                                <p className="font-semibold text-gray-800">{member}</p>
                                                                                <div className="flex gap-2 mt-1 flex-wrap">
                                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                                                        status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                                    }`}>
                                                                                        {status}
                                                                                    </span>
                                                                                    {log.participation_data?.[member] && (
                                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                                                            log.participation_data[member] === 'High' ? 'bg-blue-100 text-blue-700' :
                                                                                            log.participation_data[member] === 'Moderate' ? 'bg-amber-100 text-amber-700' :
                                                                                            'bg-gray-100 text-gray-700'
                                                                                        }`}>
                                                                                            {log.participation_data[member]}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="font-medium">No consultation logs yet</p>
                                            <p className="text-xs text-center max-w-[200px] mt-2">Completed consultations with your adviser will appear here.</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Journal Details Modal */}
                    {selectedJournal && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm fixed p-4">
                            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                                <div className="bg-[#0095FF] px-6 py-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-lg font-bold text-white">Journal Details</h2>
                                        {(user?.role === 'Admin' || String(user?.role || '').toLowerCase() === 'adviser') && (
                                            <button 
                                                onClick={handleExportDocs}
                                                disabled={exportingDocs}
                                                className="bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all flex items-center gap-2 border border-white/20 shadow-sm"
                                            >
                                                {exportingDocs ? (
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                )}
                                                {exportingDocs ? 'Generating...' : 'Get DOCs Copy'}
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedJournal(null)} className="text-white/80 hover:text-white transition-colors text-xl leading-none">&times;</button>
                                </div>
                                <div className="p-8 overflow-y-auto flex flex-col gap-8 custom-scrollbar">
                                    {/* Top Section: Header Info */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                                        <div className="flex-1">
                                            <h3 className="text-3xl font-black text-gray-900 leading-tight mb-2 uppercase tracking-tight">{selectedJournal.conMil}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-full border shadow-sm ${
                                                    selectedJournal.conStat === 'On Track' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    selectedJournal.conStat === 'Needs Revision' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                    {selectedJournal.conStat}
                                                </span>
                                                <span className="text-[10px] uppercase font-black px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full shadow-sm">
                                                    {selectedJournal.conType}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400 font-bold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 shadow-inner">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-sm tracking-widest">{selectedJournal.conDate}</span>
                                        </div>
                                    </div>

                                    {/* Middle Section: Description */}
                                    <div className="space-y-3">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Milestone Description</h4>
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                                            <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">
                                                {selectedJournal.conSum || <span className="italic text-gray-400">No description provided.</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Attendees Table */}
                                    <div className="space-y-3">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Attendance & Participation</h4>
                                        <div className="overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-[#4FB6DF]/10 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-3 text-[10px] font-black text-[#4FB6DF] uppercase tracking-wider">Member Name</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-[#4FB6DF] uppercase tracking-wider text-right">Attendance</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-[#4FB6DF] uppercase tracking-wider text-right">Participation Rating</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {fetchingJournalDetails ? (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic text-sm">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="w-4 h-4 border-2 border-[#4FB6DF] border-t-transparent rounded-full animate-spin"></div>
                                                                    Loading records...
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : selectedJournal.conAtt ? (
                                                        selectedJournal.conAtt.split(',').map((name: string) => name.trim()).filter(Boolean).map((attendee: string, i: number) => {
                                                            const status = journalAttendance[attendee] || 'Absent';
                                                            const rating = journalParticipation[attendee] || 'None';
                                                            return (
                                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-[#0095FF]/10 flex items-center justify-center text-[#0095FF] font-black text-xs border border-[#0095FF]/20 shadow-sm">
                                                                                {attendee.charAt(0)}
                                                                            </div>
                                                                            <span className="text-sm font-bold text-gray-800">{attendee}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full shadow-sm border ${
                                                                            status === 'Present' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                                                                        }`}>
                                                                            {status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full shadow-sm border ${
                                                                            rating === 'High' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                            rating === 'Moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                            rating === 'Low' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                                                            'bg-slate-50 text-slate-400 border-slate-100 italic'
                                                                        }`}>
                                                                            {rating}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic text-sm">No attendees logged.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Bottom Section: Internal Notes */}
                                    <div className="space-y-3 pt-4 border-t border-gray-100">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Adviser&apos;s Notes</h4>
                                        <div className="bg-[#4FB6DF]/5 p-6 rounded-2xl border border-[#4FB6DF]/10 shadow-sm relative overflow-hidden group">
                                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#4FB6DF] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                            <p className="text-gray-700 italic text-sm leading-relaxed pl-2 whitespace-pre-wrap">
                                                {selectedJournal.conNotes || "No internal notes provided for this consultation."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                {/* AI Result Modal */}
                {canUseAI && showAIModal && <AIResultModal onClose={() => setShowAIModal(false)} />}
                </main>
            </div>
        </AppLayout>
    );
}
