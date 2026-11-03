import { syncIn, syncOut } from '@/lib/server/store';
import { requireEngagementAccess, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { XeroReconnectError, pullTrialBalance } from '@/lib/server/xero';

// Pulls the engagement's trial balance from Xero: { engagementId }
export async function POST(req: Request) {
  try {
    await syncIn();
    const { engagementId } = await req.json().catch(() => ({}));
    const actor = requireEngagementAccess(req, String(engagementId || ''));
    try {
      const out = await pullTrialBalance(actor, engagementId);
      await syncOut();
      return jsonResponse(out.body, out.status);
    } catch (err) {
      // Save "reconnect needed" on the client before reporting it
      if (err instanceof XeroReconnectError) await syncOut();
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
