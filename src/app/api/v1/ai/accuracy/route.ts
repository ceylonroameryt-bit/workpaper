import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, requireEngagementAccess, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { accuracy, DEFAULT_THRESHOLDS, OutputType } from '@/lib/server/gate';

// AUD-03 / DAT-03: AI accuracy per output type, from the AI action log
export async function GET(req: Request) {
  try {
    await syncIn();
    const url = new URL(req.url);
    const engagementId = url.searchParams.get('engagementId') || undefined;
    const actor = engagementId ? requireEngagementAccess(req, engagementId) : getActorFromRequest(req);
    const types = (Object.keys(DEFAULT_THRESHOLDS) as OutputType[]).filter((t) => !url.searchParams.get('type') || t === url.searchParams.get('type'));
    return jsonResponse(types.map((t) => accuracy(actor.firmId, t, engagementId)));
  } catch (err) {
    return errorResponse(err);
  }
}
