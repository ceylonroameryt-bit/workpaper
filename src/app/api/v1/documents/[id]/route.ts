import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireAttachmentAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { db } from '@/lib/server/db';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAttachmentAccess(req, params.id);
    const doc = db.attachments.find((a) => a.id === params.id && !a.deleted_at);
    if (!doc) {
      return jsonResponse({ error: 'Document not found' }, 404);
    }
    return jsonResponse({ document: doc });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAttachmentAccess(req, params.id);
    const result = services.deleteAttachment(actor.firmId, actor, params.id);
    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

