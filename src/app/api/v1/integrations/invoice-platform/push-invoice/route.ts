import { syncIn, syncOut } from '@/lib/server/store';
import { errorResponse, jsonResponse, getActorFromRequest } from '@/lib/server/api-helpers';
import { services } from '@/lib/server/services';

export async function POST(req: Request) {
  try {
    await syncIn();
    const actor = getActorFromRequest(req);
    const body = await req.json();

    const {
      client_id,
      invoice_id,
      supplier,
      invoice_date,
      invoice_number,
      description,
      net_p,
      vat_p,
      ledger_transaction_id,
      image_url,
    } = body;

    if (!client_id || !invoice_id || !supplier || !net_p) {
      return jsonResponse({ error: 'client_id, invoice_id, supplier and net_p are required' }, 400);
    }

    const result = services.pushInvoiceFromPlatform(actor.firmId, actor, {
      client_id,
      invoice_id,
      supplier,
      invoice_date: invoice_date || '2026-03-12',
      invoice_number: invoice_number || 'INV-001',
      description: description || 'Capital addition',
      net_p: String(net_p),
      vat_p: String(vat_p || '0'),
      ledger_transaction_id,
      image_url,
      is_capital: true,
    });

    await syncOut();
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}

