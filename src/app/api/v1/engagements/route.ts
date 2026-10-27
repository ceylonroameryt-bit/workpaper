import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();
    const engagement = services.createEngagement(actor.firmId, actor, body, actor.clientIds);
    await syncOut();
    return jsonResponse(engagement, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
