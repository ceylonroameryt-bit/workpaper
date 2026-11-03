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
    const body = await req.json().catch(() => ({}));
    if (body.undo) {
      const undone = services.undoRollForward(actor.firmId, actor, workpaperId);
      await syncOut();
      return jsonResponse(undone);
    }
    const rolled = services.rollForwardPaper(actor.firmId, actor, workpaperId);
    await syncOut();
    return jsonResponse(rolled);
  } catch (err) {
    return errorResponse(err);
  }
}
