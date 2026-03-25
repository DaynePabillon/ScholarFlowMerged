"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ThemeContextType {
    isProfessionalMode: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
    children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <ThemeContext.Provider value={{
                isProfessionalMode: true
            }}>
                {children}
            </ThemeContext.Provider>
        )
    }

    return (
        <ThemeContext.Provider value={{
            isProfessionalMode: true
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useThemeMode() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useThemeMode must be used within a ThemeProvider')
    }
    return context
}

// Helper labels - now just returns professional labels
export function useThemeLabels() {
    return {
        dashboard: 'Dashboard',
        tasks: 'Tasks',
        projects: 'Projects',
        boards: 'Boards',
        team: 'Team',
        status: {
            todo: 'To Do',
            inProgress: 'In Progress',
            review: 'Review',
            done: 'Done'
        }
    }
}
