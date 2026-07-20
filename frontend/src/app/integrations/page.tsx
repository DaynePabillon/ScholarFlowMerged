'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Microsoft365Settings from '@/components/integrations/Microsoft365Settings';
import ClassroomIntegrationPanel from '@/components/integrations/ClassroomIntegrationPanel';
import ColumnMappingPanel from '@/components/sync/ColumnMappingPanel';
import ConflictResolutionDialog from '@/components/sync/ConflictResolutionDialog';
import SyncControlPanel from '@/components/sync/SyncControlPanel';
import ConnectedSheetsPanel from '@/components/sync/ConnectedSheetsPanel';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { Plug, RefreshCw, Grid3x3, BookOpen } from 'lucide-react';

interface Organization { id: string; name: string; role: 'admin' | 'manager' | 'member' | 'adviser'; }
interface Project { id: string; name: string; }

export default function IntegrationsPage() {
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [orgId, setOrgId] = useState('');
  const [tab, setTab] = useState<'ms365' | 'classroom' | 'sync'>('sync');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProjects = (effectiveOrgId: string) => {
    setLoading(true);
    apiClient.get(`/projects?organization_id=${effectiveOrgId}`).then(res => {
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) setSelectedProject(list[0].id);
    }).catch(() => setProjects([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) { router.push('/login'); return; }

    const storedUser = localStorage.getItem('user');
    const storedOrgs = localStorage.getItem('organizations');
    const storedOrg = localStorage.getItem('selectedOrganization');

    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedOrgs) setOrganizations(JSON.parse(storedOrgs));

    // Prefer selectedOrganization, fall back to first org
    const orgObj = storedOrg ? JSON.parse(storedOrg) : (storedOrgs ? JSON.parse(storedOrgs)[0] : null);
    if (orgObj) {
      setSelectedOrg(orgObj);
      setOrgId(orgObj.id);
      fetchProjects(orgObj.id);
    } else {
      setLoading(false);
    }
  }, []);

  const handleOrgChange = (org: Organization) => {
    setSelectedOrg(org);
    setOrgId(org.id);
    setProjects([]);
    setSelectedProject('');
    localStorage.setItem('selectedOrganization', JSON.stringify(org));
    fetchProjects(org.id);
  };

  const TABS = [
    { id: 'sync', label: 'Sync Controls', icon: RefreshCw },
    { id: 'ms365', label: 'Microsoft 365', icon: Grid3x3 },
    { id: 'classroom', label: 'Google Classroom', icon: BookOpen },
  ] as const;

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={handleOrgChange}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Integrations
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
              Manage external data sources, sync controls, and conflict resolution
            </p>
          </div>
          {projects.length > 0 && (
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-sm"
              style={{ color: 'var(--color-text)' }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-1.5 border border-white/40 dark:border-slate-700/40 shadow-sm w-fit mb-8">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md'
                    : 'hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors'
                }`}
                style={tab !== t.id ? { color: 'var(--color-text)' } : undefined}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32" style={{ color: 'var(--color-textSecondary)' }}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500 mr-2" />
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tab === 'sync' && (
              selectedProject ? (
                <>
                  <div className="lg:col-span-2">
                    <ConnectedSheetsPanel projectId={selectedProject} organizationId={orgId} />
                  </div>
                  <SyncControlPanel projectId={selectedProject} />
                  <ConflictResolutionDialog projectId={selectedProject} />
                  <div className="lg:col-span-2">
                    <ColumnMappingPanel projectId={selectedProject} sheetColumns={[]} />
                  </div>
                </>
              ) : (
                <div className="lg:col-span-2 text-center py-12" style={{ color: 'var(--color-textSecondary)' }}>
                  <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No project selected. Create a project first to use Sync Controls.</p>
                  <a href="/projects" className="mt-3 inline-block text-sm text-violet-600 hover:text-violet-700 underline">
                    Go to Projects →
                  </a>
                </div>
              )
            )}
            {tab === 'ms365' && orgId && selectedProject && (
              <div className="lg:col-span-2">
                <Microsoft365Settings organizationId={orgId} projectId={selectedProject} />
              </div>
            )}
            {tab === 'classroom' && orgId && (
              <div className="lg:col-span-2">
                <ClassroomIntegrationPanel organizationId={orgId} />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
