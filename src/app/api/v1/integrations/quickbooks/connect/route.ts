import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, errorResponse } from '@/lib/server/api-helpers';
import { connectFailed } from '@/lib/server/connect-redirect';
import { services, ServiceError } from '@/lib/server/services';
import { qboAuthorizeUrl } from '@/lib/server/quickbooks';
import { createState } from '@/lib/server/xero';

// Starts "Connect QuickBooks" for one client: sends the accountant to Intuit's consent screen
export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get('clientId') || '';
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const client = services.getClient(actor.firmId, clientId, actor.clientIds);
    if (!client) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
    if (client.archived_at) throw new ServiceError('This client is archived. Restore it before connecting QuickBooks.', 409, 'ARCHIVED');
    const url = qboAuthorizeUrl(createState({ firmId: actor.firmId, userId: actor.id, clientId }));
    return new Response(null, { status: 302, headers: { Location: url } });
  } catch (err) {
    // A browser was sent here: go back to the client page with a reason, not a JSON error
    return connectFailed(req, 'qbo', clientId, err) ?? errorResponse(err);
  }
}
