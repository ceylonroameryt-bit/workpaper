/**
 * What changed in a working paper between two snapshots (REV-02 "changes since your review",
 * version compare), and a stable fingerprint of a paper's data for sign-offs.
 */

// Bookkeeping fields the sign-off workflow writes itself; not changes to the paper
const META = new Set(['changed_after_review', 'last_unreview_reason', 'last_unreviewed_at', 'last_unreviewed_by']);

function flatten(v: unknown, path: string, out: Map<string, string>) {
  if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (!path && META.has(k)) continue;
      flatten(x, path ? `${path}.${k}` : k, out);
    }
  } else if (path) out.set(path, v === undefined || v === null ? '' : String(v));
}

export function diffData(before: Record<string, unknown> = {}, after: Record<string, unknown> = {}) {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flatten(before, '', a);
  flatten(after, '', b);
  const fields = [...new Set([...a.keys(), ...b.keys()])];
  return fields.filter((f) => (a.get(f) ?? '') !== (b.get(f) ?? '')).map((f) => ({ field: f, before: a.get(f) ?? '', after: b.get(f) ?? '' }));
}

/** FNV-1a over the paper's fields in a fixed order: the same data always gives the same value. */
export function paperFingerprint(data: Record<string, unknown> = {}): string {
  const m = new Map<string, string>();
  flatten(data, '', m);
  const s = [...m.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => `${k}=${v}`).join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `fnv1a_${(h >>> 0).toString(16).padStart(8, '0')}`;
}
