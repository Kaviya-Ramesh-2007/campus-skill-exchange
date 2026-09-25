import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@campus-skill-exchange/contracts';
import { CurrentUser } from '../auth/auth.decorators';
import { ReputationService } from './reputation.service';

@ApiTags('reputation')
@Controller({ path: 'reputation', version: '1' })
export class ReputationController {
  constructor(@Inject(ReputationService) private readonly service: ReputationService) {}

  @Get('users/:userId')
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', description: 'The User identifier' })
  @ApiOperation({ summary: 'Get a transparent reputation summary for an authorized User' })
  async getSummary(
    @CurrentUser() actor: AuthUser,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ) {
    return { success: true, data: await this.service.getSummary(actor, userId) };
  }
}
