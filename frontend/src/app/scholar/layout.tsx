'use client';

import { ThemeProvider, useTheme } from '@/contexts/scholar/ThemeContext';
import './globals.css';

function ScholarThemeShell({ children }: { children: React.ReactNode }) {
  const { role } = useTheme();

  return <div className={`scholar-theme ${role === 'manager' ? 'scholar-role-manager' : ''}`}>{children}</div>;
}

export default function ScholarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ScholarThemeShell>{children}</ScholarThemeShell>
    </ThemeProvider>
  );
}
