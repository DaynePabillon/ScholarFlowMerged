'use client';

import { useState } from 'react';
import { Bug, X, Send, AlertTriangle, Lightbulb, MessageSquare, HelpCircle } from 'lucide-react';
import { API_URL } from '@/lib/api/client';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const categories = [
    { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500' },
    { value: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'text-blue-500' },
    { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-gray-500' },
];

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
    const [category, setCategory] = useState('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            setError('Please fill in all fields');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    category,
                    title: title.trim(),
                    description: description.trim(),
                    pageUrl: window.location.href,
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setTitle('');
                setDescription('');
                setCategory('bug');
                // Auto close after 2 seconds
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                }, 2000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to submit report');
            }
        } catch (err) {
            console.error('Error submitting report:', err);
            setError('Failed to submit report. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bug className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-bold text-white">Report an Issue</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {success ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
                        <p className="text-gray-600">Your report has been submitted successfully.</p>
                        <p className="text-sm text-gray-500 mt-2">The creator will review it soon.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Category Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Category
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => setCategory(cat.value)}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${category === cat.value
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <cat.icon className={`w-5 h-5 ${cat.color}`} />
                                        <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Brief description of the issue..."
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Please provide details about the issue, steps to reproduce, what you expected to happen..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                required
                            />
                        </div>

                        {/* Page URL Info */}
                        <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                            📍 Current page will be included: {window.location.pathname}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Submit Report
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
