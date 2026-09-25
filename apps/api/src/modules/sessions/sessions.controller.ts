import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createSessionSchema,
  sessionQuerySchema,
  updateSessionSchema,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  declare sessionRequestId: string;
  declare mode: 'ONLINE' | 'OFFLINE';
  declare scheduledStart: string;
  declare scheduledEnd: string;
  declare timezone: string;
  declare meetingUrl?: string;
  declare locationDetails?: string;
}
ZodSchema(createSessionSchema)(CreateSessionDto);

class UpdateSessionDto {
  declare status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  declare locationDetails?: string | null;
  declare meetingUrl?: string | null;
  declare scheduledStart?: string;
  declare scheduledEnd?: string;
  declare timezone?: string;
}
ZodSchema(updateSessionSchema)(UpdateSessionDto);

class SessionQueryDto {
  declare page?: number;
  declare limit?: number;
}
ZodSchema(sessionQuerySchema)(SessionQueryDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('sessions')
@Controller({ path: 'sessions', version: '1' })
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly service: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Schedule a Session from an accepted SessionRequest' })
  async create(@CurrentUser() user: { id: string }, @Body() body: CreateSessionDto) {
    return { success: true, data: await this.service.create(user.id, body) };
  }

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List Sessions involving the current User' })
  async list(@CurrentUser() user: { id: string }, @Query() query: SessionQueryDto) {
    const result = await this.service.list(user.id, query);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          pageSize: result.limit,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / result.limit),
        },
      },
    };
  }

  @Get(':sessionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get a Session visible to the current User' })
  async get(@CurrentUser() user: { id: string }, @Param('sessionId', idPipe) sessionId: string) {
    return { success: true, data: await this.service.get(sessionId, user.id) };
  }

  @Patch(':sessionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update a Session status' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('sessionId', idPipe) sessionId: string,
    @Body() body: UpdateSessionDto,
  ) {
    return { success: true, data: await this.service.update(sessionId, user.id, body) };
  }
}
