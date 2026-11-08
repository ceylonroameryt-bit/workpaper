import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(req: Request) {
  try {
    await syncIn();
    const body = await req.json();
    const { workpaperId } = body;

    if (!workpaperId) {
      return jsonResponse({ error: 'workpaperId is required' }, 400);
    }

    const { actor, id: resolvedWpId } = requireWorkpaperAccess(req, workpaperId);
    const result = services.reconcileBankWithOpenBanking(actor.firmId, actor, resolvedWpId);
    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

