'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, Check, Plus, Search, Sparkles } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useRouter, usePathname } from 'next/navigation';

interface CompanySelectorProps {
  variant?: 'header' | 'sidebar' | 'dashboard';
  onAddNewCompany?: () => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  variant = 'header',
  onAddNewCompany,
}) => {
  const { clients, engagements, activeCompany, activeEngagement, setActiveCompanyId } = useCompany();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered clients list
  const filteredClients = clients.filter((c) => !c.archived_at).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company_no || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectCompany = (clientId: string) => {
    setActiveCompanyId(clientId);
    setOpen(false);

    // If currently on an engagement-specific page, redirect to the new company's engagement or dashboard
    if (pathname.includes('/engagements/')) {
      const match = pathname.match(/\/engagements\/([^/]+)(\/.*)?/);
      if (match) {
        const subpath = match[2] || '';
        // Find engagement for selected company
        const nextEng =
          engagements.find((e) => e.client_id === clientId && e.status !== 'locked') ||
          engagements.find((e) => e.client_id === clientId) ||
          null;
        if (nextEng) {
          router.push(`/engagements/${nextEng.id}${subpath}`);
        } else {
          router.push('/');
        }
      }
    }
  };

  if (!activeCompany) {
    if (variant === 'sidebar') {
      return (
        <div className="w-full">
          <button
            type="button"
            onClick={onAddNewCompany || (() => router.push('/engagements/new'))}
            className="w-full bg-[#122654] hover:bg-[#16336e] border border-dashed border-[#FF7A66]/50 hover:border-[#FF7A66] rounded-[14px] p-3 text-left transition-all flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-white text-xs font-semibold">
              <Building2 className="w-4 h-4 text-[#FF7A66]" />
              <span>Add First Company</span>
            </div>
            <Plus className="w-4 h-4 text-[#FF7A66] group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onAddNewCompany || (() => router.push('/engagements/new'))}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F8FD] border border-dashed border-[#D3DCEE] hover:border-[#122654] text-xs font-semibold text-[#122654] transition-colors cursor-pointer"
      >
        <Building2 className="w-3.5 h-3.5 text-[#4A5878]" />
        <span>No company selected</span>
        <Plus className="w-3.5 h-3.5 text-[#B8432F]" />
      </button>
    );
  }

  // Render according to variant
  if (variant === 'sidebar') {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full bg-[#122654] hover:bg-[#16336e] border border-[#E3E7EF]/20 hover:border-[#FF7A66]/50 rounded-[14px] p-3 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF7A66]"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#FF7A66] shrink-0" />
                <span className="truncate">{activeCompany.name}</span>
              </span>
              <span className="text-[11px] text-[#A6B4D0] mt-0.5 truncate">
                Co #{activeCompany.company_no} • {activeCompany.company_type}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#A6B4D0] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
            <span className="text-[#FF7A66] font-semibold">Active Company</span>
            <span className="text-[#A6B4D0]">Click to switch ▾</span>
          </div>
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white text-[#122654] rounded-[16px] shadow-2xl border border-[#E3E7EF] overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="p-2.5 border-b border-[#E3E7EF]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#4A5878] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input aria-label="Search companies"
                  type="text"
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] outline-none text-[#122654] focus:border-[#FF7A66]"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 flex flex-col gap-1 text-xs">
              {filteredClients.map((client) => {
                const isSelected = client.id === activeCompany.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectCompany(client.id)}
                    className={`p-2 rounded-[10px] text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EAF5FC] text-[#1D4E89] font-bold'
                        : 'hover:bg-[#F5F8FD] text-[#122654]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{client.name}</div>
                      <div className="text-[10px] text-[#4A5878] truncate">
                        #{client.company_no} • {client.company_type}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            <div className="p-2 border-t border-[#E3E7EF] bg-[#F5F8FD] flex flex-col gap-1.5">
              {onAddNewCompany && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAddNewCompany();
                  }}
                  className="w-full py-1.5 px-3 bg-white hover:bg-[#FFF1EE] border border-[#D3DCEE] hover:border-[#FF7A66] rounded-[8px] text-[11px] font-bold text-[#122654] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF7A66]" />
                  <span>+ Setup New Company</span>
                </button>
              )}
              <Link
                href="/clients"
                onClick={() => setOpen(false)}
                className="text-[10px] text-center text-[#4A5878] hover:text-[#B8432F] font-semibold py-0.5 hover:underline"
              >
                Manage or delete companies →
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Header / Dashboard variant
  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="min-h-[38px] px-3 bg-[#F5F8FD] hover:bg-[#EEF1F7] border border-[#D3DCEE] hover:border-[#FF7A66] rounded-[10px] flex items-center gap-2.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF7A66]"
      >
        <div className="w-6 h-6 rounded-md bg-[#122654] text-white flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-[#FF7A66]" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-[#122654] max-w-[160px] sm:max-w-[200px] truncate leading-tight">
            {activeCompany.name}
          </span>
          <span className="text-[10px] text-[#4A5878] truncate leading-tight">
            Co #{activeCompany.company_no}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#4A5878] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 mt-2 z-50 w-72 sm:w-80 bg-white text-[#122654] rounded-[16px] shadow-2xl border border-[#E3E7EF] overflow-hidden animate-in fade-in zoom-in-95"
        >
          <div className="p-3 border-b border-[#E3E7EF] bg-[#F5F8FD]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#4A5878] mb-2 flex items-center justify-between">
              <span>Switch Active Company</span>
              <span className="text-[#FF7A66] font-semibold">Live Scoping</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#4A5878] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input aria-label="Search company name or number"
                type="text"
                placeholder="Search company name or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px] outline-none text-[#122654] focus:border-[#FF7A66]"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 flex flex-col gap-1 text-xs">
            {filteredClients.map((client) => {
              const isSelected = client.id === activeCompany.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectCompany(client.id)}
                  className={`p-2.5 rounded-[10px] text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EAF5FC] text-[#1D4E89] font-bold border border-[#1D4E89]/20'
                      : 'hover:bg-[#F5F8FD] text-[#122654]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{client.name}</div>
                    <div className="text-[11px] text-[#4A5878] truncate mt-0.5">
                      #{client.company_no} • {client.company_type}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#1D4E89] shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>

          <div className="p-2.5 border-t border-[#E3E7EF] bg-[#F5F8FD] flex flex-col gap-1.5">
            {onAddNewCompany && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAddNewCompany();
                }}
                className="w-full py-2 px-3 bg-white hover:bg-[#FFF1EE] border border-[#D3DCEE] hover:border-[#FF7A66] rounded-[10px] text-xs font-bold text-[#122654] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#FF7A66]" />
                <span>+ Register New Client Company</span>
              </button>
            )}
            <Link
              href="/clients"
              onClick={() => setOpen(false)}
              className="text-[11px] text-center text-[#4A5878] hover:text-[#B8432F] font-semibold py-0.5 hover:underline"
            >
              Manage or delete companies →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
