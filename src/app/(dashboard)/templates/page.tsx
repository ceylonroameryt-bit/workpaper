'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
  Upload,
  Plus,
  FileText,
  Layers,
  Search,
  X,
  ChevronRight,
  Sliders,
  Edit3,
  Copy,
  Save,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';
import { TEMPLATES, PACKS, TemplateDef } from '@/lib/workpapers/templates';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';

const COMPANY_TYPES = [
  'Sole trader',
  'Partnership',
  'LLP',
  'Micro · FRS 105',
  'Small · FRS 102 1A',
  'Medium/large · FRS 102',
  'IFRS',
  'Charity · SORP',
  'Academy',
] as const;

type CompanyType = (typeof COMPANY_TYPES)[number];

const COMPANY_TYPE_TO_PACK_KEY: Record<CompanyType, string> = {
  'Sole trader': 'Sole trader',
  'Partnership': 'Partnership',
  'LLP': 'LLP (FRS 102 + LLP SORP)',
  'Micro · FRS 105': 'Micro-entity (FRS 105)',
  'Small · FRS 102 1A': 'Small company (FRS 102 1A)',
  'Medium/large · FRS 102': 'Medium/large (FRS 102)',
  'IFRS': 'IFRS company/group',
  'Charity · SORP': 'Charity (SORP)',
  'Academy': 'Academy',
};

// Initial firm templates
const INITIAL_FIRM_TEMPLATES: TemplateDef[] = [
  {
    ref: 'T-10',
    area: 'T',
    areaName: 'Tax',
    title: 'Corporation tax computation',
    version: 2,
    summary: 'Disallowables, capital allowances, CT charge.',
    objective: 'Confirm corporation tax liability is complete, agrees to tax computation, and capital allowances claims are substantiated.',
    assertions: ['Completeness', 'Accuracy', 'Valuation'],
    leads: [{ code: '2300', label: 'Corporation tax liability' }],
    creditArea: true,
    kind: 'lines',
    columns: [
      { key: 'amount', label: 'Per ledger' },
      { key: 'computation', label: 'Per tax computation', inTotal: false },
    ],
    procedures: [
      'Agree tax liability to the external corporation tax return (CT600).',
      'Test capital allowances claims against additions schedule.',
      'Check disallowable entertainment and depreciation add-backs.',
    ],
  },
  {
    ref: 'F-12',
    area: 'F',
    areaName: 'Fixed assets',
    title: 'Right-of-use lease assets (IFRS 16 / FRS 102)',
    version: 1,
    summary: 'Lease liability reconciliation, discount rate, depreciation.',
    objective: 'Verify right-of-use assets and lease liabilities are recognized in line with lease agreements and discount rates.',
    assertions: ['Existence', 'Rights', 'Valuation', 'Completeness'],
    leads: [
      { code: '1550', label: 'ROU Assets' },
      { code: '2150', label: 'Lease obligations' },
    ],
    kind: 'lines',
    columns: [
      { key: 'asset_val', label: 'ROU Asset' },
      { key: 'liability_val', label: 'Lease liability' },
    ],
    procedures: [
      'Inspect master lease agreement and test payment schedule.',
      'Recalculate present value of lease payments using incremental borrowing rate.',
      'Verify depreciation charge on ROU asset over lease term.',
    ],
  },
];

// Initial drafts
const INITIAL_DRAFTS: TemplateDef[] = [
  {
    ref: 'R-10',
    area: 'R',
    areaName: 'R&D Tax Credits',
    title: 'SME R&D Tax Relief Schedule',
    version: 1,
    summary: 'Qualifying staff costs, subcontractors, HMRC notification.',
    objective: 'Validate qualifying expenditure for SME R&D tax credit claims.',
    assertions: ['Occurrence', 'Accuracy', 'Compliance'],
    leads: [{ code: '6250', label: 'R&D Staff Costs' }],
    kind: 'lines',
    columns: [
      { key: 'project', label: 'Project Name', money: false, inTotal: false },
      { key: 'cost', label: 'Qualifying Spend' },
    ],
    procedures: [
      'Review technical narrative against DSIT guidance for scientific advancement.',
      'Vouch staff time allocations to payroll and timesheets.',
    ],
  },
  {
    ref: 'V-10',
    area: 'V',
    areaName: 'Cryptocurrency & Digital Assets',
    title: 'Digital Assets and Token Holdings',
    version: 1,
    summary: 'Wallet keys, exchange balances, fair value accounting.',
    objective: 'Confirm ownership of private keys and year-end valuation of digital assets.',
    assertions: ['Rights', 'Existence', 'Valuation'],
    leads: [{ code: '1350', label: 'Digital Token Holdings' }],
    kind: 'lines',
    columns: [
      { key: 'tokens', label: 'Token Quantity', money: false, inTotal: false },
      { key: 'val_gbp', label: 'Fair Value (GBP)' },
    ],
    procedures: [
      'Verify wallet ownership via signed micro-transaction.',
      'Obtain closing spot rate from approved UK benchmark pricing source.',
    ],
  },
];

export default function TemplatesCatalogPage() {
  const { activeEngagement } = useCompany();

  // Active top tab
  const [activeTab, setActiveTab] = useState<'by_type' | 'by_area' | 'firm' | 'drafts'>('by_type');

  // Active company type filter
  const [selectedType, setSelectedType] = useState<CompanyType>('Small · FRS 102 1A');

  // Active area filter (for By Area tab)
  const [selectedArea, setSelectedArea] = useState<string>('All');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Pack customization state: track enabled refs for each pack
  const [packCustomizations, setPackCustomizations] = useState<Record<string, string[]>>({
    'Small company (FRS 102 1A)': [
      'A-10',
      'B-10',
      'C-10',
      'F-10',
      'K-10',
      'T-10',
      'Z-10',
    ],
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Template preview modal
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDef | null>(null);

  // New firm template modal
  const [newTemplateModalOpen, setNewTemplateModalOpen] = useState(false);
  const [newTplRef, setNewTplRef] = useState('F-15');
  const [newTplArea, setNewTplArea] = useState('F');
  const [newTplAreaName, setNewTplAreaName] = useState('Fixed assets');
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplSummary, setNewTplSummary] = useState('');
  const [newTplObjective, setNewTplObjective] = useState('');
  const [newTplKind, setNewTplKind] = useState<'reconciliation' | 'assets' | 'lines' | 'checklist'>('lines');
  const [newTplProcedures, setNewTplProcedures] = useState('Agree ledger balance to trial balance.\nVouch a sample of additions over materiality.');

  // Import template modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Firm templates list
  const [firmTemplates, setFirmTemplates] = useState<TemplateDef[]>(INITIAL_FIRM_TEMPLATES);
  const [draftTemplates, setDraftTemplates] = useState<TemplateDef[]>(INITIAL_DRAFTS);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper for pack papers
  const packKey = COMPANY_TYPE_TO_PACK_KEY[selectedType];
  const defaultPackPapers = PACKS[packKey] || ['A-10', 'B-10', 'C-10', 'Z-10'];
  const currentPackPapers = packCustomizations[packKey] ?? defaultPackPapers;

  const togglePackPaper = (ref: string) => {
    setPackCustomizations((prev) => {
      const existing = prev[packKey] ?? defaultPackPapers;
      const next = existing.includes(ref) ? existing.filter((r) => r !== ref) : [...existing, ref];
      return { ...prev, [packKey]: next };
    });
  };

  const handleSavePack = () => {
    showToast(`${selectedType} pack configuration saved successfully as v4!`);
  };

  const handleCreateFirmTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplTitle.trim()) return;

    const tpl: TemplateDef = {
      ref: newTplRef.trim().toUpperCase(),
      area: newTplArea.toUpperCase(),
      areaName: newTplAreaName,
      title: newTplTitle.trim(),
      version: 1,
      summary: newTplSummary.trim() || 'Custom firm methodology workpaper.',
      objective: newTplObjective.trim() || 'Standard testing and verification.',
      assertions: ['Existence', 'Accuracy', 'Completeness'],
      leads: [],
      kind: newTplKind,
      procedures: newTplProcedures
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean),
    };

    setFirmTemplates((prev) => [tpl, ...prev]);
    setNewTemplateModalOpen(false);
    setNewTplTitle('');
    setNewTplSummary('');
    setNewTplObjective('');
    setActiveTab('firm');
    showToast(`Template ${tpl.ref} "${tpl.title}" published to Firm templates!`);
  };

  const handleImportTemplate = () => {
    if (!importText.trim()) return;
    try {
      const parsed = JSON.parse(importText);
      if (parsed.ref && parsed.title) {
        setFirmTemplates((prev) => [parsed, ...prev]);
        setImportModalOpen(false);
        setImportText('');
        setActiveTab('firm');
        showToast(`Template ${parsed.ref} successfully imported!`);
        return;
      }
    } catch {
      // not json, simulate template import
    }
    const simulated: TemplateDef = {
      ref: 'M-10',
      area: 'M',
      areaName: 'Management',
      title: 'Imported Methodology Checklist',
      version: 1,
      summary: 'Imported from firm library package.',
      objective: 'Verify management accounts reconciliation and compliance.',
      assertions: ['Completeness', 'Accuracy'],
      leads: [],
      kind: 'checklist',
      procedures: ['Verify management reconciliations.', 'Check analytical variances.'],
    };
    setFirmTemplates((prev) => [simulated, ...prev]);
    setImportModalOpen(false);
    setImportText('');
    setActiveTab('firm');
    showToast('Package imported successfully into Firm templates!');
  };

  // Areas list
  const ALL_AREAS = [
    { code: 'All', name: 'All areas (10)' },
    { code: 'A', name: 'A Planning & materiality' },
    { code: 'B', name: 'B Cash and bank' },
    { code: 'C', name: 'C Debtors' },
    { code: 'D', name: 'D Stock and WIP' },
    { code: 'E', name: 'E Equity and reserves' },
    { code: 'F', name: 'F Fixed assets' },
    { code: 'I', name: 'I Revenue & income' },
    { code: 'K', name: 'K Creditors & accruals' },
    { code: 'P', name: 'P Costs and overheads' },
    { code: 'T', name: 'T Taxation (VAT, PAYE, CT)' },
    { code: 'Z', name: 'Z Completion checklists' },
  ];

  // Filtering templates for display
  let displayedTemplates: TemplateDef[] = [];

  if (activeTab === 'by_type') {
    // Show templates relevant to company type (or built-in set)
    displayedTemplates = TEMPLATES.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ref.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.areaName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  } else if (activeTab === 'by_area') {
    displayedTemplates = TEMPLATES.filter((t) => {
      const matchArea = selectedArea === 'All' || t.area === selectedArea;
      if (!matchArea) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ref.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  } else if (activeTab === 'firm') {
    displayedTemplates = firmTemplates.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ref.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  } else if (activeTab === 'drafts') {
    displayedTemplates = draftTemplates.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ref.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  // Pack checklist definition for the sidebar
  const PACK_CHECKLIST = [
    { ref: 'A-10', area: 'A', name: 'A Planning', count: 3, note: '' },
    { ref: 'B-10', area: 'B', name: 'B Cash and bank', count: 2, note: '' },
    { ref: 'C-10', area: 'C', name: 'C Debtors', count: 3, note: '' },
    { ref: 'D-10', area: 'D', name: 'D Stock', count: 2, note: 'only if stock' },
    { ref: 'F-10', area: 'F', name: 'F Fixed assets', count: 2, note: '' },
    { ref: 'K-10', area: 'K', name: 'K Creditors', count: 3, note: '' },
    { ref: 'T-10', area: 'T', name: 'T Tax', count: 2, note: '' },
    { ref: 'Z-10', area: 'Z', name: 'Z Completion', count: 3, note: '' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#122654] text-white text-xs font-semibold rounded-[10px] shadow-xl border border-[#23427E] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <CheckCircle2 className="w-4 h-4 text-[#FF7A66]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section matching Page 13 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#4A5878] mb-1 font-medium">
            <span>Library</span>
            <span className="text-[#A2ADBF]">›</span>
            <span className="text-[#122654] font-semibold">Templates</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#122654] tracking-tight">Templates</h1>
          <p className="text-xs sm:text-sm text-[#4A5878] mt-1.5 max-w-3xl leading-relaxed">
            Every template follows the same shape, whatever the company type. Packs pick the right papers for each
            type, so a small company and a charity feel familiar even though the content differs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="min-h-[38px] px-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#122654] bg-white border border-[#D3DCEE] hover:border-[#122654] rounded-[8px] transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-[#4A5878]" /> Import template
          </button>
          <button
            type="button"
            onClick={() => setNewTemplateModalOpen(true)}
            className="min-h-[38px] px-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#122654] hover:bg-[#1A3B7C] rounded-[8px] transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New firm template
          </button>
        </div>
      </div>

      {/* Flow Banner Card: One shape for every working paper */}
      <div className="blynt-card p-4 sm:p-5 bg-[#F5F8FD] border border-[#E3E7EF] rounded-[14px]">
        <div className="text-xs font-bold text-[#122654] mb-3">One shape for every working paper</div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {[
            '1 Objective',
            '2 Lead figures from Blynt chart',
            '3 Schedule',
            '4 Checks',
            '5 Procedures',
            '6 Evidence',
            '7 Conclusion',
            '8 Sign-off',
          ].map((step, idx, arr) => (
            <React.Fragment key={step}>
              <div className="px-3 py-1.5 bg-white border border-[#D3DCEE] rounded-[8px] font-semibold text-[#122654] shadow-2xs whitespace-nowrap">
                {step}
              </div>
              {idx < arr.length - 1 && <span className="text-[#A2ADBF] font-mono select-none">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center justify-between border-b border-[#E3E7EF] flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('by_type')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
              activeTab === 'by_type'
                ? 'border-[#122654] text-[#122654]'
                : 'border-transparent text-[#4A5878] hover:text-[#122654]'
            }`}
          >
            By company type
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('by_area')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'by_area'
                ? 'border-[#122654] text-[#122654]'
                : 'border-transparent text-[#4A5878] hover:text-[#122654]'
            }`}
          >
            <span>By area</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#EAEFF8] text-[#122654] font-bold">10</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('firm')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'firm'
                ? 'border-[#122654] text-[#122654]'
                : 'border-transparent text-[#4A5878] hover:text-[#122654]'
            }`}
          >
            <span>Firm templates</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#EAEFF8] text-[#122654] font-bold">
              {firmTemplates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'drafts'
                ? 'border-[#122654] text-[#122654]'
                : 'border-transparent text-[#4A5878] hover:text-[#122654]'
            }`}
          >
            <span>Drafts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#EAEFF8] text-[#122654] font-bold">
              {draftTemplates.length}
            </span>
          </button>
        </div>

        {/* Quick search */}
        <div className="relative min-w-[200px] mb-2 sm:mb-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7E8DA6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654] placeholder-[#7E8DA6] outline-none focus:border-[#122654]"
          />
        </div>
      </div>

      {/* Sub-Filters: Company Type Pill Selector (when on by_type) */}
      {activeTab === 'by_type' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-2">
          {COMPANY_TYPES.map((type) => {
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#122654] text-white shadow-sm'
                    : 'bg-white text-[#4A5878] border border-[#D3DCEE] hover:border-[#122654] hover:text-[#122654]'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Filters: Area Selector (when on by_area) */}
      {activeTab === 'by_area' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-2">
          {ALL_AREAS.map((a) => {
            const isSelected = selectedArea === a.code;
            return (
              <button
                key={a.code}
                type="button"
                onClick={() => setSelectedArea(a.code)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#122654] text-white shadow-sm'
                    : 'bg-white text-[#4A5878] border border-[#D3DCEE] hover:border-[#122654] hover:text-[#122654]'
                }`}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Main 2-Column Content Layout matching Page 13 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Template Cards Grid */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedTemplates.map((t) => {
              const isAiExtraction = t.ref === 'B-10';
              const isFirmEdit = t.ref === 'T-10' || activeTab === 'firm';

              // Metadata line: determine bindings or sample files
              let metaInfo = `v${t.version}`;
              if (t.ref === 'A-10' || t.ref === 'Z-10') {
                metaInfo += ' · used in 18 files';
              } else if (t.leads && t.leads.length > 0) {
                metaInfo += ` · Blynt ${t.leads[0].code}${t.leads.length > 1 ? `–${t.leads[t.leads.length - 1].code}` : ''}`;
              } else {
                metaInfo += ' · all types';
              }

              return (
                <div
                  key={t.ref}
                  onClick={() => setPreviewTemplate(t)}
                  className="blynt-card p-5 bg-white border border-[#E3E7EF] hover:border-[#122654] hover:shadow-md transition-all cursor-pointer rounded-[12px] flex flex-col justify-between group"
                >
                  <div>
                    <div className="text-xs font-mono font-bold text-[#7E8DA6] mb-1 group-hover:text-[#122654] transition-colors">
                      {t.ref}
                    </div>
                    <h3 className="text-sm font-bold text-[#122654] group-hover:text-[#FF7A66] transition-colors">
                      {t.title}
                    </h3>
                    <p className="text-xs text-[#4A5878] mt-1 leading-relaxed">{t.summary}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F0F3F9] flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-[#7E8DA6] font-mono">{metaInfo}</span>

                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F4EF] text-[#0B6B52]">
                        <Check className="w-2.5 h-2.5" /> Built-in
                      </span>

                      {t.allTypes && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F3F9] text-[#4A5878]">
                          All types
                        </span>
                      )}

                      {isAiExtraction && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF1EE] text-[#FF7A66]">
                          <Sparkles className="w-2.5 h-2.5" /> AI extraction
                        </span>
                      )}

                      {isFirmEdit && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4DB] text-[#8C5800]">
                          ◐ Firm edit
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayedTemplates.length === 0 && (
            <div className="p-8 text-center blynt-card bg-white border border-[#E3E7EF] rounded-[12px]">
              <FileText className="w-8 h-8 text-[#A2ADBF] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-[#122654]">No templates found</h4>
              <p className="text-xs text-[#4A5878] mt-1">Try clearing your search term or select another category.</p>
            </div>
          )}
        </div>

        {/* Right Column: Pack Configuration & Template Rules */}
        <div className="flex flex-col gap-5">
          {/* Pack Checklist Card matching Page 13 */}
          <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-[12px] shadow-sm">
            <h2 className="text-sm font-extrabold text-[#122654]">
              {selectedType.replace(' · FRS 102 1A', '').replace(' · FRS 105', '').replace(' · SORP', '')} pack
            </h2>
            <p className="text-xs text-[#4A5878] mt-1 leading-relaxed">
              Tick the papers new engagements start with. Changes apply to new files only.
            </p>

            <div className="mt-4 flex flex-col divide-y divide-[#F0F3F9] border-y border-[#F0F3F9]">
              {PACK_CHECKLIST.map((item) => {
                const isChecked = currentPackPapers.includes(item.ref);
                return (
                  <label
                    key={item.ref}
                    className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-[#F5F8FD] px-1 rounded-[6px] transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePackPaper(item.ref)}
                        className="w-4 h-4 rounded border-[#D3DCEE] text-[#122654] focus:ring-[#122654]"
                      />
                      <span className={`text-xs ${isChecked ? 'font-bold text-[#122654]' : 'text-[#7E8DA6]'}`}>
                        {item.name} ({item.count})
                      </span>
                    </div>

                    {item.note && (
                      <span className="text-[10px] text-[#7E8DA6] font-medium">{item.note}</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={handleSavePack}
                className="w-full min-h-[38px] px-4 font-bold text-xs text-white bg-[#122654] hover:bg-[#1A3B7C] rounded-[8px] transition-colors shadow-sm"
              >
                Save pack as v4
              </button>
            </div>
          </div>

          {/* Template Rules Card matching Page 13 */}
          <div className="blynt-card p-5 bg-white border border-[#E3E7EF] rounded-[12px] shadow-sm">
            <h2 className="text-sm font-extrabold text-[#122654] mb-3">Template rules</h2>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#E6F4EF] text-[#0B6B52] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <p className="text-xs text-[#4A5878] leading-relaxed">
                  Figures come from Blynt account codes, never typed
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#E6F4EF] text-[#0B6B52] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <p className="text-xs text-[#4A5878] leading-relaxed">
                  Every version is kept; files stay on the version they started with
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#E6F4EF] text-[#0B6B52] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <p className="text-xs text-[#4A5878] leading-relaxed">
                  A second admin approves before publishing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Preview / Detail Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="blynt-card p-6 bg-white border border-[#D3DCEE] rounded-[14px] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#122654] text-white">
                  {previewTemplate.ref}
                </span>
                <h3 className="text-lg font-bold text-[#122654]">{previewTemplate.title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F0F3F9] text-[#4A5878] rounded-full">
                  v{previewTemplate.version}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1 text-[#7E8DA6] hover:text-[#122654] rounded-[6px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="font-bold text-[#122654] block mb-1">Objective</span>
                <p className="text-[#4A5878] bg-[#F5F8FD] p-2.5 rounded-[8px] border border-[#E3E7EF]">
                  {previewTemplate.objective}
                </p>
              </div>

              {previewTemplate.assertions && previewTemplate.assertions.length > 0 && (
                <div>
                  <span className="font-bold text-[#122654] block mb-1">Assertions Tested</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {previewTemplate.assertions.map((ass) => (
                      <span key={ass} className="px-2 py-0.5 rounded-[6px] bg-[#EAEFF8] text-[#122654] font-semibold">
                        {ass}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {previewTemplate.leads && previewTemplate.leads.length > 0 && (
                <div>
                  <span className="font-bold text-[#122654] block mb-1">Lead Figures Mapped From Blynt Chart</span>
                  <div className="flex flex-col gap-1">
                    {previewTemplate.leads.map((l) => (
                      <div
                        key={l.code}
                        className="flex items-center justify-between p-2 rounded-[6px] bg-[#F5F8FD] border border-[#E3E7EF]"
                      >
                        <span className="font-mono font-bold text-[#122654]">{l.code}xx</span>
                        <span className="text-[#4A5878]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="font-bold text-[#122654] block mb-1">Key procedures ({previewTemplate.procedures.length})</span>
                <ol className="list-decimal list-inside space-y-1 text-[#4A5878]">
                  {previewTemplate.procedures.map((p, i) => (
                    <li key={i} className="pl-1 leading-relaxed">
                      {p}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-[#E3E7EF] flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#7E8DA6]">Schedule Layout: {previewTemplate.kind}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#4A5878] hover:text-[#122654]"
                >
                  Close
                </button>
                {activeEngagement && (
                  <Link
                    href={`/engagements/${activeEngagement.id}/workpapers`}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#122654] hover:bg-[#1A3B7C] rounded-[8px]"
                  >
                    View in Engagement
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Firm Template Modal */}
      {newTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="blynt-card p-6 bg-white border border-[#D3DCEE] rounded-[14px] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <h3 className="text-base font-bold text-[#122654]">Create New Firm Template</h3>
              <button
                type="button"
                onClick={() => setNewTemplateModalOpen(false)}
                className="p-1 text-[#7E8DA6] hover:text-[#122654] rounded-[6px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFirmTemplate} className="flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-bold text-[#122654]">Paper Reference</span>
                  <input
                    type="text"
                    required
                    value={newTplRef}
                    onChange={(e) => setNewTplRef(e.target.value)}
                    placeholder="e.g. F-15"
                    className="p-2 border border-[#D3DCEE] rounded-[8px] font-mono text-[#122654]"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-bold text-[#122654]">Area</span>
                  <select
                    value={newTplArea}
                    onChange={(e) => {
                      setNewTplArea(e.target.value);
                      const a = ALL_AREAS.find((x) => x.code === e.target.value);
                      if (a) setNewTplAreaName(a.name.slice(2));
                    }}
                    className="p-2 border border-[#D3DCEE] rounded-[8px] bg-white text-[#122654]"
                  >
                    {ALL_AREAS.filter((a) => a.code !== 'All').map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#122654]">Template Title</span>
                <input
                  type="text"
                  required
                  value={newTplTitle}
                  onChange={(e) => setNewTplTitle(e.target.value)}
                  placeholder="e.g. Right-of-use asset schedule"
                  className="p-2 border border-[#D3DCEE] rounded-[8px] text-[#122654]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#122654]">Subtitle / Summary</span>
                <input
                  type="text"
                  value={newTplSummary}
                  onChange={(e) => setNewTplSummary(e.target.value)}
                  placeholder="Brief summary shown on card"
                  className="p-2 border border-[#D3DCEE] rounded-[8px] text-[#122654]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#122654]">Objective</span>
                <textarea
                  rows={2}
                  value={newTplObjective}
                  onChange={(e) => setNewTplObjective(e.target.value)}
                  placeholder="Objective statement"
                  className="p-2 border border-[#D3DCEE] rounded-[8px] text-[#122654]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#122654]">Schedule Type</span>
                <select
                  value={newTplKind}
                  onChange={(e) => setNewTplKind(e.target.value as any)}
                  className="p-2 border border-[#D3DCEE] rounded-[8px] bg-white text-[#122654]"
                >
                  <option value="lines">Lines Schedule (Multi-column ledgers & aging)</option>
                  <option value="reconciliation">Bank / Ledger Reconciliation</option>
                  <option value="assets">Fixed Assets & Depreciation Matrix</option>
                  <option value="checklist">Procedures checklist</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#122654]">Procedures (one per line)</span>
                <textarea
                  rows={3}
                  value={newTplProcedures}
                  onChange={(e) => setNewTplProcedures(e.target.value)}
                  className="p-2 border border-[#D3DCEE] rounded-[8px] text-[#122654] font-mono text-[11px]"
                />
              </label>

              <div className="mt-2 pt-3 border-t border-[#E3E7EF] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewTemplateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#4A5878]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#122654] hover:bg-[#1A3B7C] rounded-[8px]"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Template Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="blynt-card p-6 bg-white border border-[#D3DCEE] rounded-[14px] max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E3E7EF] pb-3">
              <h3 className="text-base font-bold text-[#122654]">Import Template Package</h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 text-[#7E8DA6] hover:text-[#122654] rounded-[6px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <p className="text-[#4A5878]">
                Paste a Blynt template JSON package definition or select an official pack to import into your firm library.
              </p>

              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Paste template JSON or leave blank to import the standard "Management Review Pack"...'
                className="p-2.5 border border-[#D3DCEE] rounded-[8px] font-mono text-[11px] text-[#122654]"
              />
            </div>

            <div className="pt-3 border-t border-[#E3E7EF] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-[#4A5878]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportTemplate}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#122654] hover:bg-[#1A3B7C] rounded-[8px]"
              >
                Import to Firm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
