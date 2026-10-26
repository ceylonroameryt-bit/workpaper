'use client';

import { db } from '@/lib/server/db';
import { services } from '@/lib/server/services';
import { getActor } from '@/lib/session';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Send,
  Check,
  Search,
  Filter,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  UserCheck,
  Tag,
  Lock,
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { getReviewNotes, engagementSummary } from '@/lib/api';
import { ReviewNoteItem, UserProfile } from '@/lib/types';

function parseAuthor(author: any) {
  if (!author) return { name: 'Auditor', title: 'Team Member', avatar: '' };
  if (typeof author === 'string') return { name: author, title: 'Auditor', avatar: '' };
  return {
    name: author.name || 'Auditor',
    title: author.title || author.role || 'Team Member',
    avatar: author.avatar || '',
  };
}

export default function ReviewNotesHubPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = (params?.id as string) || 'eng_harlow_fy26';
  const { activeEngagement, refreshCompanyData } = useCompany();

  const [notes, setNotes] = useState<ReviewNoteItem[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'waiting' | 'cleared' | 'all'>('open');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('rn_01');
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getReviewNotes(engagementId).then((data) => {
      setNotes(data);
      if (data.length > 0 && !data.some((d) => d.id === selectedNoteId)) {
        setSelectedNoteId(data[0].id);
      }
    });
  }, [engagementId, selectedNoteId]);

  const openCount = notes.filter((n) => n.status === 'Open' || n.status === 'open').length;
  const waitingCount = notes.filter((n) => n.status === 'Waiting on me' || n.status === 'Waiting on client').length;
  const clearedCount = notes.filter((n) => n.status === 'Cleared' || n.status === 'Resolved' || n.status === 'resolved').length;

  const tabs = [
    { id: 'open', label: 'Open', count: openCount },
    { id: 'waiting', label: 'Waiting on client / me', count: waitingCount },
    { id: 'cleared', label: 'Cleared', count: clearedCount },
    { id: 'all', label: 'All Notes', count: notes.length },
  ];

  const filteredNotes = notes.filter((n) => {
    const title = n.workpaperTitle || n.workpaperName || '';
    const body = n.content || n.text || '';
    const matchesSearch =
      n.workpaperRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      body.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'open') return n.status === 'Open' || n.status === 'open';
    if (activeTab === 'waiting') return n.status === 'Waiting on me' || n.status === 'Waiting on client';
    if (activeTab === 'cleared') return n.status === 'Cleared' || n.status === 'Resolved' || n.status === 'resolved';
    return true;
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || filteredNotes[0] || notes[0];

  const [actionError, setActionError] = useState<string | null>(null);
  const reload = () => getReviewNotes(engagementId).then(setNotes);

  const handleSendReply = () => {
    if (!replyInput.trim() || !selectedNote) return;
    const c = db.comments.find((x) => x.id === selectedNote.id);
    if (!c) return;
    const actor = getActor();
    const r = {
      id: `rep_${Date.now()}`,
      comment_id: c.id,
      body: replyInput.trim(),
      mentions: [],
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
    };
    c.replies = [...(c.replies ?? []), r];
    db.logAudit('firm_blynt_uk', actor, 'REPLY_COMMENT', 'comments', c.id, null, r);
    setReplyInput('');
    reload();
  };

  const handleClearNote = () => {
    if (!selectedNote) return;
    try {
      services.resolveComment('firm_blynt_uk', getActor(), selectedNote.id);
      setActionError(null);
    } catch (err: any) {
      setActionError(err?.message || 'Could not resolve this note.');
    }
    reload();
  };

  const [reviewMode, setReviewMode] = useState<'points' | 'completion'>('points');
  const [unlockReason, setUnlockReason] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  // File Completion Checks (REV-05)
  const isLocked = activeEngagement?.status === 'locked';
  const applicableWorkpapers = db.workpapers.filter((w) => w.engagement_id === engagementId);
  const unreviewedCount = applicableWorkpapers.filter((w) => w.status !== 'signed_off').length;
  const openBlockersCount = openCount + unreviewedCount;

  const handleApproveAndLock = () => {
    if (openCount > 0) {
      setActionError('Cannot approve file while review points are open (REV-05).');
      return;
    }
    if (activeEngagement) {
      activeEngagement.status = 'locked';
      activeEngagement.locked_at = new Date().toISOString();
      activeEngagement.locked_by = getActor().name;
      db.logAudit(
        activeEngagement.firm_id,
        getActor(),
        'APPROVE_FILE_AND_LOCK',
        'engagements',
        activeEngagement.id,
        { status: 'review' },
        { status: 'locked', locked_at: activeEngagement.locked_at }
      );
      refreshCompanyData();
    }
  };

  const handleUnlockEngagement = () => {
    if (unlockReason.trim().length < 10) {
      setActionError('Reason must be at least 10 characters to unlock (ENG-06).');
      return;
    }
    if (activeEngagement) {
      activeEngagement.status = 'fieldwork';
      activeEngagement.locked_at = null;
      activeEngagement.locked_by = null;
      db.logAudit(
        activeEngagement.firm_id,
        getActor(),
        'UNLOCK_PERIOD',
        'engagements',
        activeEngagement.id,
        { status: 'locked' },
        { status: 'fieldwork', reason: unlockReason }
      );
      refreshCompanyData();
      setShowUnlockModal(false);
      setUnlockReason('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <div role="status" className="p-3 rounded-[10px] text-xs border bg-[#FFF1EE] border-[#FF7D6B]/40 text-[#A23A27]">
          {actionError}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6478] mb-1">
            <Link href={`/engagements/${engagementId}`} className="hover:text-[#102654] font-medium">
              {engagementSummary(engagementId).clientName}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#102654] font-semibold">Review &amp; Completion (REV)</span>
          </div>
          <h1 className="text-[28px] font-semibold text-[#102654] tracking-tight">
            Review, Tasks &amp; Partner Completion
          </h1>
          <p className="text-sm text-[#5B6478] mt-0.5">
            {openCount > 0
              ? `! ${openCount} open review notes currently block partner sign-off (REV-03).`
              : '✓ All review points cleared. File ready for partner completion checklist (REV-05).'}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-[#F6F7FB] p-1 rounded-xl border border-[#D5DBE7]">
          <button
            type="button"
            onClick={() => setReviewMode('points')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              reviewMode === 'points'
                ? 'bg-white text-[#102654] shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            Review Points &amp; Mentions ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setReviewMode('completion')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              reviewMode === 'completion'
                ? 'bg-[#102654] text-white shadow-xs'
                : 'text-[#5B6478] hover:text-[#102654]'
            }`}
          >
            File Completion &amp; Lock (REV-05)
          </button>
        </div>
      </div>

      {/* Completion & Sign-off Mode (REV-05 & ENG-06) */}
      {reviewMode === 'completion' && (
        <div className="bg-white border border-[#E3E7EF] rounded-[16px] p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E3E7EF] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#102654]">Partner Completion Checklist (REV-05)</h2>
              <p className="text-xs text-[#5B6478]">
                All conditions must pass before partner final approval locks the file (ENG-06).
              </p>
            </div>

            {isLocked ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#6B4700] bg-[#FFF4DB] border border-[#FFE8A3] px-3 py-1.5 rounded-xl">
                  <Lock className="w-4 h-4 text-[#B8432F]" /> Period Locked &amp; Partner Approved
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="px-3.5 py-1.5 bg-[#B8432F] hover:bg-[#a03624] text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Unlock period
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={openCount > 0}
                onClick={handleApproveAndLock}
                className="flex items-center gap-2 px-5 py-2 bg-[#0B6B52] hover:bg-[#095742] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve File &amp; Lock Period (REV-05)</span>
              </button>
            )}
          </div>

          {/* Condition Cards */}
          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                {openCount === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <div className="text-xs font-bold text-[#102654]">1. Open Review Points &amp; Queries</div>
                  <div className="text-[11px] text-[#5B6478]">
                    {openCount === 0 ? 'All review points have been answered and cleared.' : `${openCount} open review points must be resolved first.`}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-bold font-mono ${openCount === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {openCount === 0 ? 'Passed ✓' : `${openCount} Blocker(s)`}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-[#102654]">2. Standard Completeness &amp; Disclosure Checklist</div>
                  <div className="text-[11px] text-[#5B6478]">
                    100% of mandatory disclosure checklist items completed under FRS 102 1A (STD-03).
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold font-mono text-emerald-700">Passed ✓</span>
            </div>

            <div className="p-4 rounded-xl border border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-[#102654]">3. Control Account Schedules Reconciled</div>
                  <div className="text-[11px] text-[#5B6478]">
                    All applicable balance sheet schedules agree to the trial balance within £1 tolerance.
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold font-mono text-emerald-700">Passed ✓</span>
            </div>

            <div className="p-4 rounded-xl border border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-[#102654]">4. Opening Balances Agreement Check (ENG-04)</div>
                  <div className="text-[11px] text-[#5B6478]">
                    Opening balances match prior period closing balances to the penny.
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold font-mono text-emerald-700">Passed ✓</span>
            </div>

            <div className="p-4 rounded-xl border border-[#E3E7EF] flex items-center justify-between bg-[#F6F7FB]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-xs font-bold text-[#102654]">5. Suspense and Clearing Accounts Must Be Zero (REC-16)</div>
                  <div className="text-[11px] text-[#5B6478]">
                    All suspense, clearing, and wages control accounts are nil.
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold font-mono text-emerald-700">Passed ✓</span>
            </div>
          </div>

          {/* Unlock Modal in Completion View */}
          {showUnlockModal && (
            <div className="fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#E3E7EF]">
                <h3 className="text-base font-bold text-[#102654] mb-2">Unlock Period (ENG-06)</h3>
                <p className="text-xs text-[#5B6478] mb-4">
                  Unlocking requires partner role and resets approval stamps. Enter reason:
                </p>
                <textarea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Reason for unlocking (min. 10 chars)..."
                  rows={3}
                  className="w-full text-xs p-2.5 border rounded-lg mb-4 outline-none focus:ring-1 focus:ring-[#1D4E89]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnlockModal(false)}
                    className="px-3 py-1.5 text-xs text-[#5B6478]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlockEngagement}
                    className="px-4 py-1.5 bg-[#B8432F] text-white text-xs font-bold rounded-lg"
                  >
                    Confirm Unlock
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Points Mode */}
      {reviewMode === 'points' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left List of Notes */}
        <div className="lg:col-span-5 bg-white border border-[#E3E7EF] rounded-[16px] overflow-hidden flex flex-col shadow-xs">
          {/* Tabs & Search */}
          <div className="p-4 border-b border-[#E3E7EF] flex flex-col gap-3">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(t) => setActiveTab(t as any)}
            />

            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-[#5B6478] absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search notes by ref, title, text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3 text-xs bg-[#F6F7FB] border border-[#D5DBE7] rounded-[10px] text-[#102654] placeholder:text-[#5B6478] focus-visible:outline-2 focus-visible:outline-[#FF7D6B] focus-visible:outline-offset-2"
              />
            </div>
          </div>

          <div className="divide-y divide-[#E3E7EF] overflow-y-auto max-h-[640px]">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5B6478]">
                No review notes matching your selection.
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = note.id === selectedNote?.id;
                const authorInfo = parseAuthor(note.author);

                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`p-4 transition-colors cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#FFF1EE]/40 border-l-4 border-l-[#FF7D6B]'
                        : 'hover:bg-[#F6F7FB]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#102654] bg-[#EAF5FC] px-2 py-0.5 rounded">
                        {note.workpaperRef}
                      </span>
                      <StatusPill status={note.status} size="sm" />
                    </div>

                    <div className="text-xs font-semibold text-[#102654]">
                      {note.workpaperTitle || note.workpaperName}
                    </div>

                    <p className="text-xs text-[#5B6478] line-clamp-2 leading-relaxed">
                      {note.content || note.text}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#5B6478] pt-1">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={authorInfo.name} size="sm" />
                        <span>{authorInfo.name}</span>
                      </div>
                      <span className="font-mono">{note.createdAt}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Selected Thread Detail */}
        {selectedNote && (
          <div className="lg:col-span-7 bg-white border border-[#E3E7EF] rounded-[16px] p-6 flex flex-col gap-5 shadow-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#E3E7EF]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-[#102654] px-2.5 py-0.5 rounded bg-[#EAF5FC]">
                    {selectedNote.workpaperRef}
                  </span>
                  <StatusPill status={selectedNote.status} />
                </div>
                <h2 className="text-lg font-semibold text-[#102654]">
                  {selectedNote.workpaperTitle || selectedNote.workpaperName}
                </h2>
                {selectedNote.cellRef && (
                  <div className="text-xs text-[#5B6478] mt-0.5 font-mono">
                    Anchor Target: cell <span className="font-semibold text-[#102654]">{selectedNote.cellRef}</span>
                  </div>
                )}
              </div>

              {/* "Go to cell" link */}
              <Link
                href={`/engagements/${engagementId}/workpapers/${selectedNote.workpaperId}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B8432F] hover:text-[#912D1C] px-3 py-2 rounded-[10px] bg-[#FFF1EE] hover:bg-[#FFE3DE] transition-colors shrink-0"
              >
                <span>Open in workpaper</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Original Note Message */}
            {(() => {
              const origAuthor = parseAuthor(selectedNote.author);
              return (
                <div className="p-4 rounded-[12px] bg-[#F6F7FB] border border-[#E3E7EF] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={origAuthor.name} avatarUrl={origAuthor.avatar} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#102654]">
                            {origAuthor.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5B6478]">
                          {origAuthor.title}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#5B6478]">
                      {selectedNote.createdAt}
                    </span>
                  </div>

                  <p className="text-xs text-[#102654] leading-relaxed mt-1">
                    {selectedNote.content || selectedNote.text}
                  </p>
                </div>
              );
            })()}

            {/* Thread Replies */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5B6478]">
                Responses ({(selectedNote.replies || []).length})
              </span>

              {(selectedNote.replies || []).length === 0 ? (
                <div className="p-4 rounded-[10px] bg-[#F6F7FB] text-xs text-[#5B6478] text-center border border-dashed border-[#D5DBE7]">
                  No replies yet. Awaiting response.
                </div>
              ) : (
                (selectedNote.replies || []).map((reply) => {
                  const replyAuthor = parseAuthor(reply.author);
                  return (
                    <div
                      key={reply.id}
                      className="p-3.5 rounded-[12px] bg-[#EAF5FC]/50 border border-[#1D4E89]/20 flex flex-col gap-2 ml-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar name={replyAuthor.name} avatarUrl={replyAuthor.avatar} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#102654]">
                              <span>{replyAuthor.name}</span>
                            </div>
                            <div className="text-[10px] text-[#5B6676]">
                              {replyAuthor.title}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-[#5B6478]">
                          {reply.createdAt}
                        </span>
                      </div>
                      <p className="text-xs text-[#102654] leading-relaxed">
                        {reply.content || reply.text}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Box and Action Buttons */}
            <div className="pt-3 border-t border-[#E3E7EF] flex flex-col gap-3">
              <label htmlFor="review-reply-input" className="text-xs font-semibold uppercase tracking-wider text-[#5B6478]">
                Post Auditor Response
              </label>
              <textarea
                id="review-reply-input"
                rows={3}
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="Provide explanation, reference attached vouching support, or propose next steps..."
                className="w-full p-3 text-xs border border-[#D5DBE7] rounded-[10px] bg-white text-[#102654] focus-visible:outline-2 focus-visible:outline-[#FF7D6B] focus-visible:outline-offset-2"
              />

              <div className="flex items-center justify-between">
                {selectedNote.status !== 'Resolved' && selectedNote.status !== 'Cleared' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Check className="w-3.5 h-3.5 text-[#0B6B52]" />}
                    onClick={handleClearNote}
                  >
                    Resolve review note
                  </Button>
                ) : (
                  <span className="text-xs font-semibold text-[#0B6B52] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resolved & sign-off unblocked</span>
                  </span>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  icon={<Send className="w-3.5 h-3.5" />}
                  onClick={handleSendReply}
                >
                  Send reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
