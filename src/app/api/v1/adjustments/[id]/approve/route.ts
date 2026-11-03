import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireAdjustmentAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAdjustmentAccess(req, params.id);
    const approved = services.approveAdjustment(actor.firmId, actor, params.id);
    await syncOut();
    return jsonResponse(approved);
  } catch (err) {
    return errorResponse(err);
  }
}
