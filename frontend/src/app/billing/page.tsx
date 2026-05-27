'use client';

import { useEffect, useState, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import BillingDashboard from '@/components/billing/BillingDashboard';
import { apiClient } from '@/lib/api/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle2, XCircle } from 'lucide-react';

interface Organization { id: string; name: string; role: 'admin' | 'manager' | 'member'; }

function BillingPageContent() {
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingStatus = searchParams?.get('billing');

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) { router.push('/login'); return; }

    const storedUser = localStorage.getItem('user');
    const storedOrgs = localStorage.getItem('organizations');
    const storedOrg = localStorage.getItem('selectedOrganization');
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedOrgs) {
      const orgs = JSON.parse(storedOrgs);
      setOrganizations(orgs);
    }
    if (storedOrg) setSelectedOrg(JSON.parse(storedOrg));

    apiClient.get('/organizations').then(res => {
      const orgs = res.data.organizations || res.data || [];
      if (orgs.length > 0) setOrgId(orgs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      selectedOrg={selectedOrg}
      onOrgChange={(org) => {
        setSelectedOrg(org);
        setOrgId(org.id);
        localStorage.setItem('selectedOrganization', JSON.stringify(org));
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Billing & Subscription
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-textSecondary)' }}>
            Manage your plan, seats, and payment history
          </p>
        </div>

        {/* Checkout result banners */}
        {billingStatus === 'success' && (
          <div className="flex items-center gap-3 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/60 rounded-2xl px-5 py-4 mb-6 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              Your subscription has been updated successfully. Welcome to your new plan!
            </p>
          </div>
        )}
        {billingStatus === 'cancel' && (
          <div className="flex items-center gap-3 bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-2xl px-5 py-4 mb-6 shadow-sm">
            <XCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Checkout was cancelled. Your current plan is unchanged.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32" style={{ color: 'var(--color-textSecondary)' }}>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2" />
            Loading billing info...
          </div>
        ) : orgId ? (
          <BillingDashboard organizationId={orgId} />
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--color-textSecondary)' }}>
            No organization found.
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
      <BillingPageContent />
    </Suspense>
  );
}
