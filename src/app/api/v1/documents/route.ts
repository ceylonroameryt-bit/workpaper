import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, getActorFromRequest, requireEngagementAccess } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';
import { db } from '@/lib/server/db';

export async function GET(req: Request) {
  try {
    await syncIn();
    const url = new URL(req.url);
    const engagementId = url.searchParams.get('engagementId');
    if (!engagementId) {
      return jsonResponse({ error: 'engagementId query parameter is required' }, 400);
    }
    const actor = requireEngagementAccess(req, engagementId);
    const folder = url.searchParams.get('folder'); // 'current' | 'permanent'
    const scheduleRef = url.searchParams.get('scheduleRef');
    const search = url.searchParams.get('search')?.toLowerCase();

    let docs = db.attachments.filter((a) => a.engagement_id === engagementId && !a.deleted_at);

    if (folder) {
      docs = docs.filter((d) => (folder === 'permanent' ? d.is_permanent || d.folder === 'permanent' : !d.is_permanent && d.folder !== 'permanent'));
    }
    if (scheduleRef) {
      docs = docs.filter((d) => d.linked_schedule_ref === scheduleRef || (d.links || []).some((l: any) => l.anchor_json?.schedule === scheduleRef));
    }
    if (search) {
      docs = docs.filter((d) => d.filename.toLowerCase().includes(search) || (d.ai_tag && d.ai_tag.toLowerCase().includes(search)));
    }

    return jsonResponse({ documents: docs });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await syncIn();
    const body = await req.json();
    const { engagementId, workpaperId, filename, mime, size, content, category, is_permanent, folder } = body;

    if (!engagementId || !filename || content === undefined) {
      return jsonResponse({ error: 'engagementId, filename and content are required' }, 400);
    }

    const actor = requireEngagementAccess(req, engagementId);
    const result = services.uploadAttachment(actor.firmId, actor, engagementId, workpaperId || null, {
      filename,
      mime: mime || 'application/pdf',
      size: Number(size || 1024),
      content,
      category,
      is_permanent: !!is_permanent || folder === 'permanent',
      folder: folder || (is_permanent ? 'permanent' : 'current'),
    });

    await syncOut();
    return jsonResponse({ attachment: result, is_duplicate: (result as any).is_duplicate });
  } catch (err) {
    return errorResponse(err);
  }
}
