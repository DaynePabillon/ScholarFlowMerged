"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <Link href="/" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/20">
                    <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
                    <p className="text-white/60 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-white/80">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                            <p>When you use SkyFlow, we collect information you provide directly to us:</p>
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                <li>Google account information (name, email, profile picture)</li>
                                <li>Organization and project data you create</li>
                                <li>Task and assignment information</li>
                                <li>Files and documents you upload or link</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
                            <p>We use the information we collect to:</p>
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                <li>Provide, maintain, and improve our services</li>
                                <li>Process and complete transactions</li>
                                <li>Send you technical notices and support messages</li>
                                <li>Respond to your comments and questions</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">3. Google API Services</h2>
                            <p>SkyFlow uses Google API Services to provide functionality. Our use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
                            <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
                            <p>We retain your information for as long as your account is active or as needed to provide you services. You can request deletion of your data at any time.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
                            <p>You have the right to:</p>
                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                <li>Access your personal data</li>
                                <li>Correct inaccurate data</li>
                                <li>Request deletion of your data</li>
                                <li>Revoke access to your Google account</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-3">7. Contact Us</h2>
                            <p>If you have questions about this Privacy Policy, please contact us at:</p>
                            <p className="mt-2 text-blue-400">waynepabillon667@gmail.com</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
