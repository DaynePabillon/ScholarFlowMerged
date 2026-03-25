"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, AlertTriangle } from 'lucide-react'

type Role = 'admin' | 'manager' | 'member'

interface ProtectedRouteProps {
    children: React.ReactNode
    minRole?: Role
    organizationId?: string
    fallbackUrl?: string
    showAccessDenied?: boolean
}

const ROLE_HIERARCHY = {
    admin: 3,
    manager: 2,
    member: 1
}

function hasPermission(userRole: Role, requiredRole: Role): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export default function ProtectedRoute({
    children,
    minRole = 'member',
    organizationId,
    fallbackUrl = '/dashboard',
    showAccessDenied = true
}: ProtectedRouteProps) {
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
    const [userRole, setUserRole] = useState<Role | null>(null)

    useEffect(() => {
        const checkAccess = () => {
            try {
                const storedOrgs = localStorage.getItem('organizations')
                if (!storedOrgs) {
                    setIsAuthorized(false)
                    return
                }

                const orgs = JSON.parse(storedOrgs)

                // If no specific org, check if any org has the required role
                if (!organizationId) {
                    const hasAccess = orgs.some((org: any) =>
                        hasPermission(org.role as Role, minRole)
                    )
                    setIsAuthorized(hasAccess)
                    if (hasAccess && orgs.length > 0) {
                        setUserRole(orgs[0].role)
                    }
                    return
                }

                // Check specific organization
                const org = orgs.find((o: any) => o.id === organizationId)
                if (!org) {
                    setIsAuthorized(false)
                    return
                }

                const authorized = hasPermission(org.role as Role, minRole)
                setIsAuthorized(authorized)
                setUserRole(org.role)
            } catch (error) {
                console.error('Error checking access:', error)
                setIsAuthorized(false)
            }
        }

        checkAccess()
    }, [organizationId, minRole])

    // Loading state
    if (isAuthorized === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        )
    }

    // Access denied
    if (!isAuthorized) {
        if (!showAccessDenied) {
            router.push(fallbackUrl)
            return null
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600 max-w-md mb-4">
                    You don't have permission to access this page.
                    {minRole === 'admin' && ' Only administrators can view this section.'}
                    {minRole === 'manager' && ' This page is for managers and administrators only.'}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Shield className="w-4 h-4" />
                    <span>Required role: <strong className="capitalize">{minRole}</strong></span>
                    {userRole && (
                        <span>• Your role: <strong className="capitalize">{userRole}</strong></span>
                    )}
                </div>
                <button
                    onClick={() => router.push(fallbackUrl)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                >
                    Go Back
                </button>
            </div>
        )
    }

    // Authorized - render children
    return <>{children}</>
}
