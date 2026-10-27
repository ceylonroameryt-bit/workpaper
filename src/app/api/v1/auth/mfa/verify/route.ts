import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import {
  readCookie,
  verifyChallengeToken,
  MFA_COOKIE,
  clearChallengeCookie,
  createSessionToken,
  sessionCookie,
  isLockedOut,
  recordFailure,
  clearFailures,
} from '@/lib/server/auth';
import { totpStep } from '@/lib/server/totp';

// Second step of sign-in: checks the authenticator code and only then issues the session
export async function POST(req: Request) {
  try {
    const challenge = verifyChallengeToken(readCookie(req, MFA_COOKIE));
    if (!challenge) return jsonResponse({ error: 'Your sign-in has expired. Please sign in again.', code: 'MFA_EXPIRED' }, 401);
    const key = `mfa:${challenge.uid}`;
    if (isLockedOut(key)) return jsonResponse({ error: 'Too many wrong codes. Try again in 15 minutes.', code: 'LOCKED' }, 429);

    await syncIn();
    const { code } = await req.json().catch(() => ({}));
    const user = db.users.find((u) => u.id === challenge.uid);
    const membership = db.memberships.find((m) => m.user_id === challenge.uid);
    const cred = db.credentials.find((c) => c.user_id === challenge.uid);
    if (!user || !membership || !cred) return jsonResponse({ error: 'Account not found.' }, 401);

    const enrolling = !(user.mfa_enabled && cred.mfa_secret);
    const secret = enrolling ? cred.mfa_pending_secret : cred.mfa_secret;
    // A code is good once: its time step must be later than the last one accepted
    const step = secret ? totpStep(secret, String(code ?? '')) : null;
    if (step === null || step <= (cred.mfa_last_step ?? -1)) {
      recordFailure(key);
      return jsonResponse({ error: 'That code is not right. Check your authenticator app and try again.' }, 401);
    }
    clearFailures(key);
    cred.mfa_last_step = step;

    const actor = { id: user.id, name: user.name, role: membership.role };
    if (enrolling) {
      cred.mfa_secret = secret;
      delete cred.mfa_pending_secret;
      user.mfa_enabled = true;
      db.logAudit(membership.firm_id, actor, 'MFA_ENROLLED', 'users', user.id, { mfa_enabled: false }, { mfa_enabled: true });
    }
    db.logAudit(membership.firm_id, actor, 'LOGIN', 'users', user.id, null, { method: 'password+totp' });
    await syncOut();

    const res = jsonResponse({ user, role: membership.role });
    res.headers.append('Set-Cookie', sessionCookie(createSessionToken(user.id)));
    res.headers.append('Set-Cookie', clearChallengeCookie());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
