import { db } from './db';
import { hashPassword, verifyPassword } from './auth';

// Password for the seeded test users in development. Default is admin123 matching the login form hint.
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'admin123';

let cleaned = false;

/**
 * Development: gives every user without a password the test password (server side only).
 * Production: never hands out a default password, and once per process removes any password
 * that is still the public demo one, so the demo accounts cannot be signed into.
 */
export function ensureCredentials(): boolean {
  if (process.env.NODE_ENV === 'production') {
    if (cleaned) return false;
    cleaned = true;
    const before = db.credentials.length;
    db.credentials = db.credentials.filter((c) => !verifyPassword('admin123', c.password_hash));
    return db.credentials.length !== before;
  }
  let added = false;
  for (const u of db.users) {
    if (!db.credentials.some((c) => c.user_id === u.id)) {
      db.credentials.push({ user_id: u.id, password_hash: hashPassword(TEST_USER_PASSWORD) });
      added = true;
    }
  }
  return added;
}
