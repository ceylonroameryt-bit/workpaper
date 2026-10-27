import { syncIn, syncOut } from '@/lib/server/store';
import { requireEngagementAccess, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(req: Request) {
  try {
    await syncIn();
    const body = await req.json();
    const { engagementId, ids } = body;
    const actor = requireEngagementAccess(req, String(engagementId || ''));
    const updated = services.confirmSelectedMappings(actor.firmId, actor, engagementId, ids);
    await syncOut();
    return jsonResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
