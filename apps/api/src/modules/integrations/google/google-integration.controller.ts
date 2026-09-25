import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiException } from '../../../common/errors/api-exception';
import { CurrentUser } from '../../auth/auth.decorators';
import { GoogleIntegrationService } from './google-integration.service';
import { GoogleOAuthStateService } from './google-oauth-state.service';

@ApiTags('integrations')
@Controller({ path: 'integrations/google', version: '1' })
export class GoogleIntegrationController {
  constructor(
    @Inject(GoogleIntegrationService) private readonly google: GoogleIntegrationService,
    @Inject(GoogleOAuthStateService) private readonly state: GoogleOAuthStateService,
  ) {}

  @Get('connect')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Start Google Calendar OAuth authorization' })
  async connect(@Res({ passthrough: true }) reply: FastifyReply) {
    const stateValue = this.state.issue(reply);
    const authorizationUrl = await this.google.getAuthorizationUrl(stateValue);
    return { success: true, data: { authorizationUrl } };
  }

  @Get('callback')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Complete Google Calendar OAuth authorization' })
  async callback(
    @CurrentUser() user: { id: string },
    @Query('code') code: string | undefined,
    @Query('state') stateValue: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    try {
      if (oauthError)
        throw new ApiException(400, 'BAD_REQUEST', 'Google authorization was declined.');
      this.state.assertValid(stateValue, request);
      if (!code)
        throw new ApiException(400, 'BAD_REQUEST', 'Google authorization code is required.');
      await this.google.completeAuthorization(user.id, code);
      return { success: true, data: { connected: true } };
    } finally {
      this.state.clear(reply);
    }
  }

  @Get('status')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get the current User Google connection status' })
  async status(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.google.status(user.id) };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Disconnect the current User Google account' })
  async disconnect(@CurrentUser() user: { id: string }): Promise<void> {
    await this.google.disconnect(user.id);
  }
}
