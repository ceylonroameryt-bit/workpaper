'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  Check,
  Search,
  Filter,
  AlertCircle,
  Download,
  Plus,
  Building2,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';
import { Comment, CommentReply } from '@/lib/types/models';
import { useCompany } from '@/context/CompanyContext';

export default function PracticeReviewNotesPage() {
  const { clients, activeCompanyId } = useCompany();
  const actor = getActor();

  const [activeTab, setActiveTab] = useState<'open' | 'assigned' | 'waiting' | 'resolved'>('open');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'review_note' | 'comment' | 'client_query'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [newType, setNewType] = useState<'review_note' | 'comment' | 'client_query'>('review_note');
  const [newClientId, setNewClientId] = useState<string>(clients[0]?.id || '');
  const [newTarget, setNewTarget] = useState('B-10 Bank reconciliation');
  const [newBody, setNewBody] = useState('');
  const [reminderSent, setReminderSent] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const triggerUpdate = () => setTick((t) => t + 1);

  // Derive client from workpaper_id or engagement or explicit client_id
  const getClientForComment = (c: Comment) => {
    if ((c as any).client_id) {
      const cli = db.clients.find((cl) => cl.id === (c as any).client_id);
      if (cli) return cli;
    }
    const wp = db.workpapers.find((w) => w.id === c.workpaper_id);
    const eng = wp ? db.engagements.find((e) => e.id === wp.engagement_id) : null;
    const client = eng ? db.clients.find((cli) => cli.id === eng.client_id) : null;
    if (client) return client;
    if (activeCompanyId) {
      const activeCli = db.clients.find((cl) => cl.id === activeCompanyId);
      if (activeCli) return activeCli;
    }
    return db.clients[0] || { id: 'cli_general', name: 'General Practice' };
  };

  const allComments = db.comments;

  // Counts for tabs
  const openCount = allComments.filter((c) => c.status === 'open').length;
  const assignedCount = allComments.filter(
    (c) => c.status === 'open' && (c.created_by === actor.id || c.replies?.some((r) => r.created_by === actor.id))
  ).length;
  const waitingCount = allComments.filter((c) => c.status === 'open' && c.type === 'client_query').length;
  const resolvedCount = allComments.filter((c) => c.status === 'resolved').length;

  // Filtered comments
  const filteredComments = useMemo(() => {
    return allComments.filter((c) => {
      // Tab filter
      if (activeTab === 'open' && c.status !== 'open') return false;
      if (activeTab === 'assigned' && (c.status !== 'open' || (c.created_by !== actor.id && !c.replies?.some((r) => r.created_by === actor.id)))) return false;
      if (activeTab === 'waiting' && (c.status !== 'open' || c.type !== 'client_query')) return false;
      if (activeTab === 'resolved' && c.status !== 'resolved') return false;

      // Type filter
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;

      // Client filter
      const client = getClientForComment(c);
      if (clientFilter !== 'all' && client.id !== clientFilter) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesBody = c.body.toLowerCase().includes(q);
        const matchesAuthor = c.created_by_name?.toLowerCase().includes(q);
        const matchesSummary = (c.anchor_summary || '').toLowerCase().includes(q);
        const matchesReplies = c.replies?.some((r) => r.body.toLowerCase().includes(q));
        if (!matchesBody && !matchesAuthor && !matchesSummary && !matchesReplies) return false;
      }

      return true;
    });
  }, [allComments, activeTab, typeFilter, clientFilter, search, actor.id, tick]);

  // Group by client
  const groupedByClient = useMemo(() => {
    const map = new Map<string, { client: any; comments: Comment[] }>();
    for (const c of filteredComments) {
      const client = getClientForComment(c);
      if (!map.has(client.id)) {
        map.set(client.id, { client, comments: [] });
      }
      map.get(client.id)!.comments.push(c);
    }
    return Array.from(map.values());
  }, [filteredComments, tick]);

  // Blocking sign-off list for right rail
  const blockingClients = useMemo(() => {
    return db.clients.map((cli) => {
      const eng = db.engagements.find((e) => e.client_id === cli.id);
      const papers = eng ? db.workpapers.filter((w) => w.engagement_id === eng.id) : [];
      const openNotes = db.comments.filter((c) => {
        if (c.status !== 'open' || c.type !== 'review_note') return false;
        if ((c as any).client_id === cli.id) return true;
        return papers.some((p) => p.id === c.workpaper_id);
      }).length;
      return {
        id: cli.id,
        name: cli.name,
        openNotes,
        isBlocked: openNotes > 0,
      };
    });
  }, [allComments, tick]);

  const handleReplySubmit = (commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (!text) return;
    const comment = db.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const newReply: CommentReply = {
      id: `rep_${Date.now()}`,
      comment_id: comment.id,
      body: text,
      mentions: [],
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
    };

    comment.replies = [...(comment.replies || []), newReply];
    db.logAudit('firm_blynt_uk', actor, 'REPLY_COMMENT', 'comments', comment.id, null, newReply);
    setReplyText((prev) => ({ ...prev, [commentId]: '' }));
    triggerUpdate();
  };

  const handleToggleResolve = (commentId: string) => {
    const comment = db.comments.find((c) => c.id === commentId);
    if (!comment) return;
    const isNowResolved = comment.status !== 'resolved';
    comment.status = isNowResolved ? 'resolved' : 'open';
    comment.resolved_at = isNowResolved ? new Date().toISOString() : null;
    comment.resolved_by = isNowResolved ? actor.id : null;
    comment.resolved_by_name = isNowResolved ? actor.name : null;
    db.logAudit('firm_blynt_uk', actor, isNowResolved ? 'RESOLVE_COMMENT' : 'REOPEN_COMMENT', 'comments', comment.id, null, { status: comment.status });
    triggerUpdate();
  };

  const handleSendReminder = (commentId: string) => {
    setReminderSent(commentId);
    setTimeout(() => setReminderSent(null), 3000);
    db.logAudit('firm_blynt_uk', actor, 'SEND_CLIENT_REMINDER', 'comments', commentId, null, { at: new Date().toISOString() });
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;

    // Find or create appropriate workpaper
    const client = db.clients.find((c) => c.id === newClientId) || (activeCompanyId ? db.clients.find(c => c.id === activeCompanyId) : null) || db.clients[0];
    const eng = client ? db.engagements.find((e) => e.client_id === client.id) : null;
    const wp = eng ? db.workpapers.find((w) => w.engagement_id === eng.id) : null;
    const wpId = wp ? wp.id : `wp_general_${Date.now()}`;

    const newComment: Comment = {
      id: `comm_${Date.now()}`,
      workpaper_id: wpId,
      type: newType,
      anchor_json: { kind: 'paper' },
      anchor_summary: newTarget.trim() || 'General review',
      status: 'open',
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
      resolved_by: null,
      body: newBody.trim(),
      replies: [],
    };
    (newComment as any).client_id = client?.id || 'cli_general';

    db.comments.unshift(newComment);
    db.logAudit('firm_blynt_uk', actor, 'CREATE_COMMENT', 'comments', newComment.id, null, newComment);
    setNewBody('');
    setShowNewModal(false);
    triggerUpdate();
  };

  const handleExportLog = () => {
    const headers = ['ID', 'Type', 'Status', 'Author', 'Target', 'Body', 'Date'];
    const rows = allComments.map((c) => [
      c.id,
      c.type,
      c.status,
      `"${c.created_by_name || ''}"`,
      `"${c.anchor_summary || ''}"`,
      `"${c.body.replace(/"/g, '""')}"`,
      c.created_at,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blynt_review_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Breadcrumb & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#4A5878] mb-1">
            <Link href="/" className="hover:text-[#122654] transition-colors">
              Practice
            </Link>
            <ChevronRight className="w-3 h-3 text-[#7E8DA6]" />
            <span className="text-[#122654] font-semibold">Review notes</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#122654] tracking-tight">
            Review notes and comments
          </h1>
          <p className="text-xs text-[#4A5878] mt-1 max-w-2xl leading-relaxed">
            Everything people have said about the work, in one list. Review notes block sign-off until the reviewer resolves them. Client queries go to the client portal and wait for a reply.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportLog}
            className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-[#F5F8FD] border border-[#D3DCEE] hover:border-[#122654] text-[#122654] text-xs font-semibold rounded-[10px] flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#4A5878]" />
            <span>Export review log</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="min-h-[42px] px-4 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-[10px] flex items-center gap-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add note or query</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 8 cols Notes & Filters | 4 cols Right Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Tabs bar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#E3E7EF] pb-px">
            {[
              { id: 'open', label: 'All open', count: openCount },
              { id: 'assigned', label: 'Assigned to me', count: assignedCount },
              { id: 'waiting', label: 'Waiting on client', count: waitingCount },
              { id: 'resolved', label: 'Resolved', count: resolvedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#FF7A66] text-[#122654]'
                    : 'border-transparent text-[#4A5878] hover:text-[#122654] hover:border-[#D3DCEE]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    activeTab === tab.id
                      ? 'bg-[#122654] text-white'
                      : 'bg-[#F5F8FD] border border-[#D3DCEE] text-[#4A5878]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filters Bar: Search + Type Dropdown + Clients Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-[12px] border border-[#E3E7EF] shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#4A5878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input aria-label="Search comments and replies"
                type="text"
                placeholder="Search comments and replies"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[38px] pl-9 pr-3 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <select aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="min-h-[38px] max-w-full px-3 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] font-semibold outline-none focus:border-[#FF7A66] cursor-pointer"
              >
                <option value="all">All types</option>
                <option value="review_note">Review notes</option>
                <option value="comment">Comments</option>
                <option value="client_query">Client queries</option>
              </select>

              <select aria-label="Filter by client"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="min-h-[38px] max-w-full px-3 text-xs bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] font-semibold outline-none focus:border-[#FF7A66] cursor-pointer"
              >
                <option value="all">All clients</option>
                {clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comment Threads grouped by Client */}
          {groupedByClient.length === 0 ? (
            <div className="blynt-card p-12 text-center flex flex-col items-center justify-center bg-white">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F8FD] border border-[#E3E7EF] flex items-center justify-center text-[#4A5878] mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#122654]">No review notes or comments found</h3>
              <p className="text-xs text-[#4A5878] max-w-sm mt-1 mb-4">
                {activeTab === 'open'
                  ? 'There are no open review notes blocking sign-off. Everything is clear!'
                  : 'No items match the active filters or tab selection.'}
              </p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="px-4 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create first note</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {groupedByClient.map(({ client, comments }) => (
                <div key={client.id} className="blynt-card p-5 bg-white border-[#E3E7EF]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E3E7EF]">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-extrabold text-[#122654] tracking-tight">
                        {client.name}
                      </h2>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F5F8FD] border border-[#D3DCEE] text-[#4A5878]">
                        {comments.length}
                      </span>
                    </div>
                    <Link
                      href={`/clients`}
                      className="text-xs font-bold text-[#B8432F] hover:underline flex items-center gap-1"
                    >
                      <span>Client overview</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="divide-y divide-[#E3E7EF]">
                    {comments.map((c) => {
                      const isExpanded = expandedCommentId === c.id;
                      const replyCount = (c.replies || []).length;
                      const timeStr = new Date(c.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div key={c.id} className="py-4 first:pt-1 last:pb-1 flex flex-col gap-3 group">
                          {/* Item Header: Type Badge, Target, Author & Time */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Type badge matching Page 10 */}
                              {c.type === 'review_note' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4DB] text-[#6B4700] border border-[#6B4700]/20">
                                  <span>◐</span> Review note
                                </span>
                              )}
                              {c.type === 'comment' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F8FD] text-[#122654] border border-[#D3DCEE]">
                                  <span>●</span> Comment
                                </span>
                              )}
                              {c.type === 'client_query' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20">
                                  <span>◷</span> Client query
                                </span>
                              )}

                              {/* Target Ref */}
                              {c.anchor_summary && (
                                <span className="text-xs font-semibold text-[#B8432F] hover:underline cursor-pointer">
                                  {c.anchor_summary}
                                </span>
                              )}

                              {c.status === 'resolved' && (
                                <span className="text-[10px] font-bold text-[#0B6B52] bg-[#E6F4EF] px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Resolved
                                </span>
                              )}
                            </div>

                            {/* Author info */}
                            <div className="text-[11px] text-[#4A5878]">
                              <span className="font-semibold text-[#122654]">{c.created_by_name}</span> · {timeStr}
                              {replyCount > 0 && <span> · {replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>}
                            </div>
                          </div>

                          {/* Message Body */}
                          <p className="text-xs text-[#122654] leading-relaxed font-medium">
                            {c.body}
                          </p>

                          {/* Action Buttons Row */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedCommentId(isExpanded ? null : c.id)}
                                className="px-3 py-1.5 rounded-[8px] bg-[#F5F8FD] hover:bg-[#EAF5FC] text-[#122654] text-xs font-bold border border-[#D3DCEE] hover:border-[#122654] transition-colors cursor-pointer"
                              >
                                {isExpanded ? 'Close replies' : replyCount > 0 ? `Open and reply (${replyCount})` : 'Open and reply'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleResolve(c.id)}
                                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-colors cursor-pointer border ${
                                  c.status === 'resolved'
                                    ? 'bg-[#E6F4EF] border-[#0B6B52]/30 text-[#0B6B52] hover:bg-white'
                                    : 'bg-white border-[#D3DCEE] hover:border-[#0B6B52] text-[#0B6B52]'
                                }`}
                              >
                                {c.status === 'resolved' ? '✓ Resolved' : 'Resolve'}
                              </button>
                            </div>

                            {c.type === 'client_query' && (
                              <button
                                type="button"
                                onClick={() => handleSendReminder(c.id)}
                                className="px-3 py-1.5 rounded-[8px] bg-white border border-[#D3DCEE] hover:border-[#FF7A66] text-[#B8432F] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{reminderSent === c.id ? 'Reminder sent!' : 'Send reminder'}</span>
                              </button>
                            )}
                          </div>

                          {/* Expanded Thread & In-line Reply */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-[#E3E7EF] flex flex-col gap-3 pl-4 border-l-2 border-l-[#FF7A66] animate-in fade-in">
                              {(c.replies || []).map((rep) => (
                                <div key={rep.id} className="p-3 rounded-[10px] bg-[#F5F8FD] border border-[#E3E7EF] text-xs flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[11px] text-[#4A5878]">
                                    <span className="font-bold text-[#122654]">{rep.created_by_name}</span>
                                    <span>{new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-[#122654] leading-relaxed">{rep.body}</p>
                                </div>
                              ))}

                              {/* Post Reply */}
                              <div className="flex gap-2 mt-1">
                                <input aria-label="Write a reply. Type @ to mention someone"
                                  type="text"
                                  placeholder="Write a reply. Type @ to mention someone..."
                                  value={replyText[c.id] || ''}
                                  onChange={(e) => setReplyText({ ...replyText, [c.id]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleReplySubmit(c.id);
                                    }
                                  }}
                                  className="flex-1 min-h-[38px] px-3 text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReplySubmit(c.id)}
                                  className="px-3.5 py-1.5 bg-[#122654] hover:bg-[#16336e] text-white text-xs font-bold rounded-[8px] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Reply</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Rail (4 cols): Blocking Sign-Off + Three Kinds of Comment */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Blocking Sign-off Card (Page 10 Spec) */}
          <div className="blynt-card p-5 bg-white border-[#E3E7EF] shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E3E7EF]">
              <h3 className="text-sm font-extrabold text-[#122654]">
                Blocking sign-off
              </h3>
              <span className="text-[10px] font-mono font-bold text-[#4A5878]">Status</span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {blockingClients.length === 0 ? (
                <p className="text-xs text-[#4A5878]">No active clients in portfolio.</p>
              ) : (
                blockingClients.map((bc) => (
                  <div key={bc.id} className="flex items-center justify-between pb-2 border-b border-[#E3E7EF]/60 last:border-0 last:pb-0">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-bold text-[#122654] truncate">{bc.name}</span>
                      <span className="text-[11px] text-[#4A5878]">
                        {bc.openNotes > 0 ? `${bc.openNotes} review notes open` : 'No open notes'}
                      </span>
                    </div>

                    {bc.isBlocked ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF1EE] text-[#A23A27] border border-[#FF7A66]/30 flex items-center gap-1 shrink-0">
                        <AlertCircle className="w-3 h-3" /> ! Blocked
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EF] text-[#0B6B52] border border-[#0B6B52]/20 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> ✓ Clear
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Three Kinds of Comment Card (Page 10 Spec) */}
          <div className="blynt-card p-5 bg-white border-[#E3E7EF] shadow-2xs">
            <h3 className="text-sm font-extrabold text-[#122654] mb-3 pb-2 border-b border-[#E3E7EF]">
              Three kinds of comment
            </h3>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F8FD] text-[#122654] border border-[#D3DCEE] shrink-0 mt-0.5">
                  Comment
                </span>
                <span className="text-[#4A5878] leading-relaxed">
                  <strong className="text-[#122654] block">Discussion</strong>
                  Never blocks sign-off.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF4DB] text-[#6B4700] border border-[#6B4700]/20 shrink-0 mt-0.5">
                  ◐ Review note
                </span>
                <span className="text-[#4A5878] leading-relaxed">
                  <strong className="text-[#122654] block">Reviewer&apos;s point</strong>
                  Blocks sign-off until resolved by the reviewer.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FC] text-[#1D4E89] border border-[#1D4E89]/20 shrink-0 mt-0.5">
                  ◷ Client query
                </span>
                <span className="text-[#4A5878] leading-relaxed">
                  <strong className="text-[#122654] block">Sent to the client</strong>
                  Tracks the wait for client documents.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Note Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0B1A3B]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#E3E7EF] max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EF] mb-4">
              <h2 className="text-base font-bold text-[#122654]">
                Create new review note or comment
              </h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-[#4A5878] hover:text-[#122654] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-bold text-[#122654] mb-1.5">Note Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'review_note', label: 'Review note', desc: 'Blocks sign-off' },
                    { id: 'comment', label: 'Comment', desc: 'Discussion only' },
                    { id: 'client_query', label: 'Client query', desc: 'Waits on client' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewType(t.id as any)}
                      className={`p-2.5 rounded-[10px] border text-left cursor-pointer transition-colors ${
                        newType === t.id
                          ? 'border-[#FF7A66] bg-[#FFF1EE]/50 font-bold text-[#122654]'
                          : 'border-[#D3DCEE] bg-white text-[#4A5878] hover:bg-[#F5F8FD]'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] font-normal text-[#4A5878]">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="modal-client" className="block font-bold text-[#122654] mb-1.5">Client</label>
                <select
                  id="modal-client"
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="w-full min-h-[40px] px-3 bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
                >
                  {clients.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="modal-target" className="block font-bold text-[#122654] mb-1.5">Target Workpaper or Area</label>
                <input
                  id="modal-target"
                  type="text"
                  placeholder="e.g. B-10 Bank reconciliation, F-10 Fixed Assets, Lead E"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full min-h-[40px] px-3 bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
                />
              </div>

              <div>
                <label htmlFor="modal-body" className="block font-bold text-[#122654] mb-1.5">Message / Observation</label>
                <textarea
                  id="modal-body"
                  rows={3}
                  required
                  placeholder="Explain the finding, query, or required explanation..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full p-3 bg-[#F5F8FD] border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E3E7EF]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-[#D3DCEE] hover:border-[#122654] rounded-[8px] text-[#122654] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] font-bold rounded-[8px] shadow-sm cursor-pointer"
                >
                  Post Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
