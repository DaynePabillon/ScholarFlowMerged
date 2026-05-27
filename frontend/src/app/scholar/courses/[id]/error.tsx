'use client';

import { useEffect } from 'react';

export default function CourseDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
  
  useEffect(() => {
        console.error('Course detail page error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
                <p className="text-gray-600 mb-2">Error loading this course page:</p>
                <pre className="text-left bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 overflow-auto max-h-48 mb-6 whitespace-pre-wrap">
                    {error?.message || 'Unknown error'}
                    {error?.stack && (
                        <>
                            {'\n\n'}
                            {error.stack}
                        </>
                    )}
                </pre>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                    >
                        Try Again
                    </button>
                    <a
                        href="/scholar/courses"
                        className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition"
                    >
                        Back to Courses
                    </a>
                </div>
            </div>
        </div>
    );
}
