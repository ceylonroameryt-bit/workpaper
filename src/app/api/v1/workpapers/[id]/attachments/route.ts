import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const body = await req.json();

    const attachment = services.uploadAttachment(
      actor.firmId,
      actor,
      body.engagementId || 'eng_harlow_fy26',
      workpaperId,
      {
        filename: body.filename || 'uploaded_evidence.pdf',
        mime: body.mime || 'application/pdf',
        size: body.size || 1024,
        content: body.content || `FILE_CONTENT_${Date.now()}`,
        category: body.category || 'Other',
        is_permanent: body.is_permanent,
      }
    );
    await syncOut();
    return jsonResponse(attachment, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
