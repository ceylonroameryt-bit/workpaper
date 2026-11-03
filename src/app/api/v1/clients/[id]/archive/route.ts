import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

// { archived: true, reason? } archives the client; { archived: false } restores it
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = getActorFromRequest(req);
    const { archived = true, reason = '' } = await req.json().catch(() => ({}));
    const client = services.setClientArchived(actor.firmId, actor, params.id, Boolean(archived), String(reason || ''), actor.clientIds);
    await syncOut();
    return jsonResponse(client);
  } catch (err) {
    return errorResponse(err);
  }
}
