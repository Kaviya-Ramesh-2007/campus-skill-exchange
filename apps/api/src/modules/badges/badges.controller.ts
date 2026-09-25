import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@campus-skill-exchange/contracts';
import { CurrentUser } from '../auth/auth.decorators';
import { BadgesService } from './badges.service';

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('badges')
@Controller({ path: 'badges', version: '1' })
export class BadgesController {
  constructor(@Inject(BadgesService) private readonly service: BadgesService) {}

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List available badge definitions' })
  async list() {
    return { success: true, data: await this.service.listDefinitions() };
  }

  @Get('users/:userId')
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', description: 'The badge owner user identifier' })
  @ApiOperation({ summary: 'List badges earned by an authorized User' })
  async listForUser(@CurrentUser() actor: AuthUser, @Param('userId', idPipe) userId: string) {
    return { success: true, data: await this.service.listUserBadges(actor, userId) };
  }
}
