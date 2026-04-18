"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { UserRole, ThemeMode, getThemeForRole } from '@/config/scholar/themes'

interface ThemeContextType {
  role: UserRole
  mode: ThemeMode
  setRole: (role: UserRole) => void
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const normalizeScholarRole = (value: unknown): UserRole | null => {
  const role = String(value || '').trim().toLowerCase()

  if (role === 'admin') return 'admin'
  if (role === 'adviser' || role === 'advisers' || role === 'manager') return 'manager'
  if (role === 'member' || role === 'student') return 'member'

  return null
}

const getInitialScholarRole = (): UserRole => {
  if (typeof window === 'undefined') {
    return 'member'
  }

  try {
    const cachedProfile = localStorage.getItem('scholar_profile')
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile)
      const cachedRole = normalizeScholarRole(parsedProfile.scholarsyncRole || parsedProfile.role)
      if (cachedRole) {
        return cachedRole
      }
    }
  } catch {
    // Fall back to the neutral member theme until the live profile loads.
  }

  return 'member'
}

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedMode = localStorage.getItem('themeMode') as ThemeMode | null
  return savedMode || 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(getInitialScholarRole)
  const [mode, setMode] = useState<ThemeMode>(getInitialThemeMode)

  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode | null
    if (savedMode) {
      setMode(savedMode)
    }
  }, [])

  useEffect(() => {
    const theme = getThemeForRole(role, mode)
    const root = document.documentElement

    // Apply CSS variables to root
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })

    root.style.setProperty('--text-primary', theme.text)
    root.style.setProperty('--text-secondary', theme.textSecondary)

    // Sync dark mode class for Tailwind
    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    localStorage.setItem('themeMode', mode)
  }, [role, mode])

  const toggleMode = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ role, mode, setRole, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
