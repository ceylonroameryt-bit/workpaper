'use client';

import { useEffect } from 'react';

/** Shown when a page crashes. Reports the error to the server log, and offers a retry. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    fetch('/api/v1/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div role="alert" className="max-w-md bg-white border border-[#E3E7EF] rounded-[16px] p-8 text-sm text-[#102654]">
        <h1 className="text-lg font-bold mb-2">Something went wrong on this page</h1>
        <p className="text-[#5B6478] mb-5">
          Nothing you saved has been lost. The problem has been logged{error.digest ? ` (reference ${error.digest})` : ''}.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => retry()} className="min-h-[38px] px-4 bg-[#102654] text-white text-xs font-bold rounded-[10px] cursor-pointer">
            Try again
          </button>
          <a href="/" className="min-h-[38px] px-4 inline-flex items-center border border-[#D5DBE7] text-xs font-bold rounded-[10px]">
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
