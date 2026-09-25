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
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { createAssessmentSchema, type AuthUser } from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { AssessmentsService } from './assessments.service';

class CreateAssessmentDto {
  declare sessionId: string;
  declare skillId?: string;
  declare understandingScore: number;
  declare practicalApplicationScore: number;
  declare problemSolvingScore: number;
  declare communicationScore: number;
  declare reliabilityScore: number;
  declare feedback?: string;
}
ZodSchema(createAssessmentSchema)(CreateAssessmentDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('assessments')
@Controller({ path: 'assessments', version: '1' })
export class AssessmentsController {
  constructor(@Inject(AssessmentsService) private readonly service: AssessmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Assess the other participant after a completed Session' })
  async create(@CurrentUser() actor: AuthUser, @Body() body: CreateAssessmentDto) {
    return { success: true, data: await this.service.create(actor.id, body) };
  }

  @Get('users/:userId')
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', description: 'The assessed User identifier' })
  @ApiOperation({ summary: 'List assessments received by an authorized User' })
  async listForUser(@CurrentUser() actor: AuthUser, @Param('userId', idPipe) userId: string) {
    return { success: true, data: await this.service.listForUser(actor, userId) };
  }

  @Get('session/:sessionId')
  @ApiCookieAuth()
  @ApiParam({ name: 'sessionId', description: 'The completed Session identifier' })
  @ApiOperation({ summary: 'List assessments for a Session participant' })
  async listForSession(
    @CurrentUser() actor: AuthUser,
    @Param('sessionId', idPipe) sessionId: string,
  ) {
    return { success: true, data: await this.service.listForSession(actor, sessionId) };
  }
}
