/**
 * Error logging: one JSON line per error on stderr, which the host keeps and can search
 * (Render > Logs, filter "blynt_error"). No secrets or request bodies are written.
 * shortcut: logs live only as long as the host keeps them; add a log drain or Sentry for alerts.
 */
export function logError(where: string, err: unknown, extra: Record<string, unknown> = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      blynt_error: true,
      at: new Date().toISOString(),
      where,
      message: e.message.slice(0, 500),
      stack: e.stack?.split('\n').slice(0, 6).join('\n'),
      ...extra,
    })
  );
}
