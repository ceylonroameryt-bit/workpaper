import { syncIn } from '@/lib/server/store';
import { getActorFromRequest, errorResponse } from '@/lib/server/api-helpers';
import { connectFailed } from '@/lib/server/connect-redirect';
import { services, ServiceError } from '@/lib/server/services';
import { authorizeUrl, createState } from '@/lib/server/xero';

// Starts "Connect Xero" for one client: sends the accountant to Xero's consent screen
export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get('clientId') || '';
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const client = services.getClient(actor.firmId, clientId, actor.clientIds);
    if (!client) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
    if (client.archived_at) throw new ServiceError('This client is archived. Restore it before connecting Xero.', 409, 'ARCHIVED');
    const url = authorizeUrl(createState({ firmId: actor.firmId, userId: actor.id, clientId }));
    return new Response(null, { status: 302, headers: { Location: url } });
  } catch (err) {
    // A browser was sent here: go back to the client page with a reason, not a JSON error
    return connectFailed(req, 'xero', clientId, err) ?? errorResponse(err);
  }
}
