'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import GanttChart from '@/components/gantt/GanttChart';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { Calendar } from 'lucide-react';

interface Organization { id: string; name: string; role: 'admin' | 'manager' | 'member'; }
interface Project { id: string; name: string; }

export default function GanttPage() {
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) { router.push('/login'); return; }

    const storedUser = localStorage.getItem('user');
    const storedOrgs = localStorage.getItem('organizations');
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedOrgs) setOrganizations(JSON.parse(storedOrgs));
    if (storedOrg) setSelectedOrg(JSON.parse(storedOrg));

    apiClient.get('/projects').then(res => {
      const list = res.data.projects || [];
      setProjects(list);
      if (list.length > 0) setSelectedProject(list[0].id);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={(org) => {
        setSelectedOrg(org);
        localStorage.setItem('selectedOrganization', JSON.stringify(org));
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
              Timeline
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
              Gantt chart visualization of task progress and dependencies
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
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--color-textSecondary)' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mr-3" />
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--color-textSecondary)' }}>
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No projects found. Create a project first to view its timeline.</p>
          </div>
        ) : selectedProject ? (
          <GanttChart projectId={selectedProject} />
        ) : null}
      </div>
    </AppLayout>
  );
}
