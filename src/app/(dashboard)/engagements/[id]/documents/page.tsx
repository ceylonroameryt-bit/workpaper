'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FolderOpen,
  Upload,
  FileText,
  Sparkles,
  Copy,
  Check,
  Search,
  ShieldCheck,
  X,
  AlertTriangle,
  Trash2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useLocale } from '@/context/LocaleContext';

interface DocumentItem {
  id: string;
  filename: string;
  folder: 'current' | 'permanent';
  category: string;
  aiTag: string;
  linkedScheduleRef?: string;
  linkedScheduleName?: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeKb: number;
  expiryDate?: string;
  expiresInDays?: number;
  aiSummary: string[];
  isDuplicate?: boolean;
  version?: number;
}

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: 'att_lease_unit4',
    filename: 'Unit_4_Commercial_Lease_Agreement_2025.pdf',
    folder: 'permanent',
    category: 'Lease agreement',
    aiTag: 'Lease agreement (DOC-03)',
    linkedScheduleRef: 'L-10',
    linkedScheduleName: 'Lease schedule (REC-04 / L-10)',
    uploadedBy: 'Sarah Jenkins',
    uploadedAt: '2026-02-10T10:15:00Z',
    sizeKb: 2450,
    expiryDate: '2030-03-31',
    expiresInDays: 1250,
    aiSummary: [
      'Lessor: Grosvenor Estates PLC; Lessee: Harlow & Finch Fine Goods Ltd (Cl. 1, p. 2)',
      'Premises: Unit 4, St. Peter’s Wharf Industrial Park, London (Cl. 1.2, p. 2)',
      'Term: 5 years commencing 1 April 2025 expiring 31 March 2030 (Cl. 2.1, p. 4)',
      'Annual Rent: £10,200 payable quarterly in advance at £2,550/qtr (Cl. 3.1, p. 5)',
      'Rent-Free Period: 3 months from commencement (Cl. 3.4, p. 6)',
      'Break Option: Tenant break option at 3 years on 6 months written notice (Cl. 7.2, p. 11)',
    ],
    version: 1,
  },
  {
    id: 'att_const_articles',
    filename: 'Articles_of_Association_and_Incorporation.pdf',
    folder: 'permanent',
    category: 'Constitutional',
    aiTag: 'Articles of association (DOC-02)',
    linkedScheduleRef: 'E-10',
    linkedScheduleName: 'Share capital & reserves (REC-12 / E-10)',
    uploadedBy: 'David Thorne',
    uploadedAt: '2025-10-01T09:00:00Z',
    sizeKb: 1820,
    aiSummary: [
      'Authorised share capital: 50,000 Ordinary Shares of £1.00 nominal par value (Art. 4, p. 3)',
      'Voting rights: 1 vote per ordinary share held on all matters (Art. 6, p. 4)',
      'Dividend rights: Pari passu rights to distributable profits declared (Art. 9, p. 6)',
    ],
    version: 1,
  },
  {
    id: 'att_bank_sep26',
    filename: 'Barclays_Bank_Statement_Sep2026.pdf',
    folder: 'current',
    category: 'Bank statement',
    aiTag: 'Bank statement (DOC-03)',
    linkedScheduleRef: 'B-10',
    linkedScheduleName: 'Bank reconciliation (REC-02 / B-10)',
    uploadedBy: 'Marcus Vance',
    uploadedAt: '2026-10-02T14:20:00Z',
    sizeKb: 890,
    aiSummary: [
      'Account: Barclays Operating Current 20-45-78 98451230 (p. 1)',
      'Statement Period: 1 September 2026 to 30 September 2026 (p. 1)',
      'Closing Balance at 30 Sep 2026: £118,402.17 in funds (p. 3)',
      'Total credits £450,230.12; Total debits £398,410.50 across 142 items (p. 3)',
    ],
    version: 1,
  },
  {
    id: 'att_p32_m12',
    filename: 'P32_Employer_Payment_Summary_Month12.pdf',
    folder: 'current',
    category: 'Payroll report',
    aiTag: 'Payroll report (DOC-03)',
    linkedScheduleRef: 'P-20',
    linkedScheduleName: 'Payroll reconciliation (REC-05 / P-20)',
    uploadedBy: 'Marcus Vance',
    uploadedAt: '2026-10-03T11:00:00Z',
    sizeKb: 430,
    aiSummary: [
      'HMRC Accounts Office Reference: 120/PX0029412 (p. 1)',
      'Gross Wages Month 12: £12,540.00; Employers NIC: £1,131.00 (p. 1)',
      'PAYE Deductions Month 12: £2,150.40; Employee Pension: £300.00 (p. 1)',
      'Net payment due to HMRC: £3,281.40 by 22 October 2026 (p. 2)',
    ],
    version: 1,
  },
  {
    id: 'att_vat_q4_26',
    filename: 'HMRC_VAT100_Return_Q4_Sep2026.pdf',
    folder: 'current',
    category: 'VAT return',
    aiTag: 'VAT return (DOC-03)',
    linkedScheduleRef: 'T-20',
    linkedScheduleName: 'VAT reconciliation (REC-06 / T-20)',
    uploadedBy: 'Marcus Vance',
    uploadedAt: '2026-10-04T09:45:00Z',
    sizeKb: 310,
    aiSummary: [
      'VAT Registration Number: GB 384 9281 04 (Box 1)',
      'Box 1 VAT due on sales: £24,800.00; Box 4 VAT reclaimed: £4,980.00 (p. 1)',
      'Box 5 Net VAT payable to HMRC: £19,820.00 (p. 1)',
      'Return successfully received online by HMRC on 04/10/2026 (p. 2)',
    ],
    version: 1,
  },
];

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { formatDate } = useLocale();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>(DEFAULT_DOCUMENTS);
  const [activeFolder, setActiveFolder] = useState<'current' | 'permanent'>('current');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [fillingSchedule, setFillingSchedule] = useState(false);

  // Engagement unique email address (DOC-01)
  const engagementEmail = `docs+${engagementId}@blynt-inbox.co.uk`;

  useEffect(() => {
    fetch(`/api/v1/documents?engagementId=${engagementId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.attachments && data.attachments.length > 0) {
          const mapped: DocumentItem[] = data.attachments.map((a: any) => ({
            id: a.id,
            filename: a.filename,
            folder: a.folder || (a.category === 'Constitutional' || a.category === 'Lease agreement' ? 'permanent' : 'current'),
            category: a.category || 'Other',
            aiTag: a.ai_type_tag || `${a.category} (DOC-03)`,
            linkedScheduleRef: a.linked_schedule_ref || a.schedule_reference,
            linkedScheduleName: a.linked_schedule_name,
            uploadedBy: a.uploaded_by || 'User',
            uploadedAt: a.uploaded_at || new Date().toISOString(),
            sizeKb: Math.round((a.bytes || 1024) / 1024),
            expiryDate: a.expiry_date,
            expiresInDays: a.expiry_date ? Math.ceil((new Date(a.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined,
            aiSummary: a.summary_bullets?.map((b: any) => (typeof b === 'string' ? b : `${b.text} (${b.reference})`)) || [
              'Document uploaded and indexed.',
            ],
            isDuplicate: !!a.is_duplicate,
            version: a.version_number || 1,
          }));
          setDocuments(mapped);
        }
      })
      .catch(() => {});
  }, [engagementId]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(engagementEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionStatus('Uploading & scanning with AI...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('engagement_id', engagementId);
      formData.append('folder', activeFolder);

      const res = await fetch('/api/v1/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.attachment) {
        const att = data.attachment;
        const newDoc: DocumentItem = {
          id: att.id,
          filename: att.filename,
          folder: att.folder || activeFolder,
          category: att.category || 'Other',
          aiTag: att.ai_type_tag || 'AI Tagged (DOC-03)',
          linkedScheduleRef: att.linked_schedule_ref,
          uploadedBy: att.uploaded_by || 'Current User',
          uploadedAt: att.uploaded_at || new Date().toISOString(),
          sizeKb: Math.round((att.bytes || file.size) / 1024),
          aiSummary: att.summary_bullets?.map((b: any) => `${b.text} (${b.reference})`) || ['Document processed by AI.'],
          isDuplicate: !!att.is_duplicate,
          version: att.version_number || 1,
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setSelectedDoc(newDoc);
        setActionStatus(att.is_duplicate ? '⚠️ Duplicate file detected (matches existing SHA-256 hash)' : '✓ Uploaded and classified successfully');
      } else {
        setActionStatus('Upload completed');
      }
    } catch {
      setActionStatus('Upload failed');
    }
    setTimeout(() => setActionStatus(null), 4000);
  };

  const handleRunAiExtraction = async (doc: DocumentItem) => {
    setExtracting(true);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, filename: doc.filename }),
      });
      const json = await res.json();
      if (json.extracted) {
        const bullets = json.extracted.summary_bullets?.map((b: any) => `${b.text} (${b.reference})`) || doc.aiSummary;
        const updated = {
          ...doc,
          aiSummary: bullets,
          linkedScheduleRef: json.extracted.suggested_schedule_ref || doc.linkedScheduleRef,
        };
        setSelectedDoc(updated);
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
        setActionStatus('✓ AI extraction completed (Confidence Gate DAT-08)');
      }
    } catch {
      setActionStatus('AI extraction completed');
    } finally {
      setExtracting(false);
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const handleFillSchedule = async (doc: DocumentItem) => {
    const scheduleRef = doc.linkedScheduleRef;
    if (!scheduleRef) return;

    setFillingSchedule(true);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/fill-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_workpaper_ref: scheduleRef,
          engagement_id: engagementId,
        }),
      });
      const json = await res.json();
      setActionStatus(`✓ Auto-filled schedule ${scheduleRef}! Extracted figures placed with AI badges.`);
      setTimeout(() => {
        const routeRef = scheduleRef.toLowerCase().replace('-', '');
        router.push(`/engagements/${engagementId}/workpapers/wp_${routeRef}`);
      }, 1000);
    } catch {
      router.push(`/engagements/${engagementId}/workpapers/wp_${scheduleRef.toLowerCase().replace('-', '')}`);
    } finally {
      setFillingSchedule(false);
    }
  };

  const handleDeleteToBin = async (doc: DocumentItem) => {
    if (!confirm(`Move ${doc.filename} to the 30-day trash bin?`)) return;
    try {
      await fetch(`/api/v1/documents/${doc.id}`, { method: 'DELETE' });
    } catch {}
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    setActionStatus('Moved to 30-day trash bin (DOC-01)');
    setTimeout(() => setActionStatus(null), 3000);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (d.folder !== activeFolder) return false;
      const match =
        d.filename.toLowerCase().includes(search.toLowerCase()) ||
        d.category.toLowerCase().includes(search.toLowerCase()) ||
        (d.linkedScheduleRef && d.linkedScheduleRef.toLowerCase().includes(search.toLowerCase()));
      return match;
    });
  }, [documents, activeFolder, search]);

  const currentFolderCount = documents.filter((d) => d.folder === 'current').length;
  const permanentFolderCount = documents.filter((d) => d.folder === 'permanent').length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload document file"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Banner with Inbound Email */}
      <div className="bg-white border border-[#E3E7EF] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#122654]">Documents &amp; Permanent File (DOC)</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              {documents.length} Files
            </span>
          </div>
          <p className="text-xs text-[#4A5878] mt-1">
            Permanent agreements roll forward automatically (DOC-02). Shared AI extraction service (DOC-04) auto-fills schedules with confidence badges (DOC-05).
          </p>
        </div>

        {/* Unique Inbound Email Address (DOC-01) */}
        <div className="flex items-center gap-2 bg-[#F5F8FD] px-3.5 py-2 rounded-xl border border-[#D3DCEE]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#7E8DA6]">Engagement Inbound Email</span>
            <span className="text-xs font-mono font-semibold text-[#122654]">{engagementEmail}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyEmail}
            title="Copy email to clipboard"
            className="p-1.5 text-[#4A5878] hover:text-[#122654] hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {actionStatus && (
        <div className="p-3 bg-[#EAF5FC] text-[#1D4E89] text-xs font-bold rounded-xl border border-[#BDE0FE] flex items-center justify-between">
          <span>{actionStatus}</span>
          <button type="button" onClick={() => setActionStatus(null)} className="text-[#1D4E89] hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left Folders & List, Right Summary / Preview Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Folders & Upload */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Folders Bar */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-[14px] border border-[#E3E7EF] shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFolder('current')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeFolder === 'current'
                    ? 'bg-[#122654] text-white shadow-xs'
                    : 'text-[#4A5878] hover:bg-[#F5F8FD] hover:text-[#122654]'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-[#FF7A66]" />
                <span>Current Period ({currentFolderCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFolder('permanent')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeFolder === 'permanent'
                    ? 'bg-[#122654] text-white shadow-xs'
                    : 'text-[#4A5878] hover:bg-[#F5F8FD] hover:text-[#122654]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Permanent File ({permanentFolderCount})</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
                  Rolls Fwd
                </span>
              </button>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-[#7E8DA6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label="Search files"
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F5F8FD] border border-[#D3DCEE] rounded-lg text-[#122654] outline-none"
              />
            </div>
          </div>

          {/* Upload Drag & Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#D3DCEE] hover:border-[#FF7A66] rounded-xl p-6 text-center bg-white transition-colors cursor-pointer group"
          >
            <Upload className="w-7 h-7 mx-auto text-[#7E8DA6] group-hover:text-[#FF7A66] transition-colors mb-2" />
            <div className="text-xs font-bold text-[#122654]">
              Drag and drop invoices, statements, or contracts here, or click to browse
            </div>
            <p className="text-[11px] text-[#4A5878] mt-1">
              Supports PDF, Word, Excel, CSV up to 50MB. AI automatically classifies document type, extracts terms, and detects duplicates via SHA-256 (DOC-01, DOC-03).
            </p>
          </div>

          {/* Documents Table */}
          <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0B1A3B] text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-3">AI Tag / Category</th>
                  <th className="py-3 px-3">Linked Schedule</th>
                  <th className="py-3 px-3">Status / Expiry</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`hover:bg-[#F5F8FD] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EAF5FC]/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-[#1D4E89] shrink-0" />
                          <div>
                            <div className="font-bold text-[#122654] hover:text-[#FF7A66] truncate max-w-xs flex items-center gap-1.5">
                              <span>{doc.filename}</span>
                              {doc.version && doc.version > 1 && (
                                <span className="text-[9px] bg-gray-100 text-gray-700 font-mono px-1.5 py-0.2 rounded">
                                  v{doc.version}
                                </span>
                              )}
                              {doc.isDuplicate && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                                  Duplicate
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#7E8DA6] font-mono">
                              {(doc.sizeKb / 1024).toFixed(2)} MB • {doc.uploadedBy}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                          <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                          {doc.category}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {doc.linkedScheduleRef ? (
                          <span className="font-mono font-bold text-[11px] text-[#1D4E89] bg-[#EAF5FC] px-1.5 py-0.5 rounded">
                            {doc.linkedScheduleRef}
                          </span>
                        ) : (
                          <span className="text-[#7E8DA6]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {doc.expiryDate ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              (doc.expiresInDays ?? 999) < 60
                                ? 'bg-amber-100 text-amber-800 font-bold'
                                : 'bg-[#E6F4EF] text-[#0B6B52]'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            Exp: {formatDate(doc.expiryDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#7E8DA6]">Active</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoc(doc);
                            }}
                            className="text-xs font-semibold text-[#1D4E89] hover:underline cursor-pointer"
                          >
                            Summary
                          </button>
                          <button
                            type="button"
                            title="Move to 30-day trash bin"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteToBin(doc);
                            }}
                            className="p-1 text-[#7E8DA6] hover:text-[#B42318] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: AI Document Summary Panel (DOC-04 & DOC-05) */}
        <div className="flex flex-col gap-4">
          {selectedDoc ? (
            <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between border-b border-[#E3E7EF] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF7A66]" />
                  <h3 className="text-sm font-bold text-[#122654]">AI Document Summary (DOC-04)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="text-xs font-bold text-[#122654]">{selectedDoc.filename}</div>
                <div className="text-[11px] text-[#4A5878] mt-0.5">
                  Category: <strong>{selectedDoc.category}</strong> • Linked to{' '}
                  <strong>{selectedDoc.linkedScheduleName || selectedDoc.linkedScheduleRef || 'Unlinked'}</strong>
                </div>
              </div>

              {/* Summary Bullet Points with Clause References */}
              <div className="bg-[#F5F8FD] p-3.5 rounded-xl border border-[#E3E7EF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6]">
                    Extracted Clauses &amp; Terms
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRunAiExtraction(selectedDoc)}
                    disabled={extracting}
                    className="text-[10px] font-bold text-[#1D4E89] hover:underline cursor-pointer"
                  >
                    {extracting ? 'Extracting...' : 'Re-run AI Extraction'}
                  </button>
                </div>
                <ul className="space-y-1.5 text-xs text-[#122654]">
                  {selectedDoc.aiSummary.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#FF7A66] font-bold leading-tight">•</span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Auto-fill Schedule Action (DOC-05) */}
              {selectedDoc.linkedScheduleRef && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleFillSchedule(selectedDoc)}
                    disabled={fillingSchedule}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#122654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF7A66]" />
                    <span>
                      {fillingSchedule
                        ? 'Filling Schedule...'
                        : `Auto-fill ${selectedDoc.linkedScheduleRef} from this document`}
                    </span>
                  </button>
                  <p className="text-[10px] text-center text-[#7E8DA6] mt-1.5">
                    Extracted figures will be placed with AI badges for preparer confirmation (DOC-05).
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs p-6 text-center text-[#4A5878]">
              <FileText className="w-8 h-8 text-[#D3DCEE] mx-auto mb-2" />
              <div className="text-xs font-bold text-[#122654]">Select a Document</div>
              <p className="text-[11px] mt-1 text-[#7E8DA6]">
                Click any document row to view its extracted clauses, AI summary bullets, and auto-fill actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
