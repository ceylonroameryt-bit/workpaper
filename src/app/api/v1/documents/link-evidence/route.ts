import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, getActorFromRequest } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();
    const { attachmentId, anchor } = body;

    if (!attachmentId || !anchor) {
      return jsonResponse({ error: 'attachmentId and anchor are required' }, 400);
    }

    const result = services.linkEvidence(actor.firmId, actor, attachmentId, anchor);
    await syncOut();
    return jsonResponse({ success: true, attachment: result });
  } catch (err) {
    return errorResponse(err);
  }
}

