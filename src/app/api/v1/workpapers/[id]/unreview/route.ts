import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { unreview } from '@/lib/server/signoff';

// { reason } (10+ characters): clears the review and approval ticks so the schedule can change (REV-02)
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id } = requireWorkpaperAccess(req, params.id);
    const { reason } = await req.json().catch(() => ({}));
    const wp = unreview(actor, id, reason);
    await syncOut();
    return jsonResponse(wp);
  } catch (err) {
    return errorResponse(err);
  }
}
