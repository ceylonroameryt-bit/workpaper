import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { updateClientProfile } from '@/lib/server/client-profile';

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

// Saves the client profile and brings open engagements' papers in line with it
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = getActorFromRequest(req);
    const out = updateClientProfile(actor, params.id, await req.json().catch(() => ({})));
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}
