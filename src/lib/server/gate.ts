import crypto from 'crypto';
import { db } from './db';
import { Actor } from './state-guard';
import { AiActionLogItem, LearnedRule, RuleScope, RuleType, UserRole } from '../types/models';

/**
 * DAT-08 confidence gate + DAT-09 rules library + AUD-03 AI action log, behind one interface.
 *
 *   runGated()           rules first (supplier > client > practice), then the AI, then the gate
 *   learnFromCorrection() a person's correction becomes a rule for next time
 *   recordDecision()      every accepted / edited / rejected AI output goes to the action log
 *   accuracy()            share of AI outputs accepted without change, per output type
 *
 * Mapping is the first caller; any later output type (extraction, journals, findings) uses the
 * same calls with its own `outputType` and `ruleType`.
 */

export type OutputType = AiActionLogItem['output_type'];
export type Gate = 'ready' | 'check' | 'exception';

export interface GateThresholds {
  ready: number; // confidence at or above this is Ready
  check: number; // at or above this is Check; below is Exception
  auto_accept: boolean; // DAT-08: built but off at launch
}

export const DEFAULT_THRESHOLDS: Record<OutputType, GateThresholds> = {
  mapping: { ready: 90, check: 70, auto_accept: false },
  extraction: { ready: 95, check: 75, auto_accept: false },
  journal: { ready: 95, check: 80, auto_accept: false },
  finding: { ready: 90, check: 70, auto_accept: false },
  note: { ready: 90, check: 70, auto_accept: false },
  commentary: { ready: 90, check: 70, auto_accept: false },
};

/** Practice settings override the defaults per output type. */
export function thresholdsFor(firmId: string, outputType: OutputType): GateThresholds {
  const firm = db.firms.find((f) => f.id === firmId);
  return { ...DEFAULT_THRESHOLDS[outputType], ...(firm?.settings?.gate?.[outputType] ?? {}) };
}

export function gateFor(firmId: string, outputType: OutputType, confidence: number): Gate {
  const t = thresholdsFor(firmId, outputType);
  return confidence >= t.ready ? 'ready' : confidence >= t.check ? 'check' : 'exception';
}

export interface AiProposal<T> {
  value: T;
  confidence: number; // 0-100
  reason: string;
  evidence: string;
}

export interface GatedResult<T> {
  value: T | null;
  confidence: number;
  reason: string;
  evidence: string;
  gate: Gate;
  source: 'rule' | 'ai' | 'none';
  rule_id?: string;
  /** True when no person needs to look: a rule matched, or auto-accept is on and the gate is Ready. */
  accepted: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const SCOPE_ORDER: RuleScope[] = ['supplier', 'client', 'practice'];

/**
 * Rule patterns are either a typed key ("code:4000", "name:sales ledger"), matched exactly,
 * or a bare name pattern where * is a wildcard ("*rent*"), matched against the item's name key.
 */
function patternMatches(pattern: string, keys: string[]): boolean {
  const p = norm(pattern);
  if (/^[a-z]+:/.test(p) && !p.includes('*')) return keys.some((k) => norm(k) === p);
  const [prefix, body] = /^[a-z]+:/.test(p) ? [p.slice(0, p.indexOf(':') + 1), p.slice(p.indexOf(':') + 1)] : ['name:', p];
  const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${body.split('*').map(escape).join('.*')}$`, 'i');
  return keys.some((k) => norm(k).startsWith(prefix) && re.test(norm(k).slice(prefix.length)));
}

/** The most specific active rule whose pattern matches one of the keys. */
export function findRule(
  firmId: string,
  ruleType: RuleType,
  keys: string[],
  ctx: { clientId?: string | null; supplier?: string | null } = {}
): LearnedRule | undefined {
  const candidates = db.learned_rules.filter(
    (r) =>
      r.firm_id === firmId &&
      r.type === ruleType &&
      r.active &&
      patternMatches(r.pattern, keys) &&
      (r.scope !== 'client' || r.client_id === ctx.clientId) &&
      (r.scope !== 'supplier' || (ctx.supplier && norm(r.supplier_name || '') === norm(ctx.supplier))) &&
      (r.scope !== 'practice' || r.approved_by_manager)
  );
  const wild = (r: LearnedRule) => (r.pattern.includes('*') ? 1 : 0);
  candidates.sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope) || wild(a) - wild(b));
  return candidates[0];
}

/**
 * Runs one AI output through rules then the gate. `keys` identify the item for rule matching
 * (e.g. "code:4000", "name:sales"); `decode` turns a rule's target_value into a value; `ai`
 * is only called when no rule matched.
 */
export function runGated<T>(opts: {
  firmId: string;
  outputType: OutputType;
  ruleType: RuleType;
  keys: string[];
  clientId?: string | null;
  supplier?: string | null;
  decode: (target: string) => T;
  ai: () => AiProposal<T> | null;
}): GatedResult<T> {
  const rule = findRule(opts.firmId, opts.ruleType, opts.keys, { clientId: opts.clientId, supplier: opts.supplier });
  if (rule) {
    rule.times_used += 1;
    return {
      value: opts.decode(rule.target_value),
      confidence: 100,
      reason: `${rule.scope[0].toUpperCase()}${rule.scope.slice(1)} rule: ${rule.explanation || rule.pattern}`,
      evidence: `Rule ${rule.id} set by ${rule.created_by_name}`,
      gate: 'ready',
      source: 'rule',
      rule_id: rule.id,
      accepted: true,
    };
  }
  const p = opts.ai();
  if (!p) {
    return { value: null, confidence: 0, reason: 'No rule or AI suggestion found', evidence: '', gate: 'exception', source: 'none', accepted: false };
  }
  const gate = gateFor(opts.firmId, opts.outputType, p.confidence);
  return {
    value: p.value,
    confidence: p.confidence,
    reason: p.reason,
    evidence: p.evidence,
    gate,
    source: 'ai',
    accepted: gate === 'ready' && thresholdsFor(opts.firmId, opts.outputType).auto_accept,
  };
}

const MANAGER_UP: UserRole[] = ['manager', 'partner', 'admin'];

/**
 * DAT-09: a correction becomes a rule. Client and supplier rules apply at once; a practice rule
 * from someone below manager waits for manager approval before it runs.
 */
export function learnFromCorrection(
  actor: Actor,
  rule: { type: RuleType; scope: RuleScope; pattern: string; target_value: string; client_id?: string | null; supplier_name?: string | null; explanation?: string }
): LearnedRule {
  const approved = rule.scope !== 'practice' || MANAGER_UP.includes(actor.role);
  const existing = db.learned_rules.find(
    (r) =>
      r.firm_id === actor.firmId &&
      r.type === rule.type &&
      r.scope === rule.scope &&
      norm(r.pattern) === norm(rule.pattern) &&
      (r.client_id ?? null) === (rule.client_id ?? null) &&
      norm(r.supplier_name || '') === norm(rule.supplier_name || '')
  );
  if (existing) {
    const before = { ...existing };
    existing.target_value = rule.target_value;
    existing.explanation = rule.explanation ?? existing.explanation;
    existing.active = approved;
    existing.approved_by_manager = rule.scope === 'practice' ? approved : existing.approved_by_manager;
    db.logAudit(actor.firmId, actor, 'UPDATE_RULE', 'learned_rules', existing.id, before, existing);
    return existing;
  }
  const created: LearnedRule = {
    id: `rule_${crypto.randomUUID()}`,
    firm_id: actor.firmId,
    client_id: rule.scope === 'practice' ? null : rule.client_id ?? null,
    supplier_name: rule.supplier_name ?? null,
    type: rule.type,
    scope: rule.scope,
    pattern: rule.pattern,
    target_value: rule.target_value,
    explanation: rule.explanation,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: new Date().toISOString(),
    times_used: 0,
    active: approved,
    approved_by_manager: rule.scope === 'practice' ? approved : undefined,
  };
  db.learned_rules.push(created);
  db.logAudit(actor.firmId, actor, 'CREATE_RULE', 'learned_rules', created.id, null, created);
  return created;
}

/** A manager approves a pending practice rule so it starts running. */
export function approveRule(actor: Actor, ruleId: string): LearnedRule {
  if (!MANAGER_UP.includes(actor.role)) throw new Error('Only a manager or above can approve practice rules.');
  const r = db.learned_rules.find((x) => x.id === ruleId && x.firm_id === actor.firmId);
  if (!r) throw new Error('Rule not found');
  const before = { ...r };
  r.approved_by_manager = true;
  r.active = true;
  db.logAudit(actor.firmId, actor, 'APPROVE_RULE', 'learned_rules', r.id, before, r);
  return r;
}

/** AUD-03: one row per AI output a person (or auto-accept) decided on. */
export function recordDecision(
  actor: Pick<Actor, 'id' | 'name' | 'firmId'>,
  d: {
    engagementId: string;
    outputType: OutputType;
    itemRef: string;
    confidence: number;
    outcome: AiActionLogItem['outcome'];
    inputs: string;
    modelVersion?: string;
    rejectionReason?: string;
  }
): AiActionLogItem {
  const row: AiActionLogItem = {
    id: `act_${crypto.randomUUID()}`,
    firm_id: actor.firmId,
    engagement_id: d.engagementId,
    output_type: d.outputType,
    item_ref: d.itemRef,
    inputs_used: d.inputs,
    confidence: d.confidence,
    model_version: d.modelVersion ?? 'rules-patterns-v1',
    outcome: d.outcome,
    decided_by: actor.id,
    decided_by_name: actor.name,
    decided_at: new Date().toISOString(),
    rejection_reason: d.rejectionReason,
  };
  db.ai_action_logs.push(row);
  return row;
}

/** Share of decided AI outputs accepted without change (the 90% target is measured here). */
export function accuracy(firmId: string, outputType: OutputType, engagementId?: string) {
  const rows = db.ai_action_logs.filter(
    (r) => r.firm_id === firmId && r.output_type === outputType && (!engagementId || r.engagement_id === engagementId)
  );
  const unchanged = rows.filter((r) => r.outcome === 'accepted' || r.outcome === 'auto_accepted').length;
  return {
    output_type: outputType,
    decided: rows.length,
    accepted_unchanged: unchanged,
    edited: rows.filter((r) => r.outcome === 'edited').length,
    rejected: rows.filter((r) => r.outcome === 'rejected').length,
    rate: rows.length ? Math.round((unchanged / rows.length) * 1000) / 10 : null,
  };
}
