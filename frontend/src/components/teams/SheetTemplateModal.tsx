"use client"

import { useState } from "react"
import { X, Copy, Check, FileSpreadsheet, Table, Download } from "lucide-react"

interface SheetTemplateModalProps {
    onClose: () => void
}

const TEMPLATE_HEADERS = [
    "TEAM CODE",
    "MEMBER #",
    "STUDENT ID",
    "LASTNAME",
    "FIRSTNAME",
    "EMAIL",
    "PROPOSED PROJECT",
    "ADVISER"
]

const SAMPLE_ROWS = [
    ["2526-sem1-it332-01", "1", "2021-00001", "Dela Cruz", "Juan", "jdelacruz@university.edu", "Campus Project Tracker", "Dr. Santos"],
    ["2526-sem1-it332-01", "2", "2021-00002", "Reyes", "Maria", "mreyes@university.edu", "Campus Project Tracker", "Dr. Santos"],
    ["2526-sem1-it332-01", "3", "2021-00003", "Garcia", "Pedro", "pgarcia@university.edu", "Campus Project Tracker", "Dr. Santos"],
    ["2526-sem1-it332-02", "1", "2021-00004", "Santos", "Ana", "asantos@university.edu", "Smart Campus App", "Prof. Rivera"],
    ["2526-sem1-it332-02", "2", "2021-00005", "Lopez", "Carlos", "clopez@university.edu", "Smart Campus App", "Prof. Rivera"],
]

export default function SheetTemplateModal({ onClose }: SheetTemplateModalProps) {
    const [copied, setCopied] = useState(false)

    const handleCopyHeaders = () => {
        const headerString = TEMPLATE_HEADERS.join("\t")
        navigator.clipboard.writeText(headerString)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDownloadCSV = () => {
        const rows = [TEMPLATE_HEADERS, ...SAMPLE_ROWS]
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "team_import_template.csv"
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="w-full max-w-[900px] max-h-[85vh] bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 rounded-[20px] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 px-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-br from-blue-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:to-cyan-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-green-500 flex items-center justify-center shrink-0">
                            <FileSpreadsheet size={20} className="text-white" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                Google Sheets Template
                            </div>
                            <div className="text-[13px] text-slate-500 dark:text-slate-400">
                                Use this format when importing teams from a Google Sheet
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Instructions */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-500/15 dark:border-blue-500/20 rounded-xl p-4 mb-5">
                        <div className="text-sm font-semibold text-blue-800 dark:text-blue-400 mb-2">
                            📋 How to use this template
                        </div>
                        <ol className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed m-0 pl-5 list-decimal space-y-1">
                            <li>Create a new Google Sheet or copy the headers below into your existing sheet</li>
                            <li>Fill in the team data — each row is one team member</li>
                            <li>Members with the same <strong>TEAM CODE</strong> are grouped into the same team</li>
                            <li>Connect the sheet via <strong>Workspace Sync</strong>, then click <strong>"Import Teams"</strong></li>
                        </ol>
                    </div>

                    {/* Template Table */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-5">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <Table size={14} className="text-slate-500 dark:text-slate-400" />
                                <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Template Preview</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr>
                                        {TEMPLATE_HEADERS.map((h, i) => (
                                            <th key={i} className={`px-3 py-2.5 bg-green-600 dark:bg-green-700 text-white font-bold text-[11px] uppercase tracking-wider whitespace-nowrap text-left ${
                                                i < TEMPLATE_HEADERS.length - 1 ? 'border-r border-white/20 dark:border-white/10' : ''
                                            }`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {SAMPLE_ROWS.map((row, ri) => (
                                        <tr key={ri} className={`${ri % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'} border-b border-slate-100 dark:border-slate-700/50`}>
                                            {row.map((cell, ci) => (
                                                <td key={ci} className={`px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap ${
                                                    ci < row.length - 1 ? 'border-r border-slate-100 dark:border-slate-700/50' : ''
                                                }`}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Column Descriptions */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5">
                        <div className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                            Column Guide
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                            {[
                                { name: 'TEAM CODE', desc: 'Unique code per team (e.g. 2526-sem1-it332-01)', required: true },
                                { name: 'MEMBER #', desc: 'Position number within the team (1, 2, 3...)', required: true },
                                { name: 'STUDENT ID', desc: 'Student identification number', required: false },
                                { name: 'LASTNAME', desc: 'Member\'s last name / surname', required: true },
                                { name: 'FIRSTNAME', desc: 'Member\'s first name', required: true },
                                { name: 'EMAIL', desc: 'Member\'s email address', required: false },
                                { name: 'PROPOSED PROJECT', desc: 'Project title (same for all team members)', required: false },
                                { name: 'ADVISER', desc: 'Adviser / teacher name for the team', required: false },
                            ].map(col => (
                                <div key={col.name} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                        {col.name}
                                        {col.required && (
                                            <span className="text-[9px] text-red-600 dark:text-red-400 font-semibold px-1 py-0.5 bg-red-50 dark:bg-red-500/10 rounded">REQUIRED</span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{col.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2.5">
                    <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Download size={14} />
                        Download CSV
                    </button>
                    <button
                        onClick={handleCopyHeaders}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-all shadow-sm ${
                            copied ? 'bg-green-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500 hover:opacity-90 hover:shadow-md'
                        }`}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Headers'}
                    </button>
                </div>
            </div>
        </div>
    )
}
