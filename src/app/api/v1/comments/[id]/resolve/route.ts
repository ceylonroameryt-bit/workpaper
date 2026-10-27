import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireCommentAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireCommentAccess(req, params.id);
    const resolved = services.resolveComment(actor.firmId, actor, params.id);
    await syncOut();
    return jsonResponse(resolved);
  } catch (err) {
    return errorResponse(err);
  }
}
