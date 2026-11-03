import { syncIn } from '@/lib/server/store';
import { jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const engagementId = params.id;

    // Everything recorded against this engagement and the records that belong to it
    const papers = db.workpapers.filter((w) => w.engagement_id === engagementId).map((w) => w.id);
    const ids = new Set<string>([
      engagementId,
      ...papers,
      ...db.procedures.filter((p) => papers.includes(p.workpaper_id)).map((p) => p.id),
      ...db.comments.filter((c) => papers.includes(c.workpaper_id)).map((c) => c.id),
      ...db.attachments.filter((a) => a.engagement_id === engagementId).map((a) => a.id),
      ...db.signoffs.filter((s) => papers.includes(s.workpaper_id)).map((s) => s.id),
      ...db.adjustments.filter((a) => a.engagement_id === engagementId).map((a) => a.id),
      ...db.account_mappings.filter((m) => m.engagement_id === engagementId).map((m) => m.id),
      ...db.tb_snapshots.filter((s) => s.engagement_id === engagementId).map((s) => s.id),
    ]);
    const engagement = db.engagements.find((e) => e.id === engagementId);
    if (engagement) ids.add(engagement.client_id);

    // Append-only trail, newest first
    const logs = db.audit_logs
      .filter((l) => ids.has(l.entity_id) || l.entity_id.split(',').some((id) => ids.has(id)))
      .slice()
      .reverse();
    return jsonResponse({ logs });
  } catch (err) {
    return errorResponse(err);
  }
}
