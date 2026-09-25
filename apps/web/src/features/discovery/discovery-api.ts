import type { DiscoveryUser, PaginationMeta } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export interface DiscoveryPage {
  items: DiscoveryUser[];
  pagination: PaginationMeta;
}

export interface DiscoverySearchParams {
  skill?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function searchDiscoveryUsers(params: DiscoverySearchParams): Promise<DiscoveryPage> {
  return apiRequest<DiscoveryPage>('/discovery/users', {
    query: {
      skill: params.skill || undefined,
      search: params.search || undefined,
      page: params.page,
      limit: params.limit,
    },
  });
}
