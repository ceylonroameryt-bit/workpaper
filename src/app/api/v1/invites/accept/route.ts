import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { acceptInvite, describeInvite } from '@/lib/server/invites';

export async function GET(req: Request) {
  try {
    await syncIn();
    return jsonResponse(describeInvite(new URL(req.url).searchParams.get('token') || ''));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await syncIn();
    const { token, password } = await req.json().catch(() => ({}));
    const user = acceptInvite(String(token || ''), String(password || ''));
    await syncOut();
    return jsonResponse({ email: user.email }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
