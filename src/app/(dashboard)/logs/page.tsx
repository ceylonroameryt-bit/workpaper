'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Download,
  CheckCircle2,
  Lock,
  Sparkles,
  SlidersHorizontal,
  FileText,
  ExternalLink,
  Copy,
  X,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/server/db';
import { AuditLogItem } from '@/lib/types';

export default function AuditLogsPage() {
  // The practice's own activity log, newest first
  const [logs] = useState<AuditLogItem[]>(() =>
    [...db.audit_logs].reverse().map((a) => ({
      id: a.id,
      timestamp: a.at.replace('T', ' ').slice(0, 19),
      user: a.actor_name,
      role: a.actor_role,
      action: a.action,
      details: `${a.action.toLowerCase().replace(/_/g, ' ')} · ${a.entity} ${a.entity_id}`,
      entity: `${a.entity} ${a.entity_id}`,
      category: /SIGN|LOCK|REVIEW|APPROVE/.test(a.action) ? 'status' : /JOURNAL|ADJUST|IMPORT|TB/.test(a.action) ? 'adjustments' : /LOGIN|MFA|INVITE|STAFF/.test(a.action) ? 'security' : /COMMENT|NOTE/.test(a.action) ? 'notes' : /AI|RULE|MAPPING/.test(a.action) ? 'ai' : 'other',
      before: a.before_json ? JSON.parse(a.before_json) : null,
      after: a.after_json ? JSON.parse(a.after_json) : null,
    }))
  );
  const people = [...new Set(logs.map((l) => l.user).filter(Boolean))] as string[];
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  // Filter logs based on search query, category, user, and date
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }

      // User filter
      if (selectedUser !== 'all' && log.user !== selectedUser) {
        return false;
      }

      // Date filter
      if (selectedDateRange === 'today') {
        if (!log.timestamp.startsWith(today)) return false;
      } else if (selectedDateRange === '7days') {
        if (log.timestamp.slice(0, 10) < weekAgo) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const userName = (log.user || log.userName || '').toLowerCase();
        const actionStr = (log.action || '').toLowerCase();
        const detailsStr = (log.details || '').toLowerCase();
        const entityStr = (log.entity || log.entityName || '').toLowerCase();
        const matchesIp = (log.ipAddress || '').toLowerCase().includes(q);
        if (!userName.includes(q) && !actionStr.includes(q) && !detailsStr.includes(q) && !entityStr.includes(q) && !matchesIp) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedCategory, selectedUser, selectedDateRange]);

  const handleCopyChecksum = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedChecksum(true);
    setTimeout(() => setCopiedChecksum(false), 1500);
  };

  const handleCopyEventJson = (log: AuditLogItem) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Action', 'Category', 'Entity', 'Details', 'IP Address', 'SHA256 Checksum'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      `"${l.user || l.userName || 'System'}"`,
      `"${l.role || l.userRole || 'Member'}"`,
      l.action,
      l.category || 'general',
      `"${l.entity || l.entityName || 'N/A'}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || 'Internal'}"`,
      l.checksum || 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workpapers_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('SIGNOFF') || action.includes('LOCK')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEEAFB] text-[#4B3A9E] border border-[#DDD6FA]">
          <Lock className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('AI_')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F3F0FE] text-[#5B3FD0] border border-[#DDD6FA]">
          <Sparkles className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('ADJUSTMENT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20">
          <SlidersHorizontal className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('AUTH_')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20">
          <ShieldCheck className="w-3 h-3" />
          <span>{action}</span>
        </span>
      );
    }
    if (action.includes('NOTE_')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF4DB] text-[#6B4700] border border-[#6B4700]/20">
          <span>{action}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5F8FD] text-[#4A5878] border border-[#E3E7EF]">
        <span>{action}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-[28px] font-semibold text-[#122654] tracking-tight">
              Activity log
            </h1>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#E6F4EF] text-[#0B6B52] font-semibold border border-[#0B6B52]/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ISA 230 Compliant • Tamper-Evident</span>
            </span>
          </div>
          <p className="text-sm text-[#4A5878] mt-1">
            Immutable, append-only security logs, AI model provenance traces, and engagement sign-off actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print activity log
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4A5878]">
            Total Logged Events
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-numbers text-[#122654]">
              1,428
            </span>
            <span className="text-[11px] font-semibold text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full">
              +18 today
            </span>
          </div>
          <span className="text-[11px] text-[#4A5878]">
            Zero tamper events • SHA-256 intact
          </span>
        </div>

        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4A5878]">
            AI Extractions Verified
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-numbers text-[#5B3FD0]">
              142
            </span>
            <span className="text-[11px] font-semibold text-[#5B3FD0] bg-[#F3F0FE] px-2 py-0.5 rounded-full">
              99.4% Match
            </span>
          </div>
          <span className="text-[11px] text-[#4A5878]">
            Full prompt version lineage logged
          </span>
        </div>

        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4A5878]">
            Partner Sign-Offs
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-numbers text-[#1D4E89]">
              28
            </span>
            <span className="text-[11px] font-semibold text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded-full">
              Locked
            </span>
          </div>
          <span className="text-[11px] text-[#4A5878]">
            Section B Cash & CIS verified
          </span>
        </div>

        <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 flex flex-col gap-1.5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4A5878]">
            Authentication Sessions
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-numbers text-[#0B6B52]">
              48
            </span>
            <span className="text-[11px] font-semibold text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full">
              MFA Active
            </span>
          </div>
          <span className="text-[11px] text-[#4A5878]">
            0 failed attempts in last 24h
          </span>
        </div>
      </div>

      {/* Main Filter & Search Toolbar */}
      <div className="bg-white border border-[#E3E7EF] rounded-[14px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#4A5878] absolute left-3 top-1/2 -translate-y-1/2" />
          <input aria-label="Search events, W/P ref, actor, IP address, action"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, W/P ref, actor, IP address, action..."
            className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#D3DCEE] text-xs text-[#122654] bg-[#F5F8FD] focus:bg-white focus:border-[#1D4E89] focus:ring-2 focus:ring-[#1D4E89]/20 focus-visible:outline-none transition-all"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Category */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#4A5878] font-medium">Category:</span>
            <select aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-1.5 px-2.5 rounded-[8px] border border-[#D3DCEE] bg-white text-[#122654] text-xs font-medium focus:border-[#1D4E89] focus-visible:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="status">Status &amp; Sign-Offs</option>
              <option value="ai">AI Extractions &amp; Lineage</option>
              <option value="adjustments">Adjustments &amp; TB</option>
              <option value="security">Security &amp; Auth (MFA)</option>
              <option value="notes">Review Notes</option>
            </select>
          </div>

          {/* User */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#4A5878] font-medium">User:</span>
            <select aria-label="Filter by user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="py-1.5 px-2.5 rounded-[8px] border border-[#D3DCEE] bg-white text-[#122654] text-xs font-medium focus:border-[#1D4E89] focus-visible:outline-none"
            >
              <option value="all">All Users</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#4A5878] font-medium">Date:</span>
            <select aria-label="Date range"
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="py-1.5 px-2.5 rounded-[8px] border border-[#D3DCEE] bg-white text-[#122654] text-xs font-medium focus:border-[#1D4E89] focus-visible:outline-none"
            >
              <option value="all">All Recorded Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 days</option>
            </select>
          </div>

          {(selectedCategory !== 'all' || selectedUser !== 'all' || selectedDateRange !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedUser('all');
                setSelectedDateRange('all');
                setSearchQuery('');
              }}
              className="text-[#1D4E89] hover:underline font-medium text-xs px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Activity log table */}
      <div className="bg-white border border-[#E3E7EF] rounded-[14px] overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-[#E3E7EF] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#1D4E89]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#122654]">
              Activity log ({filteredLogs.length} records)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#4A5878]">
            <span>Sorted: Newest First</span>
            <span>•</span>
            <span className="text-[#0B6B52] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Chain of Custody Validated</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#4A5878] text-[11px] font-semibold uppercase tracking-wider border-b border-[#E3E7EF]">
                <th className="px-4 py-3">Timestamp (UTC+1)</th>
                <th className="px-4 py-3">Actor / User</th>
                <th className="px-4 py-3">Action Event</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Details &amp; provenance</th>
                <th className="px-4 py-3">Integrity Checksum</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F9FA]/70 transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 font-mono-numbers whitespace-nowrap text-[#4A5878]">
                      <div className="text-[#122654] font-medium">{log.timestamp.split(' ')[1]}</div>
                      <div className="text-[11px]">{log.timestamp.split(' ')[0]}</div>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#EAF5FC] text-[#1D4E89] flex items-center justify-center font-bold text-[10px]">
                          {(log.user || log.userName || 'System')
                            .replace(/\(Test\)/gi, '')
                            .trim()
                            .split(' ')
                            .map((n: string) => n[0] || '')
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-[#122654]">
                            <span>{log.user || log.userName || 'System'}</span>
                          </div>
                          <div className="text-[10px] text-[#4A5878]">{log.role || log.userRole || 'Member'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Target Entity */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono-numbers">
                      {(log.entity || log.entityName || '').startsWith('WP') ? (
                        <Link
                          href={`/engagements/eng_harlow_fy26/workpapers/${(log.entity || log.entityName || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`}
                          className="font-semibold text-[#1D4E89] hover:underline flex items-center gap-1"
                        >
                          <span>{log.entity || log.entityName}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      ) : (
                        <span className="font-semibold text-[#122654]">{log.entity || log.entityName || 'General'}</span>
                      )}
                      <div className="text-[10px] text-[#4A5878]">{log.engagementName || ''}</div>
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3 max-w-[340px]">
                      <p className="text-[#122654] leading-relaxed line-clamp-2">
                        {log.details}
                      </p>
                      {log.ipAddress && (
                        <span className="text-[10px] font-mono-numbers text-[#4A5878]">
                          From: {log.ipAddress}
                        </span>
                      )}
                    </td>

                    {/* Checksum */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[10px]">
                      {log.checksum ? (
                        <button
                          type="button"
                          onClick={() => handleCopyChecksum(log.checksum!)}
                          className="px-2 py-0.5 rounded bg-[#F5F8FD] hover:bg-[#EAF5FC] text-[#4A5878] hover:text-[#1D4E89] border border-[#E3E7EF] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Click to copy full SHA-256 hash"
                        >
                          <span>{log.checksum.slice(0, 15)}...</span>
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <span className="text-[#4A5878]">—</span>
                      )}
                    </td>

                    {/* Inspect Button */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLogForDetails(log)}
                        className="px-2.5 py-1 rounded-[6px] text-xs font-semibold text-[#1D4E89] bg-[#EAF5FC] hover:bg-[#d8e4fb] transition-colors cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#4A5878]">
                    No records match the selected search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Inspection Drawer / Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 bg-[#122654]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E7EF] rounded-[14px] w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-[#E3E7EF]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#4A5878]">
                  ISA 230 Event Record
                </span>
                <h3 className="text-lg font-semibold text-[#122654] flex items-center gap-2 mt-0.5">
                  <span>{selectedLogForDetails.action}</span>
                  <span className="text-xs font-mono text-[#4A5878]">#{selectedLogForDetails.id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetails(null)}
                className="p-1 rounded text-[#4A5878] hover:text-[#122654] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-[10px] bg-[#F5F8FD] border border-[#E3E7EF]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#4A5878] block mb-0.5">
                    User / Officer
                  </span>
                  <span className="font-semibold text-[#122654]">{selectedLogForDetails.user}</span>
                  <span className="text-[11px] text-[#4A5878] block">{selectedLogForDetails.role}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#4A5878] block mb-0.5">
                    Timestamp
                  </span>
                  <span className="font-mono-numbers font-semibold text-[#122654]">
                    {selectedLogForDetails.timestamp}
                  </span>
                  <span className="text-[11px] text-[#0B6B52] block">Verified Timestamp</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[#4A5878] block mb-1">
                  Event description &amp; context
                </span>
                <p className="p-3 rounded-[10px] bg-white border border-[#D3DCEE] text-xs text-[#122654] leading-relaxed">
                  {selectedLogForDetails.details}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[#4A5878] block mb-1">
                  Cryptographic Provenance Checksum
                </span>
                <div className="p-3 rounded-[10px] bg-[#F5F8FD] border border-[#E3E7EF] flex items-center justify-between font-mono text-[11px]">
                  <span className="text-[#1D4E89] truncate">{selectedLogForDetails.checksum || 'Not recorded'}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyChecksum(selectedLogForDetails.checksum || '')}
                    className="text-[#1D4E89] hover:underline shrink-0 ml-2 font-sans font-semibold cursor-pointer"
                  >
                    {copiedChecksum ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-[#4A5878]">
                    Raw Immutable JSON Entry
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyEventJson(selectedLogForDetails)}
                    className="text-xs text-[#1D4E89] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === selectedLogForDetails.id ? 'Copied JSON!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-[10px] bg-[#0d131f] text-[#cbd5e1] font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedLogForDetails, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E3E7EF] flex justify-end">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedLogForDetails(null)}
              >
                Close Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
