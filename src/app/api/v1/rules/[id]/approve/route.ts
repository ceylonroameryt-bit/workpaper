import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { ServiceError } from '@/lib/server/services';
import { approveRule } from '@/lib/server/gate';

// DAT-09: practice rules run only after a manager approves them
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = getActorFromRequest(req);
    let rule;
    try {
      rule = approveRule(actor, params.id);
    } catch (e) {
      throw new ServiceError((e as Error).message, 403, 'FORBIDDEN');
    }
    await syncOut();
    return jsonResponse(rule);
  } catch (err) {
    return errorResponse(err);
  }
}
