import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, requireWorkpaperAccess } from '@/lib/server/api-helpers';
import { signOff } from '@/lib/server/signoff';

const ACTION: Record<string, 'prepare' | 'review' | 'approve'> = { prepare: 'prepare', preparer: 'prepare', review: 'review', reviewer: 'review', approve: 'approve', partner: 'approve' };

// { action: 'prepare' | 'review' | 'approve' } (older callers send role: 'preparer' | 'reviewer' | 'partner')
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await syncIn();
    const params = await props.params;
    const { actor, id } = requireWorkpaperAccess(req, params.id);
    const body = await req.json().catch(() => ({}));
    const s = signOff(actor, id, ACTION[body.action ?? body.role]);
    await syncOut();
    return jsonResponse(s, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
