'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ScholarLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem('post_login_redirect', '/scholar/dashboard');
    router.replace('/login');
  }, [router]);

  return null;
}
