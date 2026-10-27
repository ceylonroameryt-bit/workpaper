import { syncIn, syncOut } from '@/lib/server/store';
import { requireEngagementAccess, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { services } from '@/lib/server/services';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const engagementId = db.account_mappings.find((m) => m.id === params.id)?.engagement_id ?? '';
    const actor = requireEngagementAccess(req, engagementId);
    const body = await req.json();
    const updated = services.updateMapping(actor.firmId, actor, params.id, body.blynt_code);
    await syncOut();
    return jsonResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
