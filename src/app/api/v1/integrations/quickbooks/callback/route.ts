import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { completeQboConnection } from '@/lib/server/quickbooks';
import { readState } from '@/lib/server/xero';

// Intuit sends the accountant back here after the consent screen
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string) => new Response(null, { status: 302, headers: { Location: new URL(path, url.origin).toString() } });
  const state = readState(url.searchParams.get('state'));
  if (!state) return back('/clients?qbo=error');
  const page = `/clients/${encodeURIComponent(state.clientId)}`;
  if (url.searchParams.get('error')) return back(`${page}?qbo=declined`);

  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    // Only the person who started the connection, in the same practice, can finish it
    if (actor.id !== state.userId || actor.firmId !== state.firmId) return back(`${page}?qbo=error`);
    if (!services.getClient(actor.firmId, state.clientId, actor.clientIds)) return back('/clients?qbo=error');
    await completeQboConnection(actor, state.clientId, url.searchParams.get('code') || '', url.searchParams.get('realmId') || '');
    await syncOut();
    return back(`${page}?qbo=connected`);
  } catch {
    return back(`${page}?qbo=error`);
  }
}
