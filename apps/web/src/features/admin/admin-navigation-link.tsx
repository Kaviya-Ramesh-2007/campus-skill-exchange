'use client';

import Link from 'next/link';
import { useAuth } from '../auth/auth-provider';

/**
 * Renders nothing at all for a normal USER, so the admin area is never
 * advertised to accounts that cannot use it.
 */
export function AdminNavigationLink() {
  const { user } = useAuth();
  if (!user?.roles?.includes('ADMIN')) return null;
  return <Link href="/admin">Admin</Link>;
}
