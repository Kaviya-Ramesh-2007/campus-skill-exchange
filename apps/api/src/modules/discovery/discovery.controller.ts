import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  discoveryUserQuerySchema,
  type DiscoveryUserQuery,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { DiscoveryService } from './discovery.service';

class DiscoveryQueryDto {
  declare skill?: string;
  declare search?: string;
  declare page?: number;
  declare limit?: number;
}
ZodSchema(discoveryUserQuerySchema, 'VALIDATION_ERROR')(DiscoveryQueryDto);

@ApiTags('discovery')
@Controller({ path: 'discovery', version: '1' })
export class DiscoveryController {
  constructor(@Inject(DiscoveryService) private readonly discoveryService: DiscoveryService) {}

  @Get('users')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Discover public users who can teach a skill' })
  async users(@CurrentUser() user: { id: string }, @Query() query: DiscoveryQueryDto) {
    const parsed = query as DiscoveryUserQuery;
    const result = await this.discoveryService.searchUsers(user.id, parsed);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: {
          page: parsed.page ?? 1,
          limit: parsed.limit ?? 20,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / (parsed.limit ?? 20)),
        },
      },
    };
  }
}
