'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Users,
  Palette,
  Sparkles,
  Lock,
  Check,
  Save,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  X,
  Plus,
  HelpCircle,
  Mail,
  Building2,
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { useCompany } from '@/context/CompanyContext';

export default function PracticeSettingsPage() {
  const { refreshCompanyData } = useCompany();

  const [activeTab, setActiveTab] = useState<'defaults' | 'roles' | 'rules' | 'branding' | 'security'>('defaults');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'rules' || tab === 'ai-rules') setActiveTab('rules');
      else if (tab === 'roles' || tab === 'users') setActiveTab('roles');
      else if (tab === 'branding') setActiveTab('branding');
      else if (tab === 'security') setActiveTab('security');
      else if (tab === 'defaults') setActiveTab('defaults');
    }
  }, []);

  // ADM-02 Practice Defaults
  const [signOffLevels, setSignOffLevels] = useState<'3' | '2'>('3');
  const [reconciliationTolerance, setReconciliationTolerance] = useState('1.00');
  const [materialityThreshold, setMaterialityThreshold] = useState('5000.00');
  const [capitalisationThreshold, setCapitalisationThreshold] = useState('500.00');
  const [aiReadyThreshold, setAiReadyThreshold] = useState('90');
  const [aiCheckThreshold, setAiCheckThreshold] = useState('70');
  const [deadlineAlertDays, setDeadlineAlertDays] = useState('30');

  // Confirmation modal for ADM-02
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // ADM-01 Users & Roles
  const [usersList, setUsersList] = useState(() => [...db.users]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'preparer' | 'reviewer' | 'partner' | 'admin'>('preparer');
  const [inviteScope, setInviteScope] = useState<'all' | 'assigned'>('all');
  const [inviteError, setInviteError] = useState('');
  const [inviteClientIds, setInviteClientIds] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  // DAT-09 Shared Rules Library & DAT-05 Mapping Rules
  const [rulesList, setRulesList] = useState<any[]>(() => {
    if (db.learned_rules.length > 0) return [...db.learned_rules];
    return [
      {
        id: 'rule_1',
        firm_id: 'firm_blynt_uk',
        type: 'mapping',
        pattern: '*Plant*Machinery*',
        scope: 'practice',
        target_value: '1500 Plant & Equipment Cost',
        created_by: 'usr_test_reviewer',
        created_by_name: 'Audit Manager',
        created_at: '2026-09-01T10:00:00Z',
        times_used: 412,
        active: true,
        approved_by_manager: true,
      },
      {
        id: 'rule_2',
        firm_id: 'firm_blynt_uk',
        type: 'mapping',
        pattern: '*Director*Loan*',
        scope: 'practice',
        target_value: "835b Director's Loan Account",
        created_by: 'usr_test_reviewer',
        created_by_name: 'Audit Manager',
        created_at: '2026-09-01T10:00:00Z',
        times_used: 285,
        active: true,
        approved_by_manager: true,
      },
      {
        id: 'rule_3',
        firm_id: 'firm_blynt_uk',
        client_id: 'cli_harlow',
        type: 'mapping',
        pattern: '*Barclays*Current*',
        scope: 'client',
        target_value: '1010 Barclays Operating Account',
        created_by: 'usr_test_preparer',
        created_by_name: 'Senior Associate',
        created_at: '2026-09-15T11:00:00Z',
        times_used: 24,
        active: true,
        approved_by_manager: true,
      },
      {
        id: 'rule_4',
        firm_id: 'firm_blynt_uk',
        client_id: 'cli_harlow',
        type: 'mapping',
        pattern: '*Rent*Unit*4*',
        scope: 'client',
        target_value: '6000 London Office Rent and Service',
        created_by: 'usr_test_preparer',
        created_by_name: 'Senior Associate',
        created_at: '2026-09-20T14:30:00Z',
        times_used: 12,
        active: true,
        approved_by_manager: true,
      },
      {
        id: 'rule_5',
        firm_id: 'firm_blynt_uk',
        supplier_name: 'Dell Technologies UK',
        type: 'extraction',
        pattern: '*Dell Technologies*PowerEdge*',
        scope: 'supplier',
        target_value: 'REC-03: Fixed Assets Addition (Computer equipment)',
        created_by: 'usr_test_reviewer',
        created_by_name: 'Audit Manager',
        created_at: '2026-10-01T09:00:00Z',
        times_used: 18,
        active: true,
        approved_by_manager: true,
      },
      {
        id: 'rule_6',
        firm_id: 'firm_blynt_uk',
        type: 'mapping',
        pattern: '*Software*SaaS*Monthly*',
        scope: 'practice',
        target_value: '6000 Subscriptions & Software',
        created_by: 'usr_test_preparer',
        created_by_name: 'Senior Associate',
        created_at: '2026-10-25T16:00:00Z',
        times_used: 6,
        active: true,
        approved_by_manager: false, // Pending manager approval (DAT-09 criteria 5)
      },
    ];
  });
  const [ruleScopeFilter, setRuleScopeFilter] = useState<'all' | 'supplier' | 'client' | 'practice'>('all');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<'all' | 'mapping' | 'extraction' | 'proposal' | 'finding'>('all');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleTarget, setNewRuleTarget] = useState('1500 Plant & Equipment Cost');
  const [newRuleScope, setNewRuleScope] = useState<'supplier' | 'client' | 'practice'>('practice');
  const [newRuleType, setNewRuleType] = useState<'mapping' | 'extraction' | 'proposal' | 'finding'>('mapping');

  // QTR-02 Branding
  const [brandPrimary, setBrandPrimary] = useState('#102654');
  const [brandAccent, setBrandAccent] = useState('#FF7D6B');
  const [brandFont, setBrandFont] = useState('Inter');
  const [footerDisclaimer, setFooterDisclaimer] = useState('Prepared by Blynt Practice & Co LLP under FRS 102 Section 1A. Registered in England & Wales.');
  const [logoUploaded, setLogoUploaded] = useState(true);

  // ADM-03 Security & Data
  const [hostingRegion, setHostingRegion] = useState('UK (London, eu-west-2)');
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [retentionYears, setRetentionYears] = useState('7');
  const [aiTrainingOptIn, setAiTrainingOptIn] = useState(false);

  const triggerSaveNotification = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleConfirmSave = (mode: 'new_only' | 'all') => {
    setShowSaveConfirmModal(false);
    triggerSaveNotification(
      mode === 'new_only'
        ? 'Settings saved successfully. Changes will apply to all new engagements.'
        : 'Settings saved and synced across all active practice engagements.'
    );
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInviteError('');
    setInviteClientIds([]);
    setInviteLink('');
  };

  // ADM-01: the server records the invite and returns a one-time link for the new user
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Please provide a valid name and professional email.');
      return;
    }
    const limited = inviteScope === 'assigned' && inviteRole !== 'partner' && inviteRole !== 'admin';
    if (limited && inviteClientIds.length === 0) {
      setInviteError('Choose at least one client, or give access to all clients.');
      return;
    }
    setInviteSending(true);
    setInviteError('');
    try {
      const res = await fetch('/api/v1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
          ...(limited ? { client_ids: inviteClientIds } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(body.error || 'Could not create the invitation.');
        return;
      }
      setInviteLink(body.link);
      triggerSaveNotification(`Invitation created for ${body.invite.email}. Send them the link to finish set-up.`);
    } catch {
      setInviteError('Could not reach the server. Please try again.');
    } finally {
      setInviteSending(false);
    }
  };

  const handleToggleRule = (id: string) => {
    setRulesList((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextActive = !r.active;
          const found = db.learned_rules.find((lr) => lr.id === id);
          if (found) found.active = nextActive;
          return { ...r, active: nextActive };
        }
        return r;
      })
    );
    triggerSaveNotification('Rule status updated.');
  };

  const handleApproveRule = (id: string) => {
    setRulesList((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const found = db.learned_rules.find((lr) => lr.id === id);
          if (found) found.approved_by_manager = true;
          return { ...r, approved_by_manager: true };
        }
        return r;
      })
    );
    triggerSaveNotification('Rule approved for practice-wide deployment (DAT-09).');
  };

  const handleDeleteRule = (id: string) => {
    setRulesList((prev) => prev.filter((r) => r.id !== id));
    db.learned_rules = db.learned_rules.filter((r) => r.id !== id);
    triggerSaveNotification('Rule deleted.');
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern.trim()) return;
    const rule = {
      id: `rule_${Date.now()}`,
      firm_id: 'firm_blynt_uk',
      type: newRuleType,
      pattern: newRulePattern.trim(),
      target_value: newRuleTarget,
      scope: newRuleScope,
      created_by: 'usr_test_reviewer',
      created_by_name: 'Audit Manager',
      created_at: new Date().toISOString(),
      times_used: 1,
      active: true,
      approved_by_manager: true,
    };
    db.learned_rules.unshift(rule as any);
    setRulesList([rule, ...rulesList]);
    setShowRuleModal(false);
    setNewRulePattern('');
    triggerSaveNotification(`Rule created for pattern: ${rule.pattern}`);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto pb-16">
      {/* Top Banner (Page 5 Screen Map) */}
      <div className="bg-white border border-[#E3E7EF] rounded-[20px] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-[#102654] tracking-tight">Practice Settings &amp; Defaults</h1>
            <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20 px-2.5 py-1 rounded-full font-mono font-bold">
              Blynt Practice &amp; Co LLP
            </span>
          </div>
          <p className="text-xs text-[#5B6478] mt-1.5 leading-relaxed">
            Configure firm-wide audit methodology, 3-level sign-off rules, AI confidence thresholds, white-label branding, and UK GDPR governance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSaveConfirmModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
        >
          <Save className="w-4 h-4 text-[#FF7D6B]" />
          <span>Save Changes</span>
        </button>
      </div>

      {savedToast && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedToast}</span>
          </div>
          <button type="button" onClick={() => setSavedToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation (ADM-01, ADM-02, DAT-05, QTR-02, ADM-03) */}
      <div className="flex items-center gap-2 border-b border-[#E3E7EF] pb-1 overflow-x-auto">
        <button
          id="tab-defaults"
          type="button"
          onClick={() => setActiveTab('defaults')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'defaults'
              ? 'border-[#FF7D6B] text-[#102654] bg-[#F6F7FB]/50 rounded-t-lg'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Sliders className="w-4 h-4 text-[#1D4E89]" />
          <span>Defaults &amp; Thresholds (ADM-02)</span>
        </button>

        <button
          id="tab-roles"
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'roles'
              ? 'border-[#FF7D6B] text-[#102654] bg-[#F6F7FB]/50 rounded-t-lg'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Users className="w-4 h-4 text-[#1D4E89]" />
          <span>Users &amp; Roles (ADM-01)</span>
        </button>

        <button
          id="tab-rules"
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'rules'
              ? 'border-[#FF7D6B] text-[#102654] bg-[#F6F7FB]/50 rounded-t-lg'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
          <span>AI Rules &amp; Accuracy (DAT-05)</span>
        </button>

        <button
          id="tab-branding"
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'branding'
              ? 'border-[#FF7D6B] text-[#102654] bg-[#F6F7FB]/50 rounded-t-lg'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Palette className="w-4 h-4 text-[#1D4E89]" />
          <span>Logo &amp; Branding (QTR-02)</span>
        </button>

        <button
          id="tab-security"
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#FF7D6B] text-[#102654] bg-[#F6F7FB]/50 rounded-t-lg'
              : 'border-transparent text-[#5B6478] hover:text-[#102654]'
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Security &amp; GDPR (ADM-03)</span>
        </button>
      </div>

      {/* TAB 1: Defaults & Thresholds (ADM-02) */}
      {activeTab === 'defaults' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 sm:p-8 space-y-8 max-w-4xl">
          <div className="border-b border-[#E3E7EF] pb-4">
            <h2 className="text-base font-bold text-[#102654]">Practice Engagement Defaults (ADM-02)</h2>
            <p className="text-xs text-[#5B6478] mt-0.5">
              Parameters enforced automatically on schedules, lead sheets, variance calculations, and statutory reviews.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-[#102654] mb-2">
                Default Sign-off Levels (REV-01)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    signOffLevels === '3'
                      ? 'border-[#102654] bg-[#F6F7FB] shadow-xs'
                      : 'border-[#E3E7EF] hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="signOff"
                    checked={signOffLevels === '3'}
                    onChange={() => setSignOffLevels('3')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-[#102654]">3 Levels: Preparer &gt; Manager &gt; Partner</div>
                    <div className="text-[11px] text-[#5B6478] mt-0.5">
                      Standard UK practice segregation of duties with required manager clearance before partner sign-off.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    signOffLevels === '2'
                      ? 'border-[#102654] bg-[#F6F7FB] shadow-xs'
                      : 'border-[#E3E7EF] hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="signOff"
                    checked={signOffLevels === '2'}
                    onChange={() => setSignOffLevels('2')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-[#102654]">2 Levels: Preparer &gt; Partner</div>
                    <div className="text-[11px] text-[#5B6478] mt-0.5">
                      Streamlined workflow suitable for sole practitioners and smaller practice setups.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
                <label className="block text-xs font-bold text-[#102654] mb-1">
                  Reconciliation Tolerance (£)
                </label>
                <input
                  type="text"
                  value={reconciliationTolerance}
                  onChange={(e) => setReconciliationTolerance(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654] focus:ring-1 focus:ring-[#1D4E89] outline-none"
                />
                <span className="text-[11px] text-[#7E8DA6] mt-1 block">
                  Default £1.00. Differences within tolerance are treated as Reconciled automatically.
                </span>
              </div>

              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
                <label className="block text-xs font-bold text-[#102654] mb-1">
                  Capitalisation Threshold (£)
                </label>
                <input
                  type="text"
                  value={capitalisationThreshold}
                  onChange={(e) => setCapitalisationThreshold(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654] focus:ring-1 focus:ring-[#1D4E89] outline-none"
                />
                <span className="text-[11px] text-[#7E8DA6] mt-1 block">
                  Expense transactions above this trigger the Capital vs Revenue detector (AIX-02).
                </span>
              </div>

              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
                <label className="block text-xs font-bold text-[#102654] mb-1">
                  AI &apos;Ready&apos; Confidence Threshold (%)
                </label>
                <input
                  type="number"
                  value={aiReadyThreshold}
                  onChange={(e) => setAiReadyThreshold(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654] focus:ring-1 focus:ring-[#1D4E89] outline-none"
                />
                <span className="text-[11px] text-[#7E8DA6] mt-1 block">
                  Suggestions at or above {aiReadyThreshold}% display as &apos;Ready&apos; for 1-click bulk confirmation (DAT-03).
                </span>
              </div>

              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
                <label className="block text-xs font-bold text-[#102654] mb-1">
                  Deadline Alert Days
                </label>
                <input
                  type="number"
                  value={deadlineAlertDays}
                  onChange={(e) => setDeadlineAlertDays(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654] focus:ring-1 focus:ring-[#1D4E89] outline-none"
                />
                <span className="text-[11px] text-[#7E8DA6] mt-1 block">
                  Highlight statutory filing deadlines within {deadlineAlertDays} days in amber/red on dashboard (ENG-05).
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Users & Roles (ADM-01) */}
      {activeTab === 'roles' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Team Roles &amp; Permissions (ADM-01)</h2>
              <p className="text-xs text-[#5B6478] mt-0.5">
                Practice users with role-based permissions: Preparer, Reviewer/Manager, Partner, and Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF7D6B]" />
              <span>Invite Team Member</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B1B3D] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Role &amp; Title</th>
                  <th className="py-3 px-4">Access Scope</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EF] text-[#102654]">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F6F7FB]/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#102654] text-white flex items-center justify-center font-bold text-[10px]">
                          {u.initials || 'U'}
                        </div>
                        <span className="font-bold text-[#102654]">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#5B6478]">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono font-bold bg-[#EAF5FC] text-[#1D4E89] px-2 py-0.5 rounded-full border border-[#1D4E89]/20 uppercase">
                        {u.title || 'Senior Auditor'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5B6478]">All Practice Clients</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Shared Rules Library & AI Accuracy (DAT-09, DAT-05, ADM-02) */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 sm:p-8 space-y-8">
          {/* Header */}
          <div className="border-b border-[#E3E7EF] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-[#102654]">Shared Rules Library (DAT-09)</h2>
                <span className="text-[10px] font-mono font-bold bg-[#EAF5FC] text-[#1D4E89] px-2 py-0.5 rounded-full border border-[#1D4E89]/20">
                  Rules run before AI
                </span>
              </div>
              <p className="text-xs text-[#5B6478] mt-0.5">
                Every correction is learned and becomes a rule at supplier, client or practice scope. Target accuracy: &gt;90%.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FF7D6B]" />
                <span>Add Rule</span>
              </button>
            </div>
          </div>

          {/* AI Performance & Confidence Gate Card (DAT-08, DAT-05, RPT-03) */}
          <div className="bg-[#F6F7FB] border border-[#E3E7EF] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF7D6B]" />
                  AI Accuracy Performance &amp; Auto-Accept Controls (DAT-08)
                </span>
                <p className="text-[11px] text-[#5B6478] mt-0.5">
                  Auto-accept is OFF at launch. Requires 3 consecutive months ≥90% accepted without change.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full w-max">
                Overall Accuracy: 94.2% (Target: ≥90%)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Account Mapping</div>
                <div className="text-lg font-mono font-bold text-emerald-700 mt-1">94.2%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Auto-accept: OFF (Month 1/3)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Document Extraction</div>
                <div className="text-lg font-mono font-bold text-emerald-700 mt-1">91.5%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Auto-accept: OFF (Month 1/3)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Proposed Journals</div>
                <div className="text-lg font-mono font-bold text-amber-700 mt-1">89.2%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Auto-accept: OFF (&lt;90%)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] uppercase font-bold text-[#7E8DA6]">Review Findings</div>
                <div className="text-lg font-mono font-bold text-emerald-700 mt-1">95.8%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Auto-accept: OFF (Month 2/3)</div>
              </div>
            </div>
          </div>

          {/* Pending Manager Approvals Queue (DAT-09 criteria 5) */}
          {rulesList.some((r) => r.scope === 'practice' && !r.approved_by_manager) && (
            <div className="border border-amber-300 bg-amber-50/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Manager Approval Queue (Practice-Scope Rules Requested by Preparers)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Under DAT-09 criteria 5, practice-wide rules created by preparers require manager or partner approval before applying across all client files.
              </p>
              <div className="space-y-2 pt-1">
                {rulesList
                  .filter((r) => r.scope === 'practice' && !r.approved_by_manager)
                  .map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-[#102654] bg-[#F6F7FB] px-2 py-0.5 rounded">
                            {rule.pattern}
                          </span>
                          <span>&rarr;</span>
                          <span className="font-bold text-[#1D4E89]">{rule.target_value}</span>
                        </div>
                        <div className="text-[10px] text-[#7E8DA6] mt-1">
                          Requested by {rule.created_by_name} • Scope: Practice-wide
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveRule(rule.id)}
                          className="px-3 py-1.5 bg-[#0B6B52] hover:bg-[#095742] text-white text-xs font-bold rounded-lg shadow-2xs"
                        >
                          Approve for Practice
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#5B6478] font-semibold text-[11px]">Scope:</span>
              {(['all', 'practice', 'client', 'supplier'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setRuleScopeFilter(sc)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                    ruleScopeFilter === sc
                      ? 'bg-[#102654] text-white'
                      : 'bg-[#F6F7FB] text-[#5B6478] hover:text-[#102654]'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#5B6478] font-semibold text-[11px]">Type:</span>
              {(['all', 'mapping', 'extraction', 'proposal', 'finding'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setRuleTypeFilter(tp)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                    ruleTypeFilter === tp
                      ? 'bg-[#1D4E89] text-white'
                      : 'bg-[#F6F7FB] text-[#5B6478] hover:text-[#102654]'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            {rulesList
              .filter((r) => ruleScopeFilter === 'all' || r.scope.toLowerCase() === ruleScopeFilter)
              .filter((r) => ruleTypeFilter === 'all' || r.type === ruleTypeFilter)
              .map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    r.active ? 'border-[#E3E7EF] bg-[#F6F7FB]/70' : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#102654] bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs">
                        {r.pattern}
                      </span>
                      <span className="text-[#7E8DA6]">&rarr;</span>
                      <span className="font-bold text-[#1D4E89]">{r.target_value}</span>
                    </div>
                    <div className="text-[11px] text-[#5B6478] mt-1.5 flex items-center gap-3 flex-wrap">
                      <span className="capitalize">
                        Scope: <strong className="text-[#102654]">{r.scope}</strong>
                      </span>
                      <span>•</span>
                      <span className="capitalize">
                        Type: <strong className="text-[#102654]">{r.type}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Used: <strong className="text-[#102654]">{r.times_used || 1} times</strong>
                      </span>
                      <span>•</span>
                      <span>Created by: {r.created_by_name || 'Staff'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(r.id)}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                        r.active
                          ? 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
                          : 'text-gray-600 bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      {r.active ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 4: Branding (QTR-02) */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 sm:p-8 space-y-6">
            <div className="border-b border-[#E3E7EF] pb-4">
              <h2 className="text-base font-bold text-[#102654]">Practice Logo &amp; Branding (QTR-02)</h2>
              <p className="text-xs text-[#5B6478] mt-0.5">
                Applied across all quarterly insight packs, management accounts, and statutory accounts PDFs.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#102654] mb-2">Practice Logo</label>
                <div className="border-2 border-dashed border-[#D5DBE7] hover:border-[#102654] rounded-2xl p-6 text-center bg-[#F6F7FB] transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-[#7E8DA6] mx-auto mb-2" />
                  <span className="text-xs font-bold text-[#102654] block">Click to upload brand logo</span>
                  <span className="text-[11px] text-[#7E8DA6]">PNG, JPG, or SVG (up to 5MB)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#102654] mb-1.5">Brand Navy Primary</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandPrimary}
                      onChange={(e) => setBrandPrimary(e.target.value)}
                      className="w-9 h-9 rounded-lg border-none cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandPrimary}
                      onChange={(e) => setBrandPrimary(e.target.value)}
                      className="flex-1 text-xs p-2 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102654] mb-1.5">Brand Coral Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandAccent}
                      onChange={(e) => setBrandAccent(e.target.value)}
                      className="w-9 h-9 rounded-lg border-none cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandAccent}
                      onChange={(e) => setBrandAccent(e.target.value)}
                      className="flex-1 text-xs p-2 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg font-mono font-bold text-[#102654]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102654] mb-1.5">Typography Family</label>
                <select
                  value={brandFont}
                  onChange={(e) => setBrandFont(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] font-medium"
                >
                  <option value="Inter">Inter (Clean modern sans-serif)</option>
                  <option value="Roboto">Roboto (Technical precision)</option>
                  <option value="Outfit">Outfit (Contemporary brand display)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102654] mb-1.5">Report Footer Disclaimer</label>
                <textarea
                  rows={3}
                  value={footerDisclaimer}
                  onChange={(e) => setFooterDisclaimer(e.target.value)}
                  className="w-full text-xs p-3 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] leading-relaxed outline-none focus:ring-1 focus:ring-[#1D4E89]"
                />
              </div>
            </div>
          </div>

          {/* Live Report Preview (QTR-02) */}
          <div className="lg:col-span-5 bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF]">
              <span className="text-xs font-bold text-[#102654] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#FF7D6B]" />
                Live PDF Report Preview
              </span>
              <span className="text-[10px] text-[#0B6B52] bg-emerald-50 font-bold px-2 py-0.5 rounded-full">
                Synchronized
              </span>
            </div>

            <div
              className="p-5 rounded-xl border border-gray-200 shadow-inner flex flex-col justify-between min-h-[360px]"
              style={{ backgroundColor: '#ffffff', fontFamily: brandFont }}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: brandPrimary }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{ backgroundColor: brandPrimary }}>
                      BP
                    </div>
                    <div>
                      <div className="text-xs font-bold" style={{ color: brandPrimary }}>Blynt Practice &amp; Co LLP</div>
                      <div className="text-[10px] text-gray-500">Chartered Accountants &amp; Statutory Auditors</div>
                    </div>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandAccent }} />
                </div>

                <div className="mt-5 space-y-2">
                  <div className="text-sm font-bold text-gray-900">Quarterly Management Report</div>
                  <div className="text-[11px] text-gray-500">Client: Harlow &amp; Finch Fine Goods Ltd · Q4 FY26</div>
                  <div className="h-16 bg-gray-50 rounded-lg p-2.5 text-[10px] text-gray-600 mt-3 border border-gray-100 flex items-center justify-around font-mono">
                    <div className="text-center">
                      <div className="text-gray-400">Revenue</div>
                      <div className="font-bold text-gray-800">£6,200,000</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Gross Margin</div>
                      <div className="font-bold text-emerald-600">38.7%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Cash</div>
                      <div className="font-bold text-blue-600">£1,305,350</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 text-[9px] text-gray-500 leading-tight">
                {footerDisclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Security & GDPR (ADM-03) */}
      {activeTab === 'security' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[20px] shadow-xs p-6 sm:p-8 space-y-6 max-w-3xl">
          <div className="border-b border-[#E3E7EF] pb-4">
            <h2 className="text-base font-bold text-[#102654]">Security &amp; Data Protection (ADM-03)</h2>
            <p className="text-xs text-[#5B6478] mt-0.5">
              Compliance with UK GDPR, AES-256 encryption at rest and in transit, and firm tenant isolation.
            </p>
          </div>

          <div className="space-y-4 text-xs text-[#102654]">
            <div className="flex items-center justify-between p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
              <div>
                <div className="font-bold text-[#102654]">Hosting Region</div>
                <div className="text-[11px] text-[#5B6478] mt-0.5">Auditor and client data stored exclusively in UK/EU sovereign cloud</div>
              </div>
              <span className="font-mono font-bold text-[#0B6B52] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                {hostingRegion}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
              <div>
                <div className="font-bold text-[#102654]">Multi-Factor Authentication (MFA)</div>
                <div className="text-[11px] text-[#5B6478] mt-0.5">Enforced on all staff sign-ins across the practice</div>
              </div>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                Enforced ✓
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
              <div>
                <div className="font-bold text-[#102654]">Statutory Audit Retention Period</div>
                <div className="text-[11px] text-[#5B6478] mt-0.5">Archive retention before automatic purging (ICAEW / Companies Act compliance)</div>
              </div>
              <span className="font-mono font-bold text-[#102654] bg-white border border-gray-200 px-3 py-1 rounded-lg">
                {retentionYears} Years
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F6F7FB] rounded-xl border border-[#E3E7EF]">
              <div>
                <div className="font-bold text-[#102654]">AI Model Training Opt-In</div>
                <div className="text-[11px] text-[#5B6478] mt-0.5">
                  Client financial numbers and vouchers are NEVER used to train shared foundation models
                </div>
              </div>
              <span className="font-mono font-bold text-[#A23A27] bg-[#FFF1EE] border border-[#A23A27]/20 px-2.5 py-1 rounded-lg">
                Opted Out (Private)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Save Changes Confirmation Modal (ADM-02) */}
      {showSaveConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[24px] shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#102654] mb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF5FC] text-[#1D4E89] flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#102654]">Apply Practice Defaults (ADM-02)</h3>
                <p className="text-xs text-[#5B6478]">Confirm how changes should propagate to client files</p>
              </div>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed mb-6">
              You are updating practice-wide defaults and thresholds. Would you like to apply these new parameters to 
              <strong> new engagements only</strong>, or <strong>also update existing active engagements</strong> across the practice?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs text-[#5B6478] hover:text-[#102654] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSave('new_only')}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#102654] text-[#102654] hover:bg-[#F6F7FB] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Apply to new engagements only
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSave('all')}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Also update existing engagements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal (ADM-01) */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[24px] shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF] mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1D4E89]" />
                <h3 className="text-base font-bold text-[#102654]">Invite Team Member (ADM-01)</h3>
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                aria-label="Close"
                className="text-[#5B6478] hover:text-[#102654]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Montgomery"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#D5DBE7] rounded-lg focus:ring-1 focus:ring-[#1D4E89] outline-none text-[#102654]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. alex.montgomery@blynt.co.uk"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#D5DBE7] rounded-lg focus:ring-1 focus:ring-[#1D4E89] outline-none text-[#102654]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Role &amp; Signing Authority
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] font-medium"
                >
                  <option value="preparer">Preparer (Reconcile &amp; prepare schedules)</option>
                  <option value="reviewer">Manager / Reviewer (Review schedules &amp; raise points)</option>
                  <option value="partner">Partner (Final sign-off, approval &amp; lock)</option>
                  <option value="admin">Practice Admin (All permissions &amp; firm setup)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Client Access
                </label>
                <div className="flex items-center gap-4 text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={inviteScope === 'all'}
                      onChange={() => setInviteScope('all')}
                    />
                    <span>All Practice Clients</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={inviteScope === 'assigned'}
                      onChange={() => setInviteScope('assigned')}
                    />
                    <span>Assigned Clients Only</span>
                  </label>
                </div>
                {inviteScope === 'assigned' && (inviteRole === 'partner' || inviteRole === 'admin') && (
                  <p className="text-[11px] text-[#5B6478] mt-2">Partners and admins always see every client.</p>
                )}
                {inviteScope === 'assigned' && inviteRole !== 'partner' && inviteRole !== 'admin' && (
                  <div className="mt-2 max-h-36 overflow-y-auto border border-[#D5DBE7] rounded-lg p-2 space-y-1.5">
                    {db.clients.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer text-[#102654]">
                        <input
                          type="checkbox"
                          checked={inviteClientIds.includes(c.id)}
                          onChange={(e) =>
                            setInviteClientIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))
                          }
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                    {db.clients.length === 0 && <p className="text-[11px] text-[#5B6478]">No clients yet.</p>}
                  </div>
                )}
              </div>

              {inviteError && <p className="text-red-600 text-[11px] font-semibold">{inviteError}</p>}

              {inviteLink && (
                <div className="p-3 rounded-lg bg-[#EAF6F0] border border-[#0B6B4D]/20 text-xs text-[#102654] space-y-2">
                  <p className="font-semibold">Invitation created. Send this link to {inviteEmail.trim()} (valid for 7 days):</p>
                  <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="w-full font-mono text-[11px] p-2 border border-[#D5DBE7] rounded bg-white" />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink)} className="text-[#1D4E89] font-semibold hover:underline">
                    Copy link
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E3E7EF]">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="px-3.5 py-2 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
                >
                  {inviteLink ? 'Done' : 'Cancel'}
                </button>
                {!inviteLink && (
                  <button
                    type="submit"
                    disabled={inviteSending}
                    className="px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {inviteSending ? 'Creating...' : 'Create Invitation'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Mapping Rule Modal (DAT-05) */}
      {showRuleModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white border border-[#E3E7EF] rounded-[24px] shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF7D6B]" />
                <h3 className="text-base font-bold text-[#102654]">Add Learned Mapping Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="text-[#5B6478] hover:text-[#102654]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Rule Type (DAT-09)
                </label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] font-medium"
                >
                  <option value="mapping">Account Mapping Rule</option>
                  <option value="extraction">Document Extraction Rule</option>
                  <option value="proposal">Schedule / Journal Proposal Rule</option>
                  <option value="finding">Review Finding Rule</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Matching Pattern (Wildcard matching)
                </label>
                <input
                  type="text"
                  placeholder="e.g. *Software*Subscription* or *Dell*PowerEdge*"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#D5DBE7] rounded-lg font-mono focus:ring-1 focus:ring-[#1D4E89] outline-none text-[#102654]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Target Value / Classification
                </label>
                <select
                  value={newRuleTarget}
                  onChange={(e) => setNewRuleTarget(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] font-medium"
                >
                  <option value="1500 Plant & Equipment Cost">1500 Plant &amp; Equipment Cost (REC-03)</option>
                  <option value="1510 Computer Equipment Cost">1510 Computer Equipment Cost (REC-03)</option>
                  <option value="1010 Barclays Operating Account">1010 Barclays Operating Account (REC-02)</option>
                  <option value="6000 London Office Rent and Service">6000 London Office Rent and Service</option>
                  <option value="6200 Staff Salaries">6200 Staff Salaries (REC-05)</option>
                  <option value="835b Director's Loan Account">835b Director&apos;s Loan Account (REC-11)</option>
                  <option value="2000 Purchase Ledger Control Account">2000 Purchase Ledger Control Account (REC-08)</option>
                  <option value="REC-03: Capital Addition">REC-03: Capital Addition</option>
                  <option value="REC-04: Lease Agreement">REC-04: Lease Agreement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#102654] mb-1">
                  Rule Scope (DAT-09)
                </label>
                <select
                  value={newRuleScope}
                  onChange={(e) => setNewRuleScope(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-[#F6F7FB] border border-[#D5DBE7] rounded-lg text-[#102654] font-medium"
                >
                  <option value="practice">Whole Practice (Requires Manager Approval)</option>
                  <option value="client">Client Only (Harlow &amp; Finch Fine Goods Ltd)</option>
                  <option value="supplier">Specific Supplier / Vendor</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E3E7EF]">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-3.5 py-2 text-xs text-[#5B6478] hover:text-[#102654] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#102654] hover:bg-[#1D4E89] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
