'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout'
import apiClient from '@/lib/api/client';
import { getTodayLocalDateString } from '@/lib/utils/date'
import {
  X,
  AlertCircle,
  Clock,
  Users,
  BookOpen,
  TrendingUp,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react';

interface PrepData {
  consultation: {
    slotId: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
    adviserName: string;
    adviserEmail: string;
  };
  group: {
    id: string;
    courseId: number | null;
    name: string;
    courseName: string;
    courseCode: string;
    courseSection: string;
    adviser: string;
    proposedProject: string;
  };
  members: Array<{
    memberNumber: number;
    name: string;
    email: string;
    isLeader: boolean;
  }>;
  outstandingFollowUps: Array<{
    id: string;
    consultationId: number;
    concern: string;
    action: string;
    status: 'overdue' | 'open' | 'resolved';
    lastUpdated: string;
    daysSince: number;
  }>;
  recentConsultations: Array<{
    conID: string;
    consultation_date: string;
    summary: string;
    action: string;
    concerns: string;
    follow_up_status: string;
    attendance: string;
    submitted_at: string;
    created_at: string;
    validation_status?: string;
    validated_by?: string | null;
    validated_at?: string | null;
  }>;
  participationSummary: Array<{
    member_id: string;
    member_email: string;
    total_consultations: number;
    total_attended: number;
    attendance_rate: number;
    participation_avg: number;
    last_consultation: string;
  }>;
}

export default function ConsultationPrepPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = String(params?.bookingId || '');

  const [user, setUser] = useState<any>(null)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [followUpSavingId, setFollowUpSavingId] = useState('');
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, 'overdue' | 'open' | 'resolved'>>({});
  const [consultationForm, setConsultationForm] = useState({
    adviserNotes: '',
    conDate: '',
    conMil: '',
    conSum: '',
    conAction: '',
    conConcerns: '',
    memberAttendance: {} as Record<string, 'Present' | 'Absent'>,
    memberParticipation: {} as Record<string, 'High' | 'Moderate' | 'Low'>,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    groupInfo: true,
    members: true,
  });
  const [requestingValId, setRequestingValId] = useState('');
  const [validationError, setValidationError] = useState('');


  // Load user + org context for unified AppLayout sidebar
  useEffect(() => {
    const u = localStorage.getItem('user')
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (u) { try { setUser(JSON.parse(u)) } catch {} }
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
    const fetchPrepData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/consultation/prep/${bookingId}`);
        setData(response.data);
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load consultation prep data');
        console.error('Prep data error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchPrepData();
    }
  }, [bookingId]);


  // Load org context for unified AppLayout sidebar
  useEffect(() => {
    const orgs = localStorage.getItem('organizations')
    const sel = localStorage.getItem('selectedOrganization')
    if (orgs) { try { setOrganizations(JSON.parse(orgs)) } catch {} }
    if (sel) { try { setSelectedOrg(JSON.parse(sel)) } catch {} }
  }, [])
  useEffect(() => {
    if (!data) return;

    const drafts: Record<string, 'overdue' | 'open' | 'resolved'> = {};
    data.outstandingFollowUps?.forEach((item) => {
      drafts[String(item.consultationId)] = item.status;
    });
    setFollowUpDrafts(drafts);
  }, [data]);

  const openConsultationForm = () => {
    if (!data) return;

    const defaultConDate = String(data.consultation.slotDate || '').slice(0, 10);
    const initialAttendance: Record<string, 'Present' | 'Absent'> = {};
    const initialParticipation: Record<string, 'High' | 'Moderate' | 'Low'> = {};

    data.members.forEach((member) => {
      const key = String(member.name || member.email || '').trim();
      if (!key) return;
      initialAttendance[key] = 'Present';
      initialParticipation[key] = 'Moderate';
    });

    setConsultationError('');
    setConsultationForm({
      adviserNotes: '',
      conDate: defaultConDate,
      conMil: '',
      conSum: '',
      conAction: '',
      conConcerns: '',
      memberAttendance: initialAttendance,
      memberParticipation: initialParticipation,
    });
    setShowConsultationForm(true);
  };

  const handleSaveConsultation = async () => {
    if (!data || isSavingConsultation) return;

    setIsSavingConsultation(true);
    setConsultationError('');

    try {
      const payload = {
        booking_id: null,
        slot_id: Number(data.consultation.slotId),
        group_id: data.group.id,
        group_name: data.group.name,
        adviser_notes: consultationForm.adviserNotes,
        conDate: consultationForm.conDate,
        conMil: consultationForm.conMil,
        conSum: consultationForm.adviserNotes,
        conAction: consultationForm.conAction,
        conConcerns: consultationForm.conConcerns,
        attendance_data: consultationForm.memberAttendance,
        participation_data: consultationForm.memberParticipation,
      };

      await apiClient.post('/consultation/feedback', payload);

      setShowConsultationForm(false);
      router.push('/scholar/schedule');
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save consultation feedback.';
      setConsultationError(message);
    } finally {
      setIsSavingConsultation(false);
    }
  };

  const handleUpdateFollowUpStatus = async (followUp: PrepData['outstandingFollowUps'][number]) => {
    const selectedStatus = followUpDrafts[String(followUp.consultationId)] || followUp.status;
    setFollowUpSavingId(String(followUp.consultationId));
    setConsultationError('');

    try {
      await apiClient.put(`/consultation/followups/${followUp.consultationId}/status`, {
        status: selectedStatus,
      });

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          outstandingFollowUps: prev.outstandingFollowUps.map((item) =>
            item.consultationId === followUp.consultationId ? { ...item, status: selectedStatus } : item
          ),
          recentConsultations: prev.recentConsultations.map((item) =>
            Number(item.conID) === followUp.consultationId ? { ...item, follow_up_status: selectedStatus } : item
          ),
        };
      });
    } catch (err: any) {
      setConsultationError(err?.response?.data?.error || 'Failed to update follow-up status.');
    } finally {
      setFollowUpSavingId('');
    }
  };

  const handleRequestValidation = async (conID: string) => {
    setRequestingValId(conID);
    setValidationError('');
    try {
      await apiClient.post(`/consultation/${conID}/request-validation`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentConsultations: prev.recentConsultations.map((item) =>
            item.conID === conID ? { ...item, validation_status: 'pending' } : item
          ),
        };
      });
    } catch (err: any) {
      setValidationError(err?.response?.data?.error || 'Failed to request validation.');
    } finally {
      setRequestingValId('');
    }
  };

  if (loading) {
    return (
      <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading consultation prep...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">{error || 'Failed to load consultation prep data'}</p>
              <button onClick={() => router.back()} className="text-sm text-red-700 hover:text-red-900 mt-2 underline">
                Go back
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (time: string) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return time;
    }
  };

  return (
    <AppLayout user={user} organizations={organizations} selectedOrg={selectedOrg} onOrgChange={setSelectedOrg}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Consultation Prep Checklist
              </h1>
              <p className="text-gray-500 mt-2 text-sm">
                Prepare for your consultation with {data.group.name}
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>

          {/* Consultation Time & Group */}
          <div className="glass-card p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-black mb-2">Consultation Details</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold">{formatDate(data.consultation.slotDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold">{formatTime(data.consultation.startTime)} – {formatTime(data.consultation.endTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold">Adviser: {data.consultation.adviserName}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-black mb-2">Group Info</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Group Name</p>
                    <p className="font-semibold text-gray-800">{data.group.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Course</p>
                    <p className="font-semibold text-gray-800">{data.group.courseCode} – {data.group.courseSection}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Members</p>
                    <p className="font-semibold text-gray-800">{data.members.length} students</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="grid grid-cols-1 gap-8 mb-8">
          <section className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Group Members
                </h2>
                <p className="text-sm text-gray-500 mt-1">Current members in the group.</p>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{data.members.length} members</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.members.map((member, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{member.name}</p>
                      <p className="text-xs text-gray-600">{member.email}</p>
                    </div>
                    {member.isLeader && <span className="text-xs uppercase font-black text-amber-700 bg-amber-100 px-2 py-1 rounded">Leader</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" /> Consultation History
                </h2>
                <p className="text-sm text-gray-500 mt-1">Recent consultation records for this group.</p>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{data.recentConsultations.length} records</span>
            </div>

            {validationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{validationError}</span>
                <button onClick={() => setValidationError('')} className="text-red-500 hover:text-red-700">×</button>
              </div>
            )}

            <div className="space-y-4">
              {data.recentConsultations.length > 0 ? (
                data.recentConsultations.map((consultation, idx) => {
                  const valStatus = consultation.validation_status || 'not_requested';
                  return (
                    <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Consultation {idx + 1}</p>
                          <p className="text-xs text-gray-500">{formatDate(consultation.consultation_date)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Validation status badge */}
                          {valStatus === 'validated' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              <CheckCircle className="w-3 h-3" /> Validated
                            </span>
                          )}
                          {valStatus === 'rejected' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                          {valStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" /> Awaiting Validation
                            </span>
                          )}
                          {valStatus === 'not_requested' && (
                            <button
                              onClick={() => handleRequestValidation(consultation.conID)}
                              disabled={requestingValId === consultation.conID}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              {requestingValId === consultation.conID ? 'Requesting...' : 'Request Validation'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Summary</p>
                          <p className="text-gray-700">{consultation.summary || 'No summary provided.'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Action Items</p>
                          <p className="text-gray-700">{consultation.action || 'No action items provided.'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Concerns</p>
                          <p className="text-gray-700">{consultation.concerns || 'No concerns provided.'}</p>
                        </div>
                      </div>

                      {/* Validator info */}
                      {consultation.validated_by && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                          {valStatus === 'validated' ? 'Validated' : 'Reviewed'} by{' '}
                          <span className="font-medium text-gray-700">{consultation.validated_by}</span>
                          {consultation.validated_at && (
                            <> on {formatDate(consultation.validated_at)}</>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
                  No consultation history yet for this group.
                </div>
              )}
            </div>
          </section>

          {data.participationSummary.length > 0 && (
            <section className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" /> Participation Summary
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Attendance and participation trends per member.</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Overview</span>
              </div>
              <div className="space-y-3">
                {data.participationSummary.map((record, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                    <p className="font-semibold text-gray-800 mb-2">{record.member_email.split('@')[0]}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-600">Attendance</p>
                        <p className="font-bold text-blue-600">{Math.round(record.attendance_rate)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Attended</p>
                        <p className="font-bold text-gray-800">{record.total_attended}/{record.total_consultations}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Participation</p>
                        <p className="font-bold text-gray-800">{Math.round(record.participation_avg * 100)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" /> Follow-up Queue
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Status updates for unresolved consultation follow-ups.</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Editable status</span>
              </div>

              <div className="space-y-3">
                {data.outstandingFollowUps.length > 0 ? data.outstandingFollowUps.map((followUp, idx) => (
                  <div key={followUp.id || idx} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Follow-up {idx + 1}</p>
                        <p className="text-xs text-gray-500">Updated {formatDate(followUp.lastUpdated)}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${followUp.status === 'overdue' ? 'bg-red-100 text-red-700' : followUp.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {followUp.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Concern</p>
                        <p className="text-gray-700">{followUp.concern}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Action</p>
                        <p className="text-gray-700">{followUp.action}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-black mb-1">Days Since Update</p>
                        <p className="text-gray-700">{followUp.daysSince} day(s)</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700">Status</label>
                        <select
                          value={followUpDrafts[String(followUp.consultationId)] || followUp.status}
                          onChange={(e) =>
                            setFollowUpDrafts((prev) => ({
                              ...prev,
                              [String(followUp.consultationId)]: e.target.value as 'overdue' | 'open' | 'resolved',
                            }))
                          }
                          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="overdue">Overdue</option>
                          <option value="open">Open</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>

                      <button
                        onClick={() => handleUpdateFollowUpStatus(followUp)}
                        disabled={followUpSavingId === String(followUp.consultationId)}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {followUpSavingId === String(followUp.consultationId) ? 'Saving...' : 'Save Status'}
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
                    No unresolved follow-ups right now. All tracked concerns appear resolved.
                  </div>
                )}
              </div>
            </section>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex gap-3 justify-end">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              openConsultationForm();
            }}
            className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
          >
            Start Consultation
          </button>
        </div>

        {showConsultationForm && (
          <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm px-3 sm:px-6 pt-20 sm:pt-24 pb-6 overflow-y-auto">
            <div className="min-h-full flex items-start sm:items-center justify-center">
              <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-2 sm:my-4">
                <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-500 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] font-black text-white/80">Consultation Session</p>
                      <h3 className="text-2xl sm:text-3xl font-bold leading-tight mt-1">{data.group.name}</h3>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30">
                          {data.group.courseCode} - {data.group.courseSection}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30">
                          {formatDate(data.consultation.slotDate)}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30">
                          {formatTime(data.consultation.startTime)} - {formatTime(data.consultation.endTime)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowConsultationForm(false)}
                      className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center transition-colors"
                      disabled={isSavingConsultation}
                      aria-label="Close consultation form"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {consultationError && (
                  <div className="mx-6 sm:mx-8 mt-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
                    <span>{consultationError}</span>
                    <button onClick={() => setConsultationError('')} className="text-red-600 hover:text-red-800">x</button>
                  </div>
                )}

                <div className="p-6 sm:p-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-7 space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      <h4 className="text-xs uppercase tracking-[0.14em] font-black text-slate-500 mb-3">Consultation Notes</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Milestone/Topic</label>
                          <textarea
                            value={consultationForm.conMil}
                            onChange={(e) => setConsultationForm({ ...consultationForm, conMil: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-sm"
                            rows={2}
                            placeholder="What milestone or topic was discussed?"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Adviser Notes</label>
                          <textarea
                            value={consultationForm.adviserNotes}
                            onChange={(e) => setConsultationForm({ ...consultationForm, adviserNotes: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-sm"
                            rows={4}
                            placeholder="Summary of discussion and observations..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Action Items</label>
                          <textarea
                            value={consultationForm.conAction}
                            onChange={(e) => setConsultationForm({ ...consultationForm, conAction: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-sm"
                            rows={3}
                            placeholder="Agreed next steps and deliverables..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Concerns</label>
                          <textarea
                            value={consultationForm.conConcerns}
                            onChange={(e) => setConsultationForm({ ...consultationForm, conConcerns: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-sm"
                            rows={3}
                            placeholder="Adviser/admin concerns for follow-up..."
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="xl:col-span-5 space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <h4 className="text-xs uppercase tracking-[0.14em] font-black text-slate-500 mb-3">Session Setup</h4>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Consultation Date</label>
                        <input
                          type="date"
                          value={consultationForm.conDate}
                          onChange={(e) => setConsultationForm({ ...consultationForm, conDate: e.target.value })}
                          max={getTodayLocalDateString()}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-sm"
                        />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs uppercase tracking-[0.14em] font-black text-slate-500">Member Attendance & Participation</h4>
                        <span className="text-xs font-semibold text-slate-500">
                          {Object.keys(consultationForm.memberAttendance).length} member(s)
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {Object.keys(consultationForm.memberAttendance).map((member) => (
                          <div key={member} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-800 mb-2">{member}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <select
                                value={consultationForm.memberAttendance[member]}
                                onChange={(e) =>
                                  setConsultationForm({
                                    ...consultationForm,
                                    memberAttendance: { ...consultationForm.memberAttendance, [member]: e.target.value as any },
                                  })
                                }
                                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                              </select>
                              <select
                                value={consultationForm.memberParticipation[member]}
                                onChange={(e) =>
                                  setConsultationForm({
                                    ...consultationForm,
                                    memberParticipation: { ...consultationForm.memberParticipation, [member]: e.target.value as any },
                                  })
                                }
                                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="High">High</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-white">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                    <button
                      onClick={() => setShowConsultationForm(false)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-sm font-semibold"
                      disabled={isSavingConsultation}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveConsultation}
                      disabled={isSavingConsultation}
                      className="px-5 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                    >
                      {isSavingConsultation ? 'Saving...' : 'Save Consultation'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

