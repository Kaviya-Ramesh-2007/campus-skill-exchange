import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@campus-skill-exchange/ui';
import { AuthNavigation } from '../../features/auth/auth-navigation';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="Campus Skill Exchange home">
            <span className="brand__mark" aria-hidden="true">
              CS
            </span>
            <span>
              <strong>Campus Skill Exchange</strong>
              <small>Learn. Teach. Exchange. Grow.</small>
            </span>
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Foundation</Link>
            <Link href="/health">Infrastructure health</Link>
          </nav>
          <AuthNavigation />
          <Badge tone="info">Identity foundation</Badge>
        </div>
      </header>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <p>Campus Skill Exchange identity foundation</p>
      </footer>
    </div>
  );
}
