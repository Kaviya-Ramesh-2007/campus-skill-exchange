'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Input } from '@campus-skill-exchange/ui';
import {
  createProfileRequestSchema,
  updateProfileRequestSchema,
  type CreateProfileRequest,
  type Profile,
  type ProfileVisibility,
  type UpdateProfileRequest,
} from '@campus-skill-exchange/contracts';
import { ApiClientError } from '../../services/api-client';
import { createProfile, updateProfile } from './profile-api';

interface ProfileEditorProps {
  profile: Profile | null;
  accountDisplayName: string;
}

interface ProfileFormValues {
  displayName: string;
  department: string;
  academicYear: string;
  institution: string;
  bio: string;
  profileImageUrl: string;
  interests: string;
  githubUrl: string;
  portfolioUrl: string;
  visibility: ProfileVisibility;
}

const emptyForm: ProfileFormValues = {
  displayName: '',
  department: '',
  academicYear: '',
  institution: '',
  bio: '',
  profileImageUrl: '',
  interests: '',
  githubUrl: '',
  portfolioUrl: '',
  visibility: 'PUBLIC',
};

export function ProfileEditor({ profile, accountDisplayName }: ProfileEditorProps) {
  const [values, setValues] = useState<ProfileFormValues>(() =>
    toFormValues(profile, accountDisplayName),
  );
  const [isInitialized, setIsInitialized] = useState(profile !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiClientError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function setValue(field: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setClientFieldErrors({});

    const input = toRequest(values);
    const validation = isInitialized
      ? updateProfileRequestSchema.safeParse(input)
      : createProfileRequestSchema.safeParse(input);
    if (!validation.success) {
      setClientFieldErrors(toFieldErrors(validation.error.issues));
      return;
    }

    setIsSubmitting(true);
    try {
      const savedProfile = isInitialized
        ? await updateProfile(validation.data as UpdateProfileRequest)
        : await createProfile(validation.data as CreateProfileRequest);
      setIsInitialized(true);
      setValues(toFormValues(savedProfile, accountDisplayName));
      setSuccess(
        isInitialized ? 'Your profile was updated.' : 'Your profile was created successfully.',
      );
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError
          : new ApiClientError(500, {
              code: 'INTERNAL_ERROR',
              message: 'Your profile could not be saved. Please try again.',
              meta: { requestId: 'profile-editor' },
            }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldError = (field: string) => clientFieldErrors[field] ?? getFieldError(error, field);

  return (
    <Card title={isInitialized ? 'Edit your profile' : 'Create your profile'}>
      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert severity="error" title="Check the highlighted fields">
            {error.message}
            {getFormErrors(error).length > 0 && (
              <ul className="profile-form__error-list">
                {getFormErrors(error).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {success && (
          <Alert severity="success" title="Profile saved">
            {success} <Link href="/profile">View your profile</Link>
          </Alert>
        )}

        <div className="profile-form__grid">
          <Input
            id="profile-display-name"
            name="displayName"
            label="Public display name"
            hint={`Optional. Your account name is used when this is empty (${accountDisplayName}).`}
            maxLength={120}
            value={values.displayName}
            onChange={(event) => setValue('displayName', event.target.value)}
            error={fieldError('displayName')}
          />
          <Input
            id="profile-department"
            name="department"
            label="Department"
            maxLength={120}
            value={values.department}
            onChange={(event) => setValue('department', event.target.value)}
            error={fieldError('department')}
          />
          <Input
            id="profile-academic-year"
            name="academicYear"
            label="Academic year"
            maxLength={32}
            placeholder="For example, Third year"
            value={values.academicYear}
            onChange={(event) => setValue('academicYear', event.target.value)}
            error={fieldError('academicYear')}
          />
          <Input
            id="profile-institution"
            name="institution"
            label="College or institution"
            maxLength={160}
            value={values.institution}
            onChange={(event) => setValue('institution', event.target.value)}
            error={fieldError('institution')}
          />
        </div>

        <label className="profile-field" htmlFor="profile-bio">
          <span className="profile-field__label">Bio</span>
          <textarea
            id="profile-bio"
            name="bio"
            className="profile-textarea"
            rows={5}
            maxLength={2000}
            value={values.bio}
            onChange={(event) => setValue('bio', event.target.value)}
            aria-describedby={`profile-bio-hint${fieldError('bio') ? ' profile-bio-error' : ''}`}
            aria-invalid={fieldError('bio') ? true : undefined}
          />
          <span id="profile-bio-hint" className="profile-field__hint">
            Share a concise introduction (up to 2,000 characters).
          </span>
          {fieldError('bio') && (
            <span id="profile-bio-error" className="profile-field__error" role="alert">
              {fieldError('bio')}
            </span>
          )}
        </label>

        <Input
          id="profile-image-url"
          name="profileImageUrl"
          type="url"
          label="Profile image URL"
          hint="Use an HTTP/HTTPS image reference. File uploads are not enabled yet."
          maxLength={2048}
          value={values.profileImageUrl}
          onChange={(event) => setValue('profileImageUrl', event.target.value)}
          error={fieldError('profileImageUrl')}
        />

        <Input
          id="profile-interests"
          name="interests"
          label="Interests"
          hint="Separate up to 20 interests with commas."
          maxLength={1620}
          value={values.interests}
          onChange={(event) => setValue('interests', event.target.value)}
          error={fieldError('interests')}
        />

        <div className="profile-form__grid">
          <Input
            id="profile-github-url"
            name="githubUrl"
            type="url"
            label="GitHub profile URL"
            maxLength={2048}
            value={values.githubUrl}
            onChange={(event) => setValue('githubUrl', event.target.value)}
            error={fieldError('githubUrl')}
          />
          <Input
            id="profile-portfolio-url"
            name="portfolioUrl"
            type="url"
            label="Portfolio URL"
            maxLength={2048}
            value={values.portfolioUrl}
            onChange={(event) => setValue('portfolioUrl', event.target.value)}
            error={fieldError('portfolioUrl')}
          />
        </div>

        <label className="profile-field" htmlFor="profile-visibility">
          <span className="profile-field__label">Profile visibility</span>
          <select
            id="profile-visibility"
            name="visibility"
            className="profile-select"
            value={values.visibility}
            onChange={(event) => setValue('visibility', event.target.value as ProfileVisibility)}
            aria-describedby={`profile-visibility-hint${fieldError('visibility') ? ' profile-visibility-error' : ''}`}
            aria-invalid={fieldError('visibility') ? true : undefined}
          >
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
          <span id="profile-visibility-hint" className="profile-field__hint">
            Public profiles can be viewed by other people. Private profiles are visible only to you
            and authorized administrators.
          </span>
          {fieldError('visibility') && (
            <span id="profile-visibility-error" className="profile-field__error" role="alert">
              {fieldError('visibility')}
            </span>
          )}
        </label>

        <div className="profile-form__actions">
          <Button type="submit" loading={isSubmitting}>
            {isInitialized ? 'Save changes' : 'Create profile'}
          </Button>
          <Link className="cse-button cse-button--ghost cse-button--md" href="/profile">
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}

function toFormValues(profile: Profile | null, accountDisplayName: string): ProfileFormValues {
  if (!profile) return { ...emptyForm, displayName: accountDisplayName };
  return {
    displayName: profile.displayName,
    department: profile.department ?? '',
    academicYear: profile.academicYear ?? '',
    institution: profile.institution ?? '',
    bio: profile.bio ?? '',
    profileImageUrl: profile.profileImageUrl ?? '',
    interests: profile.interests.join(', '),
    githubUrl: profile.githubUrl ?? '',
    portfolioUrl: profile.portfolioUrl ?? '',
    visibility: profile.visibility,
  };
}

function toRequest(values: ProfileFormValues): CreateProfileRequest | UpdateProfileRequest {
  const interests = values.interests
    .split(/[,\n]/)
    .map((interest) => interest.trim())
    .filter(Boolean);
  const optional = (value: string) => value.trim() || null;
  return {
    displayName: optional(values.displayName),
    department: optional(values.department),
    academicYear: optional(values.academicYear),
    institution: optional(values.institution),
    bio: optional(values.bio),
    profileImageUrl: optional(values.profileImageUrl),
    interests,
    githubUrl: optional(values.githubUrl),
    portfolioUrl: optional(values.portfolioUrl),
    visibility: values.visibility,
  };
}

function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function getFieldError(error: ApiClientError | null, field: string): string | undefined {
  if (!error?.details) return undefined;
  const fieldErrors = error.details.fieldErrors;
  if (typeof fieldErrors !== 'object' || fieldErrors === null) return undefined;
  const messages = (fieldErrors as Record<string, unknown>)[field];
  return Array.isArray(messages) && typeof messages[0] === 'string' ? messages[0] : undefined;
}

function getFormErrors(error: ApiClientError | null): string[] {
  if (!error?.details) return [];
  const formErrors = error.details.formErrors;
  return Array.isArray(formErrors)
    ? formErrors.filter((message): message is string => typeof message === 'string')
    : [];
}
