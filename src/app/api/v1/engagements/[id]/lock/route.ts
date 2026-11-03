import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const actor = getActorFromRequest(req);
    const locked = services.lockEngagement(actor.firmId, actor, params.id);
    await syncOut();
    return jsonResponse(locked);
  } catch (err) {
    return errorResponse(err);
  }
}
