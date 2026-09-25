import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileEditor } from '../src/features/profile/profile-editor';

const mocks = vi.hoisted(() => ({
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../src/features/profile/profile-api', () => ({
  createProfile: mocks.createProfile,
  updateProfile: mocks.updateProfile,
}));

vi.mock('../src/services/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: Record<string, unknown>;

    constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
}));

const profile = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  displayName: 'Ada Lovelace',
  department: 'Computer Science',
  academicYear: 'Third year',
  institution: 'Example University',
  bio: 'A short introduction.',
  profileImageUrl: null,
  interests: ['Mathematics'],
  githubUrl: null,
  portfolioUrl: null,
  visibility: 'PUBLIC' as const,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
};

describe('ProfileEditor', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.createProfile.mockReset();
    mocks.updateProfile.mockReset();
  });

  it('creates a profile from the real form state and shows success feedback', async () => {
    mocks.createProfile.mockResolvedValue(profile);
    render(<ProfileEditor profile={null} accountDisplayName="Ada Account" />);

    fireEvent.change(screen.getByLabelText(/Public display name/), {
      target: { value: 'Ada Public' },
    });
    fireEvent.change(screen.getByLabelText(/Department/), {
      target: { value: 'Computer Science' },
    });
    fireEvent.change(screen.getByLabelText(/Interests/), {
      target: { value: 'Mathematics, Sharing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    await waitFor(() => {
      expect(mocks.createProfile).toHaveBeenCalledWith({
        displayName: 'Ada Public',
        department: 'Computer Science',
        academicYear: null,
        institution: null,
        bio: null,
        profileImageUrl: null,
        interests: ['Mathematics', 'Sharing'],
        githubUrl: null,
        portfolioUrl: null,
        visibility: 'PUBLIC',
      });
    });
    expect(await screen.findByText('Your profile was created successfully.')).toBeInTheDocument();
  });

  it('shows client validation before submitting invalid profile data', async () => {
    render(<ProfileEditor profile={null} accountDisplayName="Ada Account" />);

    fireEvent.change(screen.getByLabelText(/Profile image URL/), {
      target: { value: 'file:///tmp/avatar.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(await screen.findByText(/credential-free HTTP or HTTPS URLs/)).toBeInTheDocument();
    expect(mocks.createProfile).not.toHaveBeenCalled();
  });

  it('updates an existing profile through the PATCH operation', async () => {
    mocks.updateProfile.mockResolvedValue(profile);
    render(<ProfileEditor profile={profile} accountDisplayName="Account Name" />);

    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'Updated bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mocks.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ bio: 'Updated bio' }),
      );
    });
  });
});
