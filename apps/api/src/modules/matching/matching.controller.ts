import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { matchingQuerySchema } from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { MatchingService } from './matching.service';
import { MutualExchangeService } from './mutual-exchange.service';

class MatchingQueryDto {
  declare page?: number;
  declare limit?: number;
}
ZodSchema(matchingQuerySchema)(MatchingQueryDto);

@ApiTags('matching')
@Controller({ path: 'matching', version: '1' })
export class MatchingController {
  constructor(@Inject(MatchingService) private readonly matchingService: MatchingService) {}

  @Get('users')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find explainable skill matches for the current User' })
  async users(@CurrentUser() user: { id: string }, @Query() query: MatchingQueryDto) {
    const result = await this.matchingService.findMatches(user.id, query);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: pagination(result.total, result.page, result.limit),
      },
    };
  }
}

@ApiTags('exchanges')
@Controller({ path: 'exchanges', version: '1' })
export class ExchangesController {
  constructor(
    @Inject(MutualExchangeService) private readonly exchangeService: MutualExchangeService,
  ) {}

  @Get('mutual')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Find mutual skill exchange opportunities' })
  async mutual(@CurrentUser() user: { id: string }, @Query() query: MatchingQueryDto) {
    const result = await this.exchangeService.listMutualExchanges(user.id, query);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: pagination(result.total, result.page, result.limit),
      },
    };
  }
}

function pagination(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
}
