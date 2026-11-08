import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { db } from '@/lib/server/db';
import { asPence } from '@/lib/money';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) return jsonResponse({ error: 'Workpaper not found' }, 404);

    const body = await req.json();
    const { action, amount_p, items, surplus_p, ct_charge_p, dt_movement_p } = body;

    let result: any;
    if (action === 'depreciation' || wp.ref === 'F-10') {
      result = services.proposeDepreciationJournal(actor.firmId, actor, wp.engagement_id);
    } else if (action === 'bad_debt' || wp.ref === 'C-10') {
      result = services.proposeBadDebtJournal(actor.firmId, actor, wp.engagement_id, asPence(amount_p || '0'));
    } else if (action === 'vat_surplus' || wp.ref === 'T-20') {
      result = services.proposeFlatRateSurplusJournal(actor.firmId, actor, wp.engagement_id, asPence(surplus_p || '0'));
    } else if (action === 'auto_reversing' || wp.ref === 'C-20' || wp.ref === 'K-20') {
      const type = wp.ref === 'C-20' ? 'prepayment' : 'accrual';
      result = services.createAutoReversingJournal(actor.firmId, actor, wp.engagement_id, type, items || []);
    } else if (action === 'tax' || wp.ref === 'T-10' || wp.ref === 'T-30') {
      result = services.proposeTaxJournals(actor.firmId, actor, wp.engagement_id, {
        ctChargePence: asPence(ct_charge_p || '0'),
        deferredTaxMovementPence: dt_movement_p ? asPence(dt_movement_p) : undefined,
      });
    } else {
      return jsonResponse({ error: 'Unsupported journal proposal action' }, 400);
    }

    await syncOut();
    return jsonResponse({ success: true, result });
  } catch (err) {
    return errorResponse(err);
  }
}

