import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RatingPanel } from '../src/features/ratings/rating-panel';
import type { RatingClient, RatingRecord } from '../src/features/ratings/rating-api';

const sessionId = '00000000-0000-4000-8000-000000000001';
const savedRating: RatingRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  sessionId,
  stars: 4,
  feedback: 'Clear and helpful.',
  createdAt: '2026-09-30T12:00:00.000Z',
};

function client(overrides: Partial<RatingClient> = {}): RatingClient {
  return {
    getRating: vi.fn().mockResolvedValue(null),
    submitRating: vi.fn().mockResolvedValue(savedRating),
    ...overrides,
  };
}

describe('RatingPanel', () => {
  afterEach(() => cleanup());

  it('renders rating controls only for a completed session', async () => {
    const ratingClient = client();
    const { rerender } = render(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="SCHEDULED"
        client={ratingClient}
      />,
    );
    expect(
      screen.getByText('Ratings become available after the session is completed.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rate 1 out of 5' })).not.toBeInTheDocument();

    rerender(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="COMPLETED"
        client={ratingClient}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Rate 1 out of 5' })).toBeInTheDocument();
  });

  it('selects a rating and submits the typed feedback', async () => {
    const ratingClient = client();
    render(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="COMPLETED"
        client={ratingClient}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Rate 4 out of 5' }));
    fireEvent.change(screen.getByLabelText('Written feedback (optional)'), {
      target: { value: '  Clear and helpful.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

    await waitFor(() =>
      expect(ratingClient.submitRating).toHaveBeenCalledWith({
        sessionId,
        stars: 4,
        feedback: 'Clear and helpful.',
      }),
    );
    expect(await screen.findByText('Your rating')).toBeInTheDocument();
    expect(screen.getByText('Rating submitted successfully.')).toBeInTheDocument();
  });

  it('shows validation when no stars are selected', async () => {
    const ratingClient = client();
    render(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="COMPLETED"
        client={ratingClient}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Submit rating' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a rating from 1 to 5 stars.');
    expect(ratingClient.submitRating).not.toHaveBeenCalled();
  });

  it('shows a safe error state when submission fails', async () => {
    const ratingClient = client({
      submitRating: vi.fn().mockRejectedValue(new Error('backend detail must not leak')),
    });
    render(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="COMPLETED"
        client={ratingClient}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Rate 5 out of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }));

    expect(
      await screen.findByText('Unable to submit the rating. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('backend detail must not leak')).not.toBeInTheDocument();
  });

  it('displays an existing rating without showing the form', () => {
    render(
      <RatingPanel
        sessionId={sessionId}
        partnerName="Session partner"
        status="COMPLETED"
        client={client()}
        existingRating={savedRating}
      />,
    );
    expect(screen.getByText('Clear and helpful.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit rating' })).not.toBeInTheDocument();
  });
});
