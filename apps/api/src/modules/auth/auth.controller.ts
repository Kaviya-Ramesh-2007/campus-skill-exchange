import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, LoginRequest, RegisterRequest } from '@campus-skill-exchange/contracts';
import { loginRequestSchema, registerRequestSchema } from '@campus-skill-exchange/contracts';
import type { FastifyReply } from 'fastify';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentSessionId, CurrentUser, Public } from './auth.decorators';
import { SessionCookieService } from './session-cookie.service';

class RegisterDto {
  declare displayName: string;
  declare email: string;
  declare password: string;
}
ZodSchema(registerRequestSchema, 'AUTH_INVALID_INPUT')(RegisterDto);

class LoginDto {
  declare email: string;
  declare password: string;
}
ZodSchema(loginRequestSchema, 'AUTH_INVALID_INPUT')(LoginDto);

@ApiTags('authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SessionCookieService) private readonly sessionCookie: SessionCookieService,
  ) {}

  @Public()
  @Header('Cache-Control', 'no-store')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a local account and establish a session' })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.register(body as RegisterRequest);
    this.sessionCookie.set(reply, result.sessionToken, result.sessionExpiresAt);
    return { success: true, data: result.response };
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.login(body as LoginRequest);
    this.sessionCookie.set(reply, result.sessionToken, result.sessionExpiresAt);
    return { success: true, data: result.response };
  }

  @Header('Cache-Control', 'no-store')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('cse_session')
  @ApiOperation({ summary: 'Invalidate the current session' })
  async logout(
    @CurrentSessionId() sessionId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.authService.logout(sessionId);
    this.sessionCookie.clear(reply);
  }

  @Header('Cache-Control', 'no-store')
  @Get('me')
  @ApiCookieAuth('cse_session')
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return { success: true, data: user };
  }
}
