import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { ServiceError } from '@/lib/server/services';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id: workpaperId } = requireWorkpaperAccess(req, params.id);
    const body = await req.json();
    const role = body.role || actor.role;

    const wp = db.workpapers.find((w) => w.id === workpaperId);
    if (!wp) throw new ServiceError('Workpaper not found', 404);

    // Ground Rule: "Mark as prepared" disabled with reason until procedures, checks and conclusion are done.
    if (role === 'preparer') {
      const pendingProcedures = db.procedures.filter(
        (p) => p.workpaper_id === wp.id && !p.done_at && !p.not_applicable_reason
      );
      if (pendingProcedures.length > 0) {
        throw new ServiceError(
          `Cannot mark as prepared: ${pendingProcedures.length} procedure(s) remain incomplete.`,
          400
        );
      }
    }

    const signoff = {
      id: `sig_${Date.now()}`,
      workpaper_id: workpaperId,
      role,
      user_id: actor.id,
      user_name: actor.name,
      signed_at: new Date().toISOString(),
      content_hash: `hash_${Date.now()}`,
      stale_at: null,
    };

    db.signoffs.push(signoff);
    if (role === 'preparer') {
      wp.status = 'prepared';
    } else if (role === 'reviewer' || role === 'partner') {
      wp.status = 'signed_off';
    }

    db.logAudit(actor.firmId, actor, 'SIGN_OFF_WORKPAPER', 'signoffs', signoff.id, null, signoff);
    await syncOut();
    return jsonResponse(signoff, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
