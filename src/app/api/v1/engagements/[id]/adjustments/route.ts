import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { createJournal, registerTotals } from '@/lib/server/journals';

// The journal register for an engagement, with its effect on profit and net assets (JNL-04)
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const t = registerTotals(params.id);
    return jsonResponse({
      journals: db.adjustments.filter((a) => a.engagement_id === params.id),
      totals: { profit_p: t.profit_p.toString(), net_assets_p: t.net_assets_p.toString() },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// New journal: { type, date, narrative, lines: [{ blynt_code, debit_p, credit_p, narrative }], evidence?, auto_reverse?, source_schedule?, calculation? }
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireEngagementAccess(req, params.id);
    const j = createJournal(actor, params.id, await req.json().catch(() => ({})));
    await syncOut();
    return jsonResponse(j, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
