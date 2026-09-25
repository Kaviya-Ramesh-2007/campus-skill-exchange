'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { BadgeDefinition, UserBadge } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import { BadgeCard } from '../../../features/badges/badge-card';
import { listBadgeDefinitions, listUserBadges } from '../../../features/badges/badges-api';

export default function BadgesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBadges = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [availableDefinitions, badges] = await Promise.all([
        listBadgeDefinitions(),
        listUserBadges(user.id),
      ]);
      setDefinitions(availableDefinitions);
      setEarnedBadges(badges);
    } catch {
      setError('Unable to load badges right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Badge data is synchronized with the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBadges();
  }, [loadBadges]);

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) return <SignInRequired />;
  if (loading) return <Loading label="Loading your badges" />;

  const earnedDefinitionIds = new Set(earnedBadges.map((badge) => badge.badgeDefinitionId));
  const availableDefinitions = definitions.filter(
    (definition) => !earnedDefinitionIds.has(definition.id),
  );

  return (
    <div className="content-stack badges-page">
      <div className="page-heading">
        <p className="eyebrow">Achievements</p>
        <h1>Your badges</h1>
        <p>Recognize the milestones and contributions you have earned through the exchange.</p>
      </div>

      {error && (
        <Alert severity="error" title="Badges unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void loadBadges()}>
            Try again
          </Button>
        </Alert>
      )}

      {!error && (
        <>
          <section aria-labelledby="earned-badges-heading">
            <div className="section-heading">
              <h2 id="earned-badges-heading">Earned badges</h2>
              <Badge tone="info">{earnedBadges.length}</Badge>
            </div>
            {earnedBadges.length === 0 ? (
              <EmptyState
                title="No badges earned yet"
                description="Keep learning and exchanging. Your earned achievements will appear here."
              />
            ) : (
              <div className="badge-grid" aria-live="polite">
                {earnedBadges.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge.badgeDefinition}
                    awardedAt={badge.awardedAt}
                  />
                ))}
              </div>
            )}
          </section>

          {definitions.length > 0 && (
            <section aria-labelledby="available-badges-heading">
              <div className="section-heading">
                <h2 id="available-badges-heading">Available badges</h2>
                <Badge tone="neutral">{availableDefinitions.length}</Badge>
              </div>
              {availableDefinitions.length === 0 ? (
                <EmptyState
                  title="You have earned every available badge"
                  description="New badge definitions will appear here when they become available."
                />
              ) : (
                <div className="badge-grid" aria-live="polite">
                  {availableDefinitions.map((definition) => (
                    <BadgeCard key={definition.id} badge={definition} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SignInRequired() {
  return (
    <div className="content-stack">
      <Alert severity="info" title="Sign in required">
        Sign in to view your earned badges.
      </Alert>
      <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
        Sign in
      </Link>
    </div>
  );
}
