import type {
  CreateProfileRequest,
  Profile,
  UpdateProfileRequest,
} from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function getCurrentProfile(): Promise<Profile> {
  return apiRequest<Profile>('/profile');
}

export function createProfile(input: CreateProfileRequest): Promise<Profile> {
  return apiRequest<Profile>('/profile', {
    method: 'POST',
    body: input,
  });
}

export function updateProfile(input: UpdateProfileRequest): Promise<Profile> {
  return apiRequest<Profile>('/profile', {
    method: 'PATCH',
    body: input,
  });
}

export function getPublicProfile(userId: string): Promise<Profile> {
  return apiRequest<Profile>(`/users/${encodeURIComponent(userId)}/profile`);
}
