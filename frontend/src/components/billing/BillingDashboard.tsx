'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { CreditCard, CheckCircle2, Star, Zap, Building2, Users, ExternalLink, Receipt, AlertCircle } from 'lucide-react';

interface Subscription {
  plan: string;
  status: string;
  seat_count: number;
  member_count: number;
  billing_cycle: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
}

interface BillingEvent {
  id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  description: string;
  invoice_url: string | null;
  created_at: string;
}

interface Plan {
  name: string;
  price_monthly: number;
  price_annual: number;
  seats: number;
  features: string[];
}

interface Props {
  organizationId: string;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Star className="h-5 w-5" />,
  standard: <Zap className="h-5 w-5" />,
  pro: <CheckCircle2 className="h-5 w-5" />,
  enterprise: <Building2 className="h-5 w-5" />
};

const PLAN_COLORS: Record<string, string> = {
  free: 'border-slate-200 dark:border-slate-600',
  standard: 'border-sky-400',
  pro: 'border-violet-500',
  enterprise: 'border-amber-500'
};

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600',
  standard: 'bg-sky-100 text-sky-700',
  pro: 'bg-violet-100 text-violet-700',
  enterprise: 'bg-amber-100 text-amber-700'
};

export default function BillingDashboard({ organizationId }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get(`/billing/subscription?organization_id=${organizationId}`),
      apiClient.get(`/billing/plans`),
      apiClient.get(`/billing/history?organization_id=${organizationId}`)
    ]).then(([subRes, plansRes, eventsRes]) => {
      setSubscription(subRes.data.subscription);
      setPlans(plansRes.data.plans);
      setEvents(eventsRes.data.events);
    }).finally(() => setLoading(false));
  }, [organizationId]);

  const handleUpgrade = async (plan: string) => {
    if (plan === 'enterprise') {
      window.open('mailto:support@skyflow.fun?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    setLoadingCheckout(plan);
    setError('');
    try {
      const res = await apiClient.post('/billing/checkout', { organization_id: organizationId, plan, billing_cycle: billingCycle });
      if (res.data.url) window.location.href = res.data.url;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to start checkout';
      setError(msg.includes('not configured')
        ? 'Stripe is not configured in this environment. Contact the administrator.'
        : msg);
    } finally {
      setLoadingCheckout(null);
    }
  };

  const handlePortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await apiClient.post('/billing/portal', { organization_id: organizationId });
      if (res.data.url) window.open(res.data.url, '_blank');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to open billing portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500 mr-2" />
        Loading billing info...
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';
  const planInfo = plans[currentPlan];

  return (
    <div className="space-y-6">
      {/* Current plan summary */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${PLAN_BADGE[currentPlan]}`}>
              {PLAN_ICONS[currentPlan]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 capitalize">{currentPlan} Plan</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {subscription?.billing_cycle === 'annual' ? 'Annual billing' : 'Monthly billing'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
              subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
              subscription?.status === 'past_due' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {subscription?.status || 'active'}
            </span>
            {subscription?.stripe_subscription_id && (
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 border border-sky-200 rounded px-2 py-1"
              >
                <ExternalLink className="h-3 w-3" />
                Manage
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <Users className="h-4 w-4 text-sky-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{subscription?.member_count || 0}</p>
            <p className="text-xs text-slate-500">Used Seats</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{planInfo?.seats === 9999 ? '∞' : (planInfo?.seats || 5)}</p>
            <p className="text-xs text-slate-500">Max Seats</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <CreditCard className="h-4 w-4 text-violet-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
            </p>
            <p className="text-xs text-slate-500">Renewal</p>
          </div>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${billingCycle === 'monthly' ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}`}>Monthly</span>
        <button
          onClick={() => setBillingCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
          className={`relative w-12 h-6 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm ${billingCycle === 'annual' ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}`}>
          Annual <span className="text-emerald-600 text-xs font-bold ml-1">–20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(plans).map(([planKey, plan]) => {
          const isCurrent = planKey === currentPlan;
          const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
          return (
            <div key={planKey} className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border-2 p-4 flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${isCurrent ? PLAN_COLORS[planKey] : 'border-white/40 dark:border-slate-700/40'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-lg ${PLAN_BADGE[planKey]}`}>{PLAN_ICONS[planKey]}</div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{plan.name}</h3>
                {isCurrent && <span className="ml-auto text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Current</span>}
              </div>

              <div className="mb-4">
                {price === 0 && planKey !== 'enterprise' ? (
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">Free</p>
                ) : planKey === 'enterprise' ? (
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Contact Us</p>
                ) : (
                  <div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">₱{price.toLocaleString()}</span>
                    <span className="text-xs text-slate-500">/{billingCycle === 'annual' ? 'yr' : 'mo'}</span>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">{plan.seats === 9999 ? 'Unlimited' : plan.seats} seats</p>
              </div>

              <ul className="space-y-1.5 mb-4 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && handleUpgrade(planKey)}
                disabled={isCurrent || loadingCheckout === planKey}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : planKey === 'enterprise'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:scale-[1.02] text-white'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] text-white'
                } disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-none`}
              >
                {isCurrent ? 'Current Plan' : loadingCheckout === planKey ? 'Loading…' : planKey === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Billing history */}
      {events.length > 0 && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/40 dark:border-slate-700/40 bg-white/30 dark:bg-slate-800/30">
            <Receipt className="h-4 w-4 text-sky-500" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Billing History</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map(event => (
              <div key={event.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{event.description}</p>
                  <p className="text-xs text-slate-400">{new Date(event.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  {event.amount_cents > 0 && (
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      ₱{(event.amount_cents / 100).toFixed(2)}
                    </span>
                  )}
                  {event.invoice_url && (
                    <a href={event.invoice_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Invoice
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
