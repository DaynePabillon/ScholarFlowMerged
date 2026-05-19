"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, ThemeMode, ThemeColors, getThemeForRole } from '@/config/themes';

interface ThemeContextType {
  role: UserRole;
  mode: ThemeMode;
  colors: ThemeColors;
  setRole: (role: UserRole) => void;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialRole?: UserRole;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialRole = 'member' 
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [mode, setMode] = useState<ThemeMode>('light');
  const [colors, setColors] = useState<ThemeColors>(getThemeForRole(initialRole, 'light'));

  // Load theme preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    if (savedMode) {
      setMode(savedMode);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Update colors when role or mode changes
  useEffect(() => {
    const newColors = getThemeForRole(role, mode);
    setColors(newColors);
    
    // Apply CSS variables to root
    const root = document.documentElement;
    Object.entries(newColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Add/remove dark class
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [role, mode]);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  return (
    <ThemeContext.Provider value={{ 
      role, 
      mode, 
      colors, 
      setRole, 
      toggleMode,
      setMode: handleSetMode 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
