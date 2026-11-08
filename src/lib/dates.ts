/** UK date display, e.g. "30 Sep 2026". Storage and exports stay ISO (2026-09-30). */

// A bare date has no time zone, so read it as UTC to keep it on the same day everywhere
const asDate = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);

export function ukDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = asDate(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : undefined });
}

export const ukTime = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
