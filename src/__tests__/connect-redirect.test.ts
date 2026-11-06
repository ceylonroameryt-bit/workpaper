// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { connectFailed } from '../lib/server/connect-redirect';
import { ServiceError } from '../lib/server/services';

const req = new Request('https://app.example/api/v1/integrations/xero/connect?clientId=cli_1');
const where = (r: Response | null) => r?.headers.get('Location');

describe('Connect Xero/QuickBooks failures go back to the client page', () => {
  it('explains a missing set-up or an archived client instead of showing JSON', () => {
    expect(where(connectFailed(req, 'xero', 'cli_1', new ServiceError('x', 503, 'XERO_NOT_CONFIGURED')))).toBe('https://app.example/clients/cli_1?xero=not_configured');
    expect(where(connectFailed(req, 'qbo', 'cli_1', new ServiceError('x', 503, 'QBO_NOT_CONFIGURED')))).toBe('https://app.example/clients/cli_1?qbo=not_configured');
    expect(where(connectFailed(req, 'xero', 'cli_1', new ServiceError('x', 409, 'ARCHIVED')))).toBe('https://app.example/clients/cli_1?xero=archived');
  });

  it('keeps the plain error for an unknown client or a signed-out request', () => {
    expect(connectFailed(req, 'xero', 'cli_1', new ServiceError('x', 404, 'NOT_FOUND'))).toBeNull();
    expect(connectFailed(req, 'xero', 'cli_1', new ServiceError('x', 401, 'UNAUTHORIZED'))).toBeNull();
    expect(connectFailed(req, 'xero', '', new ServiceError('x', 503, 'XERO_NOT_CONFIGURED'))).toBeNull();
  });
});

describe('public address for links', () => {
  it('uses APP_URL when set (AWS sees 0.0.0.0:3000 internally), else the request address', async () => {
    const { publicOrigin } = await import('../lib/server/api-helpers');
    const internal = new Request('http://0.0.0.0:3000/api/v1/invites');
    process.env.APP_URL = 'https://app.example/';
    expect(publicOrigin(internal)).toBe('https://app.example');
    delete process.env.APP_URL;
    expect(publicOrigin(internal)).toBe('http://0.0.0.0:3000');
  });
});
