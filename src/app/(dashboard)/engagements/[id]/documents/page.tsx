'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Folder,
  FolderOpen,
  Upload,
  FileText,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Clock,
  Tag,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
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
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, activeCompany } = useCompany();
  const { formatDate } = useLocale();

  const [activeFolder, setActiveFolder] = useState<'current' | 'permanent'>('current');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showAutoFillToast, setShowAutoFillToast] = useState<string | null>(null);

  // Engagement unique email address (DOC-01)
  const engagementEmail = `docs+${engagementId}@blynt-inbox.co.uk`;

  // Seed documents matching DOC-01 through DOC-06
  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: 'doc_001',
      filename: 'Unit_4_Commercial_Lease_Agreement_2025.pdf',
      folder: 'permanent',
      category: 'Lease agreement',
      aiTag: 'Lease agreement (DOC-03)',
      linkedScheduleRef: 'REC-04',
      linkedScheduleName: 'Lease schedule (REC-04)',
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
    },
    {
      id: 'doc_002',
      filename: 'Articles_of_Association_and_Incorporation.pdf',
      folder: 'permanent',
      category: 'Constitutional',
      aiTag: 'Articles of association (DOC-02)',
      linkedScheduleRef: 'REC-12',
      linkedScheduleName: 'Share capital & reserves (REC-12)',
      uploadedBy: 'David Thorne',
      uploadedAt: '2025-10-01T09:00:00Z',
      sizeKb: 1820,
      aiSummary: [
        'Authorised share capital: 50,000 Ordinary Shares of £1.00 nominal par value (Art. 4, p. 3)',
        'Voting rights: 1 vote per ordinary share held on all matters (Art. 6, p. 4)',
        'Dividend rights: Pari passu rights to distributable profits declared (Art. 9, p. 6)',
      ],
    },
    {
      id: 'doc_003',
      filename: 'Barclays_Bank_Statement_Sep2026.pdf',
      folder: 'current',
      category: 'Bank statement',
      aiTag: 'Bank statement (DOC-03)',
      linkedScheduleRef: 'REC-02',
      linkedScheduleName: 'Bank reconciliation (REC-02)',
      uploadedBy: 'Marcus Vance',
      uploadedAt: '2026-10-02T14:20:00Z',
      sizeKb: 890,
      aiSummary: [
        'Account: Barclays Operating Current 20-45-78 98451230 (p. 1)',
        'Statement Period: 1 September 2026 to 30 September 2026 (p. 1)',
        'Closing Balance at 30 Sep 2026: £118,402.17 in funds (p. 3)',
        'Total credits £450,230.12; Total debits £398,410.50 across 142 items (p. 3)',
      ],
    },
    {
      id: 'doc_004',
      filename: 'P32_Employer_Payment_Summary_Month12.pdf',
      folder: 'current',
      category: 'Payroll report',
      aiTag: 'Payroll report (DOC-03)',
      linkedScheduleRef: 'REC-05',
      linkedScheduleName: 'Payroll reconciliation (REC-05)',
      uploadedBy: 'Marcus Vance',
      uploadedAt: '2026-10-03T11:00:00Z',
      sizeKb: 430,
      aiSummary: [
        'HMRC Accounts Office Reference: 120/PX0029412 (p. 1)',
        'Gross Wages Month 12: £12,540.00; Employers NIC: £1,131.00 (p. 1)',
        'PAYE Deductions Month 12: £2,150.40; Employee Pension: £300.00 (p. 1)',
        'Net payment due to HMRC: £3,281.40 by 22 October 2026 (p. 2)',
      ],
    },
    {
      id: 'doc_005',
      filename: 'HMRC_VAT100_Return_Q4_Sep2026.pdf',
      folder: 'current',
      category: 'VAT return',
      aiTag: 'VAT return (DOC-03)',
      linkedScheduleRef: 'REC-06',
      linkedScheduleName: 'VAT reconciliation (REC-06)',
      uploadedBy: 'Marcus Vance',
      uploadedAt: '2026-10-04T09:45:00Z',
      sizeKb: 310,
      aiSummary: [
        'VAT Registration Number: GB 384 9281 04 (Box 1)',
        'Box 1 VAT due on sales: £24,800.00; Box 4 VAT reclaimed: £4,980.00 (p. 1)',
        'Box 5 Net VAT payable to HMRC: £19,820.00 (p. 1)',
        'Return successfully received online by HMRC on 04/10/2026 (p. 2)',
      ],
    },
  ]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(engagementEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
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
      {/* Top Banner with Inbound Email */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Documents &amp; Permanent File (DOC)</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              {documents.length} Files
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Permanent agreements roll forward automatically (DOC-02). AI extracts key clauses and auto-fills schedules.
          </p>
        </div>

        {/* Unique Inbound Email Address (DOC-01) */}
        <div className="flex items-center gap-2 bg-[#F6F7FB] px-3.5 py-2 rounded-xl border border-[#D5DBE7]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#7E8DA6]">Engagement Inbound Email</span>
            <span className="text-xs font-mono font-semibold text-[#102654]">{engagementEmail}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyEmail}
            title="Copy email to clipboard"
            className="p-1.5 text-[#5B6478] hover:text-[#102654] hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

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
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeFolder === 'current'
                    ? 'bg-[#102654] text-white shadow-xs'
                    : 'text-[#5B6478] hover:bg-[#F6F7FB] hover:text-[#102654]'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-[#FF7D6B]" />
                <span>Current Period ({currentFolderCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFolder('permanent')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeFolder === 'permanent'
                    ? 'bg-[#102654] text-white shadow-xs'
                    : 'text-[#5B6478] hover:bg-[#F6F7FB] hover:text-[#102654]'
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
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] outline-none"
              />
            </div>
          </div>

          {/* Upload Drag & Drop Area */}
          <div className="border-2 border-dashed border-[#D5DBE7] hover:border-[#FF7D6B] rounded-[16px] p-6 text-center bg-white transition-colors cursor-pointer group">
            <Upload className="w-7 h-7 mx-auto text-[#7E8DA6] group-hover:text-[#FF7D6B] transition-colors mb-2" />
            <div className="text-xs font-bold text-[#102654]">
              Drag and drop invoices, statements, or contracts here, or click to browse
            </div>
            <p className="text-[11px] text-[#5B6478] mt-1">
              Supports PDF, Word, Excel, CSV up to 50MB. AI automatically classifies document type and extracts terms.
            </p>
          </div>

          {/* Documents Table */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0B1B3D] text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-3">AI Tag / Category</th>
                  <th className="py-3 px-3">Linked Schedule</th>
                  <th className="py-3 px-3">Uploaded</th>
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
                      className={`hover:bg-[#F6F7FB] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EAF5FC]/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-[#1D4E89] shrink-0" />
                          <div>
                            <div className="font-bold text-[#102654] hover:text-[#FF7D6B] truncate max-w-xs">
                              {doc.filename}
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

                      <td className="py-3 px-3 text-[#5B6478] font-mono text-[11px]">
                        {formatDate(doc.uploadedAt, { day: 'numeric', month: 'short' })}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDoc(doc);
                          }}
                          className="text-xs font-semibold text-[#1D4E89] hover:underline"
                        >
                          View Summary
                        </button>
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
            <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between border-b border-[#E3E7EF] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
                  <h3 className="text-sm font-bold text-[#102654]">AI Document Summary (DOC-04)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="text-xs font-bold text-[#102654]">{selectedDoc.filename}</div>
                <div className="text-[11px] text-[#5B6478] mt-0.5">
                  Category: <strong>{selectedDoc.category}</strong> • Linked to{' '}
                  <strong>{selectedDoc.linkedScheduleName || 'Unlinked'}</strong>
                </div>
              </div>

              {/* Summary Bullet Points with Clause References */}
              <div className="bg-[#F6F7FB] p-3.5 rounded-xl border border-[#E3E7EF] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6]">
                  Extracted Clauses &amp; Terms
                </div>
                <ul className="space-y-1.5 text-xs text-[#102654]">
                  {selectedDoc.aiSummary.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#FF7D6B] font-bold leading-tight">•</span>
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
                    onClick={() => {
                      const scheduleRef = selectedDoc.linkedScheduleRef;
                      if (!scheduleRef) return;
                      setShowAutoFillToast(scheduleRef);
                      setTimeout(() => setShowAutoFillToast(null), 3000);
                      router.push(
                        `/engagements/${engagementId}/workpapers/wp_${scheduleRef
                          .toLowerCase()
                          .replace('-', '')}`
                      );
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B]" />
                    <span>Auto-fill {selectedDoc.linkedScheduleRef} from this document</span>
                  </button>
                  <p className="text-[10px] text-center text-[#7E8DA6] mt-1.5">
                    Extracted figures will be placed with AI badges for preparer confirmation (DOC-05).
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 text-center text-[#5B6478]">
              <FileText className="w-8 h-8 text-[#D5DBE7] mx-auto mb-2" />
              <div className="text-xs font-bold text-[#102654]">Select a Document</div>
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
