import { syncIn, syncOut } from '@/lib/server/store';
import { requireEngagementAccess, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { QboReconnectError, pullQboTrialBalance } from '@/lib/server/quickbooks';

// Pulls the engagement's trial balance from QuickBooks: { engagementId }
export async function POST(req: Request) {
  try {
    await syncIn();
    const { engagementId } = await req.json().catch(() => ({}));
    const actor = requireEngagementAccess(req, String(engagementId || ''));
    try {
      const out = await pullQboTrialBalance(actor, engagementId);
      await syncOut();
      return jsonResponse(out.body, out.status);
    } catch (err) {
      // Save "reconnect needed" on the client before reporting it
      if (err instanceof QboReconnectError) await syncOut();
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
