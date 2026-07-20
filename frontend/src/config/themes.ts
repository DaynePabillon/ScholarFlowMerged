export type UserRole = 'admin' | 'manager' | 'member' | 'adviser';
export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface RoleTheme {
  name: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
}

export const roleThemes: Record<UserRole, RoleTheme> = {
  admin: {
    name: 'Elite Indigo',
    description: 'Authority and Premium Feel',
    light: {
      primary: '#2563eb',
      secondary: '#4f46e5',
      accent: '#6366f1',
      background: '#f0f9ff',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#bfdbfe',
      hover: '#eff6ff',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#6366f1',
    },
    dark: {
      primary: '#818cf8',
      secondary: '#60a5fa',
      accent: '#a5b4fc',
      background: '#080f1e',
      surface: '#0f1e38',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#1e3a5f',
      hover: 'rgba(96, 165, 250, 0.10)',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa',
    },
  },
  manager: {
    name: 'Professional Blue',
    description: 'Academic Organization and Growth',
    light: {
      primary: '#2563eb',
      secondary: '#0891b2',
      accent: '#06b6d4',
      background: '#f0f9ff',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#bae6fd',
      hover: '#e0f2fe',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#14b8a6',
    },
    dark: {
      primary: '#38bdf8',
      secondary: '#60a5fa',
      accent: '#7dd3fc',
      background: '#080f1e',
      surface: '#0f1e38',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#1e3a5f',
      hover: 'rgba(56, 189, 248, 0.10)',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa',
    },
  },
  member: {
    name: 'ScholarFlow Classic',
    description: 'Focused Productivity',
    light: {
      primary: '#2563eb',
      secondary: '#0891b2',
      accent: '#06b6d4',
      background: '#f0f9ff',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#bae6fd',
      hover: '#e0f2fe',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    dark: {
      primary: '#60a5fa',
      secondary: '#38bdf8',
      accent: '#7dd3fc',
      background: '#080f1e',
      surface: '#0f1e38',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#1e3a5f',
      hover: 'rgba(96, 165, 250, 0.10)',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa',
    },
  },
  adviser: {
    name: 'Adviser Purple',
    description: 'Academic Advisory and Oversight',
    light: {
      primary: '#7c3aed',
      secondary: '#6d28d9',
      accent: '#8b5cf6',
      background: '#faf5ff',
      surface: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#ddd6fe',
      hover: '#f5f3ff',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#8b5cf6',
    },
    dark: {
      primary: '#a78bfa',
      secondary: '#c4b5fd',
      accent: '#c4b5fd',
      background: '#0d0a1e',
      surface: '#1a1035',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#2e1d5e',
      hover: 'rgba(167, 139, 250, 0.10)',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#a78bfa',
    },
  },
};

export const getThemeForRole = (role: UserRole, mode: ThemeMode): ThemeColors => {
  const roleTheme = roleThemes[role] ?? roleThemes.member;
  return roleTheme[mode] ?? roleTheme.light;
};

export const getRoleThemeName = (role: UserRole): string => {
  return (roleThemes[role] ?? roleThemes.member).name;
};
