import Link from 'next/link';
import { Alert } from '@campus-skill-exchange/ui';

export default function FoundationPage() {
  return (
    <div className="hero">
      <p className="eyebrow">Foundation infrastructure</p>
      <h1>Campus Skill Exchange</h1>
      <p className="hero__tagline">Learn. Teach. Exchange. Grow.</p>
      <p className="hero__description">
        The technical foundation is ready for future product modules. This page intentionally does
        not display users, skills, matches, sessions, or other product data.
      </p>
      <div className="hero__actions">
        <Link href="/health" className="cse-button cse-button--primary cse-button--md">
          View infrastructure health
        </Link>
      </div>
      <Alert severity="info" title="Foundation boundary">
        Authentication and product features will be added in later prompts. No external provider is
        connected yet.
      </Alert>
      <p className="foundation-note">
        The application shell, shared contracts, database migration workflow, API conventions, and
        design-system primitives are intentionally separated from product behavior.
      </p>
    </div>
  );
}
