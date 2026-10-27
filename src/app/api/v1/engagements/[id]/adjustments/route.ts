import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { toPence } from '@/lib/money';
import { ServiceError } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const adjs = db.adjustments.filter((a) => a.engagement_id === params.id);
    return jsonResponse(adjs);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const actor = getActorFromRequest(req);
    const body = await req.json();

    const { narrative, lines } = body;
    if (!lines || lines.length < 2) {
      throw new ServiceError('Adjustment must contain at least two lines', 400);
    }

    // Verify lines balance strictly in integer pence
    let debits = 0n;
    let credits = 0n;
    lines.forEach((l: any) => {
      debits += toPence(l.debit_p);
      credits += toPence(l.credit_p);
    });

    if (debits !== credits || debits === 0n) {
      throw new ServiceError(
        `Adjustment lines must balance. Debits: ${debits}, Credits: ${credits}`,
        400
      );
    }

    const newAdj = {
      id: `aje_${Date.now()}`,
      engagement_id: params.id,
      ref: `AJE-${String(db.adjustments.length + 1).padStart(3, '0')}`,
      narrative: narrative || 'Proposed adjustment',
      status: 'proposed' as const,
      proposed_by: actor.id,
      proposed_by_name: actor.name,
      approved_by: null,
      created_at: new Date().toISOString(),
      lines: lines.map((l: any, idx: number) => ({
        id: `line_${Date.now()}_${idx}`,
        adjustment_id: `aje_${Date.now()}`,
        blynt_code: l.blynt_code,
        debit_p: toPence(l.debit_p).toString(),
        credit_p: toPence(l.credit_p).toString(),
        narrative: l.narrative || '',
      })),
    };

    db.adjustments.push(newAdj);
    db.logAudit(actor.firmId, actor, 'PROPOSE_ADJUSTMENT', 'adjustments', newAdj.id, null, newAdj);

    await syncOut();

    return jsonResponse(newAdj, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
