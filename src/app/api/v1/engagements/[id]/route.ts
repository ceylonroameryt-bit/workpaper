import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const actor = getActorFromRequest(req);
    const engagement = services.getEngagement(actor.firmId, params.id);
    return jsonResponse(engagement);
  } catch (err) {
    return errorResponse(err);
  }
}
