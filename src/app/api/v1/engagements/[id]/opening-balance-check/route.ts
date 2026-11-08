import { syncIn } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireEngagementAccess(req, params.id);
    const result = services.checkOpeningBalances(actor.firmId, params.id);
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

