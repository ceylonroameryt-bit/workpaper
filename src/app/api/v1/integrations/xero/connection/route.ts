import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { services, ServiceError } from '@/lib/server/services';
import { disconnect, xeroConfig } from '@/lib/server/xero';

const visibleClient = (req: Request) => {
  const actor = getActorFromRequest(req);
  const clientId = new URL(req.url).searchParams.get('clientId') || '';
  if (!services.getClient(actor.firmId, clientId, actor.clientIds)) throw new ServiceError('Client not found', 404, 'NOT_FOUND');
  return { actor, clientId };
};

// Connection status for a client (no tokens)
export async function GET(req: Request) {
  try {
    await syncIn();
    const { actor, clientId } = visibleClient(req);
    const c = db.xero_connections.find((x) => x.firm_id === actor.firmId && x.client_id === clientId);
    return jsonResponse({
      configured: Boolean(xeroConfig()),
      connected: Boolean(c),
      tenant_name: c?.tenant_name ?? null,
      connected_at: c?.connected_at ?? null,
      last_synced_at: c?.last_synced_at ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// Disconnect: forget the stored tokens
export async function DELETE(req: Request) {
  try {
    await syncIn();
    const { actor, clientId } = visibleClient(req);
    disconnect(actor, clientId);
    await syncOut();
    return jsonResponse({ disconnected: true });
  } catch (err) {
    return errorResponse(err);
  }
}
