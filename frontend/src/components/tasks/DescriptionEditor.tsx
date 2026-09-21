"use client"

import { useRef, useState } from 'react'
import { FileText, Loader2, X } from 'lucide-react'

interface DescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

// Accept the text-bearing formats we can extract in the browser (Rev 5).
const ACCEPT =
  '.txt,.md,.csv,.docx,.pdf,text/plain,text/markdown,text/csv,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf'

// Matches the installed pdfjs-dist version so the worker script lines up.
const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

/**
 * A large, resizable description field with a "Fill from file" control that reads
 * a .txt/.md/.csv/.docx/.pdf and drops its text into the field — no upload/storage,
 * fully editable before saving. Backing column is TEXT (unlimited capacity).
 */
export default function DescriptionEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  className,
}: DescriptionEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const extractText = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase()

    if (name.endsWith('.docx')) {
      const mammoth: any = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value || ''
    }

    if (name.endsWith('.pdf')) {
      const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((it: any) => it.str ?? '').join(' ') + '\n\n'
      }
      return text.trim()
    }

    // .txt / .md / .csv and other plain-text files
    return await file.text()
  }

  const handleFile = async (file?: File | null) => {
    if (!file) return
    setError(null)
    setLoading(true)
    setFileName(file.name)
    try {
      const text = await extractText(file)
      if (!text.trim()) {
        setError('No readable text was found in that file.')
      } else {
        // Append to any existing text rather than clobbering it.
        onChange(value && value.trim() ? `${value.trimEnd()}\n\n${text}` : text)
      }
    } catch (e) {
      console.error('File extraction failed:', e)
      setError('Could not read that file. Supported: .txt, .md, .csv, .docx, .pdf.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {value.length.toLocaleString()} characters
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 transition-colors"
          title="Read a .txt, .md, .csv, .docx or .pdf into the description"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {loading ? 'Reading…' : 'Fill from file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={
          className ||
          'w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400 dark:bg-slate-800/70 dark:text-white resize-y max-h-[400px]'
        }
      />
      {fileName && !error && !loading && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Loaded from <span className="font-medium">{fileName}</span> — edit as needed before saving.
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  )
}
