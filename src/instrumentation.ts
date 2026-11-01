import type { Instrumentation } from 'next';

// Errors the server catches outside our API try/catch (page renders, route crashes)
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logError } = await import('./lib/server/log-error');
  logError('server', err, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    digest: typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined,
  });
};
