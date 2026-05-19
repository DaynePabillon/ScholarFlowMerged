'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">Privacy Policy</h1>
          <p className="mt-2 text-slate-500">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">1. Introduction</h2>
            <p>
              ScholarFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by ScholarFlow.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">2. Information Collection</h2>
            <p>We collect information you provide directly to us when you create an account via Google Authentication, including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Name and Email Address (retrieved from Google)</li>
              <li>Google Drive files and Google Sheets data (only as explicitly requested for academic collaboration)</li>
              <li>User-generated content (tasks, comments, and project data)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">3. Data Usage & Google OAuth</h2>
            <p>
              ScholarFlow's use and transfer of information received from Google APIs to any other app will adhere to 
              <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" className="text-blue-600 hover:underline mx-1" target="_blank">
                Google API Service User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-2">Specifically, we use Google data to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Sync your academic rosters and grades with Google Sheets.</li>
              <li>Allow you to access and manage project files within ScholarFlow.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data. Your database information is stored securely on Supabase servers, and authentication tokens are encrypted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at: 
              <span className="font-semibold ml-1 text-slate-900">scholarflow123@gmail.com</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
