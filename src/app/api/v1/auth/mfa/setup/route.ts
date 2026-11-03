import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { readCookie, verifyChallengeToken, MFA_COOKIE } from '@/lib/server/auth';
import { generateTotpSecret, otpauthUri } from '@/lib/server/totp';

// Enrolment: hands out a new authenticator secret to a user who has passed the password step
export async function GET(req: Request) {
  try {
    const challenge = verifyChallengeToken(readCookie(req, MFA_COOKIE));
    if (!challenge) return jsonResponse({ error: 'Your sign-in has expired. Please sign in again.', code: 'MFA_EXPIRED' }, 401);
    await syncIn();
    const user = db.users.find((u) => u.id === challenge.uid);
    const cred = db.credentials.find((c) => c.user_id === challenge.uid);
    if (!user || !cred) return jsonResponse({ error: 'Account not found.' }, 401);
    if (user.mfa_enabled && cred.mfa_secret) return jsonResponse({ error: 'MFA is already set up.', code: 'MFA_ENROLLED' }, 409);

    cred.mfa_pending_secret ||= generateTotpSecret();
    await syncOut();
    return jsonResponse({ secret: cred.mfa_pending_secret, otpauth: otpauthUri(cred.mfa_pending_secret, user.email) });
  } catch (err) {
    return errorResponse(err);
  }
}
