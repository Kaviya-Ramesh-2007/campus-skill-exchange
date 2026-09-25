import { Badge, Card } from '@campus-skill-exchange/ui';
import type { BadgeDefinition } from '@campus-skill-exchange/contracts';

export interface BadgeCardProps {
  badge: BadgeDefinition;
  awardedAt?: string;
}

export function BadgeCard({ badge, awardedAt }: BadgeCardProps) {
  return (
    <Card className="badge-card">
      <div className="badge-card__header">
        {badge.iconUrl ? (
          // Badge icons are externally managed references supplied by the API.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="badge-card__icon"
            src={badge.iconUrl}
            alt=""
            loading="lazy"
            width={48}
            height={48}
          />
        ) : (
          <span className="badge-card__icon badge-card__icon--fallback" aria-hidden="true">
            ★
          </span>
        )}
        <div className="badge-card__heading">
          <h3>{badge.name}</h3>
          {awardedAt && <Badge tone="success">Earned</Badge>}
        </div>
      </div>
      <p className="badge-card__description">{badge.description}</p>
      {awardedAt && (
        <p className="badge-card__awarded">
          Awarded <time dateTime={awardedAt}>{formatAwardedAt(awardedAt)}</time>
        </p>
      )}
    </Card>
  );
}

function formatAwardedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}
