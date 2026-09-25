import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@campus-skill-exchange/contracts';
import { CurrentUser } from '../auth/auth.decorators';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly service: AnalyticsService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Real platform aggregate counters (ADMIN only)' })
  async overview(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.service.overview(user) };
  }
}
