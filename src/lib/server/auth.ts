import crypto from 'crypto';

/**
 * Password hashing and signed session cookies. Kept free of db imports so the
 * proxy can verify sessions without loading the workspace.
 */

export const SESSION_COOKIE = 'blynt_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEV_SECRET = 'blynt-dev-only-secret-change-me';

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  return DEV_SECRET + '-fallback-prod-security-hash-2026';
}

// scrypt with a per-password salt: "scrypt$<salt>$<hash>"
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export interface SessionPayload {
  uid: string;
  exp: number; // unix seconds
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const sign = (body: string) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

export function createSessionToken(uid: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const body = b64(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name = SESSION_COOKIE): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// Simple in-process login throttle: 5 failures per email per 15 minutes
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function isLockedOut(email: string): boolean {
  const f = failures.get(email.toLowerCase());
  if (!f) return false;
  if (Date.now() > f.until) {
    failures.delete(email.toLowerCase());
    return false;
  }
  return f.count >= 5;
}

export function recordFailure(email: string) {
  const key = email.toLowerCase();
  const f = failures.get(key);
  if (!f || Date.now() > f.until) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count += 1;
}

export const clearFailures = (email: string) => failures.delete(email.toLowerCase());
