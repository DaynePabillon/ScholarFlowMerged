"use client"

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10 hover:bg-gray-500"
      style={{
        backgroundColor: mode === 'dark' ? 'var(--color-surface)' : 'var(--color-hover)',
        color: 'var(--color-text)',
      }}
      title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {mode === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
