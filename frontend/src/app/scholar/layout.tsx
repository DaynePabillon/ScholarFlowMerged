'use client';

import { ThemeProvider } from '@/contexts/scholar/ThemeContext';

export default function ScholarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
