import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, publicOrigin } from '@/lib/server/api-helpers';
import { createPasswordReset } from '@/lib/server/invites';

// No mail service yet: the reset link is returned for the admin to send
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const { id } = await props.params;
    const { token, expires_at } = createPasswordReset(getActorFromRequest(req), id);
    await syncOut();
    return jsonResponse({ link: `${publicOrigin(req)}/reset-password?token=${token}`, expires_at }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
