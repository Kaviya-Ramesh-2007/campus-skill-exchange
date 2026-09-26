'use client';

import { Alert, Loading } from '@campus-skill-exchange/ui';
import { useAuth } from '../../../features/auth/auth-provider';
import { RequestsInbox } from '../../../features/requests/requests-inbox';

export default function RequestsPage() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) {
    return (
      <Alert severity="info" title="Sign in required">
        Sign in to review your session requests.
      </Alert>
    );
  }

  return (
    <div className="content-stack requests-page">
      <div className="page-heading">
        <p className="eyebrow">Session requests</p>
        <h1>Requests</h1>
        <p>Review the skill-sharing requests you sent and received.</p>
      </div>
      <RequestsInbox currentUserId={user.id} />
    </div>
  );
}
