import { syncIn } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { services } from '@/lib/server/services';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const { workpaper } = services.getWorkpaper(workpaperId);
    const eng = db.engagements.find((e) => e.id === workpaper.engagement_id);
    const client = db.clients.find((c) => c.id === eng?.client_id);

    // Filter templates valid for this area and company type
    const areaLetter = workpaper.ref.charAt(0);
    const templates = db.templates.filter(
      (t) =>
        t.area_letter === areaLetter &&
        (!client?.company_type || t.company_types.includes(client.company_type))
    );

    return jsonResponse(templates);
  } catch (err) {
    return errorResponse(err);
  }
}
