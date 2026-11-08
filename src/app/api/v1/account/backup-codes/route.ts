import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { readCookie, verifySessionToken } from '@/lib/server/auth';
import { generateBackupCodes } from '@/lib/server/totp';

// Replaces the signed-in user's backup codes. Not getActorFromRequest: read-only members need this too
export async function POST(req: Request) {
  try {
    const session = verifySessionToken(readCookie(req));
    if (!session) return jsonResponse({ error: 'Please sign in.', code: 'UNAUTHENTICATED' }, 401);
    await syncIn();
    const user = db.users.find((u) => u.id === session.uid);
    const membership = db.memberships.find((m) => m.user_id === session.uid);
    const cred = db.credentials.find((c) => c.user_id === session.uid);
    if (!user || !membership || !cred || membership.status === 'deactivated') {
      return jsonResponse({ error: 'Your account no longer has access.', code: 'UNAUTHENTICATED' }, 401);
    }
    if (!user.mfa_enabled || !cred.mfa_secret) return jsonResponse({ error: 'Set up two-factor sign-in first.', code: 'MFA_NOT_ENROLLED' }, 409);

    const { codes, hashes } = generateBackupCodes();
    cred.mfa_backup_hashes = hashes;
    db.logAudit(membership.firm_id, { id: user.id, name: user.name, role: membership.role }, 'MFA_BACKUP_CODES_CREATED', 'users', user.id, null, { count: codes.length });
    await syncOut();
    return jsonResponse({ backup_codes: codes });
  } catch (err) {
    return errorResponse(err);
  }
}
