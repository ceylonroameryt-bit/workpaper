'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
  MessageSquare,
  History,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  AlertTriangle,
  Layers,
  X,
  Download,
  Unlock,
} from 'lucide-react';
import { db } from '@/lib/server/db';
import { services } from '@/lib/server/services';
import { formatPence } from '@/lib/money';
import { getActor } from '@/lib/session';
import { StatusBadge } from '@/components/ui/StatusPill';
import { evaluatePaper, levelsFor, linkedFiles, paperStatus } from '@/lib/workpapers/engine';
import { diffData } from '@/lib/workpapers/diff';
import { TEMPLATES, templateFor, templateOf } from '@/lib/workpapers/templates';
import type { Attachment, AttachmentCategory } from '@/lib/types/models';
import {
  Section,
  StatePill,
  SectionState,
  CATEGORIES,
  PreviewModal,
  uploadToPaper,
  fileKind,
  fileUrl,
  fmtDate,
  fmtDateTime,
  fmtTb,
  initials,
  TickmarkPicker,
  AddOption,
  DEFAULT_TICKMARKS,
  Tickmark,
} from '@/components/workpaper/parts';
import {
  ReconciliationSchedule,
  AssetsSchedule,
  LinesSchedule,
  ChecklistSchedule,
  VatSchedule,
  PayrollSchedule,
  LeasesSchedule,
  DlaSchedule,
  LoansSchedule,
  TaxSchedule,
} from '@/components/workpaper/schedules';

const ROLE_ORDER = ['preparer', 'reviewer', 'partner'] as const;
type SignRole = (typeof ROLE_ORDER)[number];
const ROLE_LABEL: Record<SignRole, string> = { preparer: 'Preparer', reviewer: 'Reviewer', partner: 'Partner' };
const STATUS_SYMBOL: Record<string, string> = { not_started: '○', in_progress: '◑', prepared: '●', signed_off: '✓', stale: '⚠' };

export default function WorkpaperPage() {
  const params = useParams();
  const router = useRouter();
  const engagementId = params?.id as string;
  const rawWpId = decodeURIComponent((params?.wpId as string) || '');

  // Re-render after every change to the in-browser db
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [sideTab, setSideTab] = useState<'evidence' | 'comments' | 'ai_review' | 'history'>('comments');
  const [unreviewOpen, setUnreviewOpen] = useState(false);
  const [unreviewReason, setUnreviewReason] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState<'review_note' | 'comment' | 'client_query'>('review_note');
  const [noteAnchor, setNoteAnchor] = useState('paper');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [conclusionDraft, setConclusionDraft] = useState<string | null>(null);
  const [explainDrafts, setExplainDrafts] = useState<Record<string, string>>({});
  const [newProcedure, setNewProcedure] = useState('');
  const [naDraft, setNaDraft] = useState<{ id: string; reason: string } | null>(null);
  const [signing, setSigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<AttachmentCategory>('Other');
  const [uploadLink, setUploadLink] = useState('paper');
  const [uploadPermanent, setUploadPermanent] = useState(false);
  const [fileFilter, setFileFilter] = useState<'all' | 'permanent' | AttachmentCategory>('all');
  const [preview, setPreview] = useState<Attachment | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pendingRow = useRef<string | null>(null);

  const [showPaperNav, setShowPaperNav] = useState(true);
  const [showComments, setShowComments] = useState(true);

  // Sync panel visibility preferences with localStorage
  useEffect(() => {
    try {
      const navStored = localStorage.getItem('blynt_wp_show_nav');
      if (navStored !== null) setShowPaperNav(navStored === 'true');
      const commentsStored = localStorage.getItem('blynt_wp_show_comments');
      if (commentsStored !== null) setShowComments(commentsStored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const togglePaperNav = () => {
    setShowPaperNav((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('blynt_wp_show_nav', String(next));
      } catch {}
      return next;
    });
  };

  const toggleComments = () => {
    setShowComments((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('blynt_wp_show_comments', String(next));
      } catch {}
      return next;
    });
  };

  const engagement = db.engagements.find((e) => e.id === engagementId);
  const client = engagement ? db.clients.find((c) => c.id === engagement.client_id) : undefined;
  const norm = (s: string) => s.toLowerCase().replace(/^wp_/, '').replace(engagementId.toLowerCase() + '_', '').replace(/[-_]/g, '');
  const key = norm(rawWpId);
  let workpaper = db.workpapers.find(
    (w) => w.engagement_id === engagementId && (w.id === rawWpId || norm(w.id) === key || norm(w.ref) === key)
  );
  if (!workpaper && engagement) {
    const rawRef = rawWpId.toUpperCase().replace(/^WP_/, '').replace(/^([A-Z])(\d)/, '$1-$2');
    const tpl = templateFor(rawRef) || TEMPLATES.find((t) => norm(t.ref) === key);
    if (tpl) {
      workpaper = db.addWorkpaper(engagement.id, tpl.ref) || undefined;
    }
  }
  const papers = db.workpapers
    .filter((w) => w.engagement_id === engagementId)
    .sort((a, b) => a.ref.localeCompare(b.ref));
  const idx = workpaper ? papers.findIndex((p) => p.id === workpaper.id) : -1;
  const prevPaper = idx > 0 ? papers[idx - 1] : null;
  const nextPaper = idx >= 0 && idx < papers.length - 1 ? papers[idx + 1] : null;

  // [ and ] move between papers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === '[' && prevPaper) router.push(`/engagements/${engagementId}/workpapers/${prevPaper.id}`);
      if (e.key === ']' && nextPaper) router.push(`/engagements/${engagementId}/workpapers/${nextPaper.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevPaper, nextPaper, engagementId, router]);

  // Paste a screenshot anywhere on the page to attach it
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!workpaper || engagement?.status === 'locked') return;
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void doUpload(files, null);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const actor = getActor();

  if (!engagement || !workpaper) {
    const tpl = templateFor(rawWpId.toUpperCase().replace(/^WP_/, '').replace(/^([A-Z])(\d)/, '$1-$2'));
    return (
      <div className="max-w-3xl mx-auto blynt-card p-8 flex flex-col items-start gap-3">
        <h1 className="text-xl font-bold text-[#122654]">Working paper not found</h1>
        <p className="text-sm text-[#4A5878]">
          {engagement
            ? tpl
              ? `${tpl.ref} ${tpl.title} is not part of this engagement yet.`
              : 'This engagement has no working paper with that reference.'
            : 'This engagement does not exist. It may have been removed.'}
        </p>
        <div className="flex gap-3">
          {engagement && tpl && (
            <button
              type="button"
              onClick={() => {
                const wp = db.addWorkpaper(engagement.id, tpl.ref);
                db.logAudit(engagement.firm_id, actor, 'ADD_WORKPAPER', 'workpapers', wp?.id ?? tpl.ref, null, { ref: tpl.ref });
                if (wp) router.replace(`/engagements/${engagement.id}/workpapers/${wp.id}`);
              }}
              className="min-h-[40px] px-4 bg-[#122654] text-white text-xs font-bold rounded-[10px]"
            >
              Add {tpl.ref} to this engagement
            </button>
          )}
          <Link href={engagement ? `/engagements/${engagementId}` : '/'} className="min-h-[40px] px-4 flex items-center text-xs font-bold text-[#B8432F] hover:underline">
            {engagement ? 'Back to engagement' : 'Back to practice home'}
          </Link>
        </div>
      </div>
    );
  }

  const result = evaluatePaper(workpaper);
  if (!result) {
    return (
      <div className="max-w-3xl mx-auto blynt-card p-8 text-sm text-[#4A5878]">
        {workpaper.ref} uses a template this version of Workpapers does not support.
      </div>
    );
  }
  const t = result.template;
  const data = workpaper.data_json as Record<string, any>;
  const isLocked = engagement.status === 'locked';
  const procedures = db.procedures.filter((p) => p.workpaper_id === workpaper.id);
  const comments = db.comments.filter((c) => c.workpaper_id === workpaper.id);
  const attachments = db.attachments.filter((a) => a.workpaper_id === workpaper.id);
  const signoffs = db.signoffs.filter((s) => s.workpaper_id === workpaper.id);
  const latestSignoff = (role: string) => signoffs.filter((s) => s.role === role && !s.stale_at).pop();
  const staleSignoffs = signoffs.filter((s) => s.stale_at);
  const anchorLabel = (row?: string) => (row ? result.anchors.find((a) => a.id === row)?.label ?? 'Removed row' : 'Whole paper');

  // ---- Writes ----
  const saveData = (patch: Record<string, any>) => {
    services.updateWorkpaperData(engagement.firm_id, actor, workpaper.id, patch);
    // A changed paper needs preparing (and signing) again
    const current = db.workpapers.find((w) => w.id === workpaper.id);
    if (current) {
      if (db.signoffs.some((so) => so.workpaper_id === workpaper.id)) current.status = 'in_progress';
      current.status = paperStatus(current); // WPS-04: Unreconciled / Reconciled from the difference
    }
    setSavedAt(Date.now());
    setMessage(null);
    refresh();
  };

  const touchPaper = () => {
    const current = db.workpapers.find((w) => w.id === workpaper.id);
    if (current) {
      current.status = paperStatus(current);
      current.updated_at = new Date().toISOString();
    }
    setSavedAt(Date.now());
  };

  async function doUpload(files: File[], rowId: string | null) {
    setUploading(true);
    setMessage(null);
    const linkRow = rowId ?? (uploadLink === 'paper' ? null : uploadLink);
    const category =
      rowId && uploadCategory === 'Other'
        ? t.kind === 'reconciliation'
          ? 'Statement'
          : t.kind === 'assets'
            ? 'Invoice'
            : 'Other'
        : uploadCategory;
    const { added, errors } = await uploadToPaper(workpaper!, files, { category, rowId: linkRow, permanent: uploadPermanent });
    if (added.length) touchPaper();
    setUploading(false);
    setMessage(
      errors.length
        ? { kind: 'error', text: errors.join(' ') }
        : { kind: 'ok', text: `${added.length} file${added.length === 1 ? '' : 's'} attached${linkRow ? ` to ${anchorLabel(linkRow)}` : ''}.` }
    );
    refresh();
  }

  const attachTo = (rowId: string) => {
    pendingRow.current = rowId;
    fileInput.current?.click();
  };

  const relink = (shown: Attachment, rowId: string) => {
    const att = db.attachments.find((a) => a.id === shown.id);
    if (!att) return;
    const before = { ...att, links: [...(att.links ?? [])] };
    att.links = rowId === 'paper' ? [] : [{ attachment_id: att.id, anchor_json: { kind: 'row', table: 'schedule', row: rowId } }];
    db.logAudit(engagement.firm_id, actor, 'LINK_ATTACHMENT', 'attachments', att.id, before, att);
    touchPaper();
    refresh();
  };

  const removeFile = (att: Attachment) => {
    if (!confirm(`Remove ${att.filename} from this paper?`)) return;
    try {
      services.deleteAttachment(engagement.firm_id, actor, att.id);
      touchPaper();
      setMessage({ kind: 'ok', text: `${att.filename} removed.` });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Could not remove the file.' });
    }
    refresh();
  };

  const toggleProcedure = (procId: string) => {
    const proc = db.procedures.find((p) => p.id === procId);
    if (!proc || isLocked) return;
    const before = { ...proc };
    if (proc.done_at || proc.not_applicable_reason) {
      proc.done_at = null;
      proc.done_by = null;
      proc.not_applicable_reason = null;
    } else {
      proc.done_at = new Date().toISOString();
      proc.done_by = actor.id;
    }
    db.logAudit(engagement.firm_id, actor, proc.done_at ? 'COMPLETE_PROCEDURE' : 'REOPEN_PROCEDURE', 'procedures', proc.id, before, proc);
    touchPaper();
    refresh();
  };

  const addProcedure = () => {
    if (!newProcedure.trim()) return;
    const proc = {
      id: `proc_${workpaper.id}_${Date.now()}`,
      workpaper_id: workpaper.id,
      text: newProcedure.trim(),
      done_by: null,
      done_at: null,
      not_applicable_reason: null,
    };
    db.procedures.push(proc);
    db.logAudit(engagement.firm_id, actor, 'ADD_PROCEDURE', 'procedures', proc.id, null, proc);
    setNewProcedure('');
    touchPaper();
    refresh();
  };

  const removeProcedure = (procId: string) => {
    const proc = db.procedures.find((p) => p.id === procId);
    if (!proc || !confirm('Remove this procedure from the paper?')) return;
    db.procedures = db.procedures.filter((p) => p.id !== procId);
    db.logAudit(engagement.firm_id, actor, 'REMOVE_PROCEDURE', 'procedures', procId, proc, null);
    touchPaper();
    refresh();
  };

  const markNa = () => {
    if (!naDraft?.reason.trim()) return;
    const proc = db.procedures.find((p) => p.id === naDraft.id);
    if (!proc) return;
    const before = { ...proc };
    proc.not_applicable_reason = naDraft.reason.trim();
    proc.done_at = null;
    proc.done_by = actor.id;
    db.logAudit(engagement.firm_id, actor, 'PROCEDURE_NOT_APPLICABLE', 'procedures', proc.id, before, proc);
    setNaDraft(null);
    touchPaper();
    refresh();
  };

  const addNote = () => {
    if (!noteBody.trim()) return;
    services.addComment(engagement.firm_id, actor, workpaper.id, {
      type: noteType,
      anchor_json: noteAnchor === 'paper' ? { kind: 'paper' } : { kind: 'row', table: 'schedule', row: noteAnchor },
      body: noteBody.trim(),
    });
    const c = db.comments[db.comments.length - 1];
    if (c) c.anchor_summary = anchorLabel(noteAnchor === 'paper' ? undefined : noteAnchor);
    setNoteBody('');
    refresh();
  };

  const reply = (commentId: string) => {
    const body = replyDrafts[commentId]?.trim();
    const c = db.comments.find((x) => x.id === commentId);
    if (!body || !c) return;
    const r = {
      id: `rep_${Date.now()}`,
      comment_id: c.id,
      body,
      mentions: [],
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
    };
    c.replies = [...(c.replies ?? []), r];
    db.logAudit(engagement.firm_id, actor, 'REPLY_COMMENT', 'comments', c.id, null, r);
    setReplyDrafts((d) => ({ ...d, [commentId]: '' }));
    refresh();
  };

  const resolveNote = (commentId: string) => {
    try {
      services.resolveComment(engagement.firm_id, actor, commentId);
      setMessage(null);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Could not resolve this note.' });
    }
    refresh();
  };

  const sign = async (role: SignRole) => {
    setSigning(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/workpapers/${workpaper.id}/signoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Sign-off failed');
      setMessage({ kind: 'ok', text: `Signed off as ${ROLE_LABEL[role].toLowerCase()}.` });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Sign-off failed' });
    } finally {
      setSigning(false);
      refresh();
    }
  };

  // ---- Section states ----
  const pending = procedures.filter((p) => !p.done_at && !p.not_applicable_reason);
  const openChecks = result.checks.filter((c) => !c.passed && !c.explanation);
  const openNotes = comments.filter((c) => c.type === 'review_note' && c.status === 'open');
  const conclusionText: string = data.conclusion?.text || '';
  const leadsAgreed = result.leads.length === 0 || result.leads.some((l) => l.mapped);
  const prepLeft = [
    pending.length && `${pending.length} procedure${pending.length === 1 ? '' : 's'}`,
    openChecks.length && `${openChecks.length} check${openChecks.length === 1 ? '' : 's'}`,
    openNotes.length && `${openNotes.length} review note${openNotes.length === 1 ? '' : 's'}`,
    !conclusionText.trim() && 'conclusion',
  ].filter(Boolean) as string[];

  const unconfirmedAiCount = Number(data.values_to_confirm_count || 0);

  const canSign = (role: SignRole): string | null => {
    if (isLocked) return 'Engagement is locked';
    const may = { preparer: ['preparer', 'reviewer', 'manager', 'partner', 'admin'], reviewer: ['reviewer', 'manager', 'partner', 'admin'], partner: ['partner', 'admin'] }[role];
    if (!may.includes(actor.role)) return `A ${ROLE_LABEL[role].toLowerCase()} signs this level`;
    if (signoffs.some((s) => !s.stale_at && s.user_id === actor.id)) return 'You have already signed another level on this schedule';
    if (role === 'preparer') {
      if (result.totals.difference !== undefined && workpaper.applicable !== false && paperStatus({ ...workpaper, status: 'in_progress' }) !== 'reconciled') return 'The schedule must be Reconciled first';
      if (unconfirmedAiCount > 0) return `${unconfirmedAiCount} unconfirmed AI value(s) must be confirmed first (DAT-08)`;
      if (openChecks.length > 0) return `${openChecks.length} open check(s) remaining`;
      if (prepLeft.length) return `Left: ${prepLeft.join(', ')}`;
      return null;
    }
    if (!latestSignoff('preparer')) return 'Needs preparer sign-off first';
    if (openNotes.length) return `${openNotes.length} open review note(s) block review (REV-03)`;
    if (role === 'partner' && !latestSignoff('reviewer')) return 'Needs reviewer sign-off first';
    return null;
  };

  const handleUnreview = async () => {
    const res = await fetch(`/api/v1/workpapers/${encodeURIComponent(workpaper.id)}/unreview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: unreviewReason.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ kind: 'error', text: body.error || 'Could not unreview.' });
      return;
    }
    setUnreviewOpen(false);
    setUnreviewReason('');
    setMessage({ kind: 'ok', text: 'Schedule unreviewed. It can be changed now, and shows Changed after review until it is reviewed again.' });
    refresh();
  };

  // REV-02: reviewed and approved schedules are read-only; the change view compares with the last review
  const reviewedBy = signoffs.filter((s) => !s.stale_at && s.role !== 'preparer').pop();
  const readOnly = Boolean(reviewedBy) || isLocked;
  const lastReviewVersion = db.schedule_versions.filter((v) => v.workpaper_id === workpaper.id && v.role && v.role !== 'preparer').pop();
  const changesSinceReview = data.changed_after_review && lastReviewVersion ? diffData(lastReviewVersion.snapshot_data_json, data) : [];
  const versions = db.schedule_versions.filter((v) => v.workpaper_id === workpaper.id);
  const team = db.users.filter((u) => db.memberships.some((m) => m.user_id === u.id && m.firm_id === engagement.firm_id));
  const assign = (patch: { assignee_id?: string | null; due_date?: string | null }) => {
    const current = db.workpapers.find((w) => w.id === workpaper.id);
    if (!current) return;
    db.logAudit(engagement.firm_id, actor, 'ASSIGN_WORKPAPER', 'workpapers', current.id, { assignee_id: current.assignee_id ?? null, due_date: current.due_date ?? null }, patch);
    Object.assign(current, patch);
    refresh();
  };

  const anyScheduleInput = JSON.stringify(data).match(/"[1-9]\d*"/) !== null || attachments.length > 0;
  const states: { id: string; label: string; state: SectionState; extra?: string }[] = [
    { id: 'objective', label: 'Objective', state: data.objective?.trim() ? 'done' : 'todo' },
    { id: 'leads', label: 'Lead figures', state: result.leads.length === 0 ? 'done' : leadsAgreed ? 'done' : 'attention' },
    { id: 'schedule', label: 'Schedule', state: openChecks.length === 0 ? 'done' : anyScheduleInput ? 'progress' : 'todo' },
    { id: 'checks', label: 'Checks', state: openChecks.length ? 'attention' : 'done' },
    {
      id: 'procedures',
      label: 'Procedures',
      state: pending.length === 0 ? 'done' : pending.length < procedures.length ? 'progress' : 'todo',
      extra: `${procedures.length - pending.length}/${procedures.length}`,
    },
    { id: 'evidence', label: 'Evidence', state: attachments.length ? 'done' : 'todo', extra: String(attachments.length) },
    { id: 'conclusion', label: 'Conclusion', state: conclusionText.trim() ? 'done' : 'todo' },
    {
      id: 'signoff',
      label: 'Sign-off',
      state: latestSignoff('partner') || latestSignoff('reviewer') ? 'done' : latestSignoff('preparer') ? 'progress' : 'todo',
    },
  ];
  const stateOf = (id: string) => states.find((s) => s.id === id)!.state;

  // Latest data for this paper; writes build on it so quick edits never overwrite each other
  const live = () => (db.workpapers.find((w) => w.id === workpaper.id)?.data_json ?? {}) as Record<string, any>;
  const tickLibrary: Tickmark[] = data.tickmarks ?? DEFAULT_TICKMARKS;
  const rowTicks: Record<string, string[]> = data.row_ticks ?? {};
  const tickFor = (rowId: string, label: string) => (
    <TickmarkPicker
      library={tickLibrary}
      value={rowTicks[rowId] ?? []}
      disabled={isLocked}
      label={label}
      onChange={(ticks) => saveData({ row_ticks: { ...(live().row_ticks ?? {}), [rowId]: ticks } })}
      onAddToLibrary={(tk) => saveData({ tickmarks: [...(live().tickmarks ?? DEFAULT_TICKMARKS), tk] })}
    />
  );

  const scheduleProps = {
    data,
    result,
    locked: isLocked,
    save: saveData,
    filesFor: (rowId: string) => linkedFiles(workpaper.id, rowId),
    attachTo,
    preview: setPreview,
    tickFor,
    live,
  };
  const shownFiles = attachments.filter((a) =>
    fileFilter === 'all' ? true : fileFilter === 'permanent' ? a.is_permanent : a.category === fileFilter
  );
  const allCategories = Array.from(
    new Set([...CATEGORIES, ...db.attachments.map((a) => a.category), ...((data.custom_categories ?? []) as string[])])
  ) as AttachmentCategory[];
  const usedCategories = allCategories.filter((c) => attachments.some((a) => a.category === c));

  const paperIds = new Set([
    workpaper.id,
    ...procedures.map((p) => p.id),
    ...comments.map((c) => c.id),
    ...attachments.map((a) => a.id),
    ...signoffs.map((s) => s.id),
  ]);
  const history = db.audit_logs
    .filter((l) => paperIds.has(l.entity_id) || (l.after_json ?? '').includes(workpaper.id))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 60);

  const areas = Array.from(new Set(papers.map((p) => p.ref.charAt(0))));
  const missingRefs = TEMPLATES.filter((tp) => !papers.some((p) => p.ref === tp.ref));
  const botDraft = !data.conclusion?.bot_dismissed && !conclusionText.trim() ? result.draftConclusion : '';

  return (
    <div className="flex flex-col gap-4 max-w-[1500px] mx-auto pb-16">
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.eml,.txt"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          const row = pendingRow.current;
          pendingRow.current = null;
          e.target.value = '';
          if (files.length) void doUpload(files, row);
        }}
      />
      <PreviewModal file={preview} onClose={() => setPreview(null)} />

      {/* Unreview Modal (REV-02) */}
      {unreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-[#122654] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#B8432F]" />
                Unreview Schedule (REV-02)
              </h3>
              <button onClick={() => setUnreviewOpen(false)} className="text-[#7E8DA6] hover:text-[#122654]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#4A5878]">
              This schedule has been reviewed. To modify figures, comments, mappings or documents, enter a reason for unreviewing. Reviewer sign-off will be removed and the schedule will be flagged as <strong>Changed after review</strong>.
            </p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[#122654]">Reason for unreview (minimum 10 characters):</span>
              <textarea
                rows={3}
                value={unreviewReason}
                onChange={(e) => setUnreviewReason(e.target.value)}
                placeholder="e.g. Updating bank reconciliation following receipt of late bank statement..."
                className="p-2 border border-[#D3DCEE] rounded-[8px] text-xs"
              />
              <span className="text-[10px] text-[#7E8DA6]">{unreviewReason.trim().length} / 10 characters minimum</span>
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setUnreviewOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[#4A5878] hover:bg-[#F5F8FD] rounded-[8px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unreviewReason.trim().length < 10}
                onClick={handleUnreview}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#B8432F] hover:bg-[#963424] rounded-[8px] disabled:opacity-40"
              >
                Unreview to edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Template Modal (WPS-02) */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-[#122654] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#122654]" />
                Schedule Templates Library (WPS-02)
              </h3>
              <button onClick={() => setTemplateModalOpen(false)} className="text-[#7E8DA6] hover:text-[#122654]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#4A5878]">
              Switching template layout preserves mapped balances and entered figures for this client.
            </p>
            <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto">
              <div
                className={`p-3 rounded-[10px] border cursor-pointer ${
                  !data.active_template_variant ? 'border-[#122654] bg-[#F5F8FD]' : 'border-[#E3E7EF] hover:border-[#122654]'
                }`}
                onClick={() => {
                  saveData({ active_template_variant: null, active_template_title: null });
                  setTemplateModalOpen(false);
                  setMessage({ kind: 'ok', text: `Switched to default template: ${t.title}` });
                  refresh();
                }}
              >
                <div className="font-bold text-xs text-[#122654]">Default: {t.title}</div>
                <div className="text-[11px] text-[#4A5878] mt-0.5">Practice standard methodology layout.</div>
              </div>
              {(t.alternativeTemplates ?? []).map((alt) => (
                <div
                  key={alt.id}
                  className={`p-3 rounded-[10px] border cursor-pointer ${
                    data.active_template_variant === alt.id ? 'border-[#122654] bg-[#F5F8FD]' : 'border-[#E3E7EF] hover:border-[#122654]'
                  }`}
                  onClick={() => {
                    saveData({ active_template_variant: alt.id, active_template_title: alt.name });
                    setTemplateModalOpen(false);
                    setMessage({ kind: 'ok', text: `Switched to alternative template: ${alt.name}` });
                    refresh();
                  }}
                >
                  <div className="font-bold text-xs text-[#122654]">Alternative: {alt.name}</div>
                  <div className="text-[11px] text-[#4A5878] mt-0.5">{alt.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[#4A5878] flex-wrap">
          <Link href={`/engagements/${engagementId}`} className="hover:text-[#B8432F] font-semibold">
            {client?.name ?? 'Engagement'}
          </Link>
          <span>›</span>
          <span>
            {t.area} {t.areaName}
          </span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#122654] text-white">{workpaper.ref}</span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#122654] tracking-tight">
                {t.title}
                {data.bank_name ? ` · ${data.bank_name}` : ''}
              </h1>
              <StatusBadge status={paperStatus(workpaper)} />
              {data.changed_after_review && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFF4DB] text-[#805B00] border border-[#C58B00]/40 text-[10px] font-bold">
                  ⚠ Changed after review
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <span className="text-xs text-[#4A5878]">
                Template: <strong className="text-[#122654]">{data.active_template_title || t.title}</strong>
              </span>
              {t.alternativeTemplates && t.alternativeTemplates.length > 0 && !isLocked && (
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  className="px-2 py-0.5 text-[11px] font-bold text-[#122654] bg-[#F5F8FD] border border-[#D3DCEE] hover:border-[#122654] rounded-[6px]"
                >
                  Change template (WPS-02)
                </button>
              )}
              {result.totals.total !== undefined && (
                <span className="text-xs text-[#4A5878]">
                  Schedule: <strong className="font-mono text-[#122654]">{formatPence(result.totals.total)}</strong>
                </span>
              )}
              {result.totals.difference !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    result.totals.difference === 0n ? 'bg-[#E6F4EF] text-[#0B6B52]' : 'bg-[#FFF1EE] text-[#B42318]'
                  }`}
                >
                  Diff: {formatPence(result.totals.difference)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#4A5878] mt-1">
              Template v{workpaper.template_version} · Preparer {latestSignoff('preparer')?.user_name ?? '—'} · Reviewer{' '}
              {latestSignoff('reviewer')?.user_name ?? '—'} · {savedAt ? '✓ Saved' : `Updated ${fmtDateTime(workpaper.updated_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Collapse / Expand Panel Toggles */}
            <div className="inline-flex items-center bg-[#F5F8FD] p-0.5 rounded-[8px] border border-[#D3DCEE]">
              <button
                type="button"
                onClick={togglePaperNav}
                className={`min-h-[32px] px-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-[6px] transition-colors ${
                  showPaperNav
                    ? 'bg-white text-[#122654] shadow-sm'
                    : 'text-[#4A5878] hover:text-[#122654] hover:bg-white/60'
                }`}
                title={showPaperNav ? 'Hide paper index (collapse left)' : 'Show paper index'}
              >
                {showPaperNav ? <PanelLeftClose className="w-3.5 h-3.5 text-[#FF7A66]" /> : <PanelLeftOpen className="w-3.5 h-3.5 text-[#4A5878]" />}
                <span>{showPaperNav ? 'Hide index' : 'Papers'}</span>
              </button>
              <button
                type="button"
                onClick={toggleComments}
                className={`min-h-[32px] px-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-[6px] transition-colors ${
                  showComments
                    ? 'bg-white text-[#122654] shadow-sm'
                    : 'text-[#4A5878] hover:text-[#122654] hover:bg-white/60'
                }`}
                title={showComments ? 'Hide comments panel (collapse right)' : 'Show comments panel'}
              >
                {showComments ? <PanelRightClose className="w-3.5 h-3.5 text-[#FF7A66]" /> : <PanelRightOpen className="w-3.5 h-3.5 text-[#4A5878]" />}
                <span>
                  {showComments ? 'Hide comments' : 'Comments'}
                  {comments.filter((c) => c.status === 'open').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-[#FF7A66] text-white text-[10px] rounded-full">
                      {comments.filter((c) => c.status === 'open').length}
                    </span>
                  )}
                </span>
              </button>
            </div>

            {/* Confidence Gate (DAT-08) */}
            {unconfirmedAiCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EFF6FF] border border-[#93C5FD] rounded-[8px] text-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#1E40AF]" />
                <span className="font-bold text-[#1E40AF]">{unconfirmedAiCount} to confirm</span>
                <button
                  type="button"
                  onClick={() => {
                    saveData({ values_to_confirm_count: 0 });
                    db.logAudit(engagement.firm_id, actor, 'CONFIRM_AI_VALUES', 'workpapers', workpaper.id, null, { action: 'confirm_all_ready' });
                    setMessage({ kind: 'ok', text: 'All Ready AI values confirmed.' });
                    refresh();
                  }}
                  className="px-2 py-0.5 bg-[#1E40AF] text-white font-bold rounded-[6px] hover:bg-[#1E3A8A] text-[10px]"
                >
                  Confirm all Ready
                </button>
              </div>
            )}

            {/* Propose Journal (JNL-02) */}
            <Link
              href={`/engagements/${engagementId}/journals?propose=${workpaper.ref}&amount=${result.totals.difference || 0}`}
              className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#122654] bg-white border border-[#D3DCEE] hover:border-[#122654] rounded-[8px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#B8432F]" /> Propose journal
            </Link>

            {/* Unreview Button (REV-02) */}
            {reviewedBy && !isLocked && (
              <button
                type="button"
                onClick={() => setUnreviewOpen(true)}
                className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#B8432F] bg-white border border-[#FF7A66] hover:bg-[#FFF1EE] rounded-[8px]"
              >
                <Unlock className="w-3.5 h-3.5" /> Unreview to edit
              </button>
            )}

            {/* Export (RPT-01) */}
            <button
              type="button"
              onClick={() => alert(`Exporting ${workpaper.ref} to PDF and Excel with practice branding...`)}
              className="min-h-[36px] px-2.5 inline-flex items-center gap-1 text-xs font-bold text-[#122654] bg-white border border-[#D3DCEE] hover:border-[#122654] rounded-[8px]"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => {
                pendingRow.current = null;
                fileInput.current?.click();
              }}
              className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#122654] bg-white border border-[#D3DCEE] hover:border-[#122654] rounded-[8px] disabled:opacity-40"
            >
              <Upload className="w-3.5 h-3.5" /> Attach file
            </button>
            <div className="inline-flex items-center">
              <button
                type="button"
                disabled={!prevPaper}
                aria-label="Previous paper"
                title="Previous paper ( [ )"
                onClick={() => prevPaper && router.push(`/engagements/${engagementId}/workpapers/${prevPaper.id}`)}
                className="min-h-[36px] px-2 border border-[#D3DCEE] rounded-l-[8px] bg-white hover:bg-[#F5F8FD] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!nextPaper}
                aria-label="Next paper"
                title="Next paper ( ] )"
                onClick={() => nextPaper && router.push(`/engagements/${engagementId}/workpapers/${nextPaper.id}`)}
                className="min-h-[36px] px-2 border-y border-r border-[#D3DCEE] rounded-r-[8px] bg-white hover:bg-[#F5F8FD] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {/* Section stepper */}
        <nav aria-label="Paper sections" className="flex flex-wrap gap-1.5">
          {states.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="hover:opacity-80">
              <StatePill state={s.state} label={`${i + 1} ${s.label}${s.extra ? ` ${s.extra}` : ''}`} />
            </a>
          ))}
        </nav>
        {isLocked && (
          <div className="p-3 rounded-[10px] bg-[#F5F8FD] border border-[#D3DCEE] text-xs text-[#4A5878]">
            This engagement is locked. The paper is read-only.
          </div>
        )}
        {staleSignoffs.length > 0 && (
          <div className="p-3 rounded-[10px] bg-[#FFF4DB] border border-[#C58B00]/30 text-xs text-[#6B4700]">
            ⚠ The paper changed after it was signed. {staleSignoffs.length} earlier sign-off{staleSignoffs.length === 1 ? ' is' : 's are'} stale and must be
            signed again.
          </div>
        )}
        {message && (
          <div
            role="status"
            className={`p-3 rounded-[10px] text-xs border ${
              message.kind === 'ok' ? 'bg-[#E6F4EF] border-[#0B6B52]/30 text-[#0B6B52]' : 'bg-[#FFF1EE] border-[#FF7A66]/40 text-[#A23A27]'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div
        className={`grid gap-5 transition-all ${
          showPaperNav && showComments
            ? 'grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)_320px]'
            : showPaperNav && !showComments
            ? 'grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)]'
            : !showPaperNav && showComments
            ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]'
            : 'grid-cols-1'
        }`}
      >
        {/* Paper navigator: a compact picker on smaller screens, the full list on wide ones */}
        <label className="xl:hidden flex items-center gap-2 text-xs">
          <span className="font-bold text-[#122654] whitespace-nowrap">Jump to paper</span>
          <select
            aria-label="Jump to paper"
            value={workpaper.id}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith('add:')) {
                const wp = db.addWorkpaper(engagement.id, v.slice(4));
                if (!wp) return;
                db.logAudit(engagement.firm_id, actor, 'ADD_WORKPAPER', 'workpapers', wp.id, null, { ref: wp.ref });
                router.push(`/engagements/${engagementId}/workpapers/${wp.id}`);
              } else {
                router.push(`/engagements/${engagementId}/workpapers/${v}`);
              }
            }}
            className="flex-1 min-w-0 min-h-[36px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white text-[#122654]"
          >
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {STATUS_SYMBOL[p.status] ?? '○'} {p.ref} {templateOf(p)?.title}
              </option>
            ))}
            {!isLocked && missingRefs.length > 0 && (
              <optgroup label="Add a paper">
                {missingRefs.map((tp) => (
                  <option key={tp.ref} value={`add:${tp.ref}`}>
                    + {tp.ref} {tp.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {showPaperNav && (
          <aside className="hidden xl:block blynt-card p-3 h-fit xl:sticky xl:top-20 text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E3E7EF]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6]">Papers Index</span>
              <button
                type="button"
                onClick={togglePaperNav}
                className="p-1 text-[#7E8DA6] hover:text-[#122654] hover:bg-[#F5F8FD] rounded-[6px] transition-colors"
                title="Hide paper index"
                aria-label="Hide paper index"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
            {areas.map((a) => (
              <div key={a} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7E8DA6]">
                  {a} {templateOf(papers.find((p) => p.ref.startsWith(a))!)?.areaName}
                </div>
                {papers
                  .filter((p) => p.ref.startsWith(a))
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/engagements/${engagementId}/workpapers/${p.id}`}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-[8px] ${
                        p.id === workpaper.id ? 'bg-[#122654] text-white font-bold' : 'text-[#122654] hover:bg-[#F5F8FD]'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono">{p.ref}</span> {templateOf(p)?.title}
                      </span>
                      <span aria-hidden>{STATUS_SYMBOL[p.status] ?? '○'}</span>
                    </Link>
                  ))}
              </div>
            ))}
            <div className="px-2 pt-2 border-t border-[#E3E7EF] text-[10px] text-[#4A5878]">All {papers.length} papers</div>
            {!isLocked && missingRefs.length > 0 && (
              <label className="flex flex-col gap-1 px-2 pt-2">
                <span className="text-[10px] font-bold text-[#4A5878]">Add a paper</span>
                <select
                  aria-label="Add a paper"
                  value=""
                  onChange={(e) => {
                    const wp = db.addWorkpaper(engagement.id, e.target.value);
                    if (wp) {
                      db.logAudit(engagement.firm_id, actor, 'ADD_WORKPAPER', 'workpapers', wp.id, null, { ref: wp.ref });
                      router.push(`/engagements/${engagementId}/workpapers/${wp.id}`);
                    }
                  }}
                  className="min-h-[32px] px-1.5 border border-[#D3DCEE] rounded-[8px] bg-white"
                >
                  <option value="">Choose…</option>
                  {missingRefs.map((tp) => (
                    <option key={tp.ref} value={tp.ref}>
                      {tp.ref} {tp.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </aside>
        )}

        {/* Main column */}
        <div className="flex flex-col gap-5 min-w-0">
          {reviewedBy && (
            <div role="status" className="p-3 rounded-[10px] bg-[#EAF5FC] border border-[#1D4E89]/20 text-xs text-[#122654]">
              {reviewedBy.role === 'partner' ? 'Approved' : 'Reviewed'} by <strong>{reviewedBy.user_name}</strong> on {fmtDateTime(reviewedBy.signed_at)}: read only. Use <strong>Unreview to edit</strong> to change it. Comments can still be added.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#122654]">
            <label className="inline-flex items-center gap-1.5">
              Assigned to
              <select
                aria-label="Assigned to"
                disabled={isLocked}
                value={workpaper.assignee_id ?? ''}
                onChange={(e) => assign({ assignee_id: e.target.value || null })}
                className="min-h-[32px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white"
              >
                <option value="">No one</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5">
              Due
              <input
                type="date"
                aria-label="Due date"
                disabled={isLocked}
                value={workpaper.due_date ?? ''}
                onChange={(e) => assign({ due_date: e.target.value || null })}
                className={`min-h-[32px] px-2 border rounded-[8px] bg-white ${workpaper.due_date && workpaper.due_date < new Date().toISOString().slice(0, 10) ? 'border-[#B8432F] text-[#B8432F]' : 'border-[#D3DCEE]'}`}
              />
            </label>
          </div>
          {changesSinceReview.length > 0 && (
            <div className="p-3 rounded-[10px] bg-[#FFF4DB] border border-[#C58B00]/40 text-xs text-[#122654]">
              <p className="font-bold mb-1.5">Changes since the last review ({changesSinceReview.length})</p>
              <p className="text-[11px] text-[#805B00] mb-2">Unreviewed by {data.last_unreviewed_by} on {data.last_unreviewed_at ? fmtDateTime(data.last_unreviewed_at) : ''}: “{data.last_unreview_reason}”</p>
              <table className="w-full text-[11px]">
                <thead className="text-[#4A5878]">
                  <tr><th className="text-left">Field</th><th className="text-left">Was</th><th className="text-left">Now</th></tr>
                </thead>
                <tbody>
                  {changesSinceReview.slice(0, 20).map((c) => (
                    <tr key={c.field}><td className="pr-3 font-mono">{c.field}</td><td className="pr-3">{c.before || '—'}</td><td>{c.after || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <fieldset disabled={readOnly} className="flex flex-col gap-5 min-w-0 border-0 p-0 m-0">
          <Section id="objective" num={1} title="Objective" state={stateOf('objective')}>
            <textarea
              aria-label="Objective"
              disabled={isLocked}
              defaultValue={data.objective}
              onBlur={(e) => e.target.value !== data.objective && saveData({ objective: e.target.value })}
              rows={2}
              className="w-full p-2.5 text-xs bg-white border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] disabled:bg-[#F5F8FD]"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(data.assertions ?? t.assertions).map((a: string) => (
                <span key={a} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F8FD] border border-[#D3DCEE] text-[#3A4560]">
                  {a}
                  {!isLocked && (
                    <button
                      type="button"
                      aria-label={`Remove assertion ${a}`}
                      onClick={() => saveData({ assertions: (data.assertions ?? t.assertions).filter((x: string) => x !== a) })}
                      className="text-[#7E8DA6] hover:text-[#B42318]"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <AddOption
                label="Add assertion"
                placeholder="e.g. Occurrence"
                disabled={isLocked}
                onAdd={(v) => {
                  const list: string[] = data.assertions ?? t.assertions;
                  if (!list.includes(v)) saveData({ assertions: [...list, v] });
                }}
              />
            </div>
          </Section>

          <Section
            id="leads"
            num={2}
            title="Lead figures from the Blynt chart"
            state={stateOf('leads')}
            stateLabel={result.leads.length === 0 ? 'No lead accounts' : leadsAgreed ? 'From TB' : 'Not mapped yet'}
          >
            {result.leads.length === 0 ? (
              <p className="text-xs text-[#4A5878]">This paper has no trial balance lead accounts.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-[#122654]">
                    <thead className="bg-[#F5F8FD] text-[10px] uppercase tracking-wider text-[#4A5878]">
                      <tr>
                        <th className="p-2 text-left">Account</th>
                        <th className="p-2 text-right">Prior year</th>
                        <th className="p-2 text-right">Draft</th>
                        <th className="p-2 text-right">Adjustments</th>
                        <th className="p-2 text-right">Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E7EF] font-mono">
                      {result.leads.map((l) => (
                        <tr key={l.code} className={l.mapped ? '' : 'text-[#7E8DA6]'}>
                          <td className="p-2 font-sans">
                            <span className="font-mono font-bold">{l.code.padEnd(4, 'x')}</span> {l.label}
                            {!l.mapped && <span className="ml-1 text-[10px]">· not mapped</span>}
                          </td>
                          <td className="p-2 text-right">{l.prior === null ? '—' : fmtTb(l.prior)}</td>
                          <td className="p-2 text-right">{fmtTb(l.draft)}</td>
                          <td className="p-2 text-right">{fmtTb(l.adjustments)}</td>
                          <td className="p-2 text-right font-bold">{fmtTb(l.final)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[#4A5878] mt-2">
                  Brackets are credits. Figures come from confirmed account mappings plus approved adjustments — they are never typed.{' '}
                  {!leadsAgreed && (
                    <Link href={`/engagements/${engagementId}/mapping`} className="font-bold text-[#B8432F] hover:underline">
                      Map accounts
                    </Link>
                  )}
                </p>
              </>
            )}
          </Section>

          <Section id="schedule" num={3} title="Schedule" state={stateOf('schedule')}>
            {/* AI Extraction Confidence Gate Items (DOC-05 / DAT-08) */}
            {data.confidence_gate_items && data.confidence_gate_items.length > 0 && (
              <div className="mb-4 p-4 rounded-[12px] bg-[#F5F8FD] border border-[#7C3AED]/30 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                    <span className="font-bold text-xs text-[#122654]">
                      AI Extracted Figures (DOC-05 / Confidence Gate DAT-08)
                    </span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-mono font-bold px-2 py-0.5 rounded-full">
                      {data.confidence_gate_items.filter((i: any) => !i.confirmed).length} pending confirmation
                    </span>
                  </div>
                  <span className="text-[10px] text-[#4A5878]">
                    Values retain AI badges until confirmed by the preparer (ENG-06 audit trail)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {data.confidence_gate_items.map((item: any) => (
                    <div
                      key={item.field_key}
                      className={`p-3 rounded-[10px] border flex flex-col justify-between gap-2 text-xs ${
                        item.confirmed
                          ? 'bg-[#E6F4EF]/50 border-[#0B6B52]/30'
                          : item.status === 'ready'
                          ? 'bg-white border-[#7C3AED]/30'
                          : 'bg-[#FFF4DB] border-[#C58B00]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#122654]">{item.field_label}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                              item.confirmed
                                ? 'bg-[#0B6B52] text-white'
                                : item.status === 'ready'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.confirmed ? 'Confirmed' : `${Math.round(item.confidence * 100)}% Conf.`}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-sm text-[#122654] mt-1">{item.extracted_value}</div>
                        <div className="text-[10px] text-[#7E8DA6] mt-0.5 truncate">
                          Source: {item.source_document_name} (p. {item.source_page || 1})
                        </div>
                      </div>

                      <div className="pt-1 border-t border-[#E3E7EF]/60 flex items-center justify-between">
                        {item.confirmed ? (
                          <span className="text-[10px] font-bold text-[#0B6B52] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Confirmed by {item.confirmed_by}
                          </span>
                        ) : !isLocked ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await fetch(`/api/v1/workpapers/${workpaper.id}/confirm-value`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ field_key: item.field_key, actor_name: actor.name }),
                                });
                              } catch {}
                              const updatedGate = (live().confidence_gate_items ?? []).map((g: any) =>
                                g.field_key === item.field_key
                                  ? { ...g, confirmed: true, confirmed_by: actor.name, confirmed_at: new Date().toISOString() }
                                  : g
                              );
                              saveData({ confidence_gate_items: updatedGate });
                            }}
                            className="px-2.5 py-1 bg-[#122654] hover:bg-[#1D4E89] text-white text-[11px] font-bold rounded-[6px] transition-colors cursor-pointer"
                          >
                            Confirm Value
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {t.kind === 'reconciliation' && <ReconciliationSchedule {...scheduleProps} />}
            {t.kind === 'assets' && <AssetsSchedule {...scheduleProps} />}
            {t.kind === 'lines' && <LinesSchedule {...scheduleProps} />}
            {t.kind === 'vat' && <VatSchedule {...scheduleProps} />}
            {t.kind === 'payroll' && <PayrollSchedule {...scheduleProps} />}
            {t.kind === 'leases' && <LeasesSchedule {...scheduleProps} />}
            {t.kind === 'dla' && <DlaSchedule {...scheduleProps} />}
            {t.kind === 'loans' && <LoansSchedule {...scheduleProps} />}
            {t.kind === 'checklist' && <ChecklistSchedule {...scheduleProps} />}
            {t.kind === 'tax' && <TaxSchedule {...scheduleProps} />}
            <div className="mt-4 pt-3 border-t border-[#E3E7EF] text-[10px] text-[#4A5878] flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">Tickmarks:</span>
              {tickLibrary.map((tk) => (
                <span key={tk.code} className="inline-flex items-center gap-1">
                  <span className="font-mono font-bold px-1 rounded bg-[#E6F4EF] text-[#0B6B52]">{tk.code}</span>
                  {tk.label}
                  {!isLocked && !Object.values(rowTicks).some((v) => v.includes(tk.code)) && (
                    <button
                      type="button"
                      aria-label={`Remove tickmark ${tk.code}`}
                      title="Remove from library"
                      onClick={() => saveData({ tickmarks: tickLibrary.filter((x) => x.code !== tk.code) })}
                      className="text-[#7E8DA6] hover:text-[#B42318]"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <AddOption
                label="Add tickmark"
                placeholder="CODE meaning, e.g. CF Confirmed"
                disabled={isLocked}
                onAdd={(v) => {
                  const [code, ...rest] = v.split(/\s+/);
                  const c = code.toUpperCase().slice(0, 4);
                  if (!tickLibrary.some((x) => x.code === c)) saveData({ tickmarks: [...tickLibrary, { code: c, label: rest.join(' ') || c }] });
                }}
              />
            </div>
          </Section>

          <Section
            id="checks"
            num={4}
            title="Checks"
            state={stateOf('checks')}
            stateLabel={openChecks.length ? `${openChecks.length} open` : 'All clear'}
          >
            <ul className="flex flex-col gap-2">
              {result.checks.map((c) => (
                <li
                  key={c.id}
                  className={`p-3 rounded-[10px] border text-xs ${
                    c.passed ? 'bg-[#E6F4EF] border-[#0B6B52]/20' : c.explanation ? 'bg-[#FFF4DB] border-[#C58B00]/30' : 'bg-[#FFF1EE] border-[#FF7A66]/30'
                  }`}
                >
                  <div className="font-bold text-[#122654]">
                    {c.passed ? '✓' : c.explanation ? '◐' : '!'} {c.label}
                  </div>
                  <div className="text-[#4A5878] mt-0.5 font-mono text-[11px] break-words">{c.detail}</div>
                  {!c.passed && (
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        aria-label={`Explain: ${c.label}`}
                        disabled={isLocked}
                        placeholder="Explain why this is acceptable…"
                        value={explainDrafts[c.id] ?? c.explanation ?? ''}
                        onChange={(e) => setExplainDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px]"
                      />
                      <button
                        type="button"
                        disabled={isLocked || explainDrafts[c.id] === undefined}
                        onClick={() => {
                          saveData({ explanations: { ...(data.explanations ?? {}), [c.id]: explainDrafts[c.id] } });
                          setExplainDrafts((d) => {
                            const n = { ...d };
                            delete n[c.id];
                            return n;
                          });
                        }}
                        className="min-h-[32px] px-3 text-xs font-bold bg-[#122654] text-white rounded-[8px] disabled:opacity-40"
                      >
                        Save explanation
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="procedures"
            num={5}
            title="Procedures"
            state={stateOf('procedures')}
            stateLabel={`${procedures.length - pending.length} of ${procedures.length}`}
          >
            <ul className="flex flex-col gap-1">
              {procedures.map((p) => (
                <li key={p.id} className="rounded-[8px] hover:bg-[#F5F8FD]">
                  <div className="flex items-start gap-2.5 p-2">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => toggleProcedure(p.id)}
                      aria-pressed={Boolean(p.done_at || p.not_applicable_reason)}
                      className="flex items-start gap-2.5 text-left flex-1 text-xs disabled:cursor-not-allowed"
                    >
                      <span className={`mt-0.5 font-bold ${p.done_at ? 'text-[#0B6B52]' : p.not_applicable_reason ? 'text-[#4A5878]' : 'text-[#7E8DA6]'}`}>
                        {p.done_at ? '✓' : p.not_applicable_reason ? '–' : '○'}
                      </span>
                      <span>
                        <span className={p.done_at || p.not_applicable_reason ? 'text-[#4A5878]' : 'text-[#122654]'}>{p.text}</span>
                        {p.done_at && (
                          <span className="block text-[10px] text-[#0B6B52] mt-0.5">
                            {db.users.find((u) => u.id === p.done_by)?.name ?? 'Unknown'} · {fmtDate(p.done_at)}
                          </span>
                        )}
                        {p.not_applicable_reason && (
                          <span className="block text-[10px] text-[#4A5878] mt-0.5">Not applicable: {p.not_applicable_reason}</span>
                        )}
                      </span>
                    </button>
                    {!isLocked && !p.done_at && !p.not_applicable_reason && (
                      <>
                        <button
                          type="button"
                          onClick={() => setNaDraft({ id: p.id, reason: '' })}
                          className="text-[10px] font-bold text-[#4A5878] hover:text-[#122654] whitespace-nowrap"
                        >
                          Not applicable…
                        </button>
                        <button
                          type="button"
                          aria-label="Remove procedure"
                          title="Remove procedure"
                          onClick={() => removeProcedure(p.id)}
                          className="text-[10px] font-bold text-[#7E8DA6] hover:text-[#B42318] whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                  {naDraft?.id === p.id && (
                    <div className="flex gap-2 px-2 pb-2">
                      <input
                        autoFocus
                        type="text"
                        aria-label="Reason not applicable"
                        placeholder="Why is this not applicable?"
                        value={naDraft.reason}
                        onChange={(e) => setNaDraft({ id: p.id, reason: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && markNa()}
                        className="flex-1 px-2 py-1.5 text-xs border border-[#D3DCEE] rounded-[8px]"
                      />
                      <button type="button" onClick={markNa} disabled={!naDraft.reason.trim()} className="px-3 text-xs font-bold bg-[#122654] text-white rounded-[8px] disabled:opacity-40">
                        Save
                      </button>
                      <button type="button" onClick={() => setNaDraft(null)} className="px-2 text-xs text-[#4A5878]">
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!isLocked && (
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  aria-label="New procedure"
                  placeholder="Add a procedure…"
                  value={newProcedure}
                  onChange={(e) => setNewProcedure(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addProcedure()}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-[#D3DCEE] rounded-[8px]"
                />
                <button type="button" onClick={addProcedure} disabled={!newProcedure.trim()} className="inline-flex items-center gap-1 px-3 text-xs font-bold bg-white border border-[#D3DCEE] rounded-[8px] disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            )}
          </Section>

          <Section id="evidence" num={6} title="Evidence" state={stateOf('evidence')} stateLabel={`${attachments.length} file${attachments.length === 1 ? '' : 's'}`}>
            {!isLocked && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const files = Array.from(e.dataTransfer.files ?? []);
                  if (files.length) void doUpload(files, null);
                }}
                className={`p-4 rounded-[12px] border-2 border-dashed text-center text-xs ${dragOver ? 'border-[#FF7A66] bg-[#FFF1EE]' : 'border-[#D3DCEE] bg-[#F5F8FD]'}`}
              >
                <div className="font-bold text-[#122654]">{uploading ? 'Uploading…' : 'Drop files here, paste a screenshot, or choose files'}</div>
                <div className="text-[10px] text-[#4A5878] mt-1">
                  PDF, Excel, Word, images, email (.eml) · up to 4 MB each · every file is fingerprinted (sha256) and kept unchanged
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <select
                    aria-label="File type"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as AttachmentCategory)}
                    className="min-h-[32px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <AddOption
                    label="Add file type"
                    placeholder="e.g. Lease"
                    onAdd={(v) => {
                      if (!allCategories.includes(v as AttachmentCategory)) saveData({ custom_categories: [...(data.custom_categories ?? []), v] });
                      setUploadCategory(v as AttachmentCategory);
                    }}
                  />
                  <select
                    aria-label="Link to"
                    value={uploadLink}
                    onChange={(e) => setUploadLink(e.target.value)}
                    className="min-h-[32px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white max-w-[220px]"
                  >
                    <option value="paper">Whole paper</option>
                    {result.anchors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1">
                    <input type="checkbox" checked={uploadPermanent} onChange={(e) => setUploadPermanent(e.target.checked)} /> Permanent
                  </label>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      pendingRow.current = null;
                      fileInput.current?.click();
                    }}
                    className="min-h-[32px] px-3 text-xs font-bold bg-[#122654] text-white rounded-[8px] disabled:opacity-40"
                  >
                    Choose files
                  </button>
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5 mt-4 mb-2">
                  {(['all', ...usedCategories, ...(attachments.some((a) => a.is_permanent) ? ['permanent' as const] : [])] as const).map((f) => {
                    const n = f === 'all' ? attachments.length : f === 'permanent' ? attachments.filter((a) => a.is_permanent).length : attachments.filter((a) => a.category === f).length;
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={fileFilter === f}
                        onClick={() => setFileFilter(f as typeof fileFilter)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${fileFilter === f ? 'bg-[#122654] text-white border-[#122654]' : 'bg-white border-[#D3DCEE] text-[#122654]'}`}
                      >
                        {f === 'all' ? 'All' : f === 'permanent' ? 'Permanent' : f} {n}
                      </button>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-[#122654]">
                    <thead className="bg-[#F5F8FD] text-[10px] uppercase tracking-wider text-[#4A5878]">
                      <tr>
                        <th className="p-2 text-left">File</th>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Linked to</th>
                        <th className="p-2 text-left">Added</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E7EF]">
                      {shownFiles.map((a) => {
                        const row = (a.links ?? [])[0]?.anchor_json as any;
                        return (
                          <tr key={a.id}>
                            <td className="p-2">
                              <button type="button" onClick={() => setPreview(a)} className="flex items-center gap-2 text-left hover:underline">
                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#122654] text-white">{fileKind(a)}</span>
                                <span className="font-semibold break-all">{a.filename}</span>
                              </button>
                              <div className="text-[10px] font-mono text-[#7E8DA6] mt-0.5">sha256 {a.sha256.slice(0, 4)}…{a.sha256.slice(-2)}</div>
                            </td>
                            <td className="p-2">
                              {a.category}
                              {a.is_permanent && <span className="ml-1 text-[10px] text-[#4A5878]">· Permanent</span>}
                            </td>
                            <td className="p-2">
                              <select
                                aria-label={`Link ${a.filename} to`}
                                disabled={isLocked}
                                value={row?.row ?? 'paper'}
                                onChange={(e) => relink(a, e.target.value)}
                                className={`max-w-[200px] px-1.5 py-1 border rounded-[8px] bg-white ${row?.row ? 'border-[#D3DCEE]' : 'border-[#C58B00]/40'}`}
                              >
                                <option value="paper">Whole paper</option>
                                {result.anchors.map((an) => (
                                  <option key={an.id} value={an.id}>
                                    {an.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {initials(a.uploaded_by_name)} · {fmtDate(a.uploaded_at)}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              <button type="button" onClick={() => setPreview(a)} className="font-bold text-[#122654] hover:underline mr-3">
                                Preview
                              </button>
                              <a href={fileUrl(a, true)} className="font-bold text-[#122654] hover:underline mr-3">
                                Download
                              </a>
                              {!isLocked && (
                                <button type="button" onClick={() => removeFile(a)} className="font-bold text-[#B42318] hover:underline">
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[#4A5878] mt-2">Attach to a single figure with ⧉ on its row. Permanent files carry forward each year.</p>
              </>
            )}
          </Section>

          <Section id="conclusion" num={7} title="Conclusion" state={stateOf('conclusion')} stateLabel={conclusionText.trim() ? 'Written' : 'Not written'}>
            {botDraft && !isLocked && (
              <div className="p-3 mb-3 rounded-[12px] bg-[#FFF1EE] border border-[#FF7A66]/40 text-xs">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A23A27]">
                  <Sparkles className="w-3.5 h-3.5" /> Blynt Bot draft · not in the paper yet
                </div>
                <p className="mt-1.5 text-[#122654] leading-relaxed">{botDraft}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => saveData({ conclusion: { ...(data.conclusion ?? {}), text: botDraft, source: 'bot', accepted_by: actor.name } })}
                    className="px-3 py-1 text-xs font-bold bg-[#122654] text-white rounded-[6px]"
                  >
                    Use this draft
                  </button>
                  <button type="button" onClick={() => setConclusionDraft(botDraft)} className="px-3 py-1 text-xs font-bold bg-white border border-[#D3DCEE] rounded-[6px]">
                    Edit first
                  </button>
                  <button
                    type="button"
                    onClick={() => saveData({ conclusion: { ...(data.conclusion ?? {}), bot_dismissed: true } })}
                    className="px-3 py-1 text-xs font-bold text-[#4A5878]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            <label className="text-[11px] font-semibold text-[#122654]" htmlFor="conclusion-text">
              Your conclusion
            </label>
            <textarea
              id="conclusion-text"
              disabled={isLocked}
              value={conclusionDraft ?? conclusionText}
              onChange={(e) => setConclusionDraft(e.target.value)}
              onBlur={() => {
                if (conclusionDraft !== null && conclusionDraft !== conclusionText) {
                  saveData({ conclusion: { ...(data.conclusion ?? {}), text: conclusionDraft } });
                }
                setConclusionDraft(null);
              }}
              rows={3}
              placeholder="Summarise the work done and whether the balance is fairly stated."
              className="w-full mt-1 p-3 text-xs bg-white border border-[#D3DCEE] rounded-[10px] text-[#122654] outline-none focus:border-[#FF7A66] disabled:bg-[#F5F8FD]"
            />
            
            {/* Preparer notes box (REC-01) */}
            <div className="mt-3 pt-3 border-t border-[#E3E7EF]">
              <label className="text-[11px] font-semibold text-[#122654] block mb-1" htmlFor="preparer-notes">
                Preparer notes (REC-01)
              </label>
              <textarea
                id="preparer-notes"
                disabled={isLocked}
                defaultValue={data.preparer_notes ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (data.preparer_notes ?? '')) {
                    saveData({ preparer_notes: e.target.value });
                  }
                }}
                rows={2}
                placeholder="Internal working notes for manager review..."
                className="w-full p-2.5 text-xs bg-white border border-[#D3DCEE] rounded-[8px] text-[#122654] outline-none focus:border-[#FF7A66] disabled:bg-[#F5F8FD]"
              />
            </div>
          </Section>

          </fieldset>

          <Section id="signoff" num={8} title="Sign-off" state={stateOf('signoff')}>
            <p className="text-[11px] text-[#4A5878] mb-3">
              Signing as <strong>{actor.name}</strong> ({actor.role}). {levelsFor(workpaper)} sign-off level{levelsFor(workpaper) === 1 ? '' : 's'} for this file, in order; one person signs one level. A reviewed schedule is read-only until it is unreviewed.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ROLE_ORDER.slice(0, levelsFor(workpaper)).map((role) => {
                const so = latestSignoff(role);
                const blocked = canSign(role);
                return (
                  <div key={role} className="p-3 rounded-[10px] bg-[#F5F8FD] border border-[#E3E7EF] text-xs flex flex-col">
                    <div className="font-bold text-[#122654]">{ROLE_LABEL[role]}</div>
                    {so ? (
                      <div className="text-[11px] text-[#0B6B52] mt-1">
                        ✓ {so.user_name} · {fmtDateTime(so.signed_at)}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(blocked) || signing}
                          onClick={() => sign(role)}
                          className="mt-2 min-h-[36px] bg-[#122654] hover:bg-[#0B1A3B] text-white font-bold rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {role === 'preparer' ? 'Mark as prepared' : `Sign as ${ROLE_LABEL[role].toLowerCase()}`}
                        </button>
                        {blocked && <div className="text-[10px] text-[#A23A27] mt-1.5">{blocked}</div>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Right rail: comments and history */}
        {showComments && (
          <aside className="blynt-card p-4 h-fit xl:sticky xl:top-20">
            <div className="flex items-center justify-between mb-3 border-b border-[#E3E7EF]">
              <div role="tablist" className="flex gap-1 overflow-x-auto pb-1">
                {[
                  { id: 'evidence' as const, label: `Evidence ${attachments.length}`, icon: FileText },
                  { id: 'comments' as const, label: `Comments ${comments.filter((c) => c.status === 'open').length}`, icon: MessageSquare },
                  { id: 'ai_review' as const, label: `AI Review ${db.ai_review_findings.filter((f) => (f.workpaper_id === workpaper.id || f.schedule_ref === workpaper.ref) && f.status === 'open').length}`, icon: Sparkles },
                  { id: 'history' as const, label: 'History', icon: History },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={sideTab === tab.id}
                    onClick={() => setSideTab(tab.id)}
                    className={`flex items-center gap-1 px-2.5 py-2 text-xs font-bold border-b-2 -mb-px whitespace-nowrap ${sideTab === tab.id ? 'border-[#FF7A66] text-[#122654]' : 'border-transparent text-[#4A5878]'}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleComments}
                className="p-1 -mt-1 text-[#7E8DA6] hover:text-[#122654] hover:bg-[#F5F8FD] rounded-[6px] transition-colors"
                title="Hide comments panel"
                aria-label="Hide comments panel"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {sideTab === 'evidence' && (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#122654]">Attached Documents ({attachments.length})</span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        pendingRow.current = null;
                        fileInput.current?.click();
                      }}
                      className="text-[11px] font-bold text-[#B8432F] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Upload file
                    </button>
                  )}
                </div>
                {attachments.length === 0 ? (
                  <div className="p-3 bg-[#F5F8FD] rounded-[10px] border border-[#E3E7EF] text-[#4A5878] text-[11px]">
                    No files linked to this schedule yet. Drag and drop or click attach above to link supporting evidence (DOC-06).
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        className="p-2.5 rounded-[10px] border border-[#D3DCEE] bg-white flex flex-col gap-1 hover:border-[#122654] cursor-pointer"
                        onClick={() => setPreview(a)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#122654] truncate max-w-[180px]">{a.filename}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F5F8FD] text-[#4A5878]">
                            {a.category}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#7E8DA6] flex items-center justify-between">
                          <span>{fmtDate(a.uploaded_at)}</span>
                          <span className="text-[#0B6B52] font-semibold">✓ Linked to paper</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sideTab === 'ai_review' && (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#122654] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#B8432F]" />
                    AI Schedule Review Bot (ANL-04)
                  </span>
                  <span className="text-[10px] text-[#4A5878]">Automated checks</span>
                </div>
                {db.ai_review_findings.filter((f) => f.workpaper_id === workpaper.id || f.schedule_ref === workpaper.ref).length === 0 ? (
                  <div className="p-3.5 rounded-[10px] bg-[#E6F4EF] border border-[#0B6B52]/30 flex flex-col gap-1">
                    <div className="font-bold text-[#0B6B52] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      No issues found
                    </div>
                    <p className="text-[#4A5878] text-[11px] mt-0.5">
                      All 8 automated checks passed: balance sheet tie, depreciation proof in total, accrual reversal, and DLA tax review.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {db.ai_review_findings
                      .filter((f) => f.workpaper_id === workpaper.id || f.schedule_ref === workpaper.ref)
                      .map((f) => (
                        <div
                          key={f.id}
                          className={`p-3 rounded-[10px] border flex flex-col gap-1.5 ${
                            f.status === 'fixed'
                              ? 'bg-[#F5F8FD] border-[#E3E7EF] opacity-75'
                              : f.severity === 'error'
                              ? 'bg-[#FFF1EE] border-[#FF7A66]'
                              : f.severity === 'warning'
                              ? 'bg-[#FFF4DB] border-[#C58B00]/40'
                              : 'bg-[#EFF6FF] border-[#93C5FD]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[#122654]">{f.title}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                f.severity === 'error'
                                  ? 'bg-[#FF7A66] text-white'
                                  : f.severity === 'warning'
                                  ? 'bg-[#FFF4DB] text-[#805B00]'
                                  : 'bg-[#E6F4EF] text-[#0B6B52]'
                              }`}
                            >
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-[#4A5878] text-[11px]">{f.detail}</p>
                          {f.status === 'open' && !isLocked && (
                            <div className="flex items-center justify-between pt-1 border-t border-[#E3E7EF]/60">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    f.status = 'fixed';
                                    db.logAudit(engagement.firm_id, actor, 'RESOLVE_AI_FINDING', 'ai_review_findings', f.id, null, { action: 'fixed' });
                                    refresh();
                                  }}
                                  className="px-2 py-0.5 bg-[#122654] text-white text-[10px] font-bold rounded"
                                >
                                  Fixed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const r = prompt('Reason for dismissing this finding:');
                                    if (r) {
                                      f.status = 'dismissed';
                                      f.dismiss_reason = r;
                                      db.logAudit(engagement.firm_id, actor, 'DISMISS_AI_FINDING', 'ai_review_findings', f.id, null, { reason: r });
                                      refresh();
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-white border border-[#D3DCEE] text-[#4A5878] text-[10px] font-semibold rounded hover:text-[#122654]"
                                >
                                  Dismiss
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[#7E8DA6]">
                                <button
                                  type="button"
                                  title="Helpful finding"
                                  onClick={() => {
                                    f.feedback = 'useful';
                                    refresh();
                                  }}
                                  className={`p-1 hover:text-[#0B6B52] ${f.feedback === 'useful' ? 'text-[#0B6B52]' : ''}`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Not helpful"
                                  onClick={() => {
                                    f.feedback = 'not_useful';
                                    refresh();
                                  }}
                                  className={`p-1 hover:text-[#B42318] ${f.feedback === 'not_useful' ? 'text-[#B42318]' : ''}`}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {sideTab === 'comments' && (
              <div className="flex flex-col gap-3 text-xs">
                {comments.length === 0 && <p className="text-[#4A5878]">No comments yet.</p>}
                {comments.map((c, i) => (
                  <div key={c.id} className={`p-3 rounded-[10px] border ${c.status === 'open' ? (c.type === 'review_note' ? 'bg-[#FFF9EC] border-[#C58B00]/30' : 'bg-white border-[#D3DCEE]') : 'bg-[#F5F8FD] border-[#E3E7EF] opacity-80'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#122654]">
                        {i + 1} {c.created_by_name}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#4A5878]">
                        {c.type === 'review_note' ? '◐ Review note' : c.type === 'client_query' ? '◷ Client query' : 'Comment'}
                        {c.status === 'resolved' ? ' · resolved' : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-[#122654] break-words">{c.body}</p>
                    <div className="text-[10px] font-mono text-[#7E8DA6] mt-1">Anchor: {c.anchor_summary || 'Whole paper'}</div>
                    {(c.replies ?? []).map((r) => (
                      <div key={r.id} className="mt-2 pl-2 border-l-2 border-[#D3DCEE]">
                        <div className="text-[10px] font-bold text-[#122654]">
                          {r.created_by_name} · {fmtDateTime(r.created_at)}
                        </div>
                        <p className="text-[#122654] break-words">{r.body}</p>
                      </div>
                    ))}
                    {c.status === 'open' && !isLocked && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            aria-label={`Reply to ${c.created_by_name}`}
                            placeholder="Reply…"
                            value={replyDrafts[c.id] ?? ''}
                            onChange={(e) => setReplyDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && reply(c.id)}
                            className="flex-1 min-w-0 px-2 py-1 border border-[#D3DCEE] rounded-[6px]"
                          />
                          <button type="button" onClick={() => reply(c.id)} disabled={!replyDrafts[c.id]?.trim()} className="px-2 font-bold text-[#122654] disabled:opacity-40">
                            Reply
                          </button>
                        </div>
                        <button type="button" onClick={() => resolveNote(c.id)} className="self-end text-[11px] font-bold text-[#0B6B52] hover:underline">
                          ✓ Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!isLocked && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[#E3E7EF]">
                    <select aria-label="Comment type" value={noteType} onChange={(e) => setNoteType(e.target.value as typeof noteType)} className="min-h-[32px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white">
                      <option value="review_note">Review note (blocks sign-off)</option>
                      <option value="comment">Comment</option>
                      <option value="client_query">Client query</option>
                    </select>
                    <select aria-label="Comment on" value={noteAnchor} onChange={(e) => setNoteAnchor(e.target.value)} className="min-h-[32px] px-2 border border-[#D3DCEE] rounded-[8px] bg-white">
                      <option value="paper">Whole paper</option>
                      {result.anchors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      aria-label="New comment"
                      rows={3}
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Write a comment… type @name to tag a colleague"
                      className="p-2 border border-[#D3DCEE] rounded-[8px]"
                    />
                    <button type="button" onClick={addNote} disabled={!noteBody.trim()} className="min-h-[34px] bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] font-bold rounded-[8px] disabled:opacity-40">
                      Add {noteType === 'review_note' ? 'review note' : noteType === 'client_query' ? 'client query' : 'comment'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {sideTab === 'history' && (
              <div className="flex flex-col gap-3 text-xs">
                {/* Saved Versions (AUD-02) */}
                {db.schedule_versions.filter((v) => v.workpaper_id === workpaper.id).length > 0 && (
                  <div className="p-3 bg-[#F5F8FD] rounded-[10px] border border-[#E3E7EF] flex flex-col gap-1.5">
                    <span className="font-bold text-[#122654]">Saved Versions ({db.schedule_versions.filter((v) => v.workpaper_id === workpaper.id).length})</span>
                    <div className="flex flex-col gap-1">
                      {db.schedule_versions
                        .filter((v) => v.workpaper_id === workpaper.id)
                        .map((v) => (
                          <div key={v.id} className="p-2 bg-white rounded border border-[#D3DCEE] flex items-center justify-between">
                            <div>
                              <div className="font-bold text-[#122654]">Version {v.version_number}</div>
                              <div className="text-[10px] text-[#4A5878]">{v.created_by_name} · {fmtDateTime(v.created_at)}</div>
                              {v.reason && <div className="text-[10px] text-[#805B00] italic mt-0.5">"{v.reason}"</div>}
                            </div>
                            <span className="text-[10px] font-bold text-[#0B6B52]">Saved</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {versions.length >= 2 && <VersionCompare versions={versions} current={data} />}

                <ol className="flex flex-col gap-2 text-xs">
                  {history.length === 0 && <li className="text-[#4A5878]">No changes yet.</li>}
                  {history.map((h) => (
                    <li key={h.id} className="pb-2 border-b border-[#E3E7EF] last:border-0">
                      <div className="text-[#122654]">
                        <strong>{h.actor_name}</strong> {h.action.toLowerCase().replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-[#7E8DA6] font-mono">{fmtDateTime(h.at)}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#E3E7EF] text-[10px] text-[#4A5878]">
              {latestSignoff('preparer') ? '✓' : '○'} Preparer · {latestSignoff('reviewer') ? '✓' : '○'} Reviewer · {latestSignoff('partner') ? '✓' : '○'} Partner
              <br />
              Shortcuts: [ ] previous or next paper · paste to attach a screenshot
              {result.totals.nbv !== undefined && <div className="mt-1">NBV {formatPence(result.totals.nbv)}</div>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Pick two saved versions (or the current paper) and list every field that differs (AUD-02). */
function VersionCompare({ versions, current }: { versions: { id: string; version_number?: number; reason?: string; snapshot_data_json?: Record<string, any> }[]; current: Record<string, any> }) {
  const [a, setA] = useState(versions[versions.length - 2]?.id ?? '');
  const [b, setB] = useState('current');
  const pick = (id: string) => (id === 'current' ? current : versions.find((v) => v.id === id)?.snapshot_data_json ?? {});
  const changes = diffData(pick(a), pick(b));
  const options = (
    <>
      {versions.map((v) => (
        <option key={v.id} value={v.id}>Version {v.version_number}{v.reason ? ` (${v.reason.slice(0, 30)})` : ''}</option>
      ))}
      <option value="current">Current</option>
    </>
  );
  return (
    <div className="p-3 bg-white rounded-[10px] border border-[#E3E7EF] flex flex-col gap-2">
      <span className="font-bold text-[#122654]">Compare versions</span>
      <div className="flex gap-2">
        <select aria-label="Compare from" value={a} onChange={(e) => setA(e.target.value)} className="flex-1 min-h-[30px] px-1.5 border border-[#D3DCEE] rounded text-[11px]">{options}</select>
        <select aria-label="Compare to" value={b} onChange={(e) => setB(e.target.value)} className="flex-1 min-h-[30px] px-1.5 border border-[#D3DCEE] rounded text-[11px]">{options}</select>
      </div>
      {changes.length === 0 ? (
        <span className="text-[11px] text-[#4A5878]">No differences.</span>
      ) : (
        <ul className="text-[11px] flex flex-col gap-1">
          {changes.slice(0, 30).map((c) => (
            <li key={c.field}><span className="font-mono text-[#4A5878]">{c.field}</span>: {c.before || '—'} → <strong>{c.after || '—'}</strong></li>
          ))}
        </ul>
      )}
    </div>
  );
}
