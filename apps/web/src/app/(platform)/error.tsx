'use client';

import { useEffect } from 'react';
import { Alert, Button } from '@campus-skill-exchange/ui';

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The production logger will receive structured client error reporting in a later prompt.
    console.error(error);
  }, [error]);

  return (
    <div className="content-stack">
      <Alert severity="error" title="Something went wrong">
        The application shell could not render this view. No product data was changed.
      </Alert>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
