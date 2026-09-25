'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Loading } from '@campus-skill-exchange/ui';
import type { Profile } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../../features/auth/auth-provider';
import { getCurrentProfile } from '../../../../features/profile/profile-api';
import { ProfileEditor } from '../../../../features/profile/profile-editor';
import { ApiClientError } from '../../../../services/api-client';

export default function EditProfilePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      setProfile(await getCurrentProfile());
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 404) {
        setProfile(null);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Profile unavailable.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // The profile request is synchronized with the authenticated session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  if (isAuthLoading) return <Loading label="Checking your session" />;

  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to edit your professional profile.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) return <Loading label="Loading profile editor" />;

  return (
    <div className="content-stack profile-page">
      <div className="page-heading">
        <p className="eyebrow">Your profile</p>
        <h1>{profile ? 'Edit profile' : 'Create profile'}</h1>
        <p>
          Only presentation information belongs here; account security remains managed separately.
        </p>
      </div>

      {error && (
        <Alert severity="error" title="Profile unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void loadProfile()}>
            Try again
          </Button>
        </Alert>
      )}

      {!error && <ProfileEditor profile={profile} accountDisplayName={user.displayName} />}
    </div>
  );
}
