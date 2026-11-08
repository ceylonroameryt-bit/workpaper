import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireAttachmentAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireAttachmentAccess(req, params.id);
    let overrideCategory: any = undefined;
    try {
      const body = await req.json();
      overrideCategory = body?.overrideCategory;
    } catch {
      // empty body is fine
    }

    const result = services.extractDocument(actor.firmId, actor, params.id, overrideCategory);
    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

