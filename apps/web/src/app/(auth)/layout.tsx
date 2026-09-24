import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <Link className="brand" href="/" aria-label="Campus Skill Exchange home">
          <span className="brand__mark" aria-hidden="true">
            CS
          </span>
          <span>
            <strong>Campus Skill Exchange</strong>
            <small>Learn. Teach. Exchange. Grow.</small>
          </span>
        </Link>
      </header>
      <main className="auth-page__main">{children}</main>
    </div>
  );
}
