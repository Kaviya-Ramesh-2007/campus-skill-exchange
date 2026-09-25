import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthNavigation } from '../../features/auth/auth-navigation';
import { PrimaryNavigation } from '../../features/navigation/primary-navigation';
import { NotificationBell } from '../../features/notifications/notification-bell';

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
          <PrimaryNavigation />
          <AuthNavigation />
          <NotificationBell />
        </div>
      </header>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <p>Campus Skill Exchange — learn, teach and exchange skills with your campus peers.</p>
      </footer>
    </div>
  );
}
