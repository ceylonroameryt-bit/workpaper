'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Database,
  Building2,
  Calendar,
  Trash2,
  AlertTriangle,
  X,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { CompanyType, DataSource, Client } from '@/lib/types/models';
import { useCompany } from '@/context/CompanyContext';

export default function ClientsPage() {
  const router = useRouter();
  const { clients, deleteCompany, setActiveCompanyId, refreshCompanyData, activeCompanyId } = useCompany();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [notice, setNotice] = useState('');

  const archivedCount = clients.filter((c) => c.archived_at).length;
  const activeCount = clients.length - archivedCount;

  // Archive (with reason) or restore through the server so it is audited
  const setArchived = async (client: Client, archived: boolean, reason = '') => {
    setArchiveBusy(true);
    setArchiveError('');
    try {
      const res = await fetch(`/api/v1/clients/${client.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived, reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setArchiveError(body.error || 'Could not update the client. Try again.');
        return false;
      }
      refreshCompanyData();
      if (archived && activeCompanyId === client.id) {
        const next = db.clients.find((c) => !c.archived_at && c.id !== client.id);
        if (next) setActiveCompanyId(next.id);
      }
      setNotice(archived ? `${client.name} archived. Find it under Archived.` : `${client.name} restored.`);
      setTimeout(() => setNotice(''), 4000);
      return true;
    } catch {
      setArchiveError('Could not reach the server. Try again.');
      return false;
    } finally {
      setArchiveBusy(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    if (view === 'active' ? c.archived_at : !c.archived_at) return false;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company_no || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || c.company_type === typeFilter;
    const matchesSource = sourceFilter === 'all' || c.data_source === sourceFilter;

    return matchesSearch && matchesType && matchesSource;
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102654] tracking-tight">
            Client portfolio
          </h1>
          <p className="text-xs text-[#5B6478] mt-1">
            Manage company types, accounting data connections, and current working paper stages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/engagements/new"
            className="min-h-[44px] px-4 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-[10px] flex items-center gap-2 shadow-sm transition-transform active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New engagement
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="blynt-card p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
        <div role="tablist" aria-label="Client status" className="inline-flex p-1 rounded-[10px] bg-[#F6F7FB] border border-[#D5DBE7] shrink-0">
          {(
            [
              ['active', 'Active', activeCount],
              ['archived', 'Archived', archivedCount],
            ] as const
          ).map(([key, text, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`min-h-[36px] px-3.5 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                view === key ? 'bg-white text-[#102654] shadow-2xs border border-[#E3E7EF]' : 'text-[#5B6478] hover:text-[#102654]'
              }`}
            >
              {text}
              <span className={`text-[10px] font-bold px-1.5 rounded-full ${view === key ? 'bg-[#EAF5FC] text-[#1D4E89]' : 'bg-[#E3E7EF] text-[#5B6478]'}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#5B6478] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by client name or company number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
          />
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Company Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-[44px] px-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
          >
            <option value="all">All company types</option>
            <option value="Small company (FRS 102 1A)">Small company (FRS 102 1A)</option>
            <option value="Medium/large (FRS 102)">Medium/large (FRS 102)</option>
            <option value="Micro-entity (FRS 105)">Micro-entity (FRS 105)</option>
            <option value="IFRS company/group">IFRS company/group</option>
            <option value="LLP (FRS 102 + LLP SORP)">LLP (FRS 102 + LLP SORP)</option>
          </select>

          {/* Data Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="min-h-[44px] px-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
          >
            <option value="all">All data sources</option>
            <option value="blynt">Blynt Accounting</option>
            <option value="xero">Xero</option>
            <option value="quickbooks">QuickBooks Online</option>
            <option value="csv">CSV / Excel</option>
          </select>
        </div>
      </div>

      {notice && (
        <div role="status" className="px-4 py-3 rounded-[10px] bg-[#E6F4EF] border border-[#0B6B52]/20 text-xs font-medium text-[#0B6B52]">
          {notice}
        </div>
      )}

      {/* Clients Table */}
      <div className="blynt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#102654]">
            <caption className="sr-only">List of accounting clients and engagements</caption>
            <thead className="bg-[#F6F7FB] text-[#5B6478] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
              <tr>
                <th scope="col" className="p-4 pl-6">Client</th>
                <th scope="col" className="p-4">Company Type</th>
                <th scope="col" className="p-4">Year End</th>
                <th scope="col" className="p-4">Data Source</th>
                <th scope="col" className="p-4">Mapping Status</th>
                <th scope="col" className="p-4">Stage</th>
                <th scope="col" className="p-4 pr-6 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {filteredClients.map((client) => {
                const eng = db.engagements.find((e) => e.client_id === client.id);
                const mappings = eng
                  ? db.account_mappings.filter((m) => m.engagement_id === eng.id)
                  : [];
                const unconfirmedCount = mappings.filter((m) => m.status !== 'confirmed').length;

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-[#F6F7FB] transition-colors cursor-pointer group ${client.archived_at ? 'text-[#5B6478]' : ''}`}
                    onClick={() => {
                      if (eng) router.push(`/engagements/${eng.id}/trial-balance`);
                    }}
                  >
                    <td className="p-4 pl-6">
                      <Link
                        href={`/clients/${client.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCompanyId(client.id);
                        }}
                        className="font-bold text-[#102654] text-sm hover:text-[#FF7D6B] transition-colors block"
                      >
                        {client.name}
                      </Link>
                      <div className="text-[11px] text-[#5B6478] font-mono">
                        Co #{client.company_no || '09876543'}
                      </div>
                      {client.archived_at && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F4F5F7] border border-[#D5DBE7] text-[#5B6478]" title={client.archive_reason || undefined}>
                          <Archive className="w-3 h-3" />
                          Archived {new Date(client.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {client.archive_reason ? ` · ${client.archive_reason}` : ''}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-[#F4F5F7] border border-[#D5DBE7] text-[11px] font-medium">
                        {client.company_type}
                      </span>
                    </td>

                    <td className="p-4 font-mono-numbers text-[11px]">
                      {new Date(client.year_end || client.yearEnd || '2026-09-30').toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold capitalize text-[#102654]">
                          {client.data_source === 'csv' ? 'CSV / Excel' : client.data_source}
                        </span>
                        {client.reconnect_needed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4DB] text-[#6B4700]">
                            <AlertCircle className="w-3 h-3" /> Reconnect needed
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      {mappings.length === 0 ? (
                        <span className="text-[#5B6478] text-[11px]">○ No trial balance</span>
                      ) : unconfirmedCount === 0 ? (
                        <span className="text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ✓ All mapped
                        </span>
                      ) : (
                        <span className="text-[#A23A27] bg-[#FFF1EE] px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ! {unconfirmedCount} to map
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {eng ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FC] text-[#1D4E89]">
                          {eng.status}
                        </span>
                      ) : (
                        <span className="text-[#5B6478]">None</span>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {eng ? (
                          <Link
                            href={`/engagements/${eng.id}/trial-balance`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCompanyId(client.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#B8432F] hover:underline"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : client.archived_at ? (
                          <span className="text-xs text-[#5B6478]">No engagement</span>
                        ) : (
                          <Link
                            href={`/engagements/new?client_id=${client.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCompanyId(client.id);
                            }}
                            className="text-xs text-[#102654] font-semibold hover:underline"
                          >
                            Start engagement
                          </Link>
                        )}

                        {client.archived_at ? (
                          <button
                            type="button"
                            disabled={archiveBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchived(client, false);
                            }}
                            className="inline-flex items-center gap-1 p-1.5 rounded-lg text-xs font-semibold text-[#1D4E89] hover:bg-[#EAF5FC] transition-colors cursor-pointer"
                            title={`Restore ${client.name}`}
                            aria-label={`Restore ${client.name}`}
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchiveReason('');
                              setArchiveError('');
                              setArchiveTarget(client);
                            }}
                            className="p-1.5 rounded-lg text-[#5B6478] hover:text-[#102654] hover:bg-[#EAF5FC] transition-colors cursor-pointer"
                            title={`Archive ${client.name}`}
                            aria-label={`Archive ${client.name}`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(client);
                          }}
                          className="p-1.5 rounded-lg text-[#5B6478] hover:text-[#B42318] hover:bg-[#FDECEA] transition-colors cursor-pointer"
                          title={`Delete ${client.name}`}
                          aria-label={`Delete ${client.name}`}
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

          {filteredClients.length === 0 && view === 'archived' && (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F6F7FB] border border-[#E3E7EF] flex items-center justify-center text-[#5B6478] mb-3">
                <Archive className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#102654]">No archived clients</h3>
              <p className="text-xs text-[#5B6478] max-w-sm mt-1">
                Archive clients you no longer act for. Their files are kept, read-only, and you can restore them any time.
              </p>
            </div>
          )}

          {filteredClients.length === 0 && view === 'active' && (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F6F7FB] border border-[#E3E7EF] flex items-center justify-center text-[#5B6478] mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#102654]">No clients found</h3>
              <p className="text-xs text-[#5B6478] max-w-sm mt-1 mb-4">
                There are no clients in the system yet. Add your first client to start preparing statutory workpapers.
              </p>
              <Link
                href="/engagements/new"
                className="px-4 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add First Client</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Archive confirmation */}
      {archiveTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="archive-title" className="fixed inset-0 z-50 bg-[#0B1B3D]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="blynt-card p-6 bg-white max-w-md w-full rounded-2xl shadow-xl flex flex-col gap-4 border border-[#E3E7EF]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF5FC] flex items-center justify-center">
                  <Archive className="w-5 h-5 text-[#1D4E89]" />
                </div>
                <h3 id="archive-title" className="text-base font-bold text-[#102654]">Archive client</h3>
              </div>
              <button type="button" aria-label="Close" onClick={() => setArchiveTarget(null)} className="p-1 rounded-lg text-[#5B6478] hover:bg-[#F6F7FB]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              Archive <strong className="text-[#102654]">{archiveTarget.name}</strong>? Nothing is deleted.
            </p>
            <ul className="text-xs text-[#102654] space-y-1.5 pl-1">
              <li className="flex gap-2"><span className="text-[#1D4E89]">&bull;</span>It moves to the Archived list and out of the client switcher.</li>
              <li className="flex gap-2"><span className="text-[#1D4E89]">&bull;</span>Its working papers, trial balances and audit trail are kept, read-only.</li>
              <li className="flex gap-2"><span className="text-[#1D4E89]">&bull;</span>No new engagements or imports until you restore it.</li>
            </ul>

            <div>
              <label htmlFor="archive-reason" className="block text-xs font-semibold text-[#102654] mb-1.5">Reason (optional)</label>
              <input
                id="archive-reason"
                value={archiveReason}
                maxLength={300}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Disengaged, company dissolved, moved to another practice"
                className="w-full min-h-[40px] px-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] outline-none focus:border-[#FF7D6B]"
              />
            </div>

            {archiveError && <p role="alert" className="text-[11px] font-medium text-[#B42318]">{archiveError}</p>}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setArchiveTarget(null)} className="min-h-[38px] px-4 text-xs font-semibold text-[#102654] hover:bg-[#F6F7FB] border border-[#D5DBE7] rounded-xl transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={archiveBusy}
                onClick={async () => {
                  if (await setArchived(archiveTarget, true, archiveReason)) setArchiveTarget(null);
                }}
                className="min-h-[38px] px-4 text-xs font-bold text-white bg-[#102654] hover:bg-[#0B1B3D] rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{archiveBusy ? 'Archiving…' : 'Archive client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Delete Company */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#0B1B3D]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="blynt-card p-6 bg-white max-w-md w-full rounded-2xl shadow-xl flex flex-col gap-4 border border-[#E3E7EF]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[#B42318]">
                <div className="w-9 h-9 rounded-xl bg-[#FDECEA] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-[#B42318]" />
                </div>
                <h3 className="text-base font-bold text-[#102654]">Delete Company</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg text-[#5B6478] hover:bg-[#F6F7FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              Are you sure you want to delete <strong className="text-[#102654]">{deleteTarget.name}</strong>?
              This will permanently remove the company, its financial years, trial balance snapshots, account mappings, and working papers.
            </p>

            <div className="p-3 bg-[#FFF1EE] border border-[#FF7D6B]/30 rounded-xl text-[11px] text-[#A23A27] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This action cannot be undone. All audit trails and working papers for this entity will be removed.</span>
            </div>

            {!deleteTarget.archived_at && (
              <p className="text-[11px] text-[#5B6478]">
                No longer acting for this client?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setArchiveReason('');
                    setArchiveError('');
                    setArchiveTarget(deleteTarget);
                    setDeleteTarget(null);
                  }}
                  className="font-semibold text-[#1D4E89] hover:underline cursor-pointer"
                >
                  Archive it instead
                </button>{' '}
                to keep the records.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[38px] px-4 text-xs font-semibold text-[#102654] hover:bg-[#F6F7FB] border border-[#D5DBE7] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCompany(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="min-h-[38px] px-4 text-xs font-bold text-white bg-[#B42318] hover:bg-[#911c13] rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Company</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
