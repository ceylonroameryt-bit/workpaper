import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const preview = services.previewRollForward(params.id);
    return jsonResponse(preview);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireEngagementAccess(req, params.id);
    const body = await req.json();

    const result = services.executeRollForward(actor.firmId, actor, params.id, {
      new_period_start: body.new_period_start,
      new_period_end: body.new_period_end,
      exclude_refs: body.exclude_refs,
      manager_override: body.manager_override,
      override_reason: body.override_reason,
    });

    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

