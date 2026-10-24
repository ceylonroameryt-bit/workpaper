import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { matchBlyntAccount } from '@/lib/mapping/auto-mapper';
import { db } from '@/lib/server/db';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Batch mode support: { items: [{ name, type, code, id }] }
    if (Array.isArray(body.items)) {
      const results = body.items.map((item: any) => {
        const suggestion = matchBlyntAccount(item.name || '', item.type || '', item.code || '');
        return {
          id: item.id,
          source_name: item.name,
          suggested_blynt_code: suggestion ? suggestion.blynt_code : '6000',
          blynt_name: suggestion ? suggestion.name : 'Office Rent & Rates',
          confidence: suggestion ? suggestion.confidence : 60,
          reason: suggestion ? suggestion.reason : 'General overhead allocation',
          lead_letter: suggestion ? suggestion.lead_letter : 'E',
        };
      });

      return jsonResponse({
        success: true,
        batch: true,
        count: results.length,
        results,
        notice: 'AI-assisted mapping predictions calculated against Blynt Chart of Accounts.',
      });
    }

    // Single account mode
    const accountName = body.name || '';
    const accountType = body.type || '';
    const accountCode = body.code || '';

    const suggestion = matchBlyntAccount(accountName, accountType, accountCode);

    // Contextual alternatives
    const allBlynt = db.blynt_accounts;
    const primary = suggestion
      ? allBlynt.find((b) => b.code === suggestion.blynt_code) || allBlynt[0]
      : allBlynt[0];

    const alternatives = allBlynt
      .filter((b) => b.code !== primary.code && b.type === primary.type)
      .slice(0, 2)
      .map((alt) => ({
        blynt_code: alt.code,
        name: alt.name,
        reason: `Related ${alt.type} category on Lead Schedule ${alt.lead_letter}`,
        confidence: Math.max(50, (suggestion?.confidence || 70) - 20),
      }));

    return jsonResponse({
      label: '✦ AI suggestion',
      suggested_blynt_code: primary.code,
      name: primary.name,
      confidence: suggestion ? suggestion.confidence : 75,
      reason: suggestion ? suggestion.reason : 'Automated mapping match',
      lead_letter: primary.lead_letter,
      alternatives,
      notice: 'AI output changes nothing until accepted by a named user.',
    });
  } catch (err) {
    return errorResponse(err);
  }
}
