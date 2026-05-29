'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client'
import {
  ClipboardList,
  Printer,
  Filter,
  X,
  CheckCircle,
  XCircle,
  ChevronRight,
  Search,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'

interface ConsultationRecord {
  con_id: string
  slot_id: string
  group_name: string
  course_code: string
  course_name: string
  consultation_date: string
  milestone: string
  summary: string
  follow_up_status: string
  validation_status: string
  validated_by: string | null
  validated_at: string | null
  submitted_at: string
}

export default function ConsultationHubPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scholarRole, setScholarRole] = useState('')

  // Filters
  const [courseFilter, setCourseFilter] = useState('')
  const [validationFilter, setValidationFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Validation review modal
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [validationNotes, setValidationNotes] = useState('')
  const [processingAction, setProcessingAction] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('user')
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (u) { try { setUser(JSON.parse(u)) } catch {} }
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }

    const profile = localStorage.getItem('scholar_profile')
    if (profile) {
      try {
        const p = JSON.parse(profile)
        setScholarRole(p.scholarsyncRole || p.role || '')
      } catch {}
    }
  }, [])

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await apiClient.get('/consultation/all-records')
      setRecords(response.data.records || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load consultation records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleValidate = async (conID: string, decision: 'validated' | 'rejected') => {
    setProcessingAction(conID + decision)
    setActionError('')
    try {
      await apiClient.post(`/consultation/${conID}/validate`, {
        decision,
        notes: validationNotes,
      })
      setRecords(prev =>
        prev.map(r =>
          r.con_id === conID
            ? {
                ...r,
                validation_status: decision,
                validated_by: user?.email || 'Admin',
                validated_at: new Date().toISOString(),
              }
            : r
        )
      )
      setValidatingId(null)
      setValidationNotes('')
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to process validation')
    } finally {
      setProcessingAction('')
    }
  }

  // Derived values
  const uniqueCourses = [...new Set(records.map(r => r.course_code).filter(Boolean))]

  const filtered = records.filter(r => {
    if (courseFilter && r.course_code !== courseFilter) return false
    if (validationFilter && r.validation_status !== validationFilter) return false
    if (dateFrom && r.consultation_date && r.consultation_date.slice(0, 10) < dateFrom) return false
    if (dateTo && r.consultation_date && r.consultation_date.slice(0, 10) > dateTo) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !r.group_name?.toLowerCase().includes(q) &&
        !r.course_code?.toLowerCase().includes(q) &&
        !r.course_name?.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const ValidationBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )
      case 'validated':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
            <CheckCircle className="w-3 h-3" /> Validated
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        )
      default:
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
            Not Requested
          </span>
        )
    }
  }

  const FollowUpBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'resolved':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Resolved</span>
      case 'overdue':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Open</span>
    }
  }

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              Consultation Hub
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              All submitted consultation records across groups and courses
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden flex items-center gap-2 px-4 py-2.5 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Audit Log
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="print:hidden bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Filters</span>
            {(courseFilter || validationFilter || dateFrom || dateTo || searchQuery) && (
              <button
                onClick={() => {
                  setCourseFilter('')
                  setValidationFilter('')
                  setDateFrom('')
                  setDateTo('')
                  setSearchQuery('')
                }}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search group or course..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">All Courses</option>
              {uniqueCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={validationFilter}
              onChange={e => setValidationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">All Validation Status</option>
              <option value="not_requested">Not Requested</option>
              <option value="pending">Pending</option>
              <option value="validated">Validated</option>
              <option value="rejected">Rejected</option>
            </select>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5 pl-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5 pl-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* ── Records Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-500">Loading records...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No consultation records found</p>
            <p className="text-gray-400 text-sm mt-1">
              {records.length > 0 ? 'Try adjusting your filters' : 'No consultations have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg overflow-hidden">
            {/* Print header (hidden on screen) */}
            <div className="hidden print:block px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Consultation Audit Log</h2>
              <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Milestone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow-up</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Validation</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((record) => (
                    <tr key={record.con_id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{record.group_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="font-medium">{record.course_code || '—'}</span>
                        {record.course_name && (
                          <span className="block text-xs text-gray-400">{record.course_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(record.consultation_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                        <span className="truncate block" title={record.milestone || ''}>
                          {record.milestone || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <FollowUpBadge status={record.follow_up_status} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <ValidationBadge status={record.validation_status} />
                          {record.validated_by && (
                            <p className="text-[10px] text-gray-400 mt-0.5">by {record.validated_by}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right print:hidden">
                        <div className="flex items-center justify-end gap-2">
                          {/* Admin/External Leader can review pending records */}
                          {scholarRole === 'Admin' && record.validation_status === 'pending' && (
                            <button
                              onClick={() => {
                                setValidatingId(record.con_id)
                                setValidationNotes('')
                                setActionError('')
                              }}
                              className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:shadow-md transition-all"
                            >
                              Review
                            </button>
                          )}
                          {/* Navigate to consultation prep page */}
                          {record.slot_id && (
                            <button
                              onClick={() =>
                                router.push(`/scholar/adviser/consultation-prep/${record.slot_id}`)
                              }
                              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                            >
                              View <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer count */}
            <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {filtered.length} of {records.length} records</span>
              {records.filter(r => r.validation_status === 'pending').length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                  <Clock className="w-3 h-3" />
                  {records.filter(r => r.validation_status === 'pending').length} awaiting review
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Validation Review Modal ── */}
      {validatingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Review Consultation Record</h3>
              <button
                onClick={() => {
                  setValidatingId(null)
                  setValidationNotes('')
                  setActionError('')
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Review this consultation record and add optional notes before approving or rejecting.
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {actionError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Validation Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={validationNotes}
                onChange={e => setValidationNotes(e.target.value)}
                placeholder="Add any feedback or comments for the adviser..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleValidate(validatingId, 'rejected')}
                disabled={!!processingAction}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100 disabled:opacity-50 transition-all"
              >
                <XCircle className="w-4 h-4" />
                {processingAction === validatingId + 'rejected' ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={() => handleValidate(validatingId, 'validated')}
                disabled={!!processingAction}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-sm hover:shadow-md disabled:opacity-50 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                {processingAction === validatingId + 'validated' ? 'Processing...' : 'Validate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
