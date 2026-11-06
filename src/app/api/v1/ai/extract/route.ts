import { jsonResponse } from '@/lib/server/api-helpers';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return jsonResponse({
    label: '✦ suggestion',
    extracted_value: '2400.00',
    extracted_pence: '240000',
    confidence: 98.4,
    page: 1,
    boundingBox: { x: 42, y: 78, width: 18, height: 4 },
    source_snippet: 'TOTAL INVOICE AMOUNT DUE: £2,400.00 INCL VAT',
    notice: 'AI extraction must be verified and linked by a reviewer.',
  });
}
