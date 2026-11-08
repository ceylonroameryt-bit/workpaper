'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { STANDARDS, requiredSchedules } from '@/lib/standards';
import { templateFor } from '@/lib/workpapers/templates';

export default function StandardsLibraryPage() {
  // Versions in force today, one card per standard; older versions are listed under each
  const standards = STANDARDS.filter((s) => !s.effective_to).map((s) => ({
    id: s.id,
    name: s.name,
    version: `${s.version} · periods ending from ${s.effective_from}`,
    status: 'In force',
    requiredSchedules: requiredSchedules(s).map((ref) => `${ref} ${templateFor(ref)?.title ?? ''}`.trim()),
    sections: s.disclosures.map((d) => ({ code: d.code, title: d.title, requirements: d.requirement })),
    earlier: STANDARDS.filter((o) => o.code === s.code && o.effective_to).map((o) => `${o.version} (to ${o.effective_to})`),
  }));
  const [selectedStandard, setSelectedStandard] = useState(standards[0].id);

  const current = standards.find((s) => s.id === selectedStandard) || standards[0];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-[#E3E7EF] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#122654]">Accounting Standards Library (STD-01)</h1>
            <span className="text-xs bg-[#122654] text-white px-2.5 py-1 rounded-full font-mono font-semibold">
              UK GAAP
            </span>
          </div>
          <p className="text-xs text-[#4A5878] mt-1">
            Maintained UK accounting standards governing schedule generation, lease models, and statutory disclosures.
          </p>
        </div>
      </div>

      {/* 2024 Amendments Notification Banner (STD-01) */}
      <div className="bg-[#FFF1EE] border border-[#FF7A66]/40 p-4 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#FF7A66] shrink-0 mt-0.5" />
        <div className="text-xs text-[#A23A27] leading-relaxed">
          <strong>FRS 102 Updated (2024 Amendments):</strong> Leases starting on or after 1 January 2026 now transition to the on-balance-sheet Right-of-Use model in schedule REC-04. Micro-entities under FRS 105 continue under commitment disclosure rules.
        </div>
      </div>

      {/* Standards Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {standards.map((std) => (
          <div
            key={std.id}
            onClick={() => setSelectedStandard(std.id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedStandard === std.id
                ? 'bg-white border-[#122654] shadow-md ring-1 ring-[#122654]'
                : 'bg-white border-[#E3E7EF] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#122654]">{std.name}</span>
              {selectedStandard === std.id && <CheckCircle2 className="w-4 h-4 text-[#0B6B52]" />}
            </div>
            <div className="text-[11px] text-[#7E8DA6] mt-1 font-mono">{std.version}</div>
            <div className="mt-3 text-[10px] bg-[#F5F8FD] p-2 rounded text-[#4A5878]">
              {std.requiredSchedules.length} Required Schedules
            </div>
          </div>
        ))}
      </div>

      {/* Selected Standard Requirements Detail */}
      <div className="bg-white border border-[#E3E7EF] rounded-xl shadow-xs p-6 space-y-6">
        <div className="border-b border-[#E3E7EF] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#122654]">{current.name}</h2>
            <p className="text-xs text-[#4A5878]">{current.version}</p>
            {current.earlier.length > 0 && <p className="text-[11px] text-[#7E8DA6]">Earlier versions: {current.earlier.join(', ')}</p>}
          </div>
          <span className="text-xs font-bold text-[#0B6B52] bg-[#E6F4EF] px-2.5 py-1 rounded-full">
            {current.status}
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-[#122654] uppercase tracking-wider">Required schedules ({current.requiredSchedules.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {current.requiredSchedules.map((r) => (
              <span key={r} className="text-[11px] bg-[#F5F8FD] border border-[#E3E7EF] rounded px-2 py-0.5 text-[#122654]">{r}</span>
            ))}
          </div>
        </div>

        {/* Requirements List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#122654] uppercase tracking-wider">
            Mandatory Sections &amp; Disclosure Rules
          </div>
          <div className="divide-y divide-[#E3E7EF] border border-[#E3E7EF] rounded-xl overflow-hidden">
            {current.sections.map((sec, idx) => (
              <div key={idx} className="p-4 hover:bg-[#F5F8FD] transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-[#1D4E89] bg-[#EAF5FC] px-2 py-0.5 rounded">
                    {sec.code}
                  </span>
                  <span className="text-xs font-bold text-[#122654]">{sec.title}</span>
                </div>
                <p className="text-xs text-[#4A5878] mt-1.5 leading-relaxed">{sec.requirements}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
