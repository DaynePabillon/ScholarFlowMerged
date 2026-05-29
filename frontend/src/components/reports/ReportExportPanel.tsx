'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { FileText, Download, ExternalLink, Clock, RefreshCw, CheckCircle2, AlertCircle, FileDown } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  wbs_code?: string;
  due_date?: string;
  start_date?: string;
  progress_percent?: number;
  estimated_hours?: number;
  actual_hours?: number;
  complexity_weight?: number;
  assigned_to_name?: string;
  assignee_names?: string[];
  created_at?: string;
  updated_at?: string;
}

interface Dependency {
  dependency_type: string;
  from_title: string;
  from_wbs: string | null;
  from_status: string;
  to_title: string;
  to_wbs: string | null;
  to_status: string;
}

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
  projectName?: string;
}

const REPORT_TYPES = [
  { value: 'sprint_summary',    label: 'Sprint Summary',     desc: 'Task progress by sprint' },
  { value: 'team_performance',  label: 'Team Performance',   desc: 'Per-member stats' },
  { value: 'task_status',       label: 'Task Status Report', desc: 'Status breakdown' },
  { value: 'dependency_report', label: 'Dependency Report',  desc: 'Task dependencies' },
  { value: 'custom',            label: 'Custom Report',      desc: 'All task details' },
];

const FORMAT_OPTIONS = [
  { value: 'pdf',        label: 'PDF',        icon: '📄' },
  { value: 'google_doc', label: 'Google Doc',  icon: '📑' },
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

function pct(n: number | null | undefined) {
  return n != null ? `${Math.round(n)}%` : '0%';
}

function cap(s: string) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function primaryAssignee(task: Task): string {
  if (task.assigned_to_name) return task.assigned_to_name;
  if (task.assignee_names?.length) return task.assignee_names[0];
  return 'Unassigned';
}

// ─── PDF native table helpers ─────────────────────────────────────────────────

function truncateText(doc: any, text: string, maxW: number): string {
  const s = String(text || '—');
  if (doc.getTextWidth(s) <= maxW) return s;
  let t = s;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawPdfTable(
  doc: any,
  opts: {
    startX: number; startY: number; pageW: number; pageH: number; margin: number;
    headers: string[]; rows: string[][]; colWidths: number[]; rowH?: number; fontSize?: number;
  }
): number {
  const { startX, pageW, pageH, margin, headers, rows, colWidths } = opts;
  const rowH = opts.rowH ?? 7;
  const fontSize = opts.fontSize ?? 8;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const safeBottom = pageH - margin - 5;

  const drawHeader = (y: number): number => {
    doc.setFillColor(30, 64, 175);
    doc.rect(startX, y, totalW, rowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    let cx = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(truncateText(doc, headers[i], colWidths[i] - 2), cx + 1.5, y + rowH - 2);
      cx += colWidths[i];
    }
    return y + rowH;
  };

  let y = drawHeader(opts.startY);

  for (let ri = 0; ri < rows.length; ri++) {
    if (y + rowH > safeBottom) {
      doc.addPage();
      // Compact header band on continuation pages
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 14, 'F');
      y = 18;
      y = drawHeader(y);
    }

    if (ri % 2 === 1) {
      doc.setFillColor(245, 247, 255);
      doc.rect(startX, y, totalW, rowH, 'F');
    }

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);

    let cx = startX;
    for (let ci = 0; ci < rows[ri].length; ci++) {
      doc.text(truncateText(doc, String(rows[ri][ci] ?? '—'), colWidths[ci] - 2), cx + 1.5, y + rowH - 2);
      cx += colWidths[ci];
    }

    // Row separator line
    doc.setDrawColor(220, 228, 240);
    doc.setLineWidth(0.15);
    doc.line(startX, y + rowH, startX + totalW, y + rowH);

    y += rowH;
  }

  return y;
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

async function generatePDF(
  reportType: string,
  title: string,
  tasks: Task[],
  meta: { projectName: string; sprintLabel?: string; dateStart?: string; dateEnd?: string; generatedBy?: string },
  dependencies: Dependency[] = []
) {
  // Use named export — works in both browser ESM and Node CJS contexts
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();   // 297 mm landscape
  const pageH = doc.internal.pageSize.getHeight();  // 210 mm landscape
  const margin = 14;
  let y = margin;

  // Header band
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, 14, { align: 'right' });
  y = 28;

  // Meta row
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  const metaParts = ([
    `Project: ${meta.projectName}`,
    meta.sprintLabel ? `Sprint: ${meta.sprintLabel}` : null,
    meta.dateStart ? `From: ${fmt(meta.dateStart)}` : null,
    meta.dateEnd ? `To: ${fmt(meta.dateEnd)}` : null,
    meta.generatedBy ? `By: ${meta.generatedBy}` : null,
  ].filter(Boolean) as string[]).join('   |   ');
  doc.text(metaParts, margin, y);
  y += 8;

  // ── Convenience wrapper ─────────────────────────────────────────────────────
  const tbl = (startY: number, headers: string[], colWidths: number[], rows: string[][], rowH = 7) =>
    drawPdfTable(doc, { startX: margin, startY, pageW, pageH, margin, headers, colWidths, rows, rowH, fontSize: 8 });

  // ── Per-report content ──────────────────────────────────────────────────────

  // ── Helper: section heading ──────────────────────────────────────────────────
  const sectionHeading = (label: string, curY: number): number => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(label, margin, curY);
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.3);
    doc.line(margin, curY + 1.5, margin + 50, curY + 1.5);
    return curY + 6;
  };

  // ── Inline stat badge helper ──────────────────────────────────────────────────
  const statBadge = (label: string, value: string | number, curY: number, rgb: [number,number,number]): number => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(`${label}: ${value}`, margin, curY);
    return curY;
  };

  const today = new Date();

  // ────────────────────────────────────────────────────────────────────────────
  // SPRINT SUMMARY — velocity, carry-overs, full task list
  // ────────────────────────────────────────────────────────────────────────────
  if (reportType === 'sprint_summary') {
    const done      = tasks.filter(t => t.status === 'done' || t.status === 'completed');
    const blocked   = tasks.filter(t => t.status === 'blocked');
    const todo      = tasks.filter(t => t.status === 'todo');
    const inProg    = tasks.filter(t => t.status === 'in_progress');
    const velocity  = done.reduce((s, t) => s + (t.complexity_weight || 1), 0);
    const carryOver = todo.length + inProg.length;
    const overdue   = tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length;

    y = sectionHeading('Sprint Overview', y);

    const overviewRows = [
      ['Total Tasks', String(tasks.length), 'Completed', String(done.length)],
      ['In Progress', String(inProg.length), 'In Review', String(tasks.filter(t => t.status === 'review').length)],
      ['Blocked', String(blocked.length), 'Carry-over', String(carryOver)],
      ['Velocity (complexity pts)', String(velocity), 'Overdue', String(overdue)],
    ];
    y = tbl(y, ['Metric', 'Value', 'Metric', 'Value'], [80, 30, 80, 30], overviewRows, 7);
    y += 6;

    y = sectionHeading('Task List', y);
    y = tbl(
      y,
      ['#', 'WBS', 'Task Title', 'Status', 'Priority', 'Assignee', 'Progress', 'Due Date', 'Complexity'],
      [8, 18, 82, 27, 24, 42, 20, 26, 22],
      tasks.map((t, i) => [
        String(i + 1),
        t.wbs_code || '—',
        t.title,
        cap(t.status),
        cap(t.priority),
        primaryAssignee(t),
        pct(t.progress_percent),
        fmt(t.due_date),
        String(t.complexity_weight ?? 1),
      ]),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TASK STATUS REPORT — status distribution + overdue highlights + priority split
  // ────────────────────────────────────────────────────────────────────────────
  else if (reportType === 'task_status') {
    const statusGroups: Record<string, Task[]> = {};
    tasks.forEach(t => {
      const key = t.status || 'unknown';
      if (!statusGroups[key]) statusGroups[key] = [];
      statusGroups[key].push(t);
    });
    const priorityGroups: Record<string, number> = {};
    tasks.forEach(t => { priorityGroups[t.priority] = (priorityGroups[t.priority] || 0) + 1; });

    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < today && !['done','completed'].includes(t.status));

    y = sectionHeading('Status Distribution', y);
    y = tbl(
      y,
      ['Status', 'Count', '% of Total'],
      [90, 30, 40],
      Object.entries(statusGroups).sort((a, b) => b[1].length - a[1].length).map(([s, ts]) => [
        cap(s), String(ts.length), `${Math.round(ts.length / tasks.length * 100)}%`,
      ]),
      7,
    );
    y += 5;

    y = sectionHeading('Priority Breakdown', y);
    y = tbl(
      y,
      ['Priority', 'Count', '% of Total'],
      [90, 30, 40],
      Object.entries(priorityGroups).map(([p, c]) => [cap(p), String(c), `${Math.round(c / tasks.length * 100)}%`]),
      7,
    );
    y += 5;

    if (overdueTasks.length > 0) {
      y = sectionHeading(`Overdue Tasks (${overdueTasks.length})`, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(220, 38, 38);
      doc.text('Tasks past their due date that are not yet completed', margin, y);
      y += 5;
      y = tbl(
        y,
        ['WBS', 'Task Title', 'Status', 'Assignee', 'Due Date', 'Days Overdue'],
        [18, 90, 27, 50, 27, 30],
        overdueTasks.map(t => [
          t.wbs_code || '—',
          t.title,
          cap(t.status),
          primaryAssignee(t),
          fmt(t.due_date),
          String(Math.floor((today.getTime() - new Date(t.due_date!).getTime()) / 86400000)),
        ]),
      );
      y += 5;
    }

    y = sectionHeading('All Tasks', y);
    y = tbl(
      y,
      ['WBS', 'Task Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Progress'],
      [18, 88, 27, 22, 42, 27, 19],
      tasks.map(t => [
        t.wbs_code || '—',
        t.title,
        cap(t.status),
        cap(t.priority),
        primaryAssignee(t),
        fmt(t.due_date),
        pct(t.progress_percent),
      ]),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TEAM PERFORMANCE — per-member stats + efficiency + workload table
  // ────────────────────────────────────────────────────────────────────────────
  else if (reportType === 'team_performance') {
    type MemberStat = { total: number; done: number; inProg: number; review: number; blocked: number; estHrs: number; actHrs: number };
    const memberMap: Record<string, MemberStat> = {};
    tasks.forEach(t => {
      const name = primaryAssignee(t);
      if (!memberMap[name]) memberMap[name] = { total: 0, done: 0, inProg: 0, review: 0, blocked: 0, estHrs: 0, actHrs: 0 };
      memberMap[name].total++;
      if (t.status === 'done' || t.status === 'completed') memberMap[name].done++;
      else if (t.status === 'in_progress') memberMap[name].inProg++;
      else if (t.status === 'review') memberMap[name].review++;
      else if (t.status === 'blocked') memberMap[name].blocked++;
      memberMap[name].estHrs  += t.estimated_hours ?? 0;
      memberMap[name].actHrs  += t.actual_hours ?? 0;
    });

    y = sectionHeading('Member Performance Summary', y);
    y = tbl(
      y,
      ['Team Member', 'Total', 'Done', 'In Prog', 'Review', 'Blocked', 'Completion %', 'Est. Hrs', 'Act. Hrs'],
      [52, 18, 18, 20, 20, 20, 30, 22, 22],
      Object.entries(memberMap).sort((a, b) => b[1].done - a[1].done).map(([name, s]) => [
        name,
        String(s.total),
        String(s.done),
        String(s.inProg),
        String(s.review),
        String(s.blocked),
        `${s.total > 0 ? Math.round(s.done / s.total * 100) : 0}%`,
        s.estHrs > 0 ? String(s.estHrs) : '—',
        s.actHrs > 0 ? String(s.actHrs) : '—',
      ]),
      8,
    );
    y += 6;

    y = sectionHeading('Task Details by Member', y);
    const sortedByMember = [...tasks].sort((a, b) => primaryAssignee(a).localeCompare(primaryAssignee(b)));
    y = tbl(
      y,
      ['Assignee', 'WBS', 'Task Title', 'Status', 'Priority', 'Due Date', 'Progress', 'Est.Hrs'],
      [42, 18, 78, 27, 22, 26, 20, 20],
      sortedByMember.map(t => [
        primaryAssignee(t),
        t.wbs_code || '—',
        t.title,
        cap(t.status),
        cap(t.priority),
        fmt(t.due_date),
        pct(t.progress_percent),
        t.estimated_hours != null ? String(t.estimated_hours) : '—',
      ]),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DEPENDENCY REPORT — actual dependency links + tasks without dates
  // ────────────────────────────────────────────────────────────────────────────
  else if (reportType === 'dependency_report') {
    const depTypeLabel: Record<string, string> = {
      finish_to_start: 'Finish → Start',
      start_to_start:  'Start → Start',
      finish_to_finish:'Finish → Finish',
      start_to_finish: 'Start → Finish',
    };

    if (dependencies.length > 0) {
      y = sectionHeading(`Dependency Links (${dependencies.length})`, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text('Arrow reads: "Predecessor must complete before Successor can proceed."', margin, y);
      y += 5;
      y = tbl(
        y,
        ['Predecessor WBS', 'Predecessor Task', 'Pred. Status', 'Type', 'Successor WBS', 'Successor Task', 'Succ. Status'],
        [24, 68, 28, 32, 24, 68, 28],
        dependencies.map(d => [
          d.from_wbs || '—',
          d.from_title,
          cap(d.from_status),
          depTypeLabel[d.dependency_type] || cap(d.dependency_type),
          d.to_wbs || '—',
          d.to_title,
          cap(d.to_status),
        ]),
      );
      y += 6;
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('No dependency links defined for this project yet.', margin, y);
      y += 8;
    }

    y = sectionHeading('All Tasks (Timeline Overview)', y);
    y = tbl(
      y,
      ['WBS', 'Task Title', 'Status', 'Priority', 'Assignee', 'Start Date', 'Due Date', 'Progress'],
      [18, 82, 27, 22, 40, 27, 27, 20],
      tasks.map(t => [
        t.wbs_code || '—',
        t.title,
        cap(t.status),
        cap(t.priority),
        primaryAssignee(t),
        fmt(t.start_date),
        fmt(t.due_date),
        pct(t.progress_percent),
      ]),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CUSTOM — all available fields
  // ────────────────────────────────────────────────────────────────────────────
  else if (reportType === 'custom') {
    y = sectionHeading('Complete Task Details', y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    doc.text('All task fields — use filters on the Reports page to narrow by date range.', margin, y);
    y += 5;
    y = tbl(
      y,
      ['#', 'WBS', 'Task Title', 'Status', 'Priority', 'Assignee', 'Progress', 'Start', 'Due', 'Est.Hrs', 'Act.Hrs', 'Complexity'],
      [8, 16, 68, 25, 20, 36, 18, 22, 22, 16, 16, 22],
      tasks.map((t, i) => [
        String(i + 1),
        t.wbs_code || '—',
        t.title,
        cap(t.status),
        cap(t.priority),
        primaryAssignee(t),
        pct(t.progress_percent),
        fmt(t.start_date),
        fmt(t.due_date),
        t.estimated_hours != null ? String(t.estimated_hours) : '—',
        t.actual_hours    != null ? String(t.actual_hours)    : '—',
        String(t.complexity_weight ?? 1),
      ]),
    );
  }

  // Footer on every page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `ScholarFlow — ${title} — Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' }
    );
  }

  doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReportExportPanel({ projectId, organizationId, projectName = 'Project' }: Props) {
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
      setReports(res.data.reports || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadReports(); }, [projectId]);

  const buildTitle = () => {
    const typeLabel = REPORT_TYPES.find(r => r.value === reportType)?.label ?? 'Report';
    return `${typeLabel}${sprintLabel ? ` — ${sprintLabel}` : ''} — ${new Date().toLocaleDateString()}`;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setFeedback(null);
    const title = buildTitle();
    try {
      const res = await apiClient.post('/export/generate', {
        project_id: projectId,
        organization_id: organizationId,
        report_type: reportType,
        format,
        sprint_label: sprintLabel || null,
        date_range_start: dateStart || null,
        date_range_end: dateEnd || null,
        title,
      });

      const tasks: Task[] = res.data.data?.tasks ?? [];
      const meta = {
        projectName,
        sprintLabel: sprintLabel || undefined,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        generatedBy: res.data.report?.generated_by_name,
      };

      if (format === 'pdf') {
        await generatePDF(reportType, title, tasks, meta);
        setFeedback({ type: 'success', message: `PDF downloaded: ${title}` });
      } else {
        // Google Doc
        if (res.data.googleDocUrl) {
          setFeedback({ type: 'success', message: `Google Doc created: ${title}`, url: res.data.googleDocUrl });
        } else {
          // Fallback: download as PDF if Google Doc creation failed/not configured
          await generatePDF(reportType, title, tasks, meta);
          setFeedback({ type: 'success', message: `Google Docs not configured — downloaded as PDF instead.` });
        }
      }
      await loadReports();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Report generation failed' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const res = await apiClient.post('/export/generate', {
        project_id: projectId,
        organization_id: organizationId,
        report_type: report.report_type,
        format: report.format === 'google_doc' ? 'pdf' : report.format,
        title: report.title,
      });
      const tasks: Task[] = res.data.data?.tasks ?? [];
      const meta = { projectName };
      await generatePDF(report.report_type, report.title, tasks, meta);
    } catch {
      setFeedback({ type: 'error', message: 'Download failed — could not retrieve report data.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate Report Form */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/40 bg-white/30">
          <FileText className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Generate Report</h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Report Type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-2">Report Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
                  <div className="font-semibold">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 ${reportType === t.value ? 'text-white/80' : 'text-slate-400'}`}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-2">Export Format</label>
            <div className="flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value as any)}
                  className={`flex items-center gap-1.5 text-xs py-2 px-4 rounded-xl transition-all duration-200 ${
                    format === f.value
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-md'
                      : 'bg-white/50 border border-gray-200 text-slate-600 hover:bg-white/80'
                  }`}
                >
                  <span>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
            {format === 'google_doc' && (
              <p className="text-xs text-slate-400 mt-1.5">Requires Google OAuth connection. Will fall back to Word (.docx) if not configured.</p>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Sprint Label <span className="text-slate-300">(optional)</span></label>
              <input
                value={sprintLabel}
                onChange={e => setSprintLabel(e.target.value)}
                placeholder="e.g. Sprint 3"
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Date From</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Date To</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
            </div>
          </div>

          {feedback && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2.5 ${
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
            {generating ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><FileDown className="h-4 w-4" /> Generate &amp; Download {REPORT_TYPES.find(r => r.value === reportType)?.label}</>
            )}
          </button>
        </div>
      </div>

      {/* Report History */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/40 bg-white/30">
          <Clock className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Report History</h2>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No reports generated yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map(report => (
              <div key={report.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/80 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{report.title}</p>
                  <p className="text-xs text-slate-400">
                    {REPORT_TYPES.find(r => r.value === report.report_type)?.label}
                    {' • '}
                    <span className="uppercase">{report.format.replace('_', ' ')}</span>
                    {' • by '}{report.generated_by_name}
                    {' • '}{new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {report.google_doc_url && (
                    <a href={report.google_doc_url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-xs text-[#1a73e8] hover:underline">
                      <ExternalLink className="h-3 w-3" /> Open Doc
                    </a>
                  )}
                  <button
                    onClick={() => handleDownload(report)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 transition-colors"
                    title="Download as PDF"
                  >
                    <Download className="h-3 w-3" />
                    .pdf
                  </button>
                </div>
              </div>
            ))}
            {reports.length === 10 && (
              <p className="px-5 py-2.5 text-center text-xs text-slate-400">
                Showing the 10 most recent reports
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
