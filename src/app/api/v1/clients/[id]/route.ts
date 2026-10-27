import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = getActorFromRequest(req);
    const client = services.getClient(actor.firmId, params.id, actor.clientIds);
    if (!client) return jsonResponse({ error: 'Client not found' }, 404);
    return jsonResponse(client);
  } catch (err) {
    return errorResponse(err);
  }
}
