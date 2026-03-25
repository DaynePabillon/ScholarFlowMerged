"use client"

import { API_URL } from '@/lib/api/client'
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Cloud, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react"

interface InvitationDetails {
    organizationName: string
    organizationId: string
    role: string
    inviterName: string
    email: string
}

function AcceptInvitationContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "accepted" | "error">("loading")
    const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
    const [error, setError] = useState<string>("")
    const [isAccepting, setIsAccepting] = useState(false)

    useEffect(() => {
        if (!token) {
            setStatus("invalid")
            setError("No invitation token provided")
            return
        }

        // Validate the invitation token
        validateInvitation()
    }, [token])

    const validateInvitation = async () => {
        try {
            const response = await fetch(`${API_URL}/api/invitations/validate?token=${token}`)
            const data = await response.json()

            if (response.ok && data.valid) {
                setInvitation(data.invitation)
                setStatus("valid")
            } else {
                setStatus("invalid")
                setError(data.error || "Invalid or expired invitation")
            }
        } catch (err) {
            setStatus("error")
            setError("Failed to validate invitation. Please try again.")
        }
    }

    const handleAcceptInvitation = async () => {
        const authToken = localStorage.getItem("token")

        if (!authToken) {
            // Store the invitation token and redirect to login
            localStorage.setItem("pendingInvitation", token || "")
            router.push("/login")
            return
        }

        setIsAccepting(true)

        try {
            const response = await fetch(`${API_URL}/api/invitations/accept`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({ token })
            })

            const data = await response.json()

            if (response.ok) {
                setStatus("accepted")

                // Clear any stored user data to force refresh
                localStorage.removeItem("user")
                localStorage.removeItem("organizations")
                localStorage.removeItem("selectedOrganization")

                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    router.push("/")
                }, 2000)
            } else {
                setStatus("error")
                setError(data.error || "Failed to accept invitation")
            }
        } catch (err) {
            setStatus("error")
            setError("Failed to accept invitation. Please try again.")
        } finally {
            setIsAccepting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-lg">
                            <Cloud className="w-8 h-8 text-blue-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">SkyFlow Invitation</h1>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {status === "loading" && (
                            <div className="text-center py-8">
                                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                                <p className="text-gray-600">Validating invitation...</p>
                            </div>
                        )}

                        {status === "valid" && invitation && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-xl font-semibold text-gray-800 mb-2">
                                        You've been invited!
                                    </h2>
                                    <p className="text-gray-600">
                                        <strong className="text-blue-600">{invitation.inviterName}</strong> has invited you to join
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-6 text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <span className="text-2xl font-bold text-white">
                                            {invitation.organizationName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800">{invitation.organizationName}</h3>
                                    <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                        as {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                                    </span>
                                </div>

                                <button
                                    onClick={handleAcceptInvitation}
                                    disabled={isAccepting}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50"
                                >
                                    {isAccepting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Accepting...
                                        </>
                                    ) : (
                                        <>
                                            Accept Invitation
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>

                                <p className="text-xs text-center text-gray-500">
                                    Invitation for: {invitation.email}
                                </p>
                            </div>
                        )}

                        {status === "accepted" && (
                            <div className="text-center py-8">
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                                    Welcome to the team!
                                </h2>
                                <p className="text-gray-600 mb-4">
                                    You've successfully joined {invitation?.organizationName}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Redirecting to dashboard...
                                </p>
                            </div>
                        )}

                        {(status === "invalid" || status === "error") && (
                            <div className="text-center py-8">
                                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                                    {status === "invalid" ? "Invalid Invitation" : "Something went wrong"}
                                </h2>
                                <p className="text-gray-600 mb-6">{error}</p>
                                <button
                                    onClick={() => router.push("/login")}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Go to Login
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AcceptInvitationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <AcceptInvitationContent />
        </Suspense>
    )
}
