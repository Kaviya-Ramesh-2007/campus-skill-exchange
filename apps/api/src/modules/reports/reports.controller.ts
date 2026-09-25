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
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createReportSchema,
  updateReportStatusSchema,
  type AuthUser,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { ReportsService } from './reports.service';

class CreateReportDto {
  declare reportedUserId: string;
  declare category:
    | 'HARASSMENT'
    | 'SPAM'
    | 'FAKE_PROFILE'
    | 'SUSPICIOUS_PAYMENT'
    | 'FRAUDULENT_CERTIFICATION'
    | 'INAPPROPRIATE_CONTENT'
    | 'OTHER';
  declare description: string;
}
ZodSchema(createReportSchema)(CreateReportDto);

class UpdateReportStatusDto {
  declare status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
}
ZodSchema(updateReportStatusSchema)(UpdateReportStatusDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly service: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'File a safety report about another User' })
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateReportDto) {
    return { success: true, data: await this.service.create(user, body) };
  }

  @Get()
  @ApiCookieAuth()
  @ApiOperation({ summary: "List the current User's reports, or every report for an ADMIN" })
  async list(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.service.list(user) };
  }

  @Patch(':id/status')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change a report status (ADMIN only)' })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body() body: UpdateReportStatusDto,
  ) {
    return { success: true, data: await this.service.updateStatus(user, id, body) };
  }
}
