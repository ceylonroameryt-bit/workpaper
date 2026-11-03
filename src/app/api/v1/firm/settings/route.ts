import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { saveFirmDefaults } from '@/lib/server/client-profile';

// Practice defaults: { tolerance, review_threshold, signoff_levels }
export async function GET(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    return jsonResponse({ defaults: db.firms.find((f) => f.id === actor.firmId)?.settings?.defaults ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const defaults = saveFirmDefaults(actor, await req.json().catch(() => ({})));
    await syncOut();
    return jsonResponse({ defaults });
  } catch (err) {
    return errorResponse(err);
  }
}
