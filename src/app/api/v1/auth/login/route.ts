import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import {
  verifyPassword,
  createSessionToken,
  sessionCookie,
  createChallengeToken,
  challengeCookie,
  mfaRequired,
  isLockedOut,
  recordFailure,
  clearFailures,
} from '@/lib/server/auth';

const INVALID = 'Invalid email or password.';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!email || !password) return jsonResponse({ error: 'Email and password required' }, 400);
    if (isLockedOut(email)) {
      return jsonResponse({ error: 'Too many failed attempts. Try again in 15 minutes.', code: 'LOCKED' }, 429);
    }

    await syncIn();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const membership = user && db.memberships.find((m) => m.user_id === user.id);
    const cred = user && db.credentials.find((c) => c.user_id === user.id);

    if (!user || !membership || !verifyPassword(password, cred?.password_hash)) {
      recordFailure(email);
      return jsonResponse({ error: INVALID }, 401);
    }
    clearFailures(email);

    // ADM-01: when MFA is switched on, password alone never signs in; the MFA endpoints finish it
    if (mfaRequired()) {
      const step = user.mfa_enabled && cred?.mfa_secret ? 'verify' : 'setup';
      return jsonResponse({ mfa: step }, 200, { 'Set-Cookie': challengeCookie(createChallengeToken(user.id)) });
    }

    db.logAudit(membership.firm_id, { id: user.id, name: user.name, role: membership.role }, 'LOGIN', 'users', user.id, null, {
      method: 'password',
    });
    await syncOut();

    return jsonResponse({ user, role: membership.role }, 200, { 'Set-Cookie': sessionCookie(createSessionToken(user.id)) });
  } catch (err) {
    return errorResponse(err);
  }
}
