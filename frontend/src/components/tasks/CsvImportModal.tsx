"use client"

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle2, ChevronDown, Download } from 'lucide-react'
import { API_URL } from '@/lib/api/client'

interface ParsedTask {
    wbs_code: string
    title: string
    assignee_raw: string
    start_date: string
    due_date: string
    status: string
    is_section_header: boolean
    priority: 'low' | 'medium' | 'high'
    complexity_weight: number
}

interface CsvImportModalProps {
    isOpen: boolean
    onClose: () => void
    projectId: string
    organizationId: string
    onImportComplete: () => void
}

const STATUS_MAP: Record<string, string> = {
    'done': 'done',
    'completed': 'done',
    'in progress': 'in_progress',
    'in-progress': 'in_progress',
    'review': 'review',
    'on-hold': 'todo',
    'on hold': 'todo',
    'todo': 'todo',
    'to do': 'todo',
    '': 'todo',
}

function parseWbsCode(title: string): { wbs: string; cleanTitle: string } {
    // Match patterns like "1.", "1.1", "1.1.1", "1.1.1.1" at start of string
    const match = title.match(/^(\d+(?:\.\d+)*\.?)\s+(.+)$/)
    if (match) {
        return {
            wbs: match[1].replace(/\.$/, ''), // remove trailing dot
            cleanTitle: match[2].trim()
        }
    }
    return { wbs: '', cleanTitle: title.trim() }
}

function isSectionHeader(row: string[]): boolean {
    // A section header has a task name but no assignee and no dates
    const assignee = (row[1] || '').trim()
    const dateStarted = (row[2] || '').trim()
    const dateFinished = (row[3] || '').trim()
    return !assignee && !dateStarted && !dateFinished
}

function parseStatus(raw: string): string {
    const key = (raw || '').toLowerCase().trim()
    return STATUS_MAP[key] || 'todo'
}

function guessPriority(wbs: string): 'low' | 'medium' | 'high' {
    const depth = wbs.split('.').length
    if (depth <= 1) return 'high'
    if (depth === 2) return 'medium'
    return 'low'
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = []
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
        if (!line.trim()) continue
        // Simple CSV parse (handles quoted commas)
        const row: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') {
                inQuotes = !inQuotes
            } else if (ch === ',' && !inQuotes) {
                row.push(current.trim())
                current = ''
            } else {
                current += ch
            }
        }
        row.push(current.trim())
        rows.push(row)
    }
    return rows
}

export default function CsvImportModal({
    isOpen, onClose, projectId, organizationId, onImportComplete
}: CsvImportModalProps) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
    const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
    const [importErrors, setImportErrors] = useState<string[]>([])
    const [importCount, setImportCount] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [fileName, setFileName] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFile = (file: File) => {
        if (!file.name.endsWith('.csv')) {
            alert('Please upload a .csv file')
            return
        }
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result as string
            const rows = parseCSV(text)

            // Try to detect if first row is a header
            const firstRow = rows[0] || []
            const hasHeader = firstRow[0]?.toLowerCase().includes('task') ||
                firstRow[1]?.toLowerCase().includes('assignee')
            const dataRows = hasHeader ? rows.slice(1) : rows

            const tasks: ParsedTask[] = []
            for (const row of dataRows) {
                const rawTitle = (row[0] || '').trim()
                if (!rawTitle) continue

                const { wbs, cleanTitle } = parseWbsCode(rawTitle)
                const isHeader = isSectionHeader(row)

                tasks.push({
                    wbs_code: wbs,
                    title: cleanTitle || rawTitle,
                    assignee_raw: (row[1] || '').trim(),
                    start_date: (row[2] || '').trim(),
                    due_date: (row[3] || '').trim(),
                    status: parseStatus(row[4] || ''),
                    is_section_header: isHeader,
                    priority: guessPriority(wbs),
                    complexity_weight: wbs.split('.').length,
                })
            }

            setParsedTasks(tasks)
            setStep('preview')
        }
        reader.readAsText(file)
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }

    const handleImport = async () => {
        setStep('importing')
        const token = localStorage.getItem('token')
        const tasksToImport = parsedTasks.filter(t => !t.is_section_header && t.title)

        try {
            const response = await fetch(`${API_URL}/api/organizations/${organizationId}/tasks/bulk-import`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_id: projectId,
                    tasks: tasksToImport.map(t => ({
                        title: t.title,
                        wbs_code: t.wbs_code || undefined,
                        assignee_raw: t.assignee_raw,
                        start_date: t.start_date || null,
                        due_date: t.due_date || null,
                        status: t.status,
                        priority: t.priority,
                        complexity_weight: t.complexity_weight,
                    }))
                })
            })

            const data = await response.json()
            if (response.ok) {
                setImportCount(data.created || tasksToImport.length)
                setImportErrors(data.errors || [])
                setStep('done')
            } else {
                setImportErrors([data.error || 'Import failed'])
                setStep('done')
            }
        } catch (err) {
            setImportErrors(['Network error during import'])
            setStep('done')
        }
    }

    const handleClose = () => {
        setStep('upload')
        setParsedTasks([])
        setImportErrors([])
        setImportCount(0)
        setFileName('')
        onClose()
        if (step === 'done') onImportComplete()
    }

    const downloadTemplate = () => {
        const csv = `Tasks,Assignee,Date Started,Date Finished,Status
1. PROJECT TITLE,,,,
1.1 PHASE 1,,,,
1.1.1 First Task example,Assignee Name,mm/dd/yyyy,mm/dd/yyyy,todo`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'kanban-import-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    if (!isOpen) return null

    const taskCount = parsedTasks.filter(t => !t.is_section_header && t.title).length
    const headerCount = parsedTasks.filter(t => t.is_section_header).length

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Import CSV to Kanban</h2>
                            <p className="text-sm text-gray-500">Upload a WBS-structured spreadsheet</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Step Indicator */}
                <div className="flex border-b border-gray-100">
                    {['Upload', 'Preview', 'Done'].map((s, i) => {
                        const stepIdx = step === 'upload' ? 0 : step === 'preview' ? 1 : step === 'importing' ? 2 : 2
                        return (
                            <div key={s} className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${i <= stepIdx ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400'}`}>
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-2 ${i < stepIdx ? 'bg-blue-500 text-white' : i === stepIdx ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {i < stepIdx ? '✓' : i + 1}
                                </span>
                                {s}
                            </div>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* STEP 1: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'}`}
                            >
                                <Upload className={`w-10 h-10 mx-auto mb-4 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                                <p className="text-lg font-semibold text-gray-700 mb-1">Drop your CSV here</p>
                                <p className="text-sm text-gray-400">or click to browse</p>
                                <p className="text-xs text-gray-400 mt-2">.csv files only</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-sm font-semibold text-blue-700 mb-2">📋 Expected Columns</p>
                                <div className="grid grid-cols-5 gap-1 text-xs">
                                    {['Tasks (WBS)', 'Assignee', 'Date Started', 'Date Finished', 'Status'].map(col => (
                                        <div key={col} className="bg-white border border-blue-200 rounded px-2 py-1 text-blue-600 font-medium text-center">{col}</div>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-500 mt-2">Rows without dates/assignees are treated as section headers (skipped as tasks)</p>
                            </div>

                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download template CSV
                            </button>
                        </div>
                    )}

                    {/* STEP 2: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                                        <span className="text-sm font-bold text-blue-700">{taskCount} tasks</span>
                                    </div>
                                    {headerCount > 0 && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                                            <span className="text-sm text-gray-500">{headerCount} section headers (skipped)</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 truncate max-w-40">{fileName}</p>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">WBS</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Task</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Assignee</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Due Date</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {parsedTasks.map((task, i) => (
                                            <tr key={i} className={task.is_section_header ? 'bg-gray-50 opacity-50' : 'bg-white'}>
                                                <td className="px-3 py-2">
                                                    {task.wbs_code && (
                                                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{task.wbs_code}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        {task.is_section_header
                                                            ? <span className="text-gray-400 italic text-xs">Section: {task.title}</span>
                                                            : <span className="font-medium text-gray-800" style={{ paddingLeft: `${(task.wbs_code.split('.').length - 1) * 12}px` }}>{task.title}</span>
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600 text-xs">{task.assignee_raw || '—'}</td>
                                                <td className="px-3 py-2 text-gray-600 text-xs">{task.due_date || '—'}</td>
                                                <td className="px-3 py-2">
                                                    {!task.is_section_header && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                            task.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                            task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            {task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Importing */}
                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-lg font-semibold text-gray-700">Importing {taskCount} tasks...</p>
                            <p className="text-sm text-gray-400">Building WBS hierarchy and assigning tasks</p>
                        </div>
                    )}

                    {/* STEP 4: Done */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            {importErrors.length === 0 ? (
                                <>
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <p className="text-xl font-bold text-gray-800">Import Complete!</p>
                                    <p className="text-gray-500">{importCount} tasks added to your Kanban board</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-8 h-8 text-amber-500" />
                                    </div>
                                    <p className="text-xl font-bold text-gray-800">Imported with issues</p>
                                    <p className="text-gray-500">{importCount} tasks imported</p>
                                    <div className="w-full max-w-md space-y-2">
                                        {importErrors.map((err, i) => (
                                            <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{err}</div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-white transition-colors text-gray-600"
                    >
                        {step === 'done' ? 'Close' : 'Cancel'}
                    </button>
                    <div className="flex gap-3">
                        {step === 'preview' && (
                            <>
                                <button
                                    onClick={() => { setStep('upload'); setParsedTasks([]) }}
                                    className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-white transition-colors text-gray-600"
                                >
                                    Re-upload
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={taskCount === 0}
                                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
                                >
                                    Import {taskCount} Tasks →
                                </button>
                            </>
                        )}
                        {step === 'done' && (
                            <button
                                onClick={() => { setStep('upload'); setParsedTasks([]); setImportErrors([]); setFileName('') }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                            >
                                Import Another
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
