'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Loading } from '@campus-skill-exchange/ui';
import { useAuth } from './auth-provider';

export function AuthNavigation() {
  const { user, isLoading, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isLoading) return <Loading label="Checking session" />;

  if (!user) {
    return (
      <div className="auth-nav-links">
        <Link className="cse-button cse-button--ghost cse-button--sm" href="/auth/login">
          Sign in
        </Link>
        <Link className="cse-button cse-button--primary cse-button--sm" href="/auth/register">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-nav-links">
      <Link className="auth-nav-user" href="/account">
        {user.displayName}
      </Link>
      <Badge tone="info">{user.roles.includes('ADMIN') ? 'ADMIN' : 'USER'}</Badge>
      <Button
        variant="secondary"
        size="sm"
        loading={isSigningOut}
        onClick={async () => {
          setIsSigningOut(true);
          try {
            await logout();
          } finally {
            setIsSigningOut(false);
          }
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
