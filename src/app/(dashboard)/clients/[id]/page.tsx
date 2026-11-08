'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/lib/server/db';
import { QuickBooksPanel, XeroPanel } from '@/components/integrations/XeroPanel';
import { ClientProfileForm } from '@/components/clients/ClientProfileForm';
import { ClientWorkpapers } from '@/components/clients/ClientWorkpapers';
import { Client } from '@/lib/types/models';
import { useLocale } from '@/context/LocaleContext';

export default function ClientRecordPage() {
  const params = useParams();
  const clientId = (params?.id as string) || '';
  const { formatDate } = useLocale();

  const client = db.clients.find((c) => c.id === clientId);

  const clientEngagements = client ? db.engagements.filter((e) => e.client_id === client.id) : [];


  // Result of "Connect Xero", passed back by the callback
  const search = useSearchParams();
  const [ledger, ledgerResult] = search.get('xero') ? ['Xero', search.get('xero')] : search.get('qbo') ? ['QuickBooks', search.get('qbo')] : ['', null];
  const xeroMessage =
    ledgerResult === 'connected'
      ? { ok: true, text: `${ledger} connected. Pull the trial balance from an engagement.` }
      : ledgerResult === 'declined'
        ? { ok: false, text: `${ledger} access was not granted, so nothing was connected.` }
        : ledgerResult === 'not_configured'
          ? { ok: false, text: `${ledger} isn’t switched on for this practice yet, so it couldn’t be connected. Your admin needs to add the ${ledger} app details to the server. Until then, import the trial balance from a CSV file.` }
          : ledgerResult === 'archived'
            ? { ok: false, text: `This client is archived. Restore it before connecting ${ledger}.` }
            : ledgerResult === 'error'
              ? { ok: false, text: `The ${ledger} connection didn’t complete. Try again, and sign in as the same user who started it.` }
              : null;
  const latestEngagement = [...clientEngagements].sort((a, b) => b.period_end.localeCompare(a.period_end))[0];

  if (!client) {
    return (
      <div className="bg-white border border-[#E3E7EF] rounded-xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold text-[#122654]">Client not found</h1>
        <p className="text-xs text-[#4A5878]">This client doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/clients" className="inline-block text-xs font-bold text-[#B8432F] hover:underline">Back to clients</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {xeroMessage && (
        <div role="status" className={`px-4 py-3 rounded-[10px] text-xs font-medium border ${xeroMessage.ok ? 'bg-[#E6F4EF] border-[#0B6B52]/20 text-[#0B6B52]' : 'bg-[#FFF4DB] border-[#6B4700]/20 text-[#6B4700]'}`}>
          {xeroMessage.text}
        </div>
      )}
      {/* Top Header */}
      <div className="bg-white border border-[#E3E7EF] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#122654]">{client.name}</h1>
            {client.company_no && (
              <span className="text-xs bg-[#EAF5FC] text-[#1D4E89] px-2.5 py-1 rounded-full font-mono font-semibold">
                Co. No. {client.company_no}
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A5878] mt-1">
            Standard: <strong>{client.company_type || 'Not set'}</strong> • Financial Year End:{' '}
            <strong>{client.year_end ? formatDate(client.year_end) : 'Not set'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/engagements/new"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FF7A66] hover:bg-[#ff9485] text-[#0B1A3B] text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Engagement</span>
          </Link>
        </div>
      </div>

      <div>
        <div className="space-y-6">
          <XeroPanel clientId={client.id} engagementId={latestEngagement?.id} reconnectNeeded={Boolean(client.reconnect_needed)} />
          <QuickBooksPanel clientId={client.id} engagementId={latestEngagement?.id} reconnectNeeded={Boolean(client.reconnect_needed)} />
          <ClientWorkpapers clientId={client.id} />

          <ClientProfileForm key={client.id} client={client as Client} />
        </div>
      </div>
    </div>
  );
}
