'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alert, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { Profile } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../../../features/auth/auth-provider';
import { getPublicProfile } from '../../../../../features/profile/profile-api';
import { ProfileView } from '../../../../../features/profile/profile-view';
import { SendRequestAction } from '../../../../../features/requests/send-request-action';
import { ApiClientError } from '../../../../../services/api-client';

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setProfile(await getPublicProfile(userId));
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
  }, [userId]);

  useEffect(() => {
    // The public profile is fetched independently of the optional session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  if (isLoading) return <Loading label="Loading public profile" />;

  return (
    <div className="content-stack profile-page">
      <div className="page-heading">
        <p className="eyebrow">Community profile</p>
        <h1>Public profile</h1>
        <p>A public introduction shared by another Campus Skill Exchange user.</p>
      </div>

      {error && (
        <Alert severity="error" title="Profile unavailable">
          {error} <Link href="/">Return home</Link>
        </Alert>
      )}

      {notFound && (
        <EmptyState
          title="Profile unavailable"
          description="This profile does not exist or is not public."
          action={
            <Link className="cse-button cse-button--primary cse-button--md" href="/">
              Return home
            </Link>
          }
        />
      )}

      {profile && (
        <>
          <ProfileView profile={profile} isOwnProfile={user?.id === profile.userId} />
          {/* A User never requests themselves, so the action is hidden on their own profile. */}
          {user && user.id !== profile.userId && (
            <section className="send-request" aria-label="Session request">
              <SendRequestAction
                currentUserId={user.id}
                recipientUserId={profile.userId}
                recipientName={profile.displayName}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
