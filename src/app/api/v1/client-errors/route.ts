import { readCookie, verifySessionToken } from '@/lib/server/auth';
import { logError } from '@/lib/server/log-error';

// A page crashed in someone's browser: keep it in the server log. Signed-in users only.
export async function POST(req: Request) {
  const session = verifySessionToken(readCookie(req));
  if (!session) return new Response(null, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const err = new Error(String(body.message ?? 'Unknown error').slice(0, 500));
  err.stack = String(body.stack ?? '').slice(0, 2000);
  logError('browser', err, { path: String(body.path ?? '').slice(0, 200), digest: body.digest, user: session.uid });
  return new Response(null, { status: 204 });
}
