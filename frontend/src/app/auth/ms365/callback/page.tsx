'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

function MS365CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting Microsoft 365…');

  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDesc || 'Authorization was cancelled or denied.');
      setTimeout(() => router.push('/integrations'), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization parameters. Please try again.');
      setTimeout(() => router.push('/integrations'), 3000);
      return;
    }

    apiClient.post('/ms365/callback', { code, state })
      .then(() => {
        setStatus('success');
        setMessage('Microsoft 365 connected! Redirecting…');
        setTimeout(() => router.push('/integrations'), 1500);
      })
      .catch((err: any) => {
        setStatus('error');
        // Show the real Microsoft error description if available
        const errData = err.response?.data;
        const detail  = errData?.error || errData?.ms_error?.error_description || errData?.ms_error?.error;
        setMessage(detail || 'Failed to connect Microsoft 365. Please try again.');
        setTimeout(() => router.push('/integrations'), 4000);
      });
  }, []);

  const icon   = status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌';
  const heading = status === 'loading' ? 'Connecting…' : status === 'success' ? 'Connected!' : 'Connection Failed';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center space-y-3">
        <div className="text-5xl">{icon}</div>
        <h1 className="text-xl font-semibold text-slate-800">{heading}</h1>
        <p className="text-sm text-slate-500">{message}</p>
        {status !== 'loading' && (
          <p className="text-xs text-slate-400">
            Returning to Integrations…
          </p>
        )}
      </div>
    </div>
  );
}

export default function MS365CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-3">⏳</div>
          <p className="text-slate-500 text-sm">Connecting Microsoft 365…</p>
        </div>
      </div>
    }>
      <MS365CallbackContent />
    </Suspense>
  );
}
