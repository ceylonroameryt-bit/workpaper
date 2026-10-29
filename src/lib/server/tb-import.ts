import crypto from 'crypto';
import { db } from './db';
import { services } from './services';
import { toPence } from '../money';
import { DataSource, TbSnapshot, UserRole } from '../types/models';

/**
 * One trial balance import, whatever the source (CSV upload, Xero, QuickBooks): validate,
 * check it balances, snapshot it, record what moved since the last import (DAT-06) and map
 * every line through rules and the confidence gate (DAT-03/04/08/09).
 */

export interface TbLineInput {
  code?: string | number;
  name?: string;
  type?: string;
  debit?: string | number | null;
  credit?: string | number | null;
  external_id?: string; // the account's id in the ledger it came from
}

export interface ImportResult {
  status: number;
  body: Record<string, any>;
}

const result = (body: Record<string, any>, status = 200): ImportResult => ({ status, body });

// Blank, a dash or nil count as zero; otherwise digits with optional £, commas, sign or brackets and up to 2 decimals
function isAmount(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'number') return Number.isFinite(v);
  const s = String(v).trim();
  if (/^(-|—|–|nil|n\/a)?$/i.test(s)) return true;
  return /^\(?-?\s*[£$€]?\s*-?\d{1,3}(,?\d{3})*(\.\d{1,2})?\)?$/.test(s);
}

export function importTrialBalance(
  actor: { id: string; name: string; role: UserRole; firmId: string },
  engagementId: string,
  lines: TbLineInput[] | unknown,
  source: DataSource | string = 'csv'
): ImportResult {
    const engClient = db.clients.find((c) => c.id === db.engagements.find((e) => e.id === engagementId)?.client_id);
    if (engClient?.archived_at) {
      return result({ error: 'This client is archived. Restore it before importing a trial balance.', code: 'ARCHIVED' }, 409);
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return result({ error: 'No data lines provided' }, 400);
    }

    // Every line needs a name and amounts that are really numbers; codes must be unique
    const problems: string[] = [];
    const seen = new Map<string, number>();
    lines.forEach((l: any, idx: number) => {
      const row = idx + 1;
      const name = typeof l?.name === 'string' ? l.name.trim() : '';
      if (!name) problems.push(`Line ${row} has no account name.`);
      for (const side of ['debit', 'credit'] as const) {
        if (!isAmount(l?.[side])) problems.push(`Line ${row} ${side} "${String(l[side])}" is not an amount.`);
      }
      let code = typeof l?.code === 'string' || typeof l?.code === 'number' ? String(l.code).trim() : '';
      if (!code && name) {
        // Auto-assign codes for lines with missing codes so valid accounting entries are preserved
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        code = cleanName ? `ACC-${cleanName}` : `ACC-${row}`;
      }
      if (code && seen.has(code)) problems.push(`Account code ${code} appears on lines ${seen.get(code)} and ${row}.`);
      if (code) seen.set(code, row);
      if (l && typeof l === 'object') {
        l.code = code;
        l.name = name;
      }
    });
    if (problems.length) {
      return result({ error: problems.slice(0, 5).join(' '), problems }, 400);
    }

    let totalDebit = 0n;
    let totalCredit = 0n;
    lines.forEach((l: any) => {
      totalDebit += toPence(l.debit);
      totalCredit += toPence(l.credit);
    });

    const difference = totalDebit - totalCredit;
    if (difference !== 0n) {
      return result(
        {
          error: 'Unbalanced trial balance rejected: total debits must equal total credits.',
          difference_p: difference.toString(),
          total_debit_p: totalDebit.toString(),
          total_credit_p: totalCredit.toString(),
        },
        400
      );
    }

    // Create immutable tb_snapshot with SHA-256
    const rawJson = JSON.stringify(lines);
    const sha256 = crypto.createHash('sha256').update(rawJson).digest('hex');

    const prior = db.tb_snapshots
      .filter((s) => s.engagement_id === engagementId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const now = new Date().toISOString();
    const snapshot: TbSnapshot = {
      id: `snap_${crypto.randomUUID()}`,
      engagement_id: engagementId,
      source: source as any,
      as_at: now.substring(0, 10),
      raw_json: rawJson,
      sha256,
      created_by: actor.id,
      created_at: now,
      prior_snapshot_id: prior?.id ?? null,
    };

    // Clear prior mappings for this engagement for a fresh import
    db.account_mappings = db.account_mappings.filter((m) => m.engagement_id !== engagementId);

    // Every line goes through rules > prior year > patterns and the confidence gate (DAT-03/04/08/09)
    const nets: { code: string; name: string; net_p: bigint }[] = [];
    lines.forEach((l: any, idx: number) => {
      const debitP = toPence(l.debit);
      const creditP = toPence(l.credit);
      const netBalance = debitP - creditP;
      const line = { code: l.code.trim(), name: l.name.trim(), type: l.type || 'General' };
      nets.push({ code: line.code, name: line.name, net_p: netBalance });

      db.tb_lines.push({
        id: `tbl_${snapshot.id}_${idx + 1}`,
        snapshot_id: snapshot.id,
        source_code: line.code,
        source_name: line.name,
        source_type: line.type,
        debit_p: debitP.toString(),
        credit_p: creditP.toString(),
      });
      db.account_mappings.push(services.buildMapping(actor.firmId, engagementId, `map_${snapshot.id}_${idx + 1}`, line, netBalance));
    });

    // DAT-06: what moved since the last pull (late postings)
    snapshot.changes = services.diffSnapshots(prior?.id, nets);

    db.tb_snapshots.push(snapshot);
    db.logAudit(actor.firmId, actor, 'CREATE_SNAPSHOT', 'tb_snapshots', snapshot.id, null, {
      sha256,
      line_count: lines.length,
      prior_snapshot_id: snapshot.prior_snapshot_id,
      changed_accounts: snapshot.changes.length,
    });
    const mapped = db.account_mappings.filter((m) => m.engagement_id === engagementId);

    return result(
      {
        success: true,
        snapshot,
        lineCount: lines.length,
        changes: snapshot.changes,
        mapping: {
          by_rule: mapped.filter((m) => m.method === 'rule').length,
          ready: mapped.filter((m) => m.status !== 'confirmed' && m.gate === 'ready').length,
          check: mapped.filter((m) => m.status !== 'confirmed' && m.gate === 'check').length,
          exception: mapped.filter((m) => m.status !== 'confirmed' && m.gate === 'exception').length,
        },
      },
      201
    );
}
