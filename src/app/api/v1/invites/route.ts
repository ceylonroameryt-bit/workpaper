import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { createInvite } from '@/lib/server/invites';
import { canSetUpPractice } from '@/lib/server/onboarding';

// Open invites for the practice (no token hashes)
export async function GET(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    if (!canSetUpPractice(actor, db.firms.find((f) => f.id === actor.firmId))) {
      return jsonResponse({ error: 'Only an admin or partner can see invitations.', code: 'FORBIDDEN' }, 403);
    }
    const open = db.invites
      .filter((i) => i.firm_id === actor.firmId && !i.accepted_at)
      .map(({ token_hash: _h, ...i }) => i);
    return jsonResponse(open);
  } catch (err) {
    return errorResponse(err);
  }
}

// No mail service yet: the invite link is returned for the inviter to send
export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { invite, token } = createInvite(actor, body);
    await syncOut();
    const link = `${new URL(req.url).origin}/invite/${token}`;
    return jsonResponse({ invite, link }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
