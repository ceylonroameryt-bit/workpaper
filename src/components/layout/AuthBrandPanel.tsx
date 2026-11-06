import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BlyntLogo } from '@/components/ui/BlyntLogo';

/** The navy Blynt panel on the left of the sign-in and two-factor pages. */
export function AuthBrandPanel() {
  return (
    <div className="lg:col-span-6 xl:col-span-5 bg-[#0B1A3B] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
      <div>
        <div className="mb-16">
          <BlyntLogo variant="full" theme="dark" size="lg" />
        </div>

        <div className="max-w-[420px]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF7A66] bg-[#122654] px-3 py-1 rounded-full border border-[#FF7A66]/30 inline-block mb-4">
            UK Cloud Accounting &amp; Workpapers
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Financial workpapers built with zero fluff
          </h1>
          <p className="text-sm text-[#A6B4D0] leading-relaxed mb-8">
            One unified Blynt account for client bookkeeping, VAT, annual statutory accounts, and transparent working papers.
          </p>

          <div className="flex flex-col gap-3.5 text-xs text-[#A6B4D0]">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Strict integer pence precision</strong>: Zero floating-point rounding anomalies.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">AI suggests, people decide</strong>: Full lineage and explicit named sign-offs.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Append-only activity log</strong>: every change records who, when and why.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-[#122654] text-xs text-[#7E8DA6] flex items-center justify-between">
        <span>Blynt Technologies UK Ltd</span>
        <span>SOC 2 Type II • WCAG 2.2 AA</span>
      </div>
    </div>
  );
}
