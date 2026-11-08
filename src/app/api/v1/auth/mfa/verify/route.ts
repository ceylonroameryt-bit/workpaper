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
  createTrustedToken,
  trustedCookie,
  isLockedOut,
  recordFailure,
  clearFailures,
} from '@/lib/server/auth';
import { backupCodeIndex, generateBackupCodes, totpStep } from '@/lib/server/totp';

// Second step of sign-in: checks the authenticator code and only then issues the session
export async function POST(req: Request) {
  try {
    const challenge = verifyChallengeToken(readCookie(req, MFA_COOKIE));
    if (!challenge) return jsonResponse({ error: 'Your sign-in has expired. Please sign in again.', code: 'MFA_EXPIRED' }, 401);
    const key = `mfa:${challenge.uid}`;
    if (isLockedOut(key)) return jsonResponse({ error: 'Too many wrong codes. Try again in 15 minutes.', code: 'LOCKED' }, 429);

    await syncIn();
    const { code, remember } = await req.json().catch(() => ({}));
    const user = db.users.find((u) => u.id === challenge.uid);
    const membership = db.memberships.find((m) => m.user_id === challenge.uid);
    const cred = db.credentials.find((c) => c.user_id === challenge.uid);
    if (!user || !membership || !cred) return jsonResponse({ error: 'Account not found.' }, 401);

    const enrolling = !(user.mfa_enabled && cred.mfa_secret);
    const secret = enrolling ? cred.mfa_pending_secret : cred.mfa_secret;
    // A code is good once: its time step must be later than the last one accepted
    const step = secret ? totpStep(secret, String(code ?? '')) : null;
    const totpOk = step !== null && step > (cred.mfa_last_step ?? -1);
    const backup = totpOk || enrolling ? -1 : backupCodeIndex(cred.mfa_backup_hashes, String(code ?? ''));
    if (!totpOk && backup < 0) {
      recordFailure(key);
      return jsonResponse({ error: 'That code is not right. Check your authenticator app and try again.' }, 401);
    }
    clearFailures(key);
    if (totpOk) cred.mfa_last_step = step;
    else cred.mfa_backup_hashes!.splice(backup, 1);

    const actor = { id: user.id, name: user.name, role: membership.role };
    let backupCodes: string[] | undefined;
    if (enrolling) {
      const generated = generateBackupCodes();
      backupCodes = generated.codes;
      cred.mfa_backup_hashes = generated.hashes;
      cred.mfa_trust_version = (cred.mfa_trust_version ?? 0) + 1; // a new authenticator revokes remembered devices
      cred.mfa_secret = secret;
      delete cred.mfa_pending_secret;
      user.mfa_enabled = true;
      db.logAudit(membership.firm_id, actor, 'MFA_ENROLLED', 'users', user.id, { mfa_enabled: false }, { mfa_enabled: true });
    }
    db.logAudit(membership.firm_id, actor, 'LOGIN', 'users', user.id, null, { method: totpOk ? 'password+totp' : 'password+backup_code' });
    await syncOut();

    const res = jsonResponse({ user, role: membership.role, ...(backupCodes ? { backup_codes: backupCodes } : {}) });
    res.headers.append('Set-Cookie', sessionCookie(createSessionToken(user.id)));
    res.headers.append('Set-Cookie', clearChallengeCookie());
    if (remember === true) res.headers.append('Set-Cookie', trustedCookie(createTrustedToken(user.id, cred.mfa_trust_version ?? 0)));
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
