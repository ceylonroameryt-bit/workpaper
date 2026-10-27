import { syncIn, syncOut } from '@/lib/server/store';
import { getActorFromRequest, jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { getOnboarding, saveOnboardingStep } from '@/lib/server/onboarding';

export async function GET(req: Request) {
  try {
    await syncIn();
    return jsonResponse(getOnboarding(getActorFromRequest(req)));
  } catch (err) {
    return errorResponse(err);
  }
}

// Saves one wizard step: { step: 0-4, data }
export async function PUT(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const { step, data } = await req.json().catch(() => ({}));
    const out = saveOnboardingStep(actor, Number(step), data);
    await syncOut();
    return jsonResponse(out);
  } catch (err) {
    return errorResponse(err);
  }
}
