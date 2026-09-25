'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../auth/auth-provider';

/**
 * Renders nothing at all for a normal USER, so the admin area is never
 * advertised to accounts that cannot use it. Prefer
 * `features/navigation/primary-navigation`, which also marks the active page.
 */
export function AdminNavigationLink() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user?.roles?.includes('ADMIN')) return null;
  // usePathname can be null outside a matched route (for example the 404 page).
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
