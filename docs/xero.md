# Xero connection — setup

Blynt pulls each client's trial balance straight from Xero (story DAT-01). The code is in `src/lib/server/xero.ts`; this page covers the one-off setup.

## 1. Create the Xero app

1. Sign in at https://developer.xero.com and go to **My Apps → New app**.
2. Choose **Web app**.
3. **Redirect URI**, one per environment:
   - Local: `http://localhost:3000/api/v1/integrations/xero/callback`
   - Live: `https://<your-domain>/api/v1/integrations/xero/callback`
4. Generate a **client secret** and copy it with the **client ID**.
5. Check the scopes the app is allowed to request (Blynt asks for read-only access, listed below). Newer Xero apps may use narrower scope names; if the consent screen reports an invalid scope, update `XERO_SCOPES` in `xero.ts` to match the app's settings.
6. Check Xero's app partner pricing tier. It limits how many organisations can be connected.

## 2. Configure Blynt

Add to `.env.local` (never commit it):

```bash
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=http://localhost:3000/api/v1/integrations/xero/callback
# Optional: a separate key for encrypting stored tokens (defaults to one derived from AUTH_SECRET)
XERO_TOKEN_KEY=a-long-random-string
```

Restart the dev server after changing them. Until they're set, the Xero panels say Xero isn't set up.

## 3. Use it

1. Open a client, or an engagement's **Import** page and choose the **Xero** tab.
2. Click **Connect Xero**, sign in to Xero, and choose the client's organisation. Use the **Demo Company** for testing.
3. Back in Blynt, click **Pull trial balance**. The trial balance at the engagement's period end is imported, snapshotted, compared with the last pull, and mapped through the rules and confidence gate, exactly like a CSV.

## How it works

| Step | Detail |
|---|---|
| Consent | `GET /api/v1/integrations/xero/connect?clientId=` redirects to Xero with a signed, 10-minute `state` |
| Callback | `GET /api/v1/integrations/xero/callback` checks the state belongs to the same user and practice, swaps the code for tokens, and links the shared organisation |
| Tokens | Stored server-side only, encrypted (AES-256-GCM). Access tokens last about 30 minutes and are refreshed silently; the rotated refresh token is saved each time |
| Pull | `POST /api/v1/integrations/xero/sync { engagementId }` calls `/Accounts` and `/Reports/TrialBalance?date=<period end>` and imports the year-to-date balances |
| Expired link | If Xero refuses the refresh token (about 60 days unused, or access revoked), the client is marked **Reconnect needed** |
| Status / disconnect | `GET` / `DELETE /api/v1/integrations/xero/connection?clientId=` |

Scopes requested (granular; apps created on or after 2 March 2026 cannot use the old broad scopes): `openid profile email offline_access accounting.settings.read accounting.reports.trialbalance.read accounting.contacts.read accounting.invoices.read accounting.banktransactions.read accounting.manualjournals.read`. `accounting.journals.read` needs Xero approval and is added when the journals drill-down is built.

## Not built yet

- Transaction drill-down with links back to Xero (DAT-07). The organisation's short code is already stored for the links.
- QuickBooks Online, which follows the same pattern.
- Choosing between several organisations when more than one is shared at once (the first organisation is linked).

Tests: `src/__tests__/xero.test.ts` runs offline against recorded Xero responses.
