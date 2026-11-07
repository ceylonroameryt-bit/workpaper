'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { NewAccountForm } from '@/components/coa/NewAccountForm';

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const accounts = db.blynt_accounts;

  const groups = [
    { id: 'all', label: 'All Accounts', range: '100–999' },
    { id: 'Asset', label: 'Assets (600–749)', range: '600–749' },
    { id: 'Liability', label: 'Liabilities (750–849)', range: '750–849' },
    { id: 'Equity', label: 'Equity & Reserves (850–899)', range: '850–899' },
    { id: 'Revenue', label: 'Revenue (100–199)', range: '100–199' },
    { id: 'Cost of Sales', label: 'Cost of Sales (200–299)', range: '200–299' },
    { id: 'Overhead', label: 'Payroll, Admin, Finance & Tax (300–599)', range: '300–599' },
    { id: 'System', label: 'System & Clearing (900–999)', range: '900–999' },
  ];

  const filteredAccounts = accounts.filter((acc) => {
    const matchSearch =
      acc.code.toLowerCase().includes(search.toLowerCase()) ||
      acc.name.toLowerCase().includes(search.toLowerCase());

    const matchGroup = selectedGroup === 'all' || acc.type === selectedGroup;
    return matchSearch && matchGroup;
  });


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
            <span className="text-[#122654] font-semibold">Blynt chart of accounts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#122654] tracking-tight">
            Master Chart of Accounts
          </h1>
          <p className="text-xs text-[#4A5878] mt-0.5">
            Standard UK account hierarchy and lead schedules. Built-in system codes are locked; custom firm additions can be added.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/library/mapping-lists"
            className="min-h-[44px] px-4 py-2 border border-[#D3DCEE] hover:border-[#122654] bg-white text-[#122654] text-xs font-semibold rounded-[10px] flex items-center gap-2"
          >
            <span>Mapping lists per company type</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="min-h-[44px] px-4 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-[10px] flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add firm account
          </button>
        </div>
      </div>

      {/* Group Pills & Search */}
      <div className="blynt-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroup(g.id)}
              className={`min-h-[38px] px-3 text-xs font-semibold rounded-[8px] transition-colors shrink-0 cursor-pointer ${
                selectedGroup === g.id
                  ? 'bg-[#122654] text-white shadow-xs'
                  : 'text-[#4A5878] hover:bg-[#F5F8FD] hover:text-[#122654]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#4A5878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input aria-label="Search nominal or name"
            type="text"
            placeholder="Search nominal or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[38px] pl-8 pr-3 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
          />
        </div>
      </div>

      {/* Grouped Table */}
      <div className="blynt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#122654]">
            <thead className="bg-[#F5F8FD] text-[#4A5878] uppercase text-[10px] font-bold tracking-wider border-b border-[#E3E7EF]">
              <tr>
                <th scope="col" className="p-3 pl-6">Code</th>
                <th scope="col" className="p-3">Standard Account Name</th>
                <th scope="col" className="p-3">Category</th>
                <th scope="col" className="p-3">Normal Balance</th>
                <th scope="col" className="p-3">Lead Schedule</th>
                <th scope="col" className="p-3">Used by Clients</th>
                <th scope="col" className="p-3 pr-6 text-right">System / Firm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EF]">
              {filteredAccounts.map((acc) => (
                <tr key={acc.code} className="hover:bg-[#F5F8FD]">
                  <td className="p-3 pl-6 font-mono font-bold text-[#122654]">
                    {acc.code}
                  </td>
                  <td className="p-3 font-semibold text-[#122654]">
                    {acc.name}
                  </td>
                  <td className="p-3 text-[#4A5878]">{acc.type}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        acc.normal_balance === 'Debit'
                          ? 'bg-[#EAF5FC] text-[#1D4E89]'
                          : 'bg-[#FFF4DB] text-[#6B4700]'
                      }`}
                    >
                      {acc.normal_balance}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-[#122654] text-white flex items-center justify-center font-mono font-bold text-[10px]">
                        {acc.lead_letter}
                      </span>
                      <span className="text-[#4A5878] text-[11px]">
                        Schedule {acc.lead_letter}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 font-mono-numbers text-[#4A5878]">
                    {acc.used_by_count ?? 12} clients
                  </td>
                  <td className="p-3 pr-6 text-right">
                    {acc.is_system ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#F5F8FD] text-[#4A5878] border border-[#D3DCEE]">
                        <Lock className="w-3 h-3" /> System
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/30">
                        Firm addition
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Firm Account Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1A3B]/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[16px] border border-[#E3E7EF] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-[#122654] mb-1">
              Add custom firm account
            </h3>
            <p className="text-xs text-[#4A5878] mb-5">
              Type a name: Blynt recommends a category and gives the next free code in its range.
            </p>

            <NewAccountForm firmId={db.firms[0]?.id ?? ''} onCancel={() => setShowAddModal(false)} onCreated={() => setShowAddModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
