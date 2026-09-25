import Link from 'next/link';
import { Alert } from '@campus-skill-exchange/ui';

export default function FoundationPage() {
  return (
    <div className="hero">
      <p className="eyebrow">Professional profiles</p>
      <h1>Campus Skill Exchange</h1>
      <p className="hero__tagline">Learn. Teach. Exchange. Grow.</p>
      <p className="hero__description">
        Secure local identity and professional profiles are now available. Build meaningful
        connections on authenticated server sessions without trusting a browser-provided user ID.
      </p>
      <div className="hero__actions">
        <Link href="/auth/login" className="cse-button cse-button--primary cse-button--md">
          Sign in
        </Link>
        <Link href="/auth/register" className="cse-button cse-button--secondary cse-button--md">
          Create account
        </Link>
      </div>
      <Alert severity="info" title="Built for verified campus exchange">
        Every participant is a single User account. Verified certifications, completed sessions and
        real feedback build a reputation you can take with you.
      </Alert>
      <p className="foundation-note">
        Sessions, payments, ratings, assessments, badges and safety reports are all recorded against
        your verified account.
      </p>
    </div>
  );
}
