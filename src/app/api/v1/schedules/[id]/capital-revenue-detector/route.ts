import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { db } from '@/lib/server/db';
import { asPence } from '@/lib/money';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) return jsonResponse({ error: 'Workpaper not found' }, 404);

    const url = new URL(req.url);
    const threshold = asPence(url.searchParams.get('threshold_p') || '50000');
    const items = services.detectCapitalItemsInExpenses(actor.firmId, wp.engagement_id, threshold);
    return jsonResponse({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) return jsonResponse({ error: 'Workpaper not found' }, 404);

    const body = await req.json();
    const { transaction_id, target_class_id } = body;

    if (!transaction_id) {
      return jsonResponse({ error: 'transaction_id is required' }, 400);
    }

    const result = services.capitaliseExpenseItem(actor.firmId, actor, wp.engagement_id, transaction_id, target_class_id || 'c1');
    await syncOut();
    return jsonResponse({ success: true, result });
  } catch (err) {
    return errorResponse(err);
  }
}

