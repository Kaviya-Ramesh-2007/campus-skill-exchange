'use client';

import Link from 'next/link';
import { Alert, Avatar, Badge, Card, EmptyState } from '@campus-skill-exchange/ui';
import type { Profile } from '@campus-skill-exchange/contracts';

interface ProfileViewProps {
  profile: Profile;
  isOwnProfile?: boolean;
}

export function ProfileView({ profile, isOwnProfile = false }: ProfileViewProps) {
  const hasDetails = [
    profile.department,
    profile.academicYear,
    profile.institution,
    profile.bio,
    profile.interests.length > 0 ? 'interests' : null,
    profile.githubUrl,
    profile.portfolioUrl,
  ].some(Boolean);
  const displayName = profile.displayName;

  return (
    <div className="profile-view">
      <Card className="profile-hero">
        <Avatar name={displayName} src={profile.profileImageUrl ?? undefined} size="lg" />
        <div className="profile-hero__identity">
          <div className="profile-hero__name-row">
            <h2>{displayName}</h2>
            <Badge tone={profile.visibility === 'PUBLIC' ? 'success' : 'neutral'}>
              {profile.visibility === 'PUBLIC' ? 'Public profile' : 'Private profile'}
            </Badge>
          </div>
          <p className="profile-hero__summary">
            {profile.institution ?? 'Institution not added yet'}
            {profile.department ? ` · ${profile.department}` : ''}
          </p>
          {isOwnProfile && (
            <Link className="cse-button cse-button--secondary cse-button--sm" href="/profile/edit">
              Edit profile
            </Link>
          )}
        </div>
      </Card>

      {!hasDetails && (
        <EmptyState
          title="Profile details are still empty"
          description="Add the context you want to share with the Campus Skill Exchange community."
          action={
            isOwnProfile ? (
              <Link className="cse-button cse-button--primary cse-button--md" href="/profile/edit">
                Complete your profile
              </Link>
            ) : undefined
          }
        />
      )}

      {(profile.department || profile.academicYear || profile.institution) && (
        <Card title="Academic context">
          <div className="profile-facts">
            <ProfileFact label="Department" value={profile.department} />
            <ProfileFact label="Academic year" value={profile.academicYear} />
            <ProfileFact label="Institution" value={profile.institution} />
          </div>
        </Card>
      )}

      {profile.bio && (
        <Card title="About">
          <p className="profile-bio">{profile.bio}</p>
        </Card>
      )}

      {profile.interests.length > 0 && (
        <Card title="Interests">
          <ul className="profile-interests" aria-label="Profile interests">
            {profile.interests.map((interest) => (
              <li key={interest}>{interest}</li>
            ))}
          </ul>
        </Card>
      )}

      {(profile.githubUrl || profile.portfolioUrl) && (
        <Card title="Links">
          <div className="profile-links">
            {profile.githubUrl && (
              <a href={profile.githubUrl} target="_blank" rel="noreferrer">
                GitHub profile
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
            {profile.portfolioUrl && (
              <a href={profile.portfolioUrl} target="_blank" rel="noreferrer">
                Portfolio
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
          </div>
        </Card>
      )}

      {profile.visibility === 'PRIVATE' && !isOwnProfile && (
        <Alert severity="info">This profile is not publicly visible.</Alert>
      )}
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="profile-fact">
      <p className="profile-fact__label">{label}</p>
      <p className="profile-fact__value">{value ?? 'Not added'}</p>
    </div>
  );
}
