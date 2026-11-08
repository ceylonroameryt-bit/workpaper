'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { CompanyType } from '@/lib/types/models';

export default function MappingListsPage() {
  const mappingPacks = [
    {
      companyType: 'Small company (FRS 102 1A)' as CompanyType,
      version: 3,
      ruleCount: 142,
      clientsUsing: 18,
      status: 'published' as const,
      matchCoverage: '94% automated match',
    },
    {
      companyType: 'Medium/large (FRS 102)' as CompanyType,
      version: 2,
      ruleCount: 215,
      clientsUsing: 8,
      status: 'published' as const,
      matchCoverage: '91% automated match',
    },
    {
      companyType: 'Micro-entity (FRS 105)' as CompanyType,
      version: 2,
      ruleCount: 88,
      clientsUsing: 14,
      status: 'published' as const,
      matchCoverage: '98% automated match',
    },
    {
      companyType: 'LLP (FRS 102 + LLP SORP)' as CompanyType,
      version: 1,
      ruleCount: 120,
      clientsUsing: 6,
      status: 'published' as const,
      matchCoverage: '89% automated match',
    },
    {
      companyType: 'Sole trader' as CompanyType,
      version: 1,
      ruleCount: 65,
      clientsUsing: 22,
      status: 'published' as const,
      matchCoverage: '96% automated match',
    },
    {
      companyType: 'IFRS company/group' as CompanyType,
      version: 2,
      ruleCount: 310,
      clientsUsing: 3,
      status: 'published' as const,
      matchCoverage: '87% automated match',
    },
    {
      companyType: 'Charity (SORP)' as CompanyType,
      version: 1,
      ruleCount: 175,
      clientsUsing: 4,
      status: 'published' as const,
      matchCoverage: '88% automated match',
    },
    {
      companyType: 'Academy trust' as CompanyType,
      version: 1,
      ruleCount: 160,
      clientsUsing: 2,
      status: 'published' as const,
      matchCoverage: '92% automated match',
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#4A5878] mb-1">
            <Link href="/" className="hover:text-[#B8432F]">Blynt</Link>
            <span>/</span>
            <span>Library</span>
            <span>/</span>
            <span className="text-[#122654] font-semibold">Mapping lists</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#122654] tracking-tight">
            Mapping lists per company type
          </h1>
          <p className="text-xs text-[#4A5878] mt-0.5">
            Standard chart mapping rules applied automatically when importing trial balances from Xero, QuickBooks, or CSV.
          </p>
        </div>

        <Link
          href="/library/chart-of-accounts"
          className="min-h-[44px] px-4 py-2 bg-[#122654] text-white text-xs font-bold rounded-[10px] flex items-center gap-2 hover:bg-[#0B1A3B]"
        >
          <BookOpen className="w-4 h-4" />
          <span>View Blynt chart of accounts</span>
        </Link>
      </div>

      {/* Grid of Mapping Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mappingPacks.map((pack) => (
          <div
            key={pack.companyType}
            className="blynt-card p-5 flex flex-col justify-between hover:border-[#122654]/40 hover:shadow-sm transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#1D4E89]">
                  v{pack.version}.0
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EF] text-[#0B6B52]">
                  ✓ {pack.status}
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#122654] mb-1">
                {pack.companyType}
              </h3>
              <p className="text-xs text-[#4A5878]">
                {pack.matchCoverage} on standard default charts
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E3E7EF] flex items-center justify-between text-xs text-[#4A5878]">
              <div className="font-mono-numbers">
                <span className="font-bold text-[#122654]">{pack.ruleCount}</span> rules •{' '}
                <span className="font-bold text-[#122654]">{pack.clientsUsing}</span> clients
              </div>
              <button
                type="button"
                onClick={() => alert(`Editing mapping list rules for ${pack.companyType}`)}
                className="text-xs font-bold text-[#B8432F] hover:underline"
              >
                Edit rules →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
