'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  Eye,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronRight,
  Printer,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';

export default function DisclosuresPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, activeCompany } = useCompany();

  const [activeTab, setActiveTab] = useState<'checklist' | 'notes' | 'accounts' | 'post_balance'>('checklist');
  const [accountsMode, setAccountsMode] = useState<'full' | 'companies_house'>('full');
  const [consistencyChecked, setConsistencyChecked] = useState(false);

  // Disclosure checklist items (STD-03)
  const [checklist, setChecklist] = useState([
    {
      id: 'chk_1',
      section: 'Accounting Policies',
      question: 'Has the basis of preparation under FRS 102 Section 1A been explicitly stated?',
      reference: 'FRS 102 1A.3(a)',
      answer: 'Yes',
      aiSuggested: 'Yes',
      evidence: 'Stated in Note 1 from accounting framework settings',
      confirmed: true,
    },
    {
      id: 'chk_2',
      section: 'Accounting Policies',
      question: 'Are depreciation methods, useful lives and residual values disclosed for each asset class?',
      reference: 'FRS 102 17.31(b)',
      answer: 'Yes',
      aiSuggested: 'Yes',
      evidence: 'Straight-line 20% plant, 33% computer equip in REC-03',
      confirmed: true,
    },
    {
      id: 'chk_3',
      section: 'Employees & Directors',
      question: 'Is the average number of employees during the financial year disclosed?',
      reference: 'Companies Act 2006 s411',
      answer: 'Yes',
      aiSuggested: 'Yes',
      evidence: 'Extracted from payroll reports: 12 employees (REC-05)',
      confirmed: true,
    },
    {
      id: 'chk_4',
      section: 'Directors Transactions',
      question: 'Are advances, credits, and interest rates for directors’ loan accounts disclosed?',
      reference: 'Companies Act 2006 s413',
      answer: 'Yes',
      aiSuggested: 'Yes',
      evidence: 'Director loan movements & s455 balance in REC-11',
      confirmed: true,
    },
    {
      id: 'chk_5',
      section: 'Commitments & Contingencies',
      question: 'Are total commitments under non-cancellable operating leases disclosed by maturity?',
      reference: 'FRS 102 1A Note Requirements',
      answer: 'Yes',
      aiSuggested: 'Yes',
      evidence: 'Unit 4 commercial lease commitments schedule in REC-04',
      confirmed: true,
    },
    {
      id: 'chk_6',
      section: 'Post Balance Sheet Events',
      question: 'Have non-adjusting events after the reporting period been described with financial effect?',
      reference: 'FRS 102 Section 32',
      answer: 'N/A',
      aiSuggested: 'N/A',
      evidence: 'Bank transactions scan found no significant post-year-end capital transactions (AIX-07)',
      confirmed: true,
    },
  ]);

  // Notes to the Accounts (STD-04)
  const notes = [
    {
      id: 'note_1',
      title: '1. Accounting Policies',
      reference: 'FRS 102 Section 1A',
      narrative:
        'The financial statements have been prepared in accordance with Financial Reporting Standard 102 Section 1A (Small Entities) and the Companies Act 2006. The accounts have been prepared on the historical cost basis.',
    },
    {
      id: 'note_2',
      title: '2. Employees',
      reference: 'Companies Act 2006 s411',
      narrative:
        'The average monthly number of persons (including executive directors) employed by the company during the financial year was 12 (FY25: 11). Staff costs totalled £384,200.00.',
    },
    {
      id: 'note_3',
      title: '3. Tangible Fixed Assets',
      reference: 'REC-03 Schedule Link',
      narrative:
        'Cost as at 30 September 2026: £4,511,700.00; Accumulated depreciation: £1,805,300.00; Net Book Value: £2,700,000.00 (FY25: £2,450,000.00). Depreciation is calculated on straight-line basis.',
    },
    {
      id: 'note_4',
      title: '4. Debtors: Amounts Falling Due Within One Year',
      reference: 'REC-07 Schedule Link',
      narrative:
        'Trade debtors: £2,489,500.00 less bad debt allowance £125,000.00; Other debtors & prepayments: £32,400.00. Total debtors: £2,396,900.00.',
    },
    {
      id: 'note_5',
      title: '5. Directors’ Advances, Credits and Guarantees',
      reference: 'REC-11 Schedule Link',
      narrative:
        'During the year, director advances of £24,249.96 were drawn down without formal commercial security. The balance is repayable on demand with HMRC official interest charged.',
    },
  ];

  // Post Balance Sheet Events Scan (AIX-07)
  const postBalanceEvents = [
    {
      date: '2026-10-18',
      description: 'HMRC Corporation Tax payment for prior FY25 cleared bank account',
      amount: '£22,505.33',
      source: 'Barclays Bank Feed',
      suggestedClass: 'Non-adjusting (Settlement of recognized liability)',
      status: 'Reviewed',
    },
    {
      date: '2026-10-22',
      description: 'Receipt of insurance claim settlement from Allianz UK',
      amount: '£15,000.00',
      source: 'Bank Feed & Email Correspondence',
      suggestedClass: 'Possibly Adjusting (Condition existed at year-end)',
      status: 'Review required',
    },
  ];

  const standardName = activeEngagement?.framework || 'FRS 102 Section 1A (Small Entities)';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Disclosures, Notes &amp; Statutory Accounts (STD)</h1>
            <span className="text-xs bg-[#102654] text-white px-2.5 py-1 rounded-full font-mono font-semibold">
              {standardName}
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Standard-tailored disclosure checklist (STD-03), AI-drafted notes (STD-04), and statutory accounts preview (STD-05).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setConsistencyChecked(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFF1EE] hover:bg-[#ffe3dd] border border-[#FF7D6B] text-[#A23A27] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
            <span>{consistencyChecked ? '✓ Consistency Passed (AIX-09)' : 'Run Consistency Check (AIX-09)'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'checklist'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#1D4E89]" />
          <span>Disclosure Checklist (STD-03)</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-bold">
            100%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'notes'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <FileText className="w-4 h-4 text-[#1D4E89]" />
          <span>Notes to Accounts (STD-04)</span>
          <span className="text-[10px] bg-gray-200 text-gray-800 px-1.5 py-0.2 rounded font-mono">
            {notes.length} Notes
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'accounts'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Eye className="w-4 h-4 text-[#1D4E89]" />
          <span>Statutory Accounts Preview (STD-05)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('post_balance')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'post_balance'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Post Balance Sheet Scan (AIX-07)</span>
        </button>
      </div>

      {/* TAB 1: Disclosure Checklist (STD-03) */}
      {activeTab === 'checklist' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F6F7FB] border-b border-[#E3E7EF] flex items-center justify-between">
            <span className="text-xs font-bold text-[#102654]">
              Mandatory Disclosures under {standardName}
            </span>
            <span className="text-[11px] text-[#0B6B52] font-semibold bg-[#E6F4EF] px-2.5 py-0.5 rounded-full">
              All 6 requirements answered &amp; evidenced
            </span>
          </div>

          <div className="divide-y divide-[#E3E7EF]">
            {checklist.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold text-[#1D4E89] bg-[#EAF5FC] px-1.5 py-0.5 rounded">
                      {item.reference}
                    </span>
                    <span className="text-xs font-bold text-[#102654]">{item.question}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
                      Answer: {item.answer}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1D4E89] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#5B6478] bg-[#F6F7FB] p-2 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B] shrink-0" />
                  <span>
                    <strong>AI Evidence:</strong> {item.evidence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Notes to Accounts (STD-04) */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#102654]">{note.title}</span>
                  <span className="text-[10px] font-mono text-[#7E8DA6] bg-gray-100 px-1.5 py-0.5 rounded">
                    {note.reference}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                  Live linked to schedules
                </span>
              </div>
              <p className="text-xs text-[#102654] leading-relaxed">{note.narrative}</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: Statutory Accounts Production Preview (STD-05) */}
      {activeTab === 'accounts' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E7EF] pb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#102654]">Output Format:</span>
              <button
                type="button"
                onClick={() => setAccountsMode('full')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  accountsMode === 'full'
                    ? 'bg-[#102654] text-white shadow-2xs'
                    : 'bg-gray-100 text-[#5B6478]'
                }`}
              >
                Full Accounts (Shareholders)
              </button>
              <button
                type="button"
                onClick={() => setAccountsMode('companies_house')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  accountsMode === 'companies_house'
                    ? 'bg-[#102654] text-white shadow-2xs'
                    : 'bg-gray-100 text-[#5B6478]'
                }`}
              >
                Companies House Filing Version
              </button>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Branded PDF (STD-05)</span>
            </button>
          </div>

          {/* Cast Check Banner */}
          <div className="bg-[#E6F4EF] border border-[#0B6B52]/30 p-3 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#0B6B52] font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Balance Sheet Cast Check: Net Assets £6,509,350 equals Total Equity £6,509,350</span>
            </div>
            <span className="font-mono text-[#0B6B52] font-bold">Agrees to Penny</span>
          </div>

          {/* Formatted Accounts Document View */}
          <div className="border border-gray-200 rounded-xl p-8 bg-gray-50/50 max-w-3xl mx-auto shadow-inner space-y-6 text-[#102654]">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold tracking-tight">
                {activeCompany?.name || 'Harlow & Finch Fine Goods Ltd'}
              </h2>
              <p className="text-xs text-[#5B6478]">
                Company Registration No. {activeCompany?.company_no || '09876543'} (England &amp; Wales)
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-[#102654] pt-2">
                Balance Sheet as at 30 September 2026
              </p>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300 font-bold">
                  <th className="py-2 text-left">Fixed Assets</th>
                  <th className="py-2 text-center w-16">Note</th>
                  <th className="py-2 text-right w-28">2026 (£)</th>
                  <th className="py-2 text-right w-28">2025 (£)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                <tr>
                  <td className="py-2 text-left font-sans">Tangible Assets</td>
                  <td className="py-2 text-center">3</td>
                  <td className="py-2 text-right font-bold">2,700,000</td>
                  <td className="py-2 text-right text-gray-600">2,450,000</td>
                </tr>
                <tr className="font-bold border-t border-gray-300">
                  <td colSpan={2} className="py-2 text-left font-sans">Current Assets</td>
                  <td className="py-2 text-right"></td>
                  <td className="py-2 text-right"></td>
                </tr>
                <tr>
                  <td className="py-1.5 text-left font-sans pl-4">Stocks</td>
                  <td className="py-1.5 text-center"></td>
                  <td className="py-1.5 text-right">1,824,000</td>
                  <td className="py-1.5 text-right text-gray-600">1,650,000</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-left font-sans pl-4">Debtors</td>
                  <td className="py-1.5 text-center">4</td>
                  <td className="py-1.5 text-right">2,364,500</td>
                  <td className="py-1.5 text-right text-gray-600">1,950,000</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-left font-sans pl-4">Cash at bank and in hand</td>
                  <td className="py-1.5 text-center"></td>
                  <td className="py-1.5 text-right">1,305,350</td>
                  <td className="py-1.5 text-right text-gray-600">940,000</td>
                </tr>
                <tr className="font-bold border-t border-b border-gray-300">
                  <td colSpan={2} className="py-2 text-left font-sans">Total Current Assets</td>
                  <td className="py-2 text-right">5,493,850</td>
                  <td className="py-2 text-right text-gray-600">4,540,000</td>
                </tr>
                <tr>
                  <td className="py-2 text-left font-sans">Creditors: amounts falling due within one year</td>
                  <td className="py-2 text-center"></td>
                  <td className="py-2 text-right text-red-600">(1,684,500)</td>
                  <td className="py-2 text-right text-gray-600">(1,420,000)</td>
                </tr>
                <tr className="font-bold border-t-2 border-b-2 border-gray-900 bg-white">
                  <td colSpan={2} className="py-2.5 text-left font-sans text-sm">Total Assets Less Current Liabilities (Net Assets)</td>
                  <td className="py-2.5 text-right text-sm">6,509,350</td>
                  <td className="py-2.5 text-right text-sm text-gray-600">5,570,000</td>
                </tr>
              </tbody>
            </table>

            <div className="pt-4 border-t border-gray-300 text-[11px] text-[#5B6478] leading-relaxed">
              For the financial year ended 30 September 2026 the company was entitled to exemption from audit under section 477 of the Companies Act 2006 relating to small companies. The members have not required the company to obtain an audit of its financial statements.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Post Balance Sheet Events (AIX-07) */}
      {activeTab === 'post_balance' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#102654]">Post Balance Sheet Events Scan (AIX-07)</h3>
            <p className="text-xs text-[#5B6478]">
              Automated scan of bank receipts, payments, and board resolutions occurring between period end and approval date.
            </p>
          </div>

          <div className="space-y-3">
            {postBalanceEvents.map((evt, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-[#E3E7EF] bg-[#F6F7FB]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1D4E89]">{evt.date}</span>
                    <span className="text-xs font-bold text-[#102654]">{evt.description}</span>
                    <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                      {evt.amount}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6478] mt-1">
                    <strong>Suggested Classification:</strong> {evt.suggestedClass}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    Adjust (Open JNL)
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    Disclose in Note
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
