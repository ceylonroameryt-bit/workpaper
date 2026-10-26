'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Search,
  ExternalLink,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function StandardsLibraryPage() {
  const [selectedStandard, setSelectedStandard] = useState<'frs102_1a' | 'frs105' | 'frs102_full'>('frs102_1a');
  const [search, setSearch] = useState('');

  const standards = [
    {
      id: 'frs102_1a',
      name: 'FRS 102 Section 1A (Small Entities)',
      version: '2024 Amendments (Effective 1 Jan 2026)',
      status: 'Current & Active',
      requiredSchedules: ['REC-02 Bank', 'REC-03 Fixed Assets', 'REC-04 Leases (Right-of-use)', 'REC-05 Payroll', 'REC-06 VAT', 'REC-07 Debtors', 'REC-08 Creditors', 'REC-09 Prepayments & Accruals', 'REC-11 Director Loan', 'REC-12 Share Capital', 'REC-13 Corporation Tax & Deferred Tax'],
      sections: [
        {
          code: '1A.3',
          title: 'Basis of Preparation and True & Fair View',
          requirements: 'Statement that accounts comply with FRS 102 Section 1A and the Companies Act 2006.',
        },
        {
          code: '1A.17',
          title: 'Tangible Fixed Assets & Depreciation',
          requirements: 'Measurement at cost or revalued amount; disclosure of depreciation rates and class movements.',
        },
        {
          code: '1A.20 (2024)',
          title: 'Leases - Right-of-Use Model',
          requirements: 'Recognition of lease liability and right-of-use asset on balance sheet; short-term exemptions.',
        },
        {
          code: '1A.33',
          title: 'Directors’ Advances and Related Parties',
          requirements: 'Full disclosure of advances, interest rates, security, and amounts repaid post period-end.',
        },
      ],
    },
    {
      id: 'frs105',
      name: 'FRS 105 (Micro-Entities)',
      version: '2024 Edition',
      status: 'Current',
      requiredSchedules: ['REC-02 Bank', 'REC-03 Fixed Assets', 'REC-05 Payroll', 'REC-06 VAT', 'REC-07 Debtors', 'REC-08 Creditors', 'REC-12 Share Capital', 'REC-13 Corporation Tax (Deferred Tax Hidden)'],
      sections: [
        {
          code: 'FRS 105.3',
          title: 'Presumed True & Fair View',
          requirements: 'Compliance with micro-entity format is legally presumed to give a true and fair view without additional disclosures.',
        },
        {
          code: 'FRS 105.12',
          title: 'No Deferred Tax',
          requirements: 'Deferred tax is prohibited under FRS 105; only current corporation tax liability is recognized.',
        },
      ],
    },
    {
      id: 'frs102_full',
      name: 'FRS 102 (The Financial Reporting Standard)',
      version: 'Full Standard Edition',
      status: 'Available',
      requiredSchedules: ['All 17 REC Schedules', 'Cash Flow Statement (MGT-04)', 'Full Strategic & Directors Report'],
      sections: [
        {
          code: 'Section 7',
          title: 'Statement of Cash Flows',
          requirements: 'Mandatory indirect cash flow statement presenting operating, investing, and financing cash flows.',
        },
        {
          code: 'Section 29',
          title: 'Income Tax and Deferred Tax',
          requirements: 'Comprehensive deferred tax accounting on all timing differences and unused tax losses.',
        },
      ],
    },
  ];

  const current = standards.find((s) => s.id === selectedStandard) || standards[0];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Accounting Standards Library (STD-01)</h1>
            <span className="text-xs bg-[#102654] text-white px-2.5 py-1 rounded-full font-mono font-semibold">
              UK GAAP
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Maintained UK accounting standards governing schedule generation, lease models, and statutory disclosures.
          </p>
        </div>
      </div>

      {/* 2024 Amendments Notification Banner (STD-01) */}
      <div className="bg-[#FFF1EE] border border-[#FF7D6B]/40 p-4 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#FF7D6B] shrink-0 mt-0.5" />
        <div className="text-xs text-[#A23A27] leading-relaxed">
          <strong>FRS 102 Updated (2024 Amendments):</strong> Leases starting on or after 1 January 2026 now transition to the on-balance-sheet Right-of-Use model in schedule REC-04. Micro-entities under FRS 105 continue under commitment disclosure rules.
        </div>
      </div>

      {/* Standards Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {standards.map((std) => (
          <div
            key={std.id}
            onClick={() => setSelectedStandard(std.id as any)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStandard === std.id
                ? 'bg-white border-[#102654] shadow-md ring-1 ring-[#102654]'
                : 'bg-white border-[#E3E7EF] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#102654]">{std.name}</span>
              {selectedStandard === std.id && <CheckCircle2 className="w-4 h-4 text-[#0B6B52]" />}
            </div>
            <div className="text-[11px] text-[#7E8DA6] mt-1 font-mono">{std.version}</div>
            <div className="mt-3 text-[10px] bg-[#F6F7FB] p-2 rounded text-[#5B6478]">
              {std.requiredSchedules.length} Required Schedules
            </div>
          </div>
        ))}
      </div>

      {/* Selected Standard Requirements Detail */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
        <div className="border-b border-[#E3E7EF] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#102654]">{current.name}</h2>
            <p className="text-xs text-[#5B6478]">{current.version}</p>
          </div>
          <span className="text-xs font-bold text-[#0B6B52] bg-[#E6F4EF] px-2.5 py-1 rounded-full">
            {current.status}
          </span>
        </div>

        {/* Requirements List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#102654] uppercase tracking-wider">
            Mandatory Sections &amp; Disclosure Rules
          </div>
          <div className="divide-y divide-[#E3E7EF] border border-[#E3E7EF] rounded-xl overflow-hidden">
            {current.sections.map((sec, idx) => (
              <div key={idx} className="p-4 hover:bg-[#F6F7FB] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded">
                    {sec.code}
                  </span>
                  <span className="text-xs font-bold text-[#102654]">{sec.title}</span>
                </div>
                <p className="text-xs text-[#5B6478] mt-1.5 leading-relaxed">{sec.requirements}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
