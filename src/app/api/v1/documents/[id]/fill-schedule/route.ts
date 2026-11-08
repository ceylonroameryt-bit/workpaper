import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireAttachmentAccess, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAttachmentAccess(req, params.id);
    const body = await req.json();
    const targetWorkpaperId = body.targetWorkpaperId;

    if (!targetWorkpaperId) {
      return jsonResponse({ error: 'targetWorkpaperId is required' }, 400);
    }

    const { id: resolvedWpId } = requireWorkpaperAccess(req, targetWorkpaperId);
    const result = services.fillScheduleFromDocument(actor.firmId, actor, params.id, resolvedWpId);
    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

