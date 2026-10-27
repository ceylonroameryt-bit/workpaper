import { NextResponse } from 'next/server';
import { ServiceError } from './services';
import { db } from './db';
import { readCookie, verifySessionToken } from './auth';
import { GuardError, visibleClientIds } from './state-guard';

/** The signed-in user, from the signed session cookie. Call after syncIn(). */
export function getActorFromRequest(req: Request) {
  const session = verifySessionToken(readCookie(req));
  if (!session) throw new ServiceError('Please sign in.', 401, 'UNAUTHENTICATED');
  const user = db.users.find((u) => u.id === session.uid);
  const membership = db.memberships.find((m) => m.user_id === session.uid);
  if (!user || !membership) throw new ServiceError('Your account no longer has access.', 401, 'UNAUTHENTICATED');
  return {
    id: user.id,
    name: user.name,
    role: membership.role,
    firmId: membership.firm_id,
    // null = every client in the firm; otherwise only these (ADM-01 assigned clients)
    clientIds: visibleClientIds(membership),
  };
}

/** The signed-in user, after checking the engagement is in their firm and on a client they are assigned to. */
export function requireEngagementAccess(req: Request, engagementId: string) {
  const actor = getActorFromRequest(req);
  if (!canAccessEngagement(actor, engagementId)) throw new ServiceError('Engagement not found', 404, 'NOT_FOUND');
  return actor;
}

type RequestActor = ReturnType<typeof getActorFromRequest>;

/** True when the engagement is in the actor's firm and on a client they may see. */
export function canAccessEngagement(actor: RequestActor, engagementId: string | null | undefined): boolean {
  const eng = db.engagements.find((e) => e.id === engagementId);
  return Boolean(eng && eng.firm_id === actor.firmId && (!actor.clientIds || actor.clientIds.includes(eng.client_id)));
}

/**
 * Workpapers are addressed by id or by reference (e.g. "F-10"); a reference is only looked up
 * among engagements the caller can see. Returns the resolved workpaper id.
 */
export function requireWorkpaperAccess(req: Request, idOrRef: string) {
  const actor = getActorFromRequest(req);
  const wp =
    db.workpapers.find((w) => w.id === idOrRef && canAccessEngagement(actor, w.engagement_id)) ??
    db.workpapers.find((w) => w.ref === idOrRef && canAccessEngagement(actor, w.engagement_id));
  if (!wp) throw new ServiceError('Workpaper not found', 404, 'NOT_FOUND');
  return { actor, id: wp.id };
}

/** A comment, via the workpaper it sits on. */
export function requireCommentAccess(req: Request, commentId: string) {
  const actor = getActorFromRequest(req);
  const c = db.comments.find((x) => x.id === commentId);
  const wp = c && db.workpapers.find((w) => w.id === c.workpaper_id);
  if (!wp || !canAccessEngagement(actor, wp.engagement_id)) throw new ServiceError('Comment not found', 404, 'NOT_FOUND');
  return actor;
}

export function requireAdjustmentAccess(req: Request, adjustmentId: string) {
  const actor = getActorFromRequest(req);
  const a = db.adjustments.find((x) => x.id === adjustmentId);
  if (!a || !canAccessEngagement(actor, a.engagement_id)) throw new ServiceError('Adjustment not found', 404, 'NOT_FOUND');
  return actor;
}

export function requireAttachmentAccess(req: Request, attachmentId: string) {
  const actor = getActorFromRequest(req);
  const a = db.attachments.find((x) => x.id === attachmentId);
  if (!a || !canAccessEngagement(actor, a.engagement_id)) throw new ServiceError('Attachment not found', 404, 'NOT_FOUND');
  return actor;
}

export function jsonResponse(data: any, status = 200, headers?: Record<string, string>) {
  // Stringify with bigint support if any
  const body = JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(err: any) {
  if (err instanceof GuardError) {
    return jsonResponse({ error: err.message, code: 'FORBIDDEN' }, 403);
  }
  if (err instanceof ServiceError) {
    return jsonResponse({ error: err.message, code: err.code }, err.status);
  }
  console.error('API Error:', err);
  return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500);
}
