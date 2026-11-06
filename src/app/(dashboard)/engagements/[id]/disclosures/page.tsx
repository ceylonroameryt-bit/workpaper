'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, FileText, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/server/db';
import { useLocale } from '@/context/LocaleContext';
import { buildAccounts, type AccountsLine } from '@/lib/workpapers/accounts';
import { structureForCompanyType } from '@/lib/practice-structure';

// Pounds, rounded; negatives in brackets as in published accounts
const fmt = (p: bigint | null) => {
  if (p === null) return '';
  const v = Math.round(Math.abs(Number(p)) / 100).toLocaleString('en-GB');
  return p < 0n ? `(${v})` : v;
};

// Company-law disclosures to confirm before the accounts are approved (STD-03)
const CHECKLIST = [
  ['Accounting policies', 'Basis of preparation and the accounting framework are stated', 'FRS 102 1A.3(a)'],
  ['Accounting policies', 'Depreciation methods and useful lives are disclosed for each asset class', 'FRS 102 17.31'],
  ['Employees', 'Average number of employees during the year is disclosed', 'Companies Act 2006 s411'],
  ['Directors', 'Advances and credits to directors, with interest and repayments, are disclosed', 'Companies Act 2006 s413'],
  ['Commitments', 'Financial commitments, guarantees and contingencies not in the balance sheet are disclosed', 'FRS 102 1A.C'],
  ['Events after the year end', 'Material non-adjusting events after the reporting date are described', 'FRS 102 Section 32'],
];

type Tab = 'accounts' | 'notes' | 'checklist';

export default function DisclosuresPage() {
  const params = useParams();
  const engagementId = (params?.id as string) || '';
  const { formatDate } = useLocale();
  const [tab, setTab] = useState<Tab>('accounts');
  const [filing, setFiling] = useState(false);

  const engagement = db.engagements.find((e) => e.id === engagementId);
  const client = engagement ? db.clients.find((c) => c.id === engagement.client_id) : undefined;
  const structure = structureForCompanyType(client?.company_type || '');
  const isCompany = structure === 'ltd' || structure === 'llp';
  const a = useMemo(() => buildAccounts(engagementId), [engagementId]);
  const prior = engagement?.prior_engagement_id ? db.engagements.find((e) => e.id === engagement.prior_engagement_id) : undefined;

  if (!engagement || !client) {
    return <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-8 text-center text-xs text-[#4A5878]">Engagement not found.</div>;
  }

  const yearLabel = (iso?: string) => (iso ? formatDate(iso, { year: 'numeric', month: 'short' }) : '');
  const balanced = a.netAssets.amount === a.capitalAndReserves.amount;
  const empty = a.pl.length === 0 && Object.values(a.bs).every((l) => l.length === 0);
  const tabs: [Tab, string, React.ReactNode][] = [
    ['accounts', isCompany ? 'Statutory accounts preview' : 'Accounts preview', <Eye key="i" className="w-4 h-4 text-[#1D4E89]" />],
    ['notes', 'Notes: line breakdown', <FileText key="i" className="w-4 h-4 text-[#1D4E89]" />],
    ...(isCompany ? ([['checklist', 'Disclosure checklist', <ShieldCheck key="i" className="w-4 h-4 text-[#1D4E89]" />]] as [Tab, string, React.ReactNode][]) : []),
  ];

  const Row = ({ label, amount, prior: p, bold, indent, rule }: { label: string; amount: bigint; prior: bigint | null; bold?: boolean; indent?: boolean; rule?: boolean }) => (
    <tr className={`${bold ? 'font-bold' : ''} ${rule ? 'border-t border-gray-300' : ''}`}>
      <td className={`py-1.5 text-left font-sans ${indent ? 'pl-4' : ''}`}>{label}</td>
      <td className="py-1.5 text-right">{fmt(amount)}</td>
      {a.hasPrior && <td className="py-1.5 text-right text-gray-600">{fmt(p)}</td>}
    </tr>
  );
  const Lines = ({ lines, negate }: { lines: AccountsLine[]; negate?: boolean }) => (
    <>
      {lines.map((l) => (
        <Row key={l.label} label={l.label} amount={negate ? -l.amount : l.amount} prior={l.prior === null ? null : negate ? -l.prior : l.prior} indent />
      ))}
    </>
  );
  const Head = () => (
    <thead>
      <tr className="border-b border-gray-300 font-bold">
        <th className="py-2 text-left" />
        <th className="py-2 text-right w-28">{yearLabel(engagement.period_end)} (£)</th>
        {a.hasPrior && <th className="py-2 text-right w-28">{yearLabel(prior?.period_end)} (£)</th>}
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs">
        <h1 className="text-xl font-bold text-[#122654]">{isCompany ? 'Disclosures, notes & statutory accounts' : 'Accounts & notes'}</h1>
        <p className="text-xs text-[#4A5878] mt-1">
          Built from the confirmed trial balance and the journals in it. {engagement.framework}
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1 overflow-x-auto" role="tablist">
        {tabs.map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0 whitespace-nowrap ${tab === k ? 'border-[#FF7A66] text-[#122654]' : 'border-transparent text-[#4A5878] hover:text-[#122654]'}`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {a.unmappedPence !== 0n && (
        <div role="alert" className="p-3 rounded-[10px] bg-[#FFF4DB] border border-[#6B4700]/20 text-xs text-[#6B4700] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            £{fmt(a.unmappedPence < 0n ? -a.unmappedPence : a.unmappedPence)} of the trial balance isn&apos;t confirmed to an account yet, so it is left out.{' '}
            <Link href={`/engagements/${engagementId}/mapping`} className="font-bold underline">Finish mapping</Link>
          </span>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs p-4 sm:p-6 space-y-5">
          {empty ? (
            <p className="text-xs text-[#4A5878]">
              No figures yet. <Link href={`/engagements/${engagementId}/import`} className="font-bold text-[#B8432F] hover:underline">Import the trial balance</Link> and confirm the mapping to see the accounts.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {isCompany ? (
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={() => setFiling(false)} className={`px-3 py-1 font-bold rounded-lg ${!filing ? 'bg-[#122654] text-white' : 'bg-[#F5F8FD] text-[#4A5878]'}`}>Full accounts</button>
                    <button type="button" onClick={() => setFiling(true)} className={`px-3 py-1 font-bold rounded-lg ${filing ? 'bg-[#122654] text-white' : 'bg-[#F5F8FD] text-[#4A5878]'}`}>Companies House filing version</button>
                  </div>
                ) : <span />}
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${balanced ? 'bg-[#E6F4EF] text-[#0B6B52]' : 'bg-[#FDECEA] text-[#B42318]'}`}>
                  {balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {balanced
                    ? `Net assets £${fmt(a.netAssets.amount)} agree to ${isCompany ? 'capital and reserves' : 'the capital account'}`
                    : a.unmappedPence !== 0n
                      ? 'Won’t balance until the whole trial balance is mapped'
                      : `Net assets £${fmt(a.netAssets.amount)} don't agree to capital £${fmt(a.capitalAndReserves.amount)}`}
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 sm:p-8 bg-gray-50/50 max-w-3xl mx-auto space-y-6 text-[#122654] overflow-x-auto">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-bold tracking-tight">{client.name}</h2>
                  {isCompany && client.company_no && <p className="text-xs text-[#4A5878]">Registered number {client.company_no}</p>}
                </div>

                {!filing && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2">
                      Profit and loss account for the period ended {formatDate(engagement.period_end)}
                    </p>
                    <table className="w-full text-xs font-mono">
                      <Head />
                      <tbody>
                        {a.pl.map((l) => (
                          <React.Fragment key={l.label}>
                            {l.label === 'Tax on profit' && <Row label="Profit/(loss) before tax" amount={a.profitBeforeTax.amount} prior={a.profitBeforeTax.prior} bold rule />}
                            <Row label={l.label} amount={l.amount} prior={l.prior} />
                            {l.label === 'Cost of sales' && a.grossProfit && <Row label="Gross profit" amount={a.grossProfit.amount} prior={a.grossProfit.prior} bold rule />}
                          </React.Fragment>
                        ))}
                        <Row label="Profit/(loss) for the period" amount={a.profit.amount} prior={a.profit.prior} bold rule />
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2">Balance sheet as at {formatDate(engagement.period_end)}</p>
                  <table className="w-full text-xs font-mono">
                    <Head />
                    <tbody>
                      {a.bs.fixed.length > 0 && <><Row label="Fixed assets" amount={a.bs.fixed.reduce((t, l) => t + l.amount, 0n)} prior={a.hasPrior ? a.bs.fixed.reduce((t, l) => t + (l.prior ?? 0n), 0n) : null} bold /><Lines lines={a.bs.fixed} /></>}
                      <tr><td colSpan={3} className="pt-3 font-bold font-sans">Current assets</td></tr>
                      <Lines lines={a.bs.current} />
                      {a.bs.suspense.map((l) => (
                        <tr key={l.label} className="text-[#B42318]"><td className="py-1.5 pl-4 font-sans">{l.label}</td><td className="py-1.5 text-right">{fmt(l.amount)}</td>{a.hasPrior && <td className="py-1.5 text-right">{fmt(l.prior)}</td>}</tr>
                      ))}
                      {a.bs.creditorsShort.length > 0 && <><tr><td colSpan={3} className="pt-3 font-bold font-sans">Creditors: amounts falling due within one year</td></tr><Lines lines={a.bs.creditorsShort} negate /></>}
                      <Row label="Net current assets/(liabilities)" amount={a.netCurrentAssets.amount} prior={a.netCurrentAssets.prior} bold rule />
                      <Row label="Total assets less current liabilities" amount={a.totalLessCurrent.amount} prior={a.totalLessCurrent.prior} bold />
                      {a.bs.creditorsLong.length > 0 && <><tr><td colSpan={3} className="pt-3 font-bold font-sans">Creditors: amounts falling due after more than one year</td></tr><Lines lines={a.bs.creditorsLong} negate /></>}
                      <Lines lines={a.bs.provisions} negate />
                      <Row label="Net assets" amount={a.netAssets.amount} prior={a.netAssets.prior} bold rule />
                      <tr><td colSpan={3} className="pt-3 font-bold font-sans">{isCompany ? 'Capital and reserves' : 'Capital account'}</td></tr>
                      <Lines lines={a.bs.equity} />
                      <Row label="Profit/(loss) for the period" amount={a.profit.amount} prior={a.profit.prior} indent />
                      <Row label={isCompany ? 'Total capital and reserves' : 'Total capital'} amount={a.capitalAndReserves.amount} prior={a.capitalAndReserves.prior} bold rule />
                    </tbody>
                  </table>
                </div>

                {structure === 'ltd' && (
                  <p className="pt-4 border-t border-gray-300 text-[11px] text-[#4A5878] leading-relaxed font-sans">
                    For the year ended {formatDate(engagement.period_end)} the company was entitled to exemption from audit under section 477 of the Companies Act 2006 relating to small companies. The members have not required the company to obtain an audit of its accounts.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          {[...a.bs.fixed, ...a.bs.current, ...a.bs.creditorsShort, ...a.bs.creditorsLong, ...a.bs.provisions, ...a.pl]
            .filter((l) => l.accounts.length > 0)
            .map((l) => (
              <div key={l.label} className="bg-white border border-[#E3E7EF] rounded-[16px] p-5 shadow-xs">
                <h3 className="text-sm font-bold text-[#122654] border-b border-[#E3E7EF] pb-2 mb-2">{l.label}</h3>
                <table className="w-full text-xs">
                  <tbody>
                    {l.accounts.map((x) => (
                      <tr key={x.code}>
                        <td className="py-1 font-mono text-[#4A5878] w-14">{x.code}</td>
                        <td className="py-1 text-[#122654]">{x.name}</td>
                        <td className="py-1 text-right font-mono">{fmt(x.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-[#E3E7EF]">
                      <td colSpan={2} className="py-1">Total</td>
                      <td className="py-1 text-right font-mono">{fmt(l.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          {empty && <p className="text-xs text-[#4A5878]">No figures yet.</p>}
        </div>
      )}

      {tab === 'checklist' && isCompany && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] shadow-xs overflow-hidden">
          <p className="p-4 bg-[#F5F8FD] border-b border-[#E3E7EF] text-xs text-[#4A5878]">
            Confirm each disclosure in the notes before the accounts are approved.
          </p>
          <ul className="divide-y divide-[#E3E7EF]">
            {CHECKLIST.map(([section, question, ref]) => (
              <li key={question} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                <span className="font-mono font-bold text-[#1D4E89] bg-[#EAF5FC] px-1.5 py-0.5 rounded self-start">{ref}</span>
                <span className="text-[#4A5878]">{section}:</span>
                <span className="font-semibold text-[#122654]">{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
