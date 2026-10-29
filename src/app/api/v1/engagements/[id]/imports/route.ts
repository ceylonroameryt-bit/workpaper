import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { importTrialBalance } from '@/lib/server/tb-import';

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
    const out = importTrialBalance(actor, params.id, body.lines, body.source || 'csv');
    if (out.status < 400) await syncOut();
    return jsonResponse(out.body, out.status);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const actor = getActorFromRequest(req);

    // Clear mappings and tb_snapshots for this engagement
    const priorCount = db.account_mappings.filter((m) => m.engagement_id === params.id).length;
    db.account_mappings = db.account_mappings.filter((m) => m.engagement_id !== params.id);
    db.tb_snapshots = db.tb_snapshots.filter((s) => s.engagement_id !== params.id);

    db.logAudit(actor.firmId, actor, 'CLEAR_TEST_DATA', 'engagements', params.id, null, {
      cleared_mappings: priorCount,
    });

    await syncOut();

    return jsonResponse({ success: true, cleared_count: priorCount });
  } catch (err) {
    return errorResponse(err);
  }
}
