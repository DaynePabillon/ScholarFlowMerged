"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20">
                    <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
                    <p className="text-white/60 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-white/80">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                            <p>By accessing or using SkyFlow, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">2. Use License</h2>
                            <p>Permission is granted to temporarily use SkyFlow for personal or commercial project management purposes. This license does not include:</p>
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                <li>Modifying or copying the software</li>
                                <li>Using the software for any unlawful purpose</li>
                                <li>Attempting to reverse engineer any software</li>
                                <li>Removing any copyright or proprietary notations</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
                            <p>You are responsible for:</p>
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                <li>Maintaining the confidentiality of your account</li>
                                <li>All activities that occur under your account</li>
                                <li>Notifying us immediately of any unauthorized use</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">4. Google Account Integration</h2>
                            <p>SkyFlow integrates with Google services. By using our application, you also agree to Google's Terms of Service. We access your Google data only with your explicit permission and for the purposes stated in our Privacy Policy.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">5. Disclaimer</h2>
                            <p>SkyFlow is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, secure, or error-free.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">6. Limitations</h2>
                            <p>In no event shall SkyFlow or its suppliers be liable for any damages arising out of the use or inability to use the service, even if we have been notified of the possibility of such damages.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">7. Modifications</h2>
                            <p>We may revise these terms of service at any time without notice. By using this service, you agree to be bound by the current version of these Terms of Service.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
                            <p>For any questions regarding these terms, please contact:</p>
                            <p className="mt-2 text-blue-400">waynepabillon667@gmail.com</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
