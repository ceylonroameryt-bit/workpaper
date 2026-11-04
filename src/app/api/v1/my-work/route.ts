import { syncIn } from '@/lib/server/store';
import { errorResponse, getActorFromRequest, jsonResponse } from '@/lib/server/api-helpers';
import { myWork } from '@/lib/server/signoff';

// Everything waiting on the signed-in person (REV-04)
export async function GET(req: Request) {
  try {
    await syncIn();
    return jsonResponse({ items: myWork(getActorFromRequest(req)) });
  } catch (err) {
    return errorResponse(err);
  }
}
