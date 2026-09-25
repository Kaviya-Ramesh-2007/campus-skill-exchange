'use client';

import Link from 'next/link';
import { Loading } from '@campus-skill-exchange/ui';
import { useAuth } from '../../../features/auth/auth-provider';
import { ChatbotPanel } from '../../../features/ai/chatbot-panel';

export default function ChatbotPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading label="Checking your session" />;

  return (
    <div className="content-stack payments-page">
      <div className="page-heading">
        <p className="eyebrow">Assistant</p>
        <h1>Chat with the assistant</h1>
        <p>
          This conversation stays in your browser for this visit only. It is not saved, and the
          assistant cannot act on your behalf.
        </p>
      </div>

      {user ? (
        <ChatbotPanel />
      ) : (
        <div className="content-stack">
          <p className="ai-hint">Sign in to chat with the assistant.</p>
          <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
