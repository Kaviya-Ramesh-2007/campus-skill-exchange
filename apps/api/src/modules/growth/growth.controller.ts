import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  createAvailabilityRequestSchema,
  createCertificationRequestSchema,
  createLearningGoalRequestSchema,
  createProjectRequestSchema,
  updateAvailabilityRequestSchema,
  updateCertificationRequestSchema,
  updateLearningGoalRequestSchema,
  updateProjectRequestSchema,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser } from '../auth/auth.decorators';
import { GrowthService } from './growth.service';

class LearningGoalDto {
  declare skillId: string;
  declare currentLevel?: string;
  declare targetLevel: string;
  declare description?: string | null;
  declare priority?: string;
}
ZodSchema(createLearningGoalRequestSchema)(LearningGoalDto);
class LearningGoalUpdateDto {
  declare skillId?: string;
  declare currentLevel?: string;
  declare targetLevel?: string;
  declare description?: string | null;
  declare priority?: string;
}
ZodSchema(updateLearningGoalRequestSchema)(LearningGoalUpdateDto);

class AvailabilityDto {
  declare dayOfWeek: string;
  declare startTime: string;
  declare endTime: string;
  declare timezone?: string;
  declare isActive?: boolean;
}
ZodSchema(createAvailabilityRequestSchema)(AvailabilityDto);
class AvailabilityUpdateDto {
  declare dayOfWeek?: string;
  declare startTime?: string;
  declare endTime?: string;
  declare timezone?: string;
  declare isActive?: boolean;
}
ZodSchema(updateAvailabilityRequestSchema)(AvailabilityUpdateDto);

class CertificationDto {
  declare title: string;
  declare issuingOrganization: string;
  declare credentialId?: string | null;
  declare issueDate?: string | null;
  declare expiryDate?: string | null;
  declare proofUrl?: string | null;
}
ZodSchema(createCertificationRequestSchema)(CertificationDto);
class CertificationUpdateDto {
  declare title?: string;
  declare issuingOrganization?: string;
  declare credentialId?: string | null;
  declare issueDate?: string | null;
  declare expiryDate?: string | null;
  declare proofUrl?: string | null;
}
ZodSchema(updateCertificationRequestSchema)(CertificationUpdateDto);

class ProjectDto {
  declare title: string;
  declare description: string;
  declare technologies?: string[];
  declare projectUrl?: string | null;
  declare repositoryUrl?: string | null;
  declare startDate?: string | null;
  declare endDate?: string | null;
}
ZodSchema(createProjectRequestSchema)(ProjectDto);
class ProjectUpdateDto {
  declare title?: string;
  declare description?: string;
  declare technologies?: string[];
  declare projectUrl?: string | null;
  declare repositoryUrl?: string | null;
  declare startDate?: string | null;
  declare endDate?: string | null;
}
ZodSchema(updateProjectRequestSchema)(ProjectUpdateDto);

const idPipe = new ParseUUIDPipe({ version: '4' });

@ApiTags('learning-goals')
@Controller({ path: 'learning-goals', version: '1' })
export class LearningGoalsController {
  constructor(@Inject(GrowthService) private readonly service: GrowthService) {}
  @Get()
  @ApiCookieAuth()
  async list(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.listLearningGoals(user.id) };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  async create(@CurrentUser() user: { id: string }, @Body() body: LearningGoalDto) {
    return { success: true, data: await this.service.createLearningGoal(user.id, body) };
  }
  @Patch(':id')
  @ApiCookieAuth()
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', idPipe) id: string,
    @Body() body: LearningGoalUpdateDto,
  ) {
    return { success: true, data: await this.service.updateLearningGoal(id, user.id, body) };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  async remove(@CurrentUser() user: { id: string }, @Param('id', idPipe) id: string) {
    await this.service.deleteLearningGoal(id, user.id);
  }
}

@ApiTags('availability')
@Controller({ path: 'availability', version: '1' })
export class AvailabilityController {
  constructor(@Inject(GrowthService) private readonly service: GrowthService) {}
  @Get()
  @ApiCookieAuth()
  async list(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.listAvailability(user.id) };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  async create(@CurrentUser() user: { id: string }, @Body() body: AvailabilityDto) {
    return { success: true, data: await this.service.createAvailability(user.id, body) };
  }
  @Patch(':id')
  @ApiCookieAuth()
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', idPipe) id: string,
    @Body() body: AvailabilityUpdateDto,
  ) {
    return { success: true, data: await this.service.updateAvailability(id, user.id, body) };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  async remove(@CurrentUser() user: { id: string }, @Param('id', idPipe) id: string) {
    await this.service.deleteAvailability(id, user.id);
  }
}

@ApiTags('certifications')
@Controller({ path: 'certifications', version: '1' })
export class CertificationsController {
  constructor(@Inject(GrowthService) private readonly service: GrowthService) {}
  @Get()
  @ApiCookieAuth()
  async list(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.listCertifications(user.id) };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  async create(@CurrentUser() user: { id: string }, @Body() body: CertificationDto) {
    return { success: true, data: await this.service.createCertification(user.id, body) };
  }
  @Patch(':id')
  @ApiCookieAuth()
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', idPipe) id: string,
    @Body() body: CertificationUpdateDto,
  ) {
    return { success: true, data: await this.service.updateCertification(id, user.id, body) };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  async remove(@CurrentUser() user: { id: string }, @Param('id', idPipe) id: string) {
    await this.service.deleteCertification(id, user.id);
  }
}

@ApiTags('projects')
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(@Inject(GrowthService) private readonly service: GrowthService) {}
  @Get()
  @ApiCookieAuth()
  async list(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.service.listProjects(user.id) };
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  async create(@CurrentUser() user: { id: string }, @Body() body: ProjectDto) {
    return { success: true, data: await this.service.createProject(user.id, body) };
  }
  @Patch(':id')
  @ApiCookieAuth()
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', idPipe) id: string,
    @Body() body: ProjectUpdateDto,
  ) {
    return { success: true, data: await this.service.updateProject(id, user.id, body) };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  async remove(@CurrentUser() user: { id: string }, @Param('id', idPipe) id: string) {
    await this.service.deleteProject(id, user.id);
  }
}
