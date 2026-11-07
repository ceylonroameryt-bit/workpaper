import { ServiceError } from './services';
import { publicOrigin } from './api-helpers';

/** Where "Connect Xero/QuickBooks" sends the browser back to when the connection can't start. */
export function connectFailed(req: Request, param: 'xero' | 'qbo', clientId: string, err: unknown): Response | null {
  if (!(err instanceof ServiceError) || !clientId || err.code === 'NOT_FOUND' || err.status === 401) return null;
  const reason = err.code.endsWith('NOT_CONFIGURED') ? 'not_configured' : err.code === 'ARCHIVED' ? 'archived' : 'error';
  const to = new URL(`/clients/${encodeURIComponent(clientId)}?${param}=${reason}`, publicOrigin(req));
  return new Response(null, { status: 302, headers: { Location: to.toString() } });
}
