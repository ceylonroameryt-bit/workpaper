import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const wp = services.getWorkpaper(workpaperId);
    return jsonResponse(wp);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const body = await req.json();
    const updated = services.updateWorkpaperData(actor.firmId, actor, workpaperId, body.data_json);
    await syncOut();
    return jsonResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
