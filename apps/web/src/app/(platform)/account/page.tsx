'use client';

import Link from 'next/link';
import { Alert, Badge, Button, Card, Loading } from '@campus-skill-exchange/ui';
import { useAuth } from '../../../features/auth/auth-provider';

export default function AccountPage() {
  const { user, isLoading, error, logout } = useAuth();

  if (isLoading) return <Loading label="Loading your account" />;

  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to view your authenticated account.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="content-stack">
      <div className="page-heading">
        <p className="eyebrow">Authenticated account</p>
        <h1>Your account</h1>
        <p>This is the current identity established by the server session.</p>
      </div>
      {error && <Alert severity="warning">{error}</Alert>}
      <Card>
        <div className="account-summary">
          <div>
            <p className="account-summary__label">Display name</p>
            <p className="account-summary__value">{user.displayName}</p>
          </div>
          <div>
            <p className="account-summary__label">Email</p>
            <p className="account-summary__value">{user.email}</p>
          </div>
          <div>
            <p className="account-summary__label">System roles</p>
            <div className="account-summary__roles">
              {user.roles.map((role) => (
                <Badge key={role} tone={role === 'ADMIN' ? 'warning' : 'info'}>
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="account-summary__label">Account status</p>
            <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>{user.status}</Badge>
          </div>
        </div>
        <div className="account-actions">
          <Link className="cse-button cse-button--secondary cse-button--md" href="/profile">
            View profile
          </Link>
          <Button variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
