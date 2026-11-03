import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { completeOnboarding } from '@/lib/server/onboarding';

export async function POST(req: Request) {
  try {
    await syncIn();
    const out = completeOnboarding(getActorFromRequest(req));
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}
