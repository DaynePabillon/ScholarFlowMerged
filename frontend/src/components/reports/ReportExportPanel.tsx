'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { FileText, Download, ExternalLink, Clock, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  report_type: string;
  format: string;
  sprint_label: string | null;
  google_doc_url: string | null;
  pdf_url: string | null;
  generated_by_name: string;
  created_at: string;
  status: string;
}

interface Props {
  projectId: string;
  organizationId: string;
}

const REPORT_TYPES = [
  { value: 'sprint_summary', label: 'Sprint Summary' },
  { value: 'team_performance', label: 'Team Performance' },
  { value: 'task_status', label: 'Task Status Report' },
  { value: 'dependency_report', label: 'Dependency Report' },
  { value: 'custom', label: 'Custom Report' }
];

export default function ReportExportPanel({ projectId, organizationId }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('sprint_summary');
  const [format, setFormat] = useState<'pdf' | 'google_doc'>('pdf');
  const [sprintLabel, setSprintLabel] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; url?: string } | null>(null);

  const loadReports = async () => {
    try {
      const res = await apiClient.get(`/export/reports?project_id=${projectId}`);
      setReports(res.data.reports);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadReports(); }, [projectId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setFeedback(null);
    const title = `${REPORT_TYPES.find(r => r.value === reportType)?.label}${sprintLabel ? ` — ${sprintLabel}` : ''} — ${new Date().toLocaleDateString()}`;
    try {
      const res = await apiClient.post('/export/generate', {
        project_id: projectId,
        organization_id: organizationId,
        report_type: reportType,
        format,
        sprint_label: sprintLabel || null,
        date_range_start: dateStart || null,
        date_range_end: dateEnd || null,
        title
      });
      setFeedback({
        type: 'success',
        message: `Report generated: ${title}`,
        url: res.data.googleDocUrl || undefined
      });
      await loadReports();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Report generation failed' });
    } finally {
      setGenerating(false);
    }
  };

  const downloadData = async (report: Report) => {
    try {
      const res = await apiClient.post('/export/generate', {
        project_id: projectId,
        organization_id: organizationId,
        report_type: report.report_type,
        format: 'pdf',
        title: report.title
      });
      // Generate downloadable JSON for now (PDF renderer not yet installed)
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Generate report form */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/40 bg-white/30">
          <FileText className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Generate Report</h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Report type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1.5">Report Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REPORT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setReportType(t.value)}
                  className={`text-xs py-2.5 px-3 rounded-xl text-left transition-all duration-200 ${
                    reportType === t.value
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-md'
                      : 'bg-white/50 border border-gray-200 text-slate-600 hover:bg-white/80 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-1.5">Export Format</label>
            <div className="flex gap-2">
              {[
                { value: 'pdf', label: 'PDF' },
                { value: 'google_doc', label: 'Google Doc' }
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value as any)}
                  className={`text-xs py-2.5 px-5 rounded-xl transition-all duration-200 ${
                    format === f.value
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-md'
                      : 'bg-white/50 border border-gray-200 text-slate-600 hover:bg-white/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sprint Label (optional)</label>
              <input
                value={sprintLabel}
                onChange={e => setSprintLabel(e.target.value)}
                placeholder="e.g. Sprint 3"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Date From</label>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Date To</label>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          {feedback && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
              feedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
              <span className="flex-1">{feedback.message}</span>
              {feedback.url && (
                <a href={feedback.url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 underline font-medium ml-2">
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-300"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : `Generate ${REPORT_TYPES.find(r => r.value === reportType)?.label}`}
          </button>
        </div>
      </div>

      {/* Report history */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/40 bg-white/30">
          <Clock className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Report History</h2>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No reports generated yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map(report => (
              <div key={report.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{report.title}</p>
                  <p className="text-xs text-slate-400">
                    {REPORT_TYPES.find(r => r.value === report.report_type)?.label} • {report.format.toUpperCase()} • by {report.generated_by_name} • {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {report.google_doc_url && (
                    <a href={report.google_doc_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-xs text-[#1a73e8] hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      Open Doc
                    </a>
                  )}
                  <button onClick={() => downloadData(report)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-600 rounded px-2 py-1">
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
