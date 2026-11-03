import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { setClientAssignments } from '@/lib/server/invites';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = getActorFromRequest(req);
    const { client_ids } = await req.json().catch(() => ({}));
    const membership = setClientAssignments(actor, params.id, Array.isArray(client_ids) ? client_ids : []);
    await syncOut();
    return jsonResponse(membership);
  } catch (err) {
    return errorResponse(err);
  }
}
