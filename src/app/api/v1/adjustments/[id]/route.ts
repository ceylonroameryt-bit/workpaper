import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse, requireAdjustmentAccess } from '@/lib/server/api-helpers';
import { deleteJournal, journalAction } from '@/lib/server/journals';

// { action: 'accept' | 'reject' | 'approve' | 'reverse', reason? }
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAdjustmentAccess(req, params.id);
    const out = journalAction(actor, params.id, await req.json().catch(() => ({})));
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}

// Only drafts and unapproved journals; approved ones are reversed instead
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    deleteJournal(requireAdjustmentAccess(req, params.id), params.id);
    await syncOut();
    return jsonResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
