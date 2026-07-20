'use client';

import { useEffect } from 'react';

export default function ScholarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {

  useEffect(() => {
    console.error('Scholar portal error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-10 text-slate-100">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Academic Portal
        </p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Something interrupted the portal
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
          We could not load this view cleanly. You can retry the current route or return to the dashboard.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">Error details</p>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-rose-200">
            {error?.message || 'Unknown error'}
            {error?.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Try again
          </button>
          <a
            href="/scholar/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}