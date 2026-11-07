import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { resetPassword } from '@/lib/server/invites';

// Public, guarded by the one-time reset token
export async function POST(req: Request) {
  try {
    await syncIn();
    const { token, password } = await req.json().catch(() => ({}));
    const out = resetPassword(String(token || ''), String(password || ''));
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}
