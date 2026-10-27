import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const body = await req.json();
    const comment = services.addComment(actor.firmId, actor, workpaperId, body);
    await syncOut();
    return jsonResponse(comment, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
