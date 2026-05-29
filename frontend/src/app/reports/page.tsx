'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ReportExportPanel from '@/components/reports/ReportExportPanel';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

interface Organization { id: string; name: string; role: 'admin' | 'manager' | 'member' | 'adviser'; }
interface Project { id: string; name: string; }

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [orgId, setOrgId] = useState('');
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Reports & Exports
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
              Generate and export sprint reports, team performance, and task status
            </p>
          </div>
          {projects.length > 0 && (
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/70 backdrop-blur-sm shadow-sm"
              style={{ color: 'var(--color-text)' }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32" style={{ color: 'var(--color-textSecondary)' }}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mr-2" />
            Loading projects...
          </div>
        ) : selectedProject && orgId ? (
          <ReportExportPanel
            projectId={selectedProject}
            organizationId={orgId}
            projectName={projects.find(p => p.id === selectedProject)?.name}
          />
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--color-textSecondary)' }}>
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No projects found in this organization.</p>
            <a href="/projects" className="mt-3 inline-block text-sm text-amber-600 hover:text-amber-700 underline">
              Create a project →
            </a>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
