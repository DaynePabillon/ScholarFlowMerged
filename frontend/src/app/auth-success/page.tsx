'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // 1. Store token for both SkyFlow and ScholarSync
      localStorage.setItem('token', token);       // SkyFlow token key
      localStorage.setItem('auth_token', token);   // ScholarSync token key

      // 2. Fetch user data immediately to populate localStorage for both modules
      const fetchUserData = async () => {
        try {
          // Use the unified port 5000 (NEXT_PUBLIC_API_URL should be available)
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const userData = await res.json();
            const { organizations, onboarding_data, ...baseUser } = userData;
            
            // Store data in the format SkyFlow expects
            localStorage.setItem('user', JSON.stringify({ ...baseUser, onboarding_data }));
            localStorage.setItem('organizations', JSON.stringify(organizations || []));
            
            // Also store for ScholarSync compatibility if needed
            localStorage.setItem('ss_user', JSON.stringify(userData));
          }
        } catch (err) {
          console.error('Failed to pre-fetch user data:', err);
        } finally {
          // Redirect to the unified Launchpad portal either way
          // Dashboard will handle its own fetch if this one fails
          router.push('/');
        }
      };

      fetchUserData();
    } else {
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-300 font-medium text-lg">Signing you into ScholarFlow...</p>
        <p className="text-gray-500 text-sm mt-1">Preparing your portal</p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
