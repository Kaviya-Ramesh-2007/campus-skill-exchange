'use client';

import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
} from '@campus-skill-exchange/ui';
import type { DiscoveryUser } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import {
  searchDiscoveryUsers,
  type DiscoverySearchParams,
} from '../../../features/discovery/discovery-api';
import { ApiClientError } from '../../../services/api-client';

export default function DiscoverPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [skill, setSkill] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<DiscoverySearchParams | null>(null);
  const [items, setItems] = useState<DiscoveryUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (nextQuery: DiscoverySearchParams) => {
    if (!nextQuery.skill && !nextQuery.search) {
      setError('Enter a skill or search term.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await searchDiscoveryUsers(nextQuery);
      setItems(result.items);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setQuery(nextQuery);
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? 'Unable to load Users. Please try again.'
          : 'Unable to load Users. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch({
      skill: skill.trim() || undefined,
      search: search.trim() || undefined,
      page: 1,
      limit: 20,
    });
  }

  function changePage(nextPage: number) {
    if (!query || nextPage < 1 || nextPage > totalPages) return;
    void runSearch({ ...query, page: nextPage });
  }

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) return <SignInRequired />;

  return (
    <div className="content-stack discover-page">
      <div className="page-heading">
        <p className="eyebrow">User discovery</p>
        <h1>Find skill-sharing partners</h1>
        <p>Search public Users by a skill they have indicated they can share.</p>
      </div>

      <Card title="Search public Users">
        <form className="discover-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="discovery-skill"
            name="skill"
            label="Skill"
            placeholder="Java, Python, AWS..."
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
          />
          <Input
            id="discovery-search"
            name="search"
            label="Search Users or skills"
            placeholder="Search users or skills..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" loading={loading}>
            Search
          </Button>
        </form>
      </Card>

      {error && (
        <Alert severity="error" title="Search unavailable">
          {error}
        </Alert>
      )}
      {loading && <Loading label="Searching Users" />}

      {!loading && !error && !query && (
        <EmptyState
          title="Start with a skill or search term"
          description="Use the search form to find public Users who can share a skill."
        />
      )}

      {!loading && !error && query && items.length === 0 && (
        <EmptyState title="No Users found" description="Try another skill or search term." />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="discover-results" aria-live="polite">
            {items.map((user) => (
              <DiscoveryUserCard key={user.userId} user={user} />
            ))}
          </div>
          <nav className="discover-pagination" aria-label="Search results pages">
            <Button variant="secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => changePage(page + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}

function DiscoveryUserCard({ user }: { user: DiscoveryUser }) {
  const context = [user.institution, user.department].filter(Boolean).join(' · ');
  return (
    <Card className="discover-user-card">
      <div className="discover-user-card__header">
        <Avatar name={user.displayName} src={user.profileImageUrl ?? undefined} size="lg" />
        <div>
          <h2>{user.displayName}</h2>
          {context && <p className="discover-user-card__context">{context}</p>}
        </div>
      </div>
      {user.bio && <p className="discover-user-card__bio">{user.bio}</p>}
      <div
        className="discover-user-card__skills"
        aria-label={`Skills ${user.displayName} can share`}
      >
        {user.skills.map((skill) => (
          <span className="discover-skill" key={skill.id}>
            <strong>{skill.name}</strong>
            <Badge tone="info">{skill.proficiency}</Badge>
          </span>
        ))}
      </div>
      <Link
        className="cse-button cse-button--secondary cse-button--sm"
        href={`/users/${user.userId}/profile`}
      >
        View Profile
      </Link>
    </Card>
  );
}

function SignInRequired() {
  return (
    <div className="content-stack">
      <Alert severity="info" title="Sign in required">
        Sign in to discover skill-sharing partners.
      </Alert>
      <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
        Sign in
      </Link>
    </div>
  );
}
