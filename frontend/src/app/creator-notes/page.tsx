'use client';

import { API_URL } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import {
    Bug,
    Lightbulb,
    MessageSquare,
    HelpCircle,
    Clock,
    User,
    ExternalLink,
    CheckCircle,
    Eye,
    Trash2,
    Filter,
    AlertTriangle,
    Shield
} from 'lucide-react';

interface BugReport {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    category: string;
    title: string;
    description: string;
    page_url: string;
    status: string;
    creator_notes: string;
    created_at: string;
    updated_at: string;
}

interface Stats {
    total: number;
    new_count: number;
    reviewed_count: number;
    resolved_count: number;
    bug_count: number;
    feature_count: number;
    feedback_count: number;
}

const CREATOR_EMAIL = 'waynepabillon667@gmail.com';

const categoryIcons: Record<string, any> = {
    bug: Bug,
    feature: Lightbulb,
    feedback: MessageSquare,
    other: HelpCircle,
};

const categoryColors: Record<string, string> = {
    bug: 'text-red-500 bg-red-50',
    feature: 'text-amber-500 bg-amber-50',
    feedback: 'text-blue-500 bg-blue-50',
    other: 'text-gray-500 bg-gray-50',
};

const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-gray-100 text-gray-700',
};

export default function CreatorNotesPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    const [reports, setReports] = useState<BugReport[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedOrgs = localStorage.getItem('organizations');
        const storedSelectedOrg = localStorage.getItem('selectedOrganization');

        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedOrgs) setOrganizations(JSON.parse(storedOrgs));
        if (storedSelectedOrg) setSelectedOrg(JSON.parse(storedSelectedOrg));

        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        // Check authorization
        checkAuthorization();
    }, [mounted, router]);

    const checkAuthorization = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/reports/check-creator`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.isCreator) {
                setAuthorized(true);
                fetchReports();
                fetchStats();
            } else {
                setAuthorized(false);
            }
        } catch (err) {
            console.error('Authorization check failed:', err);
            setAuthorized(false);
        } finally {
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        try {
            const token = localStorage.getItem('token');
            let url = `${API_URL}/api/reports`;
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            if (filterCategory) params.append('category', filterCategory);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setReports(data.reports || []);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/reports/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const updateReportStatus = async (id: string, status: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/api/reports/${id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });
            fetchReports();
            fetchStats();
        } catch (err) {
            console.error('Failed to update report:', err);
        }
    };

    const deleteReport = async (id: string) => {
        if (!confirm('Delete this report permanently?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/api/reports/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setSelectedReport(null);
            fetchReports();
            fetchStats();
        } catch (err) {
            console.error('Failed to delete report:', err);
        }
    };

    useEffect(() => {
        if (authorized) {
            fetchReports();
        }
    }, [filterStatus, filterCategory, authorized]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const handleOrgChange = (org: any) => {
        setSelectedOrg(org);
        localStorage.setItem('selectedOrganization', JSON.stringify(org));
    };

    if (!mounted || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-6">
                        This page is restricted to the application creator only.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <AppLayout
            user={user}
            organizations={organizations}
            selectedOrg={selectedOrg}
            onOrgChange={handleOrgChange}
        >
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Creator Notes</h1>
                    <p className="text-gray-500 text-sm">Bug reports and feedback from users</p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="text-3xl font-bold text-blue-600">{stats.new_count}</div>
                            <div className="text-sm text-gray-500">New Reports</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="text-3xl font-bold text-amber-600">{stats.reviewed_count}</div>
                            <div className="text-sm text-gray-500">Under Review</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="text-3xl font-bold text-green-600">{stats.resolved_count}</div>
                            <div className="text-sm text-gray-500">Resolved</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="text-3xl font-bold text-gray-600">{stats.total}</div>
                            <div className="text-sm text-gray-500">Total Reports</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">All Statuses</option>
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                        </select>
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">All Categories</option>
                        <option value="bug">Bugs</option>
                        <option value="feature">Features</option>
                        <option value="feedback">Feedback</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Reports List */}
                    <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">Reports ({reports.length})</h2>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {reports.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Bug className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>No reports found</p>
                                </div>
                            ) : (
                                reports.map((report) => {
                                    const CategoryIcon = categoryIcons[report.category] || Bug;
                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReport(report)}
                                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedReport?.id === report.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${categoryColors[report.category]}`}>
                                                    <CategoryIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 truncate">{report.title}</h3>
                                                    <p className="text-sm text-gray-500 truncate">{report.user_email}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[report.status]}`}>
                                                            {report.status}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(report.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Report Detail */}
                    <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm">
                        {!selectedReport ? (
                            <div className="h-full flex items-center justify-center p-8 text-center text-gray-400">
                                <div>
                                    <Eye className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                                    <p className="text-lg">Select a report to view details</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-lg ${categoryColors[selectedReport.category]}`}>
                                            {(() => {
                                                const Icon = categoryIcons[selectedReport.category] || Bug;
                                                return <Icon className="w-6 h-6" />;
                                            })()}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{selectedReport.title}</h2>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[selectedReport.status]}`}>
                                                {selectedReport.status}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteReport(selectedReport.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete report"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <User className="w-4 h-4" />
                                        <span>{selectedReport.user_name || 'Unknown'}</span>
                                        <span className="text-gray-400">({selectedReport.user_email})</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Clock className="w-4 h-4" />
                                        <span>{formatDate(selectedReport.created_at)}</span>
                                    </div>
                                    {selectedReport.page_url && (
                                        <div className="flex items-center gap-2 text-sm text-blue-600">
                                            <ExternalLink className="w-4 h-4" />
                                            <a href={selectedReport.page_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                                {selectedReport.page_url}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                    <h3 className="font-medium text-gray-700 mb-2">Description</h3>
                                    <p className="text-gray-600 whitespace-pre-wrap">{selectedReport.description}</p>
                                </div>

                                {/* Status Actions */}
                                <div className="border-t border-gray-100 pt-4">
                                    <h3 className="font-medium text-gray-700 mb-3">Update Status</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => updateReportStatus(selectedReport.id, 'reviewed')}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Mark Reviewed
                                        </button>
                                        <button
                                            onClick={() => updateReportStatus(selectedReport.id, 'resolved')}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Mark Resolved
                                        </button>
                                        <button
                                            onClick={() => updateReportStatus(selectedReport.id, 'dismissed')}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
