'use client';

import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">Terms of Service</h1>
          <p className="mt-2 text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ScholarFlow, you agree to bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">2. Use of ScholarFlow</h2>
            <p>
              ScholarFlow is provided for academic collaboration, project management, and grade syncing. You agree to use the service only for lawful and professional academic purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">3. Google Services & API Integration</h2>
            <p>
              ScholarFlow integrates with Google APIs to provide features such as Google Drive file access and Google Sheets syncing. Your use of these features is subject to the 
              <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline mx-1" target="_blank">
                Google Terms of Service
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">4. Limitation of Liability</h2>
            <p>
              ScholarFlow is provided "as is" without warranty of any kind. We are not liable for any data loss, academic penalties, or other damages arising from the use of this software.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to ScholarFlow at any time for violation of these terms or misuse of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">6. Contact</h2>
            <p>
              Questions about these Terms should be sent to: 
              <span className="font-semibold ml-1 text-slate-900">scholarflow123@gmail.com</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
