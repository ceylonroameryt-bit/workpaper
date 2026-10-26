'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  History,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  Sparkles,
  ArrowRight,
  GitCompare,
  RotateCcw,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
import { useLocale } from '@/context/LocaleContext';

export default function HistoryPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement } = useCompany();
  const { formatDate } = useLocale();

  const [activeTab, setActiveTab] = useState<'audit' | 'versions' | 'ai_log'>('audit');
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Version Comparison (AUD-02)
  const [versionA, setVersionA] = useState('v2_review');
  const [versionB, setVersionB] = useState('v3_current');

  // Audit Logs (AUD-01)
  const auditLogs = db.audit_logs.filter((l) => l.firm_id === (activeEngagement?.firm_id || 'firm_blynt_uk'));

  // Seed sample full trail if empty
  const displayLogs = useMemo(() => {
    const list = [...auditLogs];
    if (list.length < 5) {
      list.push(
        {
          id: 'aud_101',
          firm_id: 'firm_blynt_uk',
          actor_id: 'usr_test_partner',
          actor_name: 'David Thorne',
          actor_role: 'partner',
          action: 'SIGN_OFF_SCHEDULE',
          entity: 'workpapers',
          entity_id: 'wp_f10',
          before_json: JSON.stringify({ status: 'reviewed' }),
          after_json: JSON.stringify({ status: 'signed_off', signed_by: 'David Thorne' }),
          at: '2026-10-24T18:30:00Z',
        },
        {
          id: 'aud_102',
          firm_id: 'firm_blynt_uk',
          actor_id: 'usr_test_reviewer',
          actor_name: 'Sarah Jenkins',
          actor_role: 'reviewer',
          action: 'ACCEPT_AI_MAPPING',
          entity: 'account_mappings',
          entity_id: 'map_1500',
          before_json: JSON.stringify({ status: 'suggested', confidence: 94 }),
          after_json: JSON.stringify({ status: 'confirmed', blynt_code: '1500' }),
          at: '2026-10-24T16:15:00Z',
        },
        {
          id: 'aud_103',
          firm_id: 'firm_blynt_uk',
          actor_id: 'usr_test_preparer',
          actor_name: 'Marcus Vance',
          actor_role: 'preparer',
          action: 'POST_MANUAL_JOURNAL',
          entity: 'adjustments',
          entity_id: 'jnl_003',
          before_json: null,
          after_json: JSON.stringify({ ref: 'JNL-003', amount: '£2,750.00', narrative: 'Audit fee accrual' }),
          at: '2026-10-24T14:45:00Z',
        },
        {
          id: 'aud_104',
          firm_id: 'firm_blynt_uk',
          actor_id: 'usr_test_preparer',
          actor_name: 'Marcus Vance',
          actor_role: 'preparer',
          action: 'UPLOAD_EVIDENCE',
          entity: 'attachments',
          entity_id: 'att_lease_01',
          before_json: null,
          after_json: JSON.stringify({ filename: 'Unit_4_Lease_Agreement.pdf', category: 'Lease' }),
          at: '2026-10-24T11:20:00Z',
        }
      );
    }
    return list;
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return displayLogs.filter((log) => {
      const matchSearch =
        log.actor_name.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.entity.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (actionFilter !== 'all' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [displayLogs, search, actionFilter]);

  // AI Action Log Entries (AUD-03)
  const aiLogEntries = [
    {
      id: 'ail_01',
      outputType: 'Account Mapping',
      inputs: 'Nominal 1500 "Plant Machinery Cost" + prior year mapping',
      confidence: '98%',
      modelVersion: 'Blynt-ChartMap-v2.6',
      decidedBy: 'Marcus Vance',
      outcome: 'Accepted without changes',
      at: '2026-10-24T10:14:00Z',
    },
    {
      id: 'ail_02',
      outputType: 'Document Extraction',
      inputs: 'Unit_4_Lease_Agreement.pdf (Pages 2, 4, 6)',
      confidence: '95%',
      modelVersion: 'Blynt-DocExtract-v3.1',
      decidedBy: 'Sarah Jenkins',
      outcome: 'Accepted: Rent £10,200/yr, 5yr term',
      at: '2026-10-24T11:22:00Z',
    },
    {
      id: 'ail_03',
      outputType: 'Schedule Review Finding',
      inputs: 'REC-11 Director Loan overdrawn £24,249.96',
      confidence: '100%',
      modelVersion: 'Blynt-AuditCheck-v1.8',
      decidedBy: 'Sarah Jenkins',
      outcome: 'Warning Flagged: s455 tax charge applicable',
      at: '2026-10-24T15:30:00Z',
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">Full Audit Trail &amp; Version History (AUD)</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              Append-Only Immutability
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Complete regulatory audit trail of every change, sign-off, mapping confirmation, and version comparison (AUD-01 to AUD-03).
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 px-3.5 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log (CSV)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <History className="w-4 h-4 text-[#1D4E89]" />
          <span>Full Engagement Audit Trail (AUD-01)</span>
          <span className="text-[10px] bg-gray-200 text-gray-800 px-1.5 py-0.2 rounded font-mono">
            {filteredLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'versions'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <GitCompare className="w-4 h-4 text-[#1D4E89]" />
          <span>Schedule Version History (AUD-02)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai_log')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'ai_log'
              ? 'border-[#FF7D6B] text-[#102654]'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
          <span>AI Decision &amp; Lineage Log (AUD-03)</span>
        </button>
      </div>

      {/* TAB 1: Audit Trail (AUD-01) */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[14px] border border-[#E3E7EF] shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-[#7E8DA6] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by user, action, or entity..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] outline-none"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 text-[#102654] font-medium outline-none"
              >
                <option value="all">All Action Types</option>
                <option value="sign_off">Sign-offs</option>
                <option value="mapping">Mapping Changes</option>
                <option value="journal">Journals</option>
                <option value="upload">Evidence Uploads</option>
                <option value="lock">Lock / Unlock</option>
              </select>
            </div>

            <span className="text-[11px] text-[#7E8DA6]">
              Showing {filteredLogs.length} events • Cannot be modified or purged
            </span>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B1B3D] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-3">User &amp; Role</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Entity &amp; Target ID</th>
                  <th className="py-3 px-4">Before / After Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5B6478]">
                      {formatDate(log.at, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-[#102654]">{log.actor_name}</div>
                      <span className="text-[10px] text-[#1D4E89] uppercase font-mono">{log.actor_role}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-[10px] bg-[#EAF5FC] text-[#1D4E89] px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-[#102654]">
                      <span className="text-[#7E8DA6]">{log.entity} / </span>
                      <span className="font-bold">{log.entity_id}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-[#5B6478] max-w-xs truncate">
                      {log.after_json ? (
                        <span className="text-[#0B6B52]">{log.after_json}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Version History (AUD-02) */}
      {activeTab === 'versions' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Schedule Version Comparison (AUD-02)</h2>
              <p className="text-xs text-[#5B6478]">
                Compare snapshots taken at prior manager reviews against current working paper state.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={versionA}
                onChange={(e) => setVersionA(e.target.value)}
                className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="v1_initial">v1: Initial Preparer Draft (15 Oct)</option>
                <option value="v2_review">v2: At Manager Review (22 Oct)</option>
              </select>

              <span className="text-xs font-bold text-[#7E8DA6]">vs</span>

              <select
                value={versionB}
                onChange={(e) => setVersionB(e.target.value)}
                className="text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg px-2.5 py-1.5 font-medium"
              >
                <option value="v3_current">v3: Current Working Paper State</option>
              </select>

              <button
                type="button"
                className="px-3.5 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Compare Side-by-Side
              </button>
            </div>
          </div>

          {/* Visual Diff View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[#E3E7EF] rounded-xl p-4 bg-[#F6F7FB]/40">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-3">
                <span className="text-xs font-bold text-[#102654]">Version 2 (At Review - Sarah Jenkins)</span>
                <span className="text-[10px] font-mono text-[#5B6478]">22 Oct 2026 14:10</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#5B6478]">Plant Machinery Cost</span>
                  <span>£4,500,000.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-[#5B6478]">Accumulated Depreciation</span>
                  <span>(£1,800,000.00)</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-[#102654]">
                  <span>Net Book Value</span>
                  <span>£2,700,000.00</span>
                </div>
              </div>
            </div>

            <div className="border border-emerald-300 rounded-xl p-4 bg-emerald-50/20">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200 mb-3">
                <span className="text-xs font-bold text-emerald-900">Version 3 (Current Working Paper)</span>
                <span className="text-[10px] font-mono text-emerald-700">Latest Snapshot</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-[#5B6478]">Plant Machinery Cost</span>
                  <span>£4,500,000.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-[#5B6478]">Accumulated Depreciation</span>
                  <span>(£1,800,000.00)</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-[#0B6B52]">
                  <span>Net Book Value</span>
                  <span>£2,700,000.00 (Agreed ✓)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI Action Log (AUD-03) */}
      {activeTab === 'ai_log' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#F6F7FB] border-b border-[#E3E7EF] flex items-center justify-between">
            <span className="text-xs font-bold text-[#102654]">
              AI Decision Lineage &amp; Model Accuracy (AUD-03)
            </span>
            <span className="text-[11px] text-[#0B6B52] bg-[#E6F4EF] font-bold px-2 py-0.5 rounded-full">
              Accuracy: 94.2% Accepted without changes (Target: &gt;90%)
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1B3D] text-white text-[10px] font-bold uppercase">
              <tr>
                <th className="py-3 px-4">Output Type</th>
                <th className="py-3 px-3">Inputs Used</th>
                <th className="py-3 px-3">Confidence</th>
                <th className="py-3 px-3">Model Version</th>
                <th className="py-3 px-3">Decided By</th>
                <th className="py-3 px-4">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {aiLogEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-bold text-[#102654]">{entry.outputType}</td>
                  <td className="py-3 px-3 text-[#5B6478]">{entry.inputs}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700">{entry.confidence}</td>
                  <td className="py-3 px-3 font-mono text-[10px] text-[#7E8DA6]">{entry.modelVersion}</td>
                  <td className="py-3 px-3 text-[#102654]">{entry.decidedBy}</td>
                  <td className="py-3 px-4 text-emerald-700 font-semibold">{entry.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
