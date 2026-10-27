import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireCommentAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { ServiceError } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const actor = requireCommentAccess(req, params.id);
    const body = await req.json();

    const comment = db.comments.find((c) => c.id === params.id);
    if (!comment) throw new ServiceError('Comment not found', 404);

    const reply = {
      id: `rep_${Date.now()}`,
      comment_id: params.id,
      body: body.body || '',
      mentions: body.mentions || [],
      created_by: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
    };

    if (!comment.replies) comment.replies = [];
    comment.replies.push(reply);

    db.logAudit(actor.firmId, actor, 'REPLY_COMMENT', 'comments', comment.id, null, reply);
    await syncOut();
    return jsonResponse(reply, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
