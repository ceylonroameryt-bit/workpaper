import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireEngagementAccess(req, params.id);
    const body = await req.json();
    const { attachmentId } = body;

    if (!attachmentId) {
      return jsonResponse({ error: 'attachmentId is required' }, 400);
    }

    const result = services.importPriorYearAccounts(actor.firmId, actor, params.id, attachmentId);
    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

