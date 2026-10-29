import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { completeConnection, readState } from '@/lib/server/xero';

// Xero sends the accountant back here after the consent screen
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string) => new Response(null, { status: 302, headers: { Location: new URL(path, url.origin).toString() } });
  const state = readState(url.searchParams.get('state'));
  if (!state) return back('/clients?xero=error');
  const page = `/clients/${encodeURIComponent(state.clientId)}`;
  if (url.searchParams.get('error')) return back(`${page}?xero=declined`);

  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    // Only the person who started the connection, in the same practice, can finish it
    if (actor.id !== state.userId || actor.firmId !== state.firmId) return back(`${page}?xero=error`);
    if (!services.getClient(actor.firmId, state.clientId, actor.clientIds)) return back('/clients?xero=error');
    await completeConnection(actor, state.clientId, url.searchParams.get('code') || '');
    await syncOut();
    return back(`${page}?xero=connected`);
  } catch {
    return back(`${page}?xero=error`);
  }
}
