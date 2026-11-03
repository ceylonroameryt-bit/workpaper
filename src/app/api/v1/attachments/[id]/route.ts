import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireAttachmentAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

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
