import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { listStaff } from '@/lib/server/staff';

// The practice's staff, for Settings > Staff (no passwords or MFA secrets)
export async function GET(req: Request) {
  try {
    await syncIn();
    return jsonResponse({ staff: listStaff(getActorFromRequest(req)) });
  } catch (err) {
    return errorResponse(err);
  }
}
