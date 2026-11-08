import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { cancelInvite } from '@/lib/server/invites';

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const { id } = await props.params;
    cancelInvite(getActorFromRequest(req), id);
    await syncOut();
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
