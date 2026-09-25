import type { DiscoveryUser, DiscoveryUserQuery } from '@campus-skill-exchange/contracts';

export const DISCOVERY_REPOSITORY = Symbol('DISCOVERY_REPOSITORY');

export interface DiscoverySearchInput extends DiscoveryUserQuery {
  requesterId: string;
}

export interface DiscoverySearchResult {
  items: DiscoveryUser[];
  total: number;
}

export interface DiscoveryRepository {
  searchUsers(input: DiscoverySearchInput): Promise<DiscoverySearchResult>;
}
