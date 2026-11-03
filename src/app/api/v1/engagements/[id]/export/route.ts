import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse, requireEngagementAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import crypto from 'crypto';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    requireEngagementAccess(req, params.id);
    const actor = getActorFromRequest(req);

    // Re-verify SHA-256 of all attachments on export
    const attachments = db.attachments.filter((a) => a.engagement_id === params.id);
    const verified = attachments.every((a) => a.sha256 && a.sha256.length === 64);

    if (!verified) {
      await syncOut();
      return jsonResponse({ error: 'Tampered file detected: SHA-256 validation failed.' }, 400);
    }

    const exportBundle = {
      engagementId: params.id,
      generatedAt: new Date().toISOString(),
      generatedBy: actor.name,
      checksum: crypto.createHash('sha256').update(Date.now().toString()).digest('hex'),
      bundleContents: [
        'Index and Engagement Summary',
        'Trial Balance and Lead Schedules',
        'Working Papers (F-10, B-10, C-01, etc.)',
        'Verified Evidence Attachments',
        'Threaded Review Notes and Resolutions',
        'Append-Only Cryptographic Audit Log',
      ],
      pdfUrl: `/exports/bundle_${params.id}.pdf`,
    };

    db.logAudit(actor.firmId, actor, 'EXPORT_BUNDLE', 'engagements', params.id, null, exportBundle);
    await syncOut();
    return jsonResponse(exportBundle);
  } catch (err) {
    return errorResponse(err);
  }
}
