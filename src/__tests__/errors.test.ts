// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/server/store', () => ({ syncIn: async () => {}, syncOut: async () => {}, currentVersion: () => 1, hasDatabase: () => false }));

import { errorResponse } from '../lib/server/api-helpers';

describe('error logging', () => {
  it('an unexpected error is logged as one JSON line and its text is not sent to the browser', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new Error('connection to db.internal:5432 refused'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('db.internal');
    const line = JSON.parse(spy.mock.calls[0][0]);
    expect(line).toMatchObject({ blynt_error: true, where: 'api', message: 'connection to db.internal:5432 refused' });
    spy.mockRestore();
  });
});
