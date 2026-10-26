'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Database,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';
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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#102654]">{client.name}</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
              Co. No. {client.company_no || '09876543'}
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1">
            Standard: <strong>{client.company_type || 'FRS 102 1A'}</strong> • Financial Year End:{' '}
            <strong>{client.year_end || '30 September'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleChLookup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F6F7FB] hover:bg-[#E3E7EF] border border-[#D5DBE7] text-[#102654] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF7D6B]" />
            <span>{chLoading ? 'Querying API...' : 'Look up on Companies House (FIL-01)'}</span>
          </button>

          <Link
            href="/engagements/new"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FF7D6B] hover:bg-[#ff9485] text-[#0B1B3D] text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Engagement</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Client Facts & Engagements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Engagements List */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <h2 className="text-sm font-bold text-[#102654]">Client Engagements (ENG-01)</h2>
              <span className="text-xs text-[#7E8DA6]">{clientEngagements.length} Total</span>
            </div>

            <div className="space-y-3">
              {clientEngagements.map((eng) => (
                <div
                  key={eng.id}
                  className="p-4 rounded-xl border border-[#E3E7EF] hover:border-[#102654]/40 bg-[#F6F7FB]/50 flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded">
                        {eng.id}
                      </span>
                      <span className="text-xs font-bold text-[#102654]">
                        Year-End Accounts: {formatDate(eng.period_end, { year: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#5B6478] mt-1">
                      Period: {formatDate(eng.period_start)} to {formatDate(eng.period_end)} • Framework: {eng.framework}
                    </div>
                  </div>

                  <Link
                    href={`/engagements/${eng.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                  >
                    Open Engagement <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Client Facts & Assigned Team (ENG-01) */}
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#102654] border-b border-[#E3E7EF] pb-3">
              Client Profile &amp; Team (ENG-01)
            </h2>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#7E8DA6] block">Entity Type</span>
                <span className="font-bold text-[#102654]">Limited Company (LTD)</span>
              </div>
              <div>
                <span className="text-[#7E8DA6] block">VAT Scheme</span>
                <span className="font-bold text-[#102654]">Standard Accrual (Quarter stagger 1)</span>
              </div>
              <div>
                <span className="text-[#7E8DA6] block">Payroll Operating</span>
                <span className="font-bold text-[#0B6B52]">Yes (12 employees via BrightPay)</span>
              </div>
              <div>
                <span className="text-[#7E8DA6] block">Ledger Connection</span>
                <span className="font-bold text-[#1D4E89] flex items-center gap-1">
                  <Database className="w-3 h-3" /> Connected (Xero API / CSV Fallback)
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E3E7EF]">
              <span className="text-xs font-bold text-[#102654] block mb-2">Assigned Practice Team</span>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-[10px]">
                    MV
                  </span>
                  <span>Marcus Vance (Preparer)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 font-bold flex items-center justify-center text-[10px]">
                    SJ
                  </span>
                  <span>Sarah Jenkins (Manager)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-[10px]">
                    DT
                  </span>
                  <span>David Thorne (Partner)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Companies House Data Card (FIL-01) */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#102654] border-b border-[#E3E7EF] pb-3">
              <Building2 className="w-4 h-4 text-[#FF7D6B]" />
              <span>Companies House Public Registry (FIL-01)</span>
            </div>

            {chData && (
              <div className="space-y-3 text-xs text-[#102654]">
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
                    <span className="font-mono font-bold text-[#102654]">{chData.accountsDue}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7E8DA6] block">Confirmation Stmt</span>
                    <span className="font-mono font-bold text-[#102654]">{chData.confirmationDue}</span>
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
