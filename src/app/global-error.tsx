'use client';

import ErrorPage from './error';

// When the root layout itself fails: same page, in its own document (global styles don't load here)
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F5F8FD', margin: 0 }}>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
