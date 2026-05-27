'use client';

import { useEffect, useState } from 'react';
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'
import { API_URL } from '@/lib/api/client';
import {
    Users,
    Trash2,
    Shield,
    Loader2
} from 'lucide-react';

type Account = {
    account_id: string;
    accountName: string;
    accountEmail: string;
    accountRole: string;
};

export default function AdminAccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

  
// Load user + org context for unified AppLayout sidebar
  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) { try { setUser(JSON.parse(u)) } catch {} }
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) { router.push('/login'); return; }
            const res = await fetch(`${API_URL}/api/accounts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 403) { router.push('/scholar/dashboard'); return; }
            if (res.ok) setAccounts(await res.json());
            else setError('Failed to load accounts');
        } catch (err) {
            setError('Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (accountId: string, newRole: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/accounts/${accountId}/role`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) {
                setAccounts(prev => prev.map(acc => acc.account_id === accountId ? { ...acc, accountRole: newRole } : acc));
                showToast('Role updated!');
            } else {
                showToast('Failed to update role', 'error');
            }
        } catch { showToast('Failed to update role', 'error'); }
    };

    const handleDelete = async (accountId: string) => {
        if (!window.confirm('Permanently delete this account?')) return;
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${API_URL}/api/accounts/${accountId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setAccounts(prev => prev.filter(acc => acc.account_id !== accountId));
                showToast('Account deleted');
            } else {
                showToast('Failed to delete account', 'error');
            }
        } catch { showToast('Failed to delete account', 'error'); }
    };

    if (loading) {
        return (
            <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="portal-panel-strong p-6 sm:p-8 mb-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <span className="portal-chip">Admin Accounts</span>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>Account Management</h1>
                            <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--color-textSecondary)' }}>Manage user roles and platform access in one cohesive view.</p>
                        </div>
                        <div className="portal-stat min-w-[220px]">
                            <p className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--color-textSecondary)' }}>Accounts Loaded</p>
                            <p className="text-3xl font-black mt-2" style={{ color: 'var(--color-text)' }}>{accounts.length}</p>
                        </div>
                    </div>
                </div>

                {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-text)' }}>{error}</div>}

                <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full max-w-md">
                        <input
                            aria-label="Search accounts"
                            placeholder="Search by name, email or role..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="portal-input pl-11"
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-textSecondary)]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
                            </svg>
                        </div>
                    </div>
                    <div className="portal-chip">{accounts.filter(acc => {
                        const q = String(query || '').trim().toLowerCase();
                        if (!q) return true;
                        return String(acc.accountName || '').toLowerCase().includes(q) || String(acc.accountEmail || '').toLowerCase().includes(q) || String(acc.accountRole || '').toLowerCase().includes(q);
                    }).length} visible</div>
                </div>

                <div className="portal-panel overflow-hidden">
                    <table className="portal-table text-left">
                        <thead>
                            <tr className="border-b" style={{ borderBottomColor: 'var(--color-border)' }}>
                                <th className="p-4 font-semibold text-sm">User</th>
                                <th className="p-4 font-semibold text-sm">Email</th>
                                <th className="p-4 font-semibold text-sm">Role</th>
                                <th className="p-4 font-semibold text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts
                                .filter(acc => {
                                    const q = String(query || '').trim().toLowerCase();
                                    if (!q) return true;
                                    return (
                                        String(acc.accountName || '').toLowerCase().includes(q) ||
                                        String(acc.accountEmail || '').toLowerCase().includes(q) ||
                                        String(acc.accountRole || '').toLowerCase().includes(q)
                                    );
                                })
                                .map((acc, idx) => (
                                <tr key={acc.account_id} className={`border-b transition-colors ${idx % 2 === 0 ? '' : 'bg-black/5 dark:bg-white/3'}`} style={{ borderBottomColor: 'var(--color-border)' }}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                                                {acc.accountName?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{acc.accountName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm" style={{ color: 'var(--color-textSecondary)' }}>{acc.accountEmail}</td>
                                    <td className="p-4">
                                        <select
                                            value={acc.accountRole || 'Student'}
                                            onChange={e => handleRoleChange(acc.account_id, e.target.value)}
                                            className="portal-input px-3 py-1.5 text-sm"
                                        >
                                            <option value="Student">Student</option>
                                            <option value="Adviser">Adviser</option>
                                            <option value="Admin">Admin</option>
                                        </select>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDelete(acc.account_id)}
                                            className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                                            title="Delete account"
                                        >
                                            <Trash2 className="w-4 h-4" style={{ color: 'var(--color-error)' }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {accounts.filter(acc => {
                                const q = String(query || '').trim().toLowerCase();
                                if (!q) return true;
                                return (
                                    String(acc.accountName || '').toLowerCase().includes(q) ||
                                    String(acc.accountEmail || '').toLowerCase().includes(q) ||
                                    String(acc.accountRole || '').toLowerCase().includes(q)
                                );
                            }).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center portal-empty">
                                        <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-textSecondary)' }} />
                                        <p style={{ color: 'var(--color-textSecondary)' }}>No accounts found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'
                    }`}>
                    {toast.message}
                </div>
            )}
        </AppLayout>
    );
}
