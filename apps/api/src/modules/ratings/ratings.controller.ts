import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createRatingSchema } from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { RatingsService } from './ratings.service';

class CreateRatingDto {
  declare sessionId: string;
  declare rating: number;
  declare feedback?: string;
}
ZodSchema(createRatingSchema)(CreateRatingDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('ratings')
@Controller({ path: 'ratings', version: '1' })
export class RatingsController {
  constructor(@Inject(RatingsService) private readonly service: RatingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rate a session partner after a completed session' })
  async create(@CurrentUser() user: { id: string }, @Body() body: CreateRatingDto) {
    return { success: true, data: await this.service.create(user.id, body) };
  }

  @Get('session/:sessionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List ratings for a completed session' })
  async list(@CurrentUser() user: { id: string }, @Param('sessionId', idPipe) sessionId: string) {
    return { success: true, data: await this.service.listForSession(sessionId, user.id) };
  }
}
