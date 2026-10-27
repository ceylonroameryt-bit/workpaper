import crypto from 'crypto';
import { db } from './db';
import { TbSnapshotDiff, UserRole, AccountMapping, Adjustment, Workpaper, Comment, Attachment, Signoff, BlyntAccount } from '../types/models';
import { toPence, asPence, sumPence } from '../money';
import { runGated, learnFromCorrection, recordDecision, GatedResult } from './gate';
import { matchBlyntAccount } from '../mapping/auto-mapper';
import { getStatutoryDetails } from '../mapping/auto-mapper';

const abs = (n: bigint) => (n < 0n ? -n : n);

export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const services = {
  // Current session simulation (matching redesign board: Test Reviewer SO Audit manager)
  getCurrentUser(userId = 'usr_test_reviewer') {
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    const membership = db.memberships.find((m) => m.user_id === user.id) || {
      user_id: user.id,
      firm_id: 'firm_blynt_uk',
      role: 'reviewer' as UserRole,
    };
    return { user, membership };
  },

  // 1. Clients
  // clientIds: the member's assigned clients (null = all of the firm's clients)
  getClients(firmId: string, clientIds: string[] | null = null) {
    return db.clients.filter((c) => c.firm_id === firmId && (!clientIds || clientIds.includes(c.id)));
  },

  getClient(firmId: string, clientId: string, clientIds: string[] | null = null) {
    if (clientIds && !clientIds.includes(clientId)) return undefined;
    return db.clients.find((c) => c.firm_id === firmId && c.id === clientId);
  },

  createClient(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    data: { name: string; company_no: string; company_type: any; year_end: string; data_source: any }
  ) {
    const newClient = {
      id: `cli_${Date.now()}`,
      firm_id: firmId,
      name: data.name,
      company_no: data.company_no,
      company_type: data.company_type,
      year_end: data.year_end,
      data_source: data.data_source || 'csv',
      reconnect_needed: false,
    };
    db.clients.push(newClient);
    db.logAudit(firmId, actor, 'CREATE_CLIENT', 'clients', newClient.id, null, newClient);
    return newClient;
  },

  /**
   * Archives or restores a client. Archived clients are hidden from everyday lists and their
   * engagements are read-only; records are kept. Managers and above, or the practice owner.
   */
  setClientArchived(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    clientId: string,
    archived: boolean,
    reason = '',
    clientIds: string[] | null = null
  ) {
    const client = this.getClient(firmId, clientId, clientIds);
    if (!client) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
    const owner = db.firms.find((f) => f.id === firmId)?.owner_user_id === actor.id;
    if (!owner && !['manager', 'partner', 'admin'].includes(actor.role)) {
      throw new ServiceError('Only a manager, partner or admin can archive clients.', 403, 'FORBIDDEN');
    }
    if (Boolean(client.archived_at) === archived) return client;
    const before = { archived_at: client.archived_at ?? null, archived_by: client.archived_by ?? null, archive_reason: client.archive_reason ?? null };
    client.archived_at = archived ? new Date().toISOString() : null;
    client.archived_by = archived ? actor.id : null;
    client.archive_reason = archived ? reason.trim().slice(0, 300) || null : null;
    db.logAudit(firmId, actor, archived ? 'ARCHIVE_CLIENT' : 'RESTORE_CLIENT', 'clients', client.id, before, {
      archived_at: client.archived_at,
      archived_by: client.archived_by,
      archive_reason: client.archive_reason,
    }, archived ? client.archive_reason : null);
    return client;
  },

  // 2. Engagements
  getEngagement(firmId: string, engagementId: string) {
    const eng = db.engagements.find((e) => e.firm_id === firmId && e.id === engagementId);
    if (!eng) throw new ServiceError('Engagement not found', 404, 'NOT_FOUND');
    const client = db.clients.find((c) => c.id === eng.client_id);
    return { ...eng, client };
  },

  createEngagement(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    data: {
      client_id: string;
      period_start: string;
      period_end: string;
      framework: string;
      template_pack_id: string;
      prior_engagement_id?: string;
    },
    clientIds: string[] | null = null
  ) {
    const client = this.getClient(firmId, data.client_id, clientIds);
    if (!client) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
    if (client.archived_at) throw new ServiceError('This client is archived. Restore it before starting an engagement.', 409, 'ARCHIVED');
    const newEng = {
      id: `eng_${Date.now()}`,
      client_id: data.client_id,
      firm_id: firmId,
      period_start: data.period_start,
      period_end: data.period_end,
      framework: data.framework,
      template_pack_id: data.template_pack_id,
      status: 'planning' as const,
      locked_at: null,
      prior_engagement_id: data.prior_engagement_id || null,
    };
    db.engagements.push(newEng);
    db.createEngagementWorkpapers(newEng.id);
    db.logAudit(firmId, actor, 'CREATE_ENGAGEMENT', 'engagements', newEng.id, null, newEng);
    return newEng;
  },

  // 3. Mapping Engine & Balance Verification
  getAccountMappings(engagementId: string) {
    const mappings = db.account_mappings.filter((m) => m.engagement_id === engagementId);
    
    // Calculate unmapped balance strictly using BigInt pence
    const unmappedBalancePence = mappings
      .filter((m) => m.status !== 'confirmed')
      .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

    const counts = {
      total: mappings.length,
      confirmed: mappings.filter((m) => m.status === 'confirmed').length,
      suggested: mappings.filter((m) => m.status === 'suggested').length,
      needs_you: mappings.filter((m) => m.status === 'needs_you').length,
      unmappedBalancePence,
    };

    return { mappings, counts };
  },

  /**
   * DAT-03/04: client rules > practice rules > prior-year mapping > name and code patterns,
   * through the shared confidence gate. Used by every TB import.
   */
  suggestMapping(
    firmId: string,
    engagementId: string,
    line: { code: string; name: string; type?: string }
  ): GatedResult<string> {
    const eng = db.engagements.find((e) => e.id === engagementId);
    const prior = eng?.prior_engagement_id
      ? db.account_mappings.find((m) => m.engagement_id === eng.prior_engagement_id && m.source_code === line.code && m.status === 'confirmed' && m.blynt_code)
      : undefined;
    return runGated<string>({
      firmId,
      outputType: 'mapping',
      ruleType: 'mapping',
      keys: [`code:${line.code}`, `name:${line.name}`],
      clientId: eng?.client_id,
      decode: (target) => target,
      ai: () => {
        if (prior?.blynt_code) {
          return { value: prior.blynt_code, confidence: 97, reason: `Mapped to ${prior.blynt_code} last year`, evidence: 'Prior-year mapping' };
        }
        const s = matchBlyntAccount(line.name, line.type || '', line.code);
        return s ? { value: s.blynt_code, confidence: s.confidence, reason: s.reason, evidence: 'Name pattern > Nominal code range' } : null;
      },
    });
  },

  /** Builds the account mapping row for one imported TB line. */
  buildMapping(firmId: string, engagementId: string, id: string, line: { code: string; name: string; type?: string }, balanceP: bigint): AccountMapping {
    const g = this.suggestMapping(firmId, engagementId, line);
    const stat = getStatutoryDetails(g.value, line.name, line.type || '');
    return {
      id,
      engagement_id: engagementId,
      source_code: line.code,
      source_name: line.name,
      source_type: line.type || 'General',
      balance_p: balanceP.toString(),
      blynt_code: g.value,
      status: g.accepted ? 'confirmed' : g.value ? 'suggested' : 'needs_you',
      confidence: g.confidence,
      method: g.source === 'rule' ? 'rule' : g.source === 'ai' ? 'ai' : 'manual',
      statutory_line: stat.statutory_line,
      schedule_ref: stat.schedule_ref,
      cash_flow_category: stat.cash_flow_category,
      ai_reason: g.reason,
      evidence_used: g.evidence,
      sign_mismatch: g.value ? (stat.is_credit_area && balanceP > 0n) || (!stat.is_credit_area && balanceP < 0n) : false,
      gate: g.gate,
      // A rule-mapped account needs no review; the rule is the record of who decided
      confirmed_by: g.accepted ? (g.rule_id ? `rule:${g.rule_id}` : 'auto_accept') : null,
      confirmed_at: g.accepted ? new Date().toISOString() : null,
      comment_count: 0,
    };
  },

  /**
   * DAT-06: account-level movements between two snapshots (net pence, debit positive).
   * Direction follows the size of the balance, as accountants read it: a credit balance that grows has increased.
   */
  diffSnapshots(priorSnapshotId: string | null | undefined, lines: { code: string; name: string; net_p: bigint }[]): TbSnapshotDiff[] {
    if (!priorSnapshotId) return [];
    const prior = new Map<string, { name: string; net: bigint }>();
    for (const l of db.tb_lines.filter((x) => x.snapshot_id === priorSnapshotId)) {
      prior.set(l.source_code, { name: l.source_name, net: asPence(l.debit_p) - asPence(l.credit_p) });
    }
    const out: TbSnapshotDiff[] = [];
    const seen = new Set<string>();
    for (const l of lines) {
      seen.add(l.code);
      const p = prior.get(l.code);
      const before = p?.net ?? 0n;
      if (p && before === l.net_p) continue;
      if (!p && l.net_p === 0n) continue;
      out.push({
        account_code: l.code, account_name: l.name, prior_amount_p: before.toString(), new_amount_p: l.net_p.toString(),
        diff_p: (l.net_p - before).toString(), direction: !p ? 'new' : abs(l.net_p) > abs(before) ? 'increased' : 'decreased',
      });
    }
    for (const [code, p] of prior) {
      if (!seen.has(code) && p.net !== 0n) {
        out.push({ account_code: code, account_name: p.name, prior_amount_p: p.net.toString(), new_amount_p: '0', diff_p: (-p.net).toString(), direction: 'decreased' });
      }
    }
    return out;
  },

  confirmSelectedMappings(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    engagementId: string,
    ids: string[]
  ) {
    if (!ids || ids.length === 0) {
      throw new ServiceError('No accounts selected for confirmation', 400);
    }
    const updated: AccountMapping[] = [];

    ids.forEach((id) => {
      const mapping = db.account_mappings.find((m) => m.id === id && m.engagement_id === engagementId);
      if (mapping) {
        const before = { ...mapping };
        if (mapping.status === 'confirmed') return;
        mapping.status = 'confirmed';
        mapping.confirmed_by = actor.id;
        mapping.confirmed_at = new Date().toISOString();
        updated.push(mapping);
        db.logAudit(firmId, actor, 'CONFIRM_MAPPING', 'account_mappings', mapping.id, before, mapping);
        if (before.method === 'ai' && before.blynt_code) {
          recordDecision({ ...actor, firmId }, {
            engagementId, outputType: 'mapping', itemRef: mapping.source_code, confidence: before.confidence,
            outcome: 'accepted', inputs: before.evidence_used || before.ai_reason || '',
          });
        }
      }
    });

    return updated;
  },

  updateMapping(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    mappingId: string,
    blyntCode: string
  ) {
    const mapping = db.account_mappings.find((m) => m.id === mappingId);
    if (!mapping) throw new ServiceError('Mapping not found', 404);
    if (!db.blynt_accounts.some((a) => a.code === blyntCode)) throw new ServiceError('Unknown statutory account code', 400);
    const before = { ...mapping };
    const stat = getStatutoryDetails(blyntCode, mapping.source_name, mapping.source_type);
    mapping.blynt_code = blyntCode;
    mapping.status = 'confirmed';
    mapping.confirmed_by = actor.id;
    mapping.confirmed_at = new Date().toISOString();
    mapping.method = 'manual';
    mapping.statutory_line = stat.statutory_line;
    mapping.schedule_ref = stat.schedule_ref;
    mapping.cash_flow_category = stat.cash_flow_category;
    mapping.gate = 'ready';
    db.logAudit(firmId, actor, 'UPDATE_MAPPING', 'account_mappings', mapping.id, before, mapping);

    const changed = before.blynt_code !== blyntCode;
    if (before.method === 'ai' && before.blynt_code) {
      recordDecision({ ...actor, firmId }, {
        engagementId: mapping.engagement_id, outputType: 'mapping', itemRef: mapping.source_code, confidence: before.confidence,
        outcome: changed ? 'edited' : 'accepted', inputs: before.evidence_used || before.ai_reason || '',
      });
    }
    // DAT-05/09: a correction maps this account the same way on this client's next import
    if (changed || before.status === 'needs_you') {
      const clientId = db.engagements.find((e) => e.id === mapping.engagement_id)?.client_id ?? null;
      learnFromCorrection({ ...actor, firmId }, {
        type: 'mapping', scope: 'client', client_id: clientId, pattern: `code:${mapping.source_code}`, target_value: blyntCode,
        explanation: `${mapping.source_code} ${mapping.source_name} maps to ${blyntCode}`,
      });
    }
    return mapping;
  },

  // 4. Trial Balance & Adjustments
  getTrialBalance(engagementId: string) {
    const mappings = db.account_mappings.filter((m) => m.engagement_id === engagementId);
    
    // Check if TB is locked due to unmapped balance
    const unmappedBalancePence = mappings
      .filter((m) => m.status !== 'confirmed')
      .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

    const isLockedByUnmapped = unmappedBalancePence !== 0n;

    // Aggregate by Blynt Code & Lead Schedule
    const leadMap: Record<string, {
      lead_letter: string;
      lead_name: string;
      accounts: BlyntAccount[];
      draft_pence: bigint;
      adjustments_pence: bigint;
      final_pence: bigint;
      prior_year_pence: bigint;
      workpaper?: Workpaper;
    }> = {};

    db.blynt_accounts.forEach((acc) => {
      const letter = acc.lead_letter;
      if (!leadMap[letter]) {
        leadMap[letter] = {
          lead_letter: letter,
          lead_name: `Schedule ${letter}`,
          accounts: [],
          draft_pence: 0n,
          adjustments_pence: 0n,
          final_pence: 0n,
          prior_year_pence: 0n,
          workpaper: db.workpapers.find((w) => w.engagement_id === engagementId && w.ref.startsWith(letter)),
        };
      }
      leadMap[letter].accounts.push(acc);
    });

    // Populate lines from mappings
    let totalDebitPence = 0n;
    let totalCreditPence = 0n;

    mappings.forEach((m) => {
      const balance = asPence(m.balance_p);
      if (balance > 0n) totalDebitPence += balance;
      else totalCreditPence += -balance;

      if (m.blynt_code) {
        const blyntAcc = db.blynt_accounts.find((b) => b.code === m.blynt_code);
        if (blyntAcc && leadMap[blyntAcc.lead_letter]) {
          leadMap[blyntAcc.lead_letter].draft_pence += balance;
        }
      }
    });

    // Apply posted or approved adjustments
    const approvedAdjustments = db.adjustments.filter(
      (a) => a.engagement_id === engagementId && (a.status === 'approved' || a.status === 'posted')
    );

    approvedAdjustments.forEach((adj) => {
      adj.lines.forEach((line) => {
        const netAdj = asPence(line.debit_p) - asPence(line.credit_p);
        const blyntAcc = db.blynt_accounts.find((b) => b.code === line.blynt_code);
        if (blyntAcc && leadMap[blyntAcc.lead_letter]) {
          leadMap[blyntAcc.lead_letter].adjustments_pence += netAdj;
        }
      });
    });

    // Calculate final pence and net row
    let netTotalPence = 0n;
    Object.values(leadMap).forEach((lead) => {
      lead.final_pence = lead.draft_pence + lead.adjustments_pence;
      netTotalPence += lead.final_pence;
    });

    return {
      isLockedByUnmapped,
      unmappedBalancePence,
      totalDebitPence,
      totalCreditPence,
      differencePence: totalDebitPence - totalCreditPence,
      netTotalPence,
      leads: Object.values(leadMap),
    };
  },

  // Ground Rule 5: Permissions are checked on the server for every action
  // "Preparer cannot approve their own adjustment (403, audited)"
  approveAdjustment(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    adjustmentId: string
  ) {
    const adj = db.adjustments.find((a) => a.id === adjustmentId);
    if (!adj) throw new ServiceError('Adjustment not found', 404);

    // Rule: Approver must differ from proposer
    if (adj.proposed_by === actor.id) {
      db.logAudit(firmId, actor, 'REJECTED_SELF_APPROVAL', 'adjustments', adjustmentId, null, {
        reason: 'Proposer cannot approve their own adjustment',
      });
      throw new ServiceError(
        'Proposer cannot approve their own adjustment. A different reviewer, manager, or partner is required.',
        403,
        'FORBIDDEN_SELF_APPROVAL'
      );
    }

    // Rule: Must be reviewer or above
    const allowedRoles: UserRole[] = ['reviewer', 'manager', 'partner', 'admin'];
    if (!allowedRoles.includes(actor.role)) {
      db.logAudit(firmId, actor, 'REJECTED_UNAUTHORIZED_APPROVAL', 'adjustments', adjustmentId, null, {
        role: actor.role,
      });
      throw new ServiceError(
        'Insufficient permissions. Only reviewer role or above may approve adjustments.',
        403,
        'FORBIDDEN_ROLE'
      );
    }

    const before = { ...adj };
    adj.status = 'approved';
    adj.approved_by = actor.id;
    adj.approved_by_name = actor.name;

    db.logAudit(firmId, actor, 'APPROVE_ADJUSTMENT', 'adjustments', adjustmentId, before, adj);
    return adj;
  },

  // 5. Working Papers
  getWorkpaper(workpaperId: string) {
    const wp = db.workpapers.find((w) => w.id === workpaperId || w.ref === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    const template = db.templates.find((t) => t.id === wp.template_id);
    const procedures = db.procedures.filter((p) => p.workpaper_id === wp.id);
    const comments = db.comments.filter((c) => c.workpaper_id === wp.id);
    const attachments = db.attachments.filter((a) => a.workpaper_id === wp.id);
    const signoffs = db.signoffs.filter((s) => s.workpaper_id === wp.id);

    return {
      workpaper: wp,
      template,
      procedures,
      comments,
      attachments,
      signoffs,
    };
  },

  updateWorkpaperData(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    workpaperId: string,
    dataJson: Record<string, any>
  ) {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    const before = { ...wp, data_json: { ...wp.data_json } };
    wp.data_json = { ...wp.data_json, ...dataJson };
    wp.updated_at = new Date().toISOString();

    // Ground Rule: Editing a reviewed paper marks reviewer sign-off stale
    db.signoffs
      .filter((s) => s.workpaper_id === wp.id && !s.stale_at)
      .forEach((sig) => {
        sig.stale_at = new Date().toISOString();
        sig.stale_reason = `Modified by ${actor.name} on ${new Date().toLocaleDateString('en-GB')}`;
      });

    db.logAudit(firmId, actor, 'UPDATE_WORKPAPER', 'workpapers', wp.id, before, wp);
    return wp;
  },

  // 6. Comments Anywhere
  addComment(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    workpaperId: string,
    data: { type: 'comment' | 'review_note' | 'client_query'; anchor_json: any; body: string }
  ) {
    const newComment: Comment = {
      id: `com_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workpaper_id: workpaperId,
      type: data.type,
      anchor_json: data.anchor_json,
      anchor_summary: data.anchor_json?.row || data.anchor_json?.section || 'Paper level',
      status: 'open',
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
      resolved_by: null,
      body: data.body,
      replies: [],
    };
    db.comments.push(newComment);
    db.logAudit(firmId, actor, 'CREATE_COMMENT', 'comments', newComment.id, null, newComment);
    return newComment;
  },

  resolveComment(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    commentId: string
  ) {
    const comment = db.comments.find((c) => c.id === commentId);
    if (!comment) throw new ServiceError('Comment not found', 404);

    // Review notes can only be resolved by reviewer, manager, partner or admin
    if (comment.type === 'review_note' && !['reviewer', 'manager', 'partner', 'admin'].includes(actor.role)) {
      throw new ServiceError('Review notes may only be resolved by a reviewer or partner.', 403);
    }

    const before = { ...comment };
    comment.status = 'resolved';
    comment.resolved_by = actor.id;
    comment.resolved_by_name = actor.name;
    comment.resolved_at = new Date().toISOString();

    db.logAudit(firmId, actor, 'RESOLVE_COMMENT', 'comments', comment.id, before, comment);
    return comment;
  },

  // 7. Attachments with SHA-256 Checksum
  uploadAttachment(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    engagementId: string,
    workpaperId: string | null,
    file: { filename: string; mime: string; size: number; content: string | Buffer; category: any; is_permanent?: boolean }
  ) {
    const hash = crypto.createHash('sha256').update(file.content).digest('hex');
    const attachment: Attachment = {
      id: `att_${Date.now()}`,
      engagement_id: engagementId,
      workpaper_id: workpaperId,
      file_key: `uploads/${engagementId}/${file.filename}`,
      filename: file.filename,
      mime: file.mime,
      size: file.size,
      sha256: hash,
      category: file.category || 'Other',
      is_permanent: !!file.is_permanent,
      uploaded_by: actor.id,
      uploaded_by_name: actor.name,
      uploaded_at: new Date().toISOString(),
    };

    db.attachments.push(attachment);
    db.logAudit(firmId, actor, 'UPLOAD_ATTACHMENT', 'attachments', attachment.id, null, {
      filename: attachment.filename,
      sha256: attachment.sha256,
      size: attachment.size,
    });
    return attachment;
  },

  deleteAttachment(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    attachmentId: string
  ) {
    const idx = db.attachments.findIndex((a) => a.id === attachmentId);
    if (idx === -1) throw new ServiceError('Attachment not found', 404);
    const att = db.attachments[idx];

    // Rule: delete only by uploader before sign-off
    if (att.uploaded_by !== actor.id && actor.role !== 'admin') {
      throw new ServiceError('Only the original uploader or an admin can delete an attachment', 403);
    }

    db.attachments.splice(idx, 1);
    db.logAudit(firmId, actor, 'DELETE_ATTACHMENT', 'attachments', attachmentId, att, null);
    return { success: true };
  },

  // 8. Sign-off and Lock Engagement Blocker Checker
  getEngagementBlockers(engagementId: string) {
    const blockers: { id: string; title: string; category: string; passed: boolean; count?: number }[] = [];

    // Check 1: Unmapped Accounts Balance
    const mappings = db.account_mappings.filter((m) => m.engagement_id === engagementId);
    const unmappedBalancePence = mappings
      .filter((m) => m.status !== 'confirmed')
      .reduce((acc, m) => acc + asPence(m.balance_p), 0n);

    blockers.push({
      id: 'unmapped_balance',
      title: 'Unmapped accounts must have zero net balance',
      category: 'Trial Balance',
      passed: unmappedBalancePence === 0n,
    });

    // Check 2: Unapproved Adjustments
    const unapprovedAdjs = db.adjustments.filter(
      (a) => a.engagement_id === engagementId && a.status === 'proposed'
    );
    blockers.push({
      id: 'unapproved_adjustments',
      title: 'All proposed adjustments must be approved or resolved',
      category: 'Adjustments',
      passed: unapprovedAdjs.length === 0,
      count: unapprovedAdjs.length,
    });

    // Check 3: Open Review Notes
    const openNotes = db.comments.filter((c) => {
      const wp = db.workpapers.find((w) => w.id === c.workpaper_id);
      return wp?.engagement_id === engagementId && c.type === 'review_note' && c.status === 'open';
    });
    blockers.push({
      id: 'open_review_notes',
      title: 'Zero open review notes across all papers',
      category: 'Review',
      passed: openNotes.length === 0,
      count: openNotes.length,
    });

    // Check 4: Stale Sign-offs
    // A stale sign-off only blocks until the same role signs that paper again
    const staleSignoffs = db.signoffs.filter((s) => {
      const wp = db.workpapers.find((w) => w.id === s.workpaper_id);
      if (wp?.engagement_id !== engagementId || !s.stale_at) return false;
      return !db.signoffs.some(
        (o) => o.workpaper_id === s.workpaper_id && o.role === s.role && !o.stale_at && o.signed_at >= s.signed_at
      );
    });
    blockers.push({
      id: 'stale_signoffs',
      title: 'Zero stale sign-offs (content modified after sign-off)',
      category: 'Sign-off',
      passed: staleSignoffs.length === 0,
      count: staleSignoffs.length,
    });

    // Check 5: Prepared Status for All Papers
    const unPrepared = db.workpapers.filter(
      (w) => w.engagement_id === engagementId && w.status !== 'prepared' && w.status !== 'signed_off'
    );
    blockers.push({
      id: 'unprepared_papers',
      title: 'All working papers must be prepared',
      category: 'Workpapers',
      passed: unPrepared.length === 0,
      count: unPrepared.length,
    });

    const canLock = blockers.every((b) => b.passed);
    return { blockers, canLock, isBlocked: !canLock };
  },

  lockEngagement(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    engagementId: string
  ) {
    if (actor.role !== 'partner' && actor.role !== 'admin') {
      throw new ServiceError('Only an engagement partner or admin can lock the engagement.', 403);
    }
    const { canLock, blockers } = this.getEngagementBlockers(engagementId);
    if (!canLock) {
      const failed = blockers.filter((b) => !b.passed).map((b) => b.title).join(', ');
      throw new ServiceError(`Cannot lock engagement due to unresolved blockers: ${failed}`, 400);
    }

    const eng = db.engagements.find((e) => e.id === engagementId && e.firm_id === firmId);
    if (!eng) throw new ServiceError('Engagement not found', 404);

    const before = { ...eng };
    eng.status = 'locked';
    eng.locked_at = new Date().toISOString();
    eng.locked_by = actor.id;

    db.logAudit(firmId, actor, 'LOCK_ENGAGEMENT', 'engagements', eng.id, before, eng);
    return eng;
  },

  unlockEngagement(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    engagementId: string,
    reason: string
  ) {
    if (actor.role !== 'partner' && actor.role !== 'admin') {
      throw new ServiceError('Only an engagement partner or admin can unlock an engagement.', 403);
    }
    if (!reason || reason.trim().length < 10) {
      throw new ServiceError('A detailed reason is required to unlock a completed engagement.', 400);
    }

    const eng = db.engagements.find((e) => e.id === engagementId && e.firm_id === firmId);
    if (!eng) throw new ServiceError('Engagement not found', 404);

    const before = { ...eng };
    eng.status = 'fieldwork';
    eng.locked_at = null;
    eng.locked_by = null;

    db.logAudit(firmId, actor, 'UNLOCK_ENGAGEMENT', 'engagements', eng.id, before, { ...eng, unlock_reason: reason });
    return eng;
  },

  // 9. Roll Forward from Prior Year
  rollForwardPaper(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    workpaperId: string
  ) {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    const eng = db.engagements.find((e) => e.id === wp.engagement_id);
    if (!eng || !eng.prior_engagement_id) {
      throw new ServiceError('No prior year engagement linked for roll forward.', 400);
    }

    // Find prior year paper with matching ref
    const pyWp = db.workpapers.find(
      (w) => w.engagement_id === eng.prior_engagement_id && w.ref === wp.ref
    );
    if (!pyWp) {
      throw new ServiceError(`No prior year working paper found for ${wp.ref}`, 404);
    }

    const before = JSON.parse(JSON.stringify(wp.data_json));
    const pyData = pyWp.data_json;

    // Roll forward: closing balances become opening balances
    const rolledClasses = (pyData.classes || []).map((c: any) => ({
      name: c.name,
      cost_opening_p: c.cost_closing_p || '0',
      cost_opening_is_py: true,
      cost_additions_p: '0',
      cost_disposals_p: '0',
      cost_closing_p: c.cost_closing_p || '0',
      deprec_opening_p: c.deprec_closing_p || '0',
      deprec_opening_is_py: true,
      deprec_charge_p: '0',
      deprec_disposals_p: '0',
      deprec_closing_p: c.deprec_closing_p || '0',
      nbv_prior_year_p: c.nbv_this_year_p || '0',
      nbv_this_year_p: c.nbv_this_year_p || '0',
      deprec_rate: c.deprec_rate || '20% straight line',
    }));

    wp.data_json = {
      ...wp.data_json,
      classes: rolledClasses,
      rolled_at: new Date().toISOString(),
      previous_data_backup: before,
    };
    wp.rolled_from_workpaper_id = pyWp.id;

    db.logAudit(firmId, actor, 'ROLL_FORWARD_WORKPAPER', 'workpapers', wp.id, before, wp.data_json);
    return wp;
  },

  undoRollForward(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    workpaperId: string
  ) {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    if (!wp.data_json.previous_data_backup) {
      throw new ServiceError('No previous state available to undo roll forward.', 400);
    }

    const before = { ...wp.data_json };
    wp.data_json = wp.data_json.previous_data_backup;
    wp.rolled_from_workpaper_id = null;

    db.logAudit(firmId, actor, 'UNDO_ROLL_FORWARD', 'workpapers', wp.id, before, wp.data_json);
    return wp;
  },

  // 10. Change Template
  changeTemplate(
    firmId: string,
    actor: { id: string; name: string; role: UserRole },
    workpaperId: string,
    targetTemplateId: string,
    dryRun = false
  ) {
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    const targetTemplate = db.templates.find((t) => t.id === targetTemplateId);
    if (!targetTemplate) throw new ServiceError('Target template not found', 404);

    // Impact preview
    const existingKeys = Object.keys(wp.data_json);
    const impactPreview = {
      fromTemplateId: wp.template_id,
      toTemplateId: targetTemplate.id,
      retainedFields: existingKeys,
      newEmptyFields: ['additional_notes', 'risk_assessment'],
      hasSignoffs: db.signoffs.some((s) => s.workpaper_id === wp.id),
    };

    if (dryRun) {
      return { dryRun: true, impactPreview };
    }

    const before = {
      template_id: wp.template_id,
      template_version: wp.template_version,
      data_json: { ...wp.data_json },
    };

    wp.template_id = targetTemplate.id;
    wp.template_version = targetTemplate.version;
    wp.data_json = {
      ...wp.data_json,
      previous_template_id: before.template_id,
    };

    // Stale any existing sign-offs
    db.signoffs
      .filter((s) => s.workpaper_id === wp.id)
      .forEach((s) => {
        s.stale_at = new Date().toISOString();
        s.stale_reason = `Template switched to ${targetTemplate.name}`;
      });

    db.logAudit(firmId, actor, 'CHANGE_TEMPLATE', 'workpapers', wp.id, before, {
      template_id: wp.template_id,
      template_version: wp.template_version,
    });

    return { success: true, workpaper: wp, impactPreview };
  },

  getSignoffMatrix(engagementId: string) {
    const wps = db.workpapers.filter((w) => w.engagement_id === engagementId);
    const signoffs = db.signoffs;

    return wps.map((wp) => {
      const pSign = signoffs.find((s) => s.workpaper_id === wp.id && s.role === 'preparer');
      const rSign = signoffs.find((s) => s.workpaper_id === wp.id && s.role === 'reviewer');
      const partSign = signoffs.find((s) => s.workpaper_id === wp.id && s.role === 'partner');

      return {
        workpaperId: wp.id,
        ref: wp.ref,
        title: wp.ref === 'F-10' ? 'Fixed asset register and depreciation' : 'Bank reconciliation',
        status: wp.status,
        preparer: pSign
          ? {
              user_id: pSign.user_id,
              initials: 'AK',
              signed_at: pSign.signed_at,
              is_stale: pSign.stale_at !== null,
            }
          : null,
        reviewer: rSign
          ? {
              user_id: rSign.user_id,
              initials: 'SR',
              signed_at: rSign.signed_at,
              is_stale: rSign.stale_at !== null,
            }
          : null,
        partner: partSign
          ? {
              user_id: partSign.user_id,
              initials: 'PL',
              signed_at: partSign.signed_at,
              is_stale: partSign.stale_at !== null,
            }
          : null,
      };
    });
  },
};
