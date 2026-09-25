import { Inject, Injectable } from '@nestjs/common';
import {
  discoveryUserQuerySchema,
  type DiscoveryUserQuery,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  DISCOVERY_REPOSITORY,
  type DiscoveryRepository,
  type DiscoverySearchResult,
} from './discovery.types';

@Injectable()
export class DiscoveryService {
  constructor(@Inject(DISCOVERY_REPOSITORY) private readonly repository: DiscoveryRepository) {}

  async searchUsers(
    requesterId: string,
    query: DiscoveryUserQuery,
  ): Promise<DiscoverySearchResult> {
    const parsed = discoveryUserQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }

    const input = {
      ...parsed.data,
      requesterId,
      skill: parsed.data.skill ? normalize(parsed.data.skill) : undefined,
      search: parsed.data.search ? normalize(parsed.data.search) : undefined,
    };
    const result = await this.repository.searchUsers(input);
    return {
      ...result,
      items: result.items,
    };
  }
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
