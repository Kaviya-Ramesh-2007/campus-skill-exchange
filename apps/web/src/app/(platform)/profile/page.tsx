'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { Profile } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import { getCurrentProfile } from '../../../features/profile/profile-api';
import { ProfileView } from '../../../features/profile/profile-view';
import { ApiClientError } from '../../../services/api-client';

export default function ProfilePage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setProfile(await getCurrentProfile());
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 404) {
        setProfile(null);
        setNotFound(true);
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
          Sign in to view your professional profile.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) return <Loading label="Loading your profile" />;

  return (
    <div className="content-stack profile-page">
      <div className="page-heading">
        <p className="eyebrow">Your profile</p>
        <h1>Professional profile</h1>
        <p>Share the context you want others to know about you.</p>
      </div>

      {error && (
        <Alert severity="error" title="Profile unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void loadProfile()}>
            Try again
          </Button>
        </Alert>
      )}

      {notFound && (
        <EmptyState
          title="Your profile is not initialized"
          description="Create a profile to add your academic context, interests, and links."
          action={
            <Link className="cse-button cse-button--primary cse-button--md" href="/profile/edit">
              Create profile
            </Link>
          }
        />
      )}

      {profile && <ProfileView profile={profile} isOwnProfile />}
    </div>
  );
}
