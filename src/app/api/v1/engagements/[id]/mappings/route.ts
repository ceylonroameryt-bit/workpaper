import { syncIn } from '@/lib/server/store';
import { jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const data = services.getAccountMappings(params.id);
    return jsonResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
