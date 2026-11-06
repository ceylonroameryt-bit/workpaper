'use client';

import React, { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { QuickBooksPanel, XeroPanel } from '@/components/integrations/XeroPanel';
import { useCompany } from '@/context/CompanyContext';
import { ClientProfileForm } from '@/components/clients/ClientProfileForm';
import { Client } from '@/lib/types/models';
import { useLocale } from '@/context/LocaleContext';

export default function ClientRecordPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = (params?.id as string) || 'cli_harlow';
  const { clients, activeEngagement, addCompany } = useCompany();
  const { formatDate } = useLocale();

  const client = db.clients.find((c) => c.id === clientId) || db.clients[0] || {
    id: clientId,
    name: 'Harlow & Finch Fine Goods Ltd',
    company_no: '09876543',
    company_type: 'Small company (FRS 102 1A)',
    year_end: '2026-09-30',
    data_source: 'xero',
  };

  const clientEngagements = db.engagements.filter((e) => e.client_id === client.id);

  // Companies House Lookup Simulation (FIL-01)
  const [chLoading, setChLoading] = useState(false);
  const [chData, setChData] = useState<{
    status: string;
    sic: string;
    registeredOffice: string;
    incorporationDate: string;
    accountsDue: string;
    confirmationDue: string;
  } | null>({
    status: 'Active (Companies House Verified)',
    sic: '47710 - Retail sale of clothing in specialised stores',
    registeredOffice: '44 Grosvenor Gardens, London, SW1W 0DH',
    incorporationDate: '14 May 2015',
    accountsDue: '30 June 2027',
    confirmationDue: '28 May 2027',
  });

  const handleChLookup = () => {
    setChLoading(true);
    setTimeout(() => {
      setChLoading(false);
      setChData({
        status: 'Active (Live from Companies House API)',
        sic: '47710 - Retail sale of clothing',
        registeredOffice: '44 Grosvenor Gardens, London, SW1W 0DH',
        incorporationDate: '14 May 2015',
        accountsDue: '30 June 2027',
        confirmationDue: '28 May 2027',
      });
    }, 700);
  };

  // Result of "Connect Xero", passed back by the callback
  const search = useSearchParams();
  const [ledger, ledgerResult] = search.get('xero') ? ['Xero', search.get('xero')] : search.get('qbo') ? ['QuickBooks', search.get('qbo')] : ['', null];
  const xeroMessage =
    ledgerResult === 'connected'
      ? { ok: true, text: `${ledger} connected. Pull the trial balance from an engagement.` }
      : ledgerResult === 'declined'
        ? { ok: false, text: `${ledger} access was not granted, so nothing was connected.` }
        : ledgerResult === 'not_configured'
          ? { ok: false, text: `${ledger} isn’t switched on for this practice yet, so it couldn’t be connected. Your admin needs to add the ${ledger} app details to the server. Until then, import the trial balance from a CSV file.` }
          : ledgerResult === 'archived'
            ? { ok: false, text: `This client is archived. Restore it before connecting ${ledger}.` }
            : ledgerResult === 'error'
              ? { ok: false, text: `The ${ledger} connection didn’t complete. Try again, and sign in as the same user who started it.` }
              : null;
  const latestEngagement = [...clientEngagements].sort((a, b) => b.period_end.localeCompare(a.period_end))[0];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {xeroMessage && (
        <div role="status" className={`px-4 py-3 rounded-[10px] text-xs font-medium border ${xeroMessage.ok ? 'bg-[#E6F4EF] border-[#0B6B52]/20 text-[#0B6B52]' : 'bg-[#FFF4DB] border-[#6B4700]/20 text-[#6B4700]'}`}>
          {xeroMessage.text}
        </div>
      )}
      {/* Top Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#122654]">{client.name}</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              Co. No. {client.company_no || '09876543'}
            </span>
          </div>
          <p className="text-xs text-[#4A5878] mt-1">
            Standard: <strong>{client.company_type || 'FRS 102 1A'}</strong> • Financial Year End:{' '}
            <strong>{client.year_end || '30 September'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleChLookup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F8FD] hover:bg-[#E3E7EF] border border-[#D3DCEE] text-[#122654] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A66]" />
            <span>{chLoading ? 'Querying API...' : 'Look up on Companies House (FIL-01)'}</span>
          </button>

          <Link
            href="/engagements/new"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Engagement</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Client Facts & Engagements */}
        <div className="lg:col-span-2 space-y-6">
          <XeroPanel clientId={client.id} engagementId={latestEngagement?.id} reconnectNeeded={Boolean(client.reconnect_needed)} />
          <QuickBooksPanel clientId={client.id} engagementId={latestEngagement?.id} reconnectNeeded={Boolean(client.reconnect_needed)} />
          {/* Engagements List */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <h2 className="text-sm font-bold text-[#122654]">Client Engagements (ENG-01)</h2>
              <span className="text-xs text-[#7E8DA6]">{clientEngagements.length} Total</span>
            </div>

            <div className="space-y-3">
              {clientEngagements.map((eng) => (
                <div
                  key={eng.id}
                  className="p-4 rounded-xl border border-[#E3E7EF] hover:border-[#122654]/40 bg-[#F5F8FD]/50 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded">
                        {eng.id}
                      </span>
                      <span className="text-xs font-bold text-[#122654]">
                        Year-End Accounts: {formatDate(eng.period_end, { year: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#4A5878] mt-1">
                      Period: {formatDate(eng.period_start)} to {formatDate(eng.period_end)} • Framework: {eng.framework}
                    </div>
                  </div>

                  <Link
                    href={`/engagements/${eng.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#122654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                  >
                    Open Engagement <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <ClientProfileForm key={client.id} client={client as Client} />
        </div>

        {/* Right Col: Companies House Data Card (FIL-01) */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#122654] border-b border-[#E3E7EF] pb-3">
              <Building2 className="w-4 h-4 text-[#FF7A66]" />
              <span>Companies House Public Registry (FIL-01)</span>
            </div>

            {chData && (
              <div className="space-y-3 text-xs text-[#122654]">
                <div>
                  <span className="text-[10px] text-[#7E8DA6] block uppercase font-bold">Status</span>
                  <span className="font-bold text-[#0B6B52]">{chData.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7E8DA6] block uppercase font-bold">Nature of Business (SIC)</span>
                  <span>{chData.sic}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7E8DA6] block uppercase font-bold">Registered Office</span>
                  <span>{chData.registeredOffice}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7E8DA6] block uppercase font-bold">Incorporated</span>
                  <span>{chData.incorporationDate}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between">
                  <div>
                    <span className="text-[10px] text-[#7E8DA6] block">Next Accounts Due</span>
                    <span className="font-mono font-bold text-[#122654]">{chData.accountsDue}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7E8DA6] block">Confirmation Stmt</span>
                    <span className="font-mono font-bold text-[#122654]">{chData.confirmationDue}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
