import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { updateStaff } from '@/lib/server/staff';

// { name?, role?, status?: 'active' | 'deactivated', client_ids?: string[] | null (all clients) }
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const out = updateStaff(getActorFromRequest(req), params.id, await req.json().catch(() => ({})));
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}
