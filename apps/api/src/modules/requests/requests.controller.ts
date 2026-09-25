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
  createSessionRequestSchema,
  sessionRequestQuerySchema,
  updateSessionRequestSchema,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { RequestsService } from './requests.service';

class CreateRequestDto {
  declare recipientUserId: string;
  declare skillId?: string;
  declare message?: string;
}
ZodSchema(createSessionRequestSchema)(CreateRequestDto);

class UpdateRequestDto {
  declare status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
}
ZodSchema(updateSessionRequestSchema)(UpdateRequestDto);

class RequestQueryDto {
  declare page?: number;
  declare limit?: number;
}
ZodSchema(sessionRequestQuerySchema)(RequestQueryDto);

const requestIdPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('requests')
@Controller({ path: 'requests', version: '1' })
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly service: RequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create a pending session request' })
  create(@CurrentUser() user: { id: string }, @Body() body: CreateRequestDto) {
    return this.service.create(user.id, body).then((data) => ({ success: true, data }));
  }

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List session requests involving the current User' })
  async list(@CurrentUser() user: { id: string }, @Query() query: RequestQueryDto) {
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

  @Patch(':requestId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Accept, decline, or cancel a pending session request' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('requestId', requestIdPipe) requestId: string,
    @Body() body: UpdateRequestDto,
  ) {
    return { success: true, data: await this.service.update(requestId, user.id, body) };
  }
}
