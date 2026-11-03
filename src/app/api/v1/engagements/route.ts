import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { autoReverseInto } from '@/lib/server/journals';

export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();
    const engagement = services.createEngagement(actor.firmId, actor, body, actor.clientIds);
    // JNL-04: last period's auto-reversing journals land on this period's first day
    autoReverseInto(engagement.id);
    await syncOut();
    return jsonResponse(engagement, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
