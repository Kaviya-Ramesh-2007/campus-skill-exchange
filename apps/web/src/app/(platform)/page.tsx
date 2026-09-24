import Link from 'next/link';
import { Alert } from '@campus-skill-exchange/ui';

export default function FoundationPage() {
  return (
    <div className="hero">
      <p className="eyebrow">Authentication & identity</p>
      <h1>Campus Skill Exchange</h1>
      <p className="hero__tagline">Learn. Teach. Exchange. Grow.</p>
      <p className="hero__description">
        Secure local identity is now available. Future product modules can build on the
        authenticated server session without trusting a browser-provided user ID.
      </p>
      <div className="hero__actions">
        <Link href="/auth/login" className="cse-button cse-button--primary cse-button--md">
          Sign in
        </Link>
        <Link href="/auth/register" className="cse-button cse-button--secondary cse-button--md">
          Create account
        </Link>
      </div>
      <Alert severity="info" title="Local authentication only">
        Accounts use the secure local password flow. No external identity provider is connected yet.
      </Alert>
      <p className="foundation-note">
        The application shell, shared contracts, identity migration, server-side sessions, and
        design-system primitives are intentionally separated from future product behavior.
      </p>
    </div>
  );
}
