import { jsonResponse } from '@/lib/server/api-helpers';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const workpaperRef = body.ref || 'F-10';

  return jsonResponse({
    label: '✦ suggestion',
    draft: `✦ suggestion: Based on testing performed on ${workpaperRef}, all closing figures tie out to nominal ledgers without variance. Capital additions over £1,000 threshold were agreed to supplier invoice documentation. Depreciation recalculation verified that rates applied adhere to disclosed accounting policy.`,
    options: ['Use suggestion', 'Edit first', 'Dismiss'],
    notice: 'Nothing enters the paper until explicitly accepted by a reviewer.',
  });
}
