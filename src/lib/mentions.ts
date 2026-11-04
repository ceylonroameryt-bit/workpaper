import { db } from './server/db';

/** Firm members tagged as @Full Name or @First name, in the order they appear. */
export function mentionsIn(body: string, firmId: string): string[] {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found: [number, string][] = [];
  for (const m of db.memberships.filter((x) => x.firm_id === firmId)) {
    const u = db.users.find((x) => x.id === m.user_id);
    if (!u) continue;
    const hit = new RegExp(`@(${esc(u.name)}|${esc(u.name.split(' ')[0])})\\b`, 'i').exec(body);
    if (hit) found.push([hit.index, u.id]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, id]) => id);
}
