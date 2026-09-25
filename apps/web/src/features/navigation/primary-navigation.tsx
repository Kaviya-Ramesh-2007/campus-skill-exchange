'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../features/auth/auth-provider';

/**
 * Primary and secondary destinations live in one place so every page presents
 * the same navigation. The Admin entry is role-gated, so it is never rendered
 * for a normal USER.
 */
const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/discover', label: 'Discover' },
  { href: '/payments', label: 'Payments' },
];

const SECONDARY_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/badges', label: 'Badges' },
  { href: '/reports', label: 'Safety' },
  { href: '/ai', label: 'AI assistance' },
  { href: '/chatbot', label: 'Chatbot' },
  { href: '/portfolio', label: 'Portfolio' },
];

export function PrimaryNavigation() {
  const pathname = usePathname();

  // usePathname can be null outside a matched route, so every check is guarded.
  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname?.startsWith(`${href}/`) === true;

  return (
    <>
      <nav className="site-nav" aria-label="Primary">
        {PRIMARY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive(link.href) ? 'site-nav__link site-nav__link--active' : 'site-nav__link'
            }
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <nav className="site-nav site-nav--secondary" aria-label="Secondary">
        {SECONDARY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive(link.href) ? 'site-nav__link site-nav__link--active' : 'site-nav__link'
            }
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
        <AdminNavigationLink pathname={pathname} />
      </nav>
    </>
  );
}

/** Rendered only for an ADMIN; returns nothing for a normal USER. */
function AdminNavigationLink({ pathname }: { pathname: string }) {
  const { user } = useAuth();
  if (!user?.roles?.includes('ADMIN')) return null;
  const active = pathname === '/admin' || pathname?.startsWith('/admin/') === true;
  return (
    <Link
      href="/admin"
      className={active ? 'site-nav__link site-nav__link--active' : 'site-nav__link'}
      aria-current={active ? 'page' : undefined}
    >
      Admin
    </Link>
  );
}
