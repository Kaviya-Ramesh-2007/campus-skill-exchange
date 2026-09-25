'use client';

import { Loading } from '@campus-skill-exchange/ui';
import { useAuth } from '../../../features/auth/auth-provider';
import { AiAssistancePanel } from '../../../features/ai/ai-assistance-panel';

export default function AiAssistancePage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading label="Checking your session" />;

  return (
    <div className="content-stack payments-page">
      <div className="page-heading">
        <p className="eyebrow">Assistant</p>
        <h1>AI assistance</h1>
        <p>
          Generate a short draft from your own notes. Everything stays editable, and nothing is
          published on your behalf.
        </p>
      </div>

      {user ? <AiAssistancePanel /> : <p className="ai-hint">Sign in to use AI assistance.</p>}
    </div>
  );
}
