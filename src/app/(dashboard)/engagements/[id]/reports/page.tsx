'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileDown,
  Download,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Calendar,
  Sparkles,
  CheckCircle2,
  Sliders,
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { formatPence } from '@/lib/money';

export default function ReportsPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, activeCompany } = useCompany();
  const { formatDate } = useLocale();

  const [activeTab, setActiveTab] = useState<'library' | 'mgt_pack' | 'cash_flow' | 'forecast_12m' | 'quarterly' | 'bundle'>('library');
  const [plainEnglish, setPlainEnglish] = useState(false);
  const [cashFlowView, setCashFlowView] = useState<'client' | 'statutory'>('client');

  // Forecast Assumptions (MGT-05)
  const [debtorDays, setDebtorDays] = useState(45);
  const [creditorDays, setCreditorDays] = useState(45);
  const [minimumCash, setMinimumCash] = useState('250,000');
  const [capexSpend, setCapexSpend] = useState('50,000');

  // Report Library Catalog (RPT-01)
  const reportLibrary = [
    {
      id: 'rep_tb',
      title: 'Full Adjusted & Unadjusted Trial Balance',
      category: 'Core Ledger',
      description: 'Side-by-side unadjusted TB, journals/adjustments, final closing balances, and prior year comparatives.',
      format: 'PDF / Excel',
    },
    {
      id: 'rep_leads',
      title: 'Lead Schedules Summary (A to Z)',
      category: 'Audit & Workpapers',
      description: 'All balance sheet and profit & loss lead schedules tied to supporting control account papers.',
      format: 'PDF / Excel',
    },
    {
      id: 'rep_jnl',
      title: 'Complete Journal Register & Adjustments Audit',
      category: 'Adjustments',
      description: 'Every manual and AI proposed journal with approvals, nominal lines, and effect on profit.',
      format: 'PDF / Excel',
    },
    {
      id: 'rep_rev',
      title: 'Review Points & Sign-Off Completion Record',
      category: 'Review & Governance',
      description: 'Comprehensive record of all cleared review notes, comments, preparer/manager sign-offs, and timestamps.',
      format: 'PDF',
    },
    {
      id: 'rep_mgt',
      title: 'Periodic Management Accounts Pack',
      category: 'Management',
      description: 'KPI summary, monthly P&L, balance sheet, cash bridge, and aged debtor analysis.',
      format: 'PDF / Excel',
    },
    {
      id: 'rep_qtr',
      title: 'Quarterly Insight Schedule (2-Page Client Briefing)',
      category: 'Insights',
      description: 'Executive briefing with headline KPIs, 12-month charts, plain-English AI commentary, and tax deadlines.',
      format: 'PDF',
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Financial Reports &amp; Exports (RPT / MGT / QTR)</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              Period: FY26 Final
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Pull any report for any period (RPT-01), generate client management packs (MGT-01), or export complete indexed audit bundles (RPT-02).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('bundle')}
          className="flex items-center gap-2 px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <FileDown className="w-4 h-4 text-[#FF7D6B]" />
          <span>Full File Export Bundle (RPT-02)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'library'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-[#1D4E89]" />
          <span>Report Library (RPT-01)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mgt_pack')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'mgt_pack'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-[#1D4E89]" />
          <span>Management Pack (MGT-01)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cash_flow')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'cash_flow'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#0B6B52]" />
          <span>Cash Flow Statement (MGT-04)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('forecast_12m')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'forecast_12m'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Calendar className="w-4 h-4 text-purple-700" />
          <span>12-Month Forecast (MGT-05)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quarterly')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'quarterly'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
          <span>Quarterly Insight Pack (QTR-01)</span>
        </button>
      </div>

      {/* TAB 1: Report Library (RPT-01) */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportLibrary.map((rep) => (
            <div
              key={rep.id}
              className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col justify-between hover:border-[#102654]/30 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6] bg-gray-100 px-2 py-0.5 rounded">
                    {rep.category}
                  </span>
                  <span className="text-[10px] font-mono text-[#1D4E89]">{rep.format}</span>
                </div>
                <h3 className="text-sm font-bold text-[#102654] mt-2.5">{rep.title}</h3>
                <p className="text-xs text-[#5B6478] mt-1 leading-relaxed">{rep.description}</p>
              </div>

              <div className="pt-4 border-t border-[#E3E7EF] flex items-center justify-between mt-4">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#1D4E89] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0B6B52] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Management Accounts Pack (MGT-01) */}
      {activeTab === 'mgt_pack' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Client Management Accounts Pack (MGT-01)</h2>
              <p className="text-xs text-[#5B6478]">
                Professional management pack with KPI graphs, P&amp;L variance, and aged debtors summary.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#102654] cursor-pointer bg-[#F6F7FB] px-3 py-1.5 rounded-lg border border-[#D5DBE7]">
                <input
                  type="checkbox"
                  checked={plainEnglish}
                  onChange={(e) => setPlainEnglish(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Plain-English labels (e.g. &apos;Money owed to you&apos;)</span>
              </label>

              <button
                type="button"
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Pack (PDF)</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200">
              <span className="text-[10px] font-bold uppercase text-[#1D4E89]">Total Turnover</span>
              <div className="text-xl font-bold font-mono text-[#102654] mt-1">£6,200,000</div>
              <span className="text-[10px] text-emerald-700 font-semibold">+14.8% vs last year</span>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-[#0B6B52]">Gross Profit</span>
              <div className="text-xl font-bold font-mono text-[#0B6B52] mt-1">£2,400,000</div>
              <span className="text-[10px] text-[#5B6478]">Margin: 38.7%</span>
            </div>
            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200">
              <span className="text-[10px] font-bold uppercase text-purple-800">Net Profit Before Tax</span>
              <div className="text-xl font-bold font-mono text-purple-900 mt-1">£939,350</div>
              <span className="text-[10px] text-emerald-700 font-semibold">+12.4% vs FY25</span>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold uppercase text-amber-800">Bank Cash Balance</span>
              <div className="text-xl font-bold font-mono text-amber-900 mt-1">£1,305,350</div>
              <span className="text-[10px] text-emerald-700 font-semibold">+£365k generated</span>
            </div>
          </div>

          {/* Section preview table */}
          <div className="border border-[#E3E7EF] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#F6F7FB] text-[#7E8DA6] text-[10px] font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-4">{plainEnglish ? 'What you earned & spent' : 'Account Category'}</th>
                  <th className="py-2.5 px-4 text-right">This Year (FY26)</th>
                  <th className="py-2.5 px-4 text-right">Last Year (FY25)</th>
                  <th className="py-2.5 px-4 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF] font-mono">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-bold text-[#102654]">
                    {plainEnglish ? 'Total Sales Invoiced' : 'Revenue / Turnover'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-[#102654]">£6,200,000.00</td>
                  <td className="py-2.5 px-4 text-right text-[#5B6478]">£5,400,000.00</td>
                  <td className="py-2.5 px-4 text-right text-emerald-700 font-bold">+14.8%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans text-[#102654]">
                    {plainEnglish ? 'Cost of Goods Bought & Made' : 'Cost of Sales'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#102654]">£3,800,000.00</td>
                  <td className="py-2.5 px-4 text-right text-[#5B6478]">£3,200,000.00</td>
                  <td className="py-2.5 px-4 text-right text-red-600">+18.8%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans text-[#102654]">
                    {plainEnglish ? 'Staff Costs & Wages' : 'Employee Salaries & Remuneration'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#102654]">£1,388,400.00</td>
                  <td className="py-2.5 px-4 text-right text-[#5B6478]">£1,195,000.00</td>
                  <td className="py-2.5 px-4 text-right text-red-600">+16.2%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans text-[#102654]">
                    {plainEnglish ? 'Office, Rent & Business Overheads' : 'Administrative Overheads'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#102654]">£344,250.00</td>
                  <td className="py-2.5 px-4 text-right text-[#5B6478]">£298,000.00</td>
                  <td className="py-2.5 px-4 text-right text-red-600">+15.5%</td>
                </tr>
                <tr className="bg-[#F6F7FB] font-bold">
                  <td className="py-2.5 px-4 font-sans text-[#0B6B52]">
                    {plainEnglish ? 'Net Profit Retained' : 'Profit on Ordinary Activities Before Tax'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[#0B6B52]">£939,350.00</td>
                  <td className="py-2.5 px-4 text-right text-[#5B6478]">£835,000.00</td>
                  <td className="py-2.5 px-4 text-right text-emerald-700">+12.5%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Cash Flow Statement (MGT-04) */}
      {activeTab === 'cash_flow' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Cash Flow Statement - Indirect Method (MGT-04)</h2>
              <p className="text-xs text-[#5B6478]">
                Reconciles operating profit to closing bank balances using balance sheet movements (DAT-03).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCashFlowView('client')}
                className={`px-3 py-1 text-xs font-bold rounded-lg ${
                  cashFlowView === 'client' ? 'bg-[#102654] text-white' : 'bg-gray-100 text-[#5B6478]'
                }`}
              >
                Client View (Bridge)
              </button>
              <button
                type="button"
                onClick={() => setCashFlowView('statutory')}
                className={`px-3 py-1 text-xs font-bold rounded-lg ${
                  cashFlowView === 'statutory' ? 'bg-[#102654] text-white' : 'bg-gray-100 text-[#5B6478]'
                }`}
              >
                Statutory View (FRS 102)
              </button>
            </div>
          </div>

          <div className="border border-[#E3E7EF] rounded-xl p-5 bg-[#F6F7FB]/50 space-y-3 font-mono text-xs max-w-2xl mx-auto">
            <div className="flex justify-between font-bold text-sm text-[#102654] pb-2 border-b border-gray-300">
              <span className="font-sans">Operating Profit Before Tax</span>
              <span>£939,350.00</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span className="font-sans">Add: Depreciation of tangible assets (non-cash)</span>
              <span>+£27,000.00</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span className="font-sans">Working capital change: (Increase) in stock</span>
              <span>(£174,000.00)</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span className="font-sans">Working capital change: (Increase) in debtors</span>
              <span>(£414,500.00)</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span className="font-sans">Working capital change: Increase in trade creditors</span>
              <span>+£264,500.00</span>
            </div>

            <div className="flex justify-between font-bold text-[#0B6B52] pt-2 border-t border-gray-300">
              <span className="font-sans">Cash Generated from Operations</span>
              <span>£642,350.00</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span className="font-sans">Capital expenditure: Fixed asset additions</span>
              <span>(£277,000.00)</span>
            </div>

            <div className="flex justify-between font-bold text-sm text-[#102654] pt-2 border-t-2 border-gray-900 bg-white p-2 rounded">
              <span className="font-sans">Net Increase in Cash &amp; Equivalents</span>
              <span className="text-[#0B6B52]">+£365,350.00</span>
            </div>

            <div className="flex justify-between text-[#5B6478] pt-1 text-[11px]">
              <span className="font-sans">Cash at beginning of financial year</span>
              <span>£940,000.00</span>
            </div>

            <div className="flex justify-between font-bold text-[#102654] text-xs">
              <span className="font-sans">Cash at end of financial year (Agrees to REC-02)</span>
              <span>£1,305,350.00</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 12-Month Forecast (MGT-05) */}
      {activeTab === 'forecast_12m' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="border-b border-[#E3E7EF] pb-4">
            <h2 className="text-base font-bold text-[#102654]">12-Month Cash Flow Forecast (MGT-05)</h2>
            <p className="text-xs text-[#5B6478]">
              Dynamic cash model driven by debtor/creditor day assumptions and scheduled tax payment dates.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Assumptions Panel */}
            <div className="bg-[#F6F7FB] p-4 rounded-xl border border-[#E3E7EF] space-y-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6] block">
                Forecast Assumptions
              </span>

              <div>
                <label className="block text-[11px] font-semibold text-[#102654] mb-1">Debtor Days</label>
                <input
                  type="number"
                  value={debtorDays}
                  onChange={(e) => setDebtorDays(Number(e.target.value))}
                  className="w-full text-xs p-2 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#102654] mb-1">Creditor Days</label>
                <input
                  type="number"
                  value={creditorDays}
                  onChange={(e) => setCreditorDays(Number(e.target.value))}
                  className="w-full text-xs p-2 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#102654] mb-1">Minimum Cash Buffer (£)</label>
                <input
                  type="text"
                  value={minimumCash}
                  onChange={(e) => setMinimumCash(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#102654] mb-1">Planned Q2 Capex (£)</label>
                <input
                  type="text"
                  value={capexSpend}
                  onChange={(e) => setCapexSpend(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold"
                />
              </div>

              <div className="text-[11px] text-[#0B6B52] bg-emerald-50 p-2 rounded-lg font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Zero forecast months breach minimum buffer (£{minimumCash})</span>
              </div>
            </div>

            {/* Monthly Forecast Table */}
            <div className="lg:col-span-3 border border-[#E3E7EF] rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#0B1B3D] text-white text-[10px] font-bold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3 text-right">Opening Cash</th>
                    <th className="py-2.5 px-3 text-right">Inflows</th>
                    <th className="py-2.5 px-3 text-right">Outflows</th>
                    <th className="py-2.5 px-3 text-right">Closing Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EF] font-mono">
                  {[
                    { m: 'Oct 2026', op: '£1,305,350', in: '£510,000', out: '£440,000', cl: '£1,375,350' },
                    { m: 'Nov 2026', op: '£1,375,350', in: '£525,000', out: '£460,000', cl: '£1,440,350' },
                    { m: 'Dec 2026', op: '£1,440,350', in: '£610,000', out: '£530,000', cl: '£1,520,350' },
                    { m: 'Jan 2027', op: '£1,520,350', in: '£480,000', out: '£450,000', cl: '£1,550,350' },
                    { m: 'Feb 2027', op: '£1,550,350', in: '£490,000', out: '£465,000', cl: '£1,575,350' },
                    { m: 'Mar 2027', op: '£1,575,350', in: '£550,000', out: '£510,000', cl: '£1,615,350' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-sans font-bold text-[#102654]">{row.m}</td>
                      <td className="py-2.5 px-3 text-right">{row.op}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">{row.in}</td>
                      <td className="py-2.5 px-3 text-right text-red-600">{row.out}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#102654]">{row.cl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Quarterly Insight Pack (QTR-01) */}
      {activeTab === 'quarterly' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Quarterly Insight Schedule (QTR-01)</h2>
              <p className="text-xs text-[#5B6478]">
                2-page executive summary with AI insights, trend charts, and statutory filing timeline.
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Generate Q4 Pack</span>
            </button>
          </div>

          <div className="bg-[#FFF1EE]/50 border border-[#FF7D6B]/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#A23A27]">
              <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
              <span>3 AI Executive Insights (QTR-01 Plain English)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#102654]">
              <li className="flex items-start gap-2">
                <span className="text-[#FF7D6B] font-bold">•</span>
                <span>Revenue expanded by 14.8% over the year, driven by strong customer demand in Q2.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF7D6B] font-bold">•</span>
                <span>Cash collection remains disciplined with debtor days at 46 days against industry norm of 52 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF7D6B] font-bold">•</span>
                <span>Corporation tax liability of £22,505.33 is scheduled for payment 9 months post year-end.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 6: Full File Export Bundle (RPT-02) */}
      {activeTab === 'bundle' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-5 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 text-[#102654] border-b border-[#E3E7EF] pb-3">
            <FileDown className="w-6 h-6 text-[#FF7D6B]" />
            <h2 className="text-base font-bold">Full Working Paper File Export (RPT-02)</h2>
          </div>

          <p className="text-xs text-[#5B6478] leading-relaxed">
            Exports the complete engagement as an indexed regulatory PDF bundle. Includes:
          </p>

          <ul className="space-y-2 text-xs text-[#102654] bg-[#F6F7FB] p-4 rounded-xl border border-[#E3E7EF]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Working paper index with sign-off initials (P / M / Pt)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>All 17 Control account schedules &amp; supporting lead sheets</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Journal adjustment register and profit impact summary</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Complete standard disclosure checklist and notes to accounts</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Permanent file evidence and linked invoice receipts</span>
            </li>
          </ul>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-5 py-2.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-[#FF7D6B]" />
              <span>Build &amp; Download Indexed PDF Bundle (RPT-02)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
