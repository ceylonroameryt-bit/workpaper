import { jsonResponse, errorResponse, getActorFromRequest } from '@/lib/server/api-helpers';
import { syncIn, syncOut, currentVersion, hasDatabase } from '@/lib/server/store';
import { mergeFirmState, publicSlice, State } from '@/lib/server/state-guard';
import { db } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// The signed-in user's firm only; password hashes and other firms never leave the server
function view(actor: ReturnType<typeof getActorFromRequest>) {
  return {
    version: currentVersion(),
    data: publicSlice(db.exportState() as State, actor.firmId, actor.id),
    persistent: hasDatabase(),
    me: actor,
  };
}

export async function GET(req: Request) {
  try {
    await syncIn();
    return jsonResponse(view(getActorFromRequest(req)));
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT and POST (POST is used by navigator.sendBeacon when the tab closes)
async function save(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();
    if (Number(body.version) !== currentVersion()) {
      return jsonResponse({ conflict: true, ...view(actor) }, 409);
    }
    try {
      db.importState(mergeFirmState(db.exportState() as State, body.data || {}, actor));
    } catch (err) {
      // Rejected change: hand back the saved copy so the browser can drop it
      return jsonResponse({ error: (err as Error).message, code: 'FORBIDDEN', ...view(actor) }, 403);
    }
    await syncOut();
    return jsonResponse({ version: currentVersion() });
  } catch (err) {
    return errorResponse(err);
  }
}

export const PUT = save;
export const POST = save;
