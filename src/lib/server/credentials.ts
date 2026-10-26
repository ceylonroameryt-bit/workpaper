import { db } from './db';
import { hashPassword } from './auth';

// Password for the seeded test users. Default is admin123 matching the login form hint.
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'admin123';

/** Gives every user without a password the test password (server side only). */
export function ensureCredentials(): boolean {
  let added = false;
  for (const u of db.users) {
    if (!db.credentials.some((c) => c.user_id === u.id)) {
      db.credentials.push({ user_id: u.id, password_hash: hashPassword(TEST_USER_PASSWORD) });
      added = true;
    }
  }
  return added;
}
