import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function GET(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const clients = services.getClients(actor.firmId, actor.clientIds);
    return jsonResponse(clients);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();
    const client = services.createClient(actor.firmId, actor, body);
    await syncOut();
    return jsonResponse(client, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
