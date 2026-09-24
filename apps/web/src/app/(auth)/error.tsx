'use client';

import { Alert, Button } from '@campus-skill-exchange/ui';

export default function AuthError({ retry }: { retry: () => void }) {
  return (
    <div className="auth-card-wrap">
      <Alert severity="error" title="Authentication view unavailable">
        The authentication view could not be rendered. No account data was changed.
      </Alert>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
