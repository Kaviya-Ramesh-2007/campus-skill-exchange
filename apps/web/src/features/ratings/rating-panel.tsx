'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card } from '@campus-skill-exchange/ui';
import type { SessionStatus } from '@campus-skill-exchange/contracts';
import {
  isRatingEligible,
  unavailableRatingClient,
  type RatingClient,
  type RatingRecord,
} from './rating-api';

export interface RatingPanelProps {
  sessionId: string;
  partnerName: string;
  status: SessionStatus;
  client?: RatingClient;
  existingRating?: RatingRecord | null;
}

export function RatingPanel({
  sessionId,
  partnerName,
  status,
  client = unavailableRatingClient,
  existingRating,
}: RatingPanelProps) {
  const [rating, setRating] = useState<RatingRecord | null>(existingRating ?? null);
  const [selectedStars, setSelectedStars] = useState<RatingRecord['stars'] | null>(null);
  const [feedback, setFeedback] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(existingRating === undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (existingRating !== undefined || !isRatingEligible(status)) return;
    let active = true;
    client
      .getRating(sessionId)
      .then((result) => {
        if (active) setRating(result);
      })
      .catch(() => {
        if (active) setSubmitError('Unable to load the existing rating.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, existingRating, sessionId, status]);

  if (!isRatingEligible(status)) {
    return (
      <Alert severity="info" title="Rating not available">
        Ratings become available after the session is completed.
      </Alert>
    );
  }

  if (rating) {
    return (
      <Card title="Your rating" description={`Rating for ${partnerName}`}>
        {submitted && <Alert severity="success">Rating submitted successfully.</Alert>}
        <div aria-label="Existing rating">
          <p className="cse-rating-display" aria-label={`${rating.stars} out of 5 stars`}>
            {'★'.repeat(rating.stars)}
            <span aria-hidden="true">{'☆'.repeat(5 - rating.stars)}</span>
          </p>
          {rating.feedback ? <p>{rating.feedback}</p> : <p>No written feedback.</p>}
        </div>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    if (!selectedStars) {
      setValidationError('Choose a rating from 1 to 5 stars.');
      return;
    }
    const trimmedFeedback = feedback.trim();
    if (trimmedFeedback.length > 2000) {
      setValidationError('Feedback must be 2,000 characters or fewer.');
      return;
    }
    setValidationError(null);
    setIsSubmitting(true);
    try {
      const result = await client.submitRating({
        sessionId,
        stars: selectedStars,
        ...(trimmedFeedback ? { feedback: trimmedFeedback } : {}),
      });
      setRating(result);
      setSubmitted(true);
    } catch {
      setSubmitError('Unable to submit the rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card title="Rate your session partner" description={`Share feedback about ${partnerName}.`}>
      {isLoading ? (
        <p role="status">Loading rating…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <fieldset>
            <legend>Rating</legend>
            <div role="group" aria-label="Star rating">
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-label={`Rate ${value} out of 5`}
                  aria-pressed={selectedStars === value}
                  onClick={() => {
                    setSelectedStars(value);
                    setValidationError(null);
                  }}
                >
                  <span aria-hidden="true">{value <= (selectedStars ?? 0) ? '★' : '☆'}</span>
                </Button>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`rating-feedback-${sessionId}`}>
            Written feedback (optional)
            <textarea
              id={`rating-feedback-${sessionId}`}
              className="cse-input"
              rows={4}
              value={feedback}
              maxLength={2000}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={validationError ? `rating-feedback-error-${sessionId}` : undefined}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
          {validationError && (
            <p id={`rating-feedback-error-${sessionId}`} role="alert">
              {validationError}
            </p>
          )}
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <Button type="submit" loading={isSubmitting}>
            Submit rating
          </Button>
        </form>
      )}
    </Card>
  );
}
