'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  Scale,
  BarChart3,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';
import { formatPence, toPence } from '@/lib/money';

export default function AnalysisPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement } = useCompany();
  const { formatDate } = useLocale();

  const [activeTab, setActiveTab] = useState<'pnl' | 'balance_sheet' | 'unusual'>('pnl');
  const [comparisonMode, setComparisonMode] = useState<'py' | 'budget' | 'both'>('py');

  // P&L Lines with AI explanations (ANL-01)
  const pnlLines = [
    {
      code: '4000',
      name: 'Wholesale Commercial UK Sales',
      currentPence: 620000000n, // £6,200,000.00
      priorPence: 540000000n, // £5,400,000.00
      variancePct: '+14.8%',
      variancePence: 80000000n,
      aiExplanation: 'Sales up £800k (+14.8%): Driven by 3 new major distribution contracts signed in Q2 (Blynt Ledger contracts #1042, #1089).',
      flagged: true,
      comment: 'Agrees to order book expansion.',
      visibility: 'client_facing' as const,
    },
    {
      code: '5000',
      name: 'Direct Component Materials',
      currentPence: 380000000n, // £3,800,000.00
      priorPence: 320000000n, // £3,200,000.00
      variancePct: '+18.8%',
      variancePence: 60000000n,
      aiExplanation: 'Materials expense up £600k: Commodity price increases in raw aluminium (+6.2%) and volume growth.',
      flagged: true,
      comment: 'Price surcharges were passed to customers starting Q3.',
      visibility: 'client_facing' as const,
    },
    {
      code: '6000',
      name: 'London Office Rent & Rates',
      currentPence: 30000000n, // £300,000.00
      priorPence: 23200000n, // £232,000.00
      variancePct: '+29.3%',
      variancePence: 6800000n,
      aiExplanation: 'Rent up £68,000 (+29.3%): New commercial lease at Unit 4 from March, 8 months at £8,500/mo (evidenced in REC-04).',
      flagged: true,
      comment: 'Expanded storage facility footprint.',
      visibility: 'internal' as const,
    },
    {
      code: '6100',
      name: 'Gas and Electricity Utilities',
      currentPence: 4120000n,
      priorPence: 4050000n,
      variancePct: '+1.7%',
      variancePence: 70000n,
      flagged: false,
      comment: '',
      visibility: 'internal' as const,
    },
    {
      code: '6900',
      name: 'Depreciation Charge on Tangibles',
      currentPence: 2700000n,
      priorPence: 2450000n,
      variancePct: '+10.2%',
      variancePence: 250000n,
      aiExplanation: 'Depreciation up £2,500: Additional plant machinery additions £45,000 depreciated straight-line at 20% (REC-03).',
      flagged: true,
      comment: '',
      visibility: 'internal' as const,
    },
  ];

  // Balance sheet lines (ANL-02)
  const bsLines = [
    { name: 'Fixed Assets (NBV)', current: '£2,700,000.00', prior: '£2,450,000.00', movement: '+£250,000.00', explanation: 'Additions £270k less depreciation £20k (REC-03)' },
    { name: 'Current Assets - Stock', current: '£1,824,000.00', prior: '£1,650,000.00', movement: '+£174,000.00', explanation: 'Stock count agrees to valuation certificate (REC-14)' },
    { name: 'Current Assets - Debtors', current: '£2,364,500.00', prior: '£1,950,000.00', movement: '+£414,500.00', explanation: 'Debtor days increased from 42 to 46 days (REC-07)' },
    { name: 'Cash and Bank Equivalents', current: '£1,305,350.00', prior: '£940,000.00', movement: '+£365,350.00', explanation: 'Net cash generation from trading activities (REC-02)' },
    { name: 'Current Liabilities - Creditors', current: '£1,684,500.00', prior: '£1,420,000.00', movement: '+£264,500.00', explanation: 'Supplier payment terms maintained at 45 days (REC-08)' },
    { name: 'Net Assets / Total Equity', current: '£6,509,350.00', prior: '£5,570,000.00', movement: '+£939,350.00', explanation: 'Retained profit for the financial year' },
  ];

  // Unusual Transactions (AIX-04)
  const unusualTransactions = [
    {
      id: 'tx_01',
      date: '2026-08-15',
      contact: 'Amazon UK',
      amount: '£4,999.00',
      reason: 'Round-sum payment just below £5,000 authorization threshold. Possible personal electronics purchase.',
      severity: 'warning',
    },
    {
      id: 'tx_02',
      date: '2026-09-27',
      contact: 'Apex Courier Express',
      amount: '£1,250.00',
      reason: 'Postings on Sunday 23:45 out-of-pattern spending with duplicate amount in same week.',
      severity: 'info',
    },
    {
      id: 'tx_03',
      date: '2026-09-30',
      contact: 'Consulting Partners Ltd',
      amount: '£42,000.00',
      reason: 'VAT claimed on supplier invoice where VAT number is not verified on HMRC VIES database.',
      severity: 'error',
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">AI Financial Analysis &amp; Schedule Review (ANL)</h1>
            <span className="text-xs bg-[#FFF1EE] text-[#A23A27] px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#FF7D6B]" /> AI Explanations Active
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Automated transaction-level variance explanations, liquidity ratios, and going concern checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value as any)}
            className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-3 py-1.5 text-[#102654] font-medium outline-none"
          >
            <option value="py">Compare: Prior Year (FY25)</option>
            <option value="budget">Compare: Budget (FY26)</option>
            <option value="both">Compare: Prior Year &amp; Budget</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('pnl')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'pnl'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#1D4E89]" />
          <span>Profit &amp; Loss Analysis (ANL-01)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balance_sheet')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'balance_sheet'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Scale className="w-4 h-4 text-[#1D4E89]" />
          <span>Balance Sheet &amp; Ratios (ANL-02)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unusual')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'unusual'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Unusual Transactions (AIX-04)</span>
          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
            {unusualTransactions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: P&L Analysis */}
      {activeTab === 'pnl' && (
        <div className="flex flex-col gap-5">
          {/* Ratio Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E3E7EF] shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Gross Margin</span>
              <div className="text-xl font-bold font-mono text-[#0B6B52] mt-1">38.7%</div>
              <span className="text-[10px] text-[#5B6478] font-medium">-2.1% vs FY25 (40.8%)</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E3E7EF] shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Operating Margin</span>
              <div className="text-xl font-bold font-mono text-[#102654] mt-1">18.4%</div>
              <span className="text-[10px] text-emerald-700 font-medium">+1.3% vs FY25 (17.1%)</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E3E7EF] shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Net Margin</span>
              <div className="text-xl font-bold font-mono text-[#102654] mt-1">15.1%</div>
              <span className="text-[10px] text-emerald-700 font-medium">+0.8% vs FY25</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E3E7EF] shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Staff Cost to Turnover</span>
              <div className="text-xl font-bold font-mono text-[#102654] mt-1">22.4%</div>
              <span className="text-[10px] text-[#5B6478] font-medium">Stable vs 22.1% prior</span>
            </div>
          </div>

          {/* Variance Grid with AI Explanation and Manual Commentary */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#F6F7FB] border-b border-[#E3E7EF] flex items-center justify-between">
              <span className="text-xs font-bold text-[#102654]">
                Lines Flagged for Review (Movement &gt; 10% and &gt; £1,000)
              </span>
              <span className="text-[11px] text-[#5B6478]">
                Threshold: ±10% / £1,000 per ADM-02
              </span>
            </div>

            <div className="divide-y divide-[#E3E7EF]">
              {pnlLines.map((line) => (
                <div key={line.code} className="p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-1.5 py-0.5 rounded">
                        {line.code}
                      </span>
                      <span className="font-bold text-xs text-[#102654]">{line.name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-[#7E8DA6] block">Current FY26</span>
                        <span className="font-bold text-[#102654]">{formatPence(line.currentPence)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7E8DA6] block">Prior FY25</span>
                        <span className="text-[#5B6478]">{formatPence(line.priorPence)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#7E8DA6] block">Variance</span>
                        <span
                          className={`font-bold ${
                            line.variancePence > 0n ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {line.variancePct} ({formatPence(line.variancePence)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanation Strip (ANL-01) */}
                  {line.aiExplanation && (
                    <div className="mt-3 bg-[#FFF1EE]/70 border border-[#FF7D6B]/30 rounded-xl p-3 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-[#FF7D6B] shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs text-[#A23A27] leading-relaxed">
                        <strong>AI Commentary:</strong> {line.aiExplanation}
                      </div>
                    </div>
                  )}

                  {/* Manual Comment Box (ANL-03) */}
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="text"
                      defaultValue={line.comment}
                      placeholder="Add preparer explanation or variance note..."
                      className="flex-1 text-xs px-3 py-1.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] outline-none"
                    />
                    <span className="text-[10px] font-bold uppercase text-[#7E8DA6] bg-gray-100 px-2 py-1 rounded">
                      {line.visibility === 'client_facing' ? 'Client Report Facing' : 'Internal WP Only'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Balance Sheet & Going Concern (ANL-02) */}
      {activeTab === 'balance_sheet' && (
        <div className="flex flex-col gap-5">
          {/* Going Concern Indicators Alert Card */}
          <div className="bg-white border-2 border-emerald-500/40 rounded-[16px] p-5 shadow-xs flex items-start gap-3.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#102654]">Going Concern Health Check (ANL-02)</h3>
              <p className="text-xs text-[#5B6478] mt-1 leading-relaxed">
                Zero triggers detected: Positive net current assets (£3,809,350), profitable in FY25 &amp; FY26, HMRC payments up to date, and cash exceeds short-term obligations.
              </p>
            </div>
          </div>

          {/* Key Balance Sheet Ratios Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Current Ratio</span>
              <div className="text-lg font-bold font-mono text-[#0B6B52] mt-1">3.26x</div>
              <span className="text-[9px] text-[#7E8DA6]">Healthy &gt; 1.5x</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Quick Ratio</span>
              <div className="text-lg font-bold font-mono text-[#0B6B52] mt-1">2.18x</div>
              <span className="text-[9px] text-[#7E8DA6]">Excl. stock &gt; 1.0x</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Debtor Days</span>
              <div className="text-lg font-bold font-mono text-[#102654] mt-1">46 days</div>
              <span className="text-[9px] text-amber-600">+4 days vs FY25</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Creditor Days</span>
              <div className="text-lg font-bold font-mono text-[#102654] mt-1">45 days</div>
              <span className="text-[9px] text-[#7E8DA6]">Stable</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Stock Days</span>
              <div className="text-lg font-bold font-mono text-[#102654] mt-1">54 days</div>
              <span className="text-[9px] text-[#7E8DA6]">Healthy turn</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-[#E3E7EF] text-center">
              <span className="text-[10px] font-bold uppercase text-[#7E8DA6]">Gearing</span>
              <div className="text-lg font-bold font-mono text-[#0B6B52] mt-1">0.0%</div>
              <span className="text-[9px] text-[#7E8DA6]">No external debt</span>
            </div>
          </div>

          {/* Balance Sheet Movement Grid */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B1B3D] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Balance Sheet Heading</th>
                  <th className="py-3 px-3">FY26 Final</th>
                  <th className="py-3 px-3">FY25 Final</th>
                  <th className="py-3 px-3">Movement</th>
                  <th className="py-3 px-4">AI Analysis / Schedule Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {bsLines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-bold text-[#102654]">{line.name}</td>
                    <td className="py-3 px-3 font-mono font-medium">{line.current}</td>
                    <td className="py-3 px-3 font-mono text-[#5B6478]">{line.prior}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">{line.movement}</td>
                    <td className="py-3 px-4 text-[#5B6478]">{line.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Unusual Transactions (AIX-04) */}
      {activeTab === 'unusual' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#102654]">Unusual Transactions Detector (AIX-04)</h3>
              <p className="text-xs text-[#5B6478]">
                Scans all ledger journal lines for round sums, weekend transactions, potential duplicates, and suspense postings.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {unusualTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  tx.severity === 'error'
                    ? 'bg-red-50/60 border-red-200'
                    : tx.severity === 'warning'
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-blue-50/60 border-blue-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#102654]">{tx.date}</span>
                    <span className="text-xs font-bold text-[#102654]">{tx.contact}</span>
                    <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                      {tx.amount}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6478] mt-1.5">{tx.reason}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    Clear with reason
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    Raise client query
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
