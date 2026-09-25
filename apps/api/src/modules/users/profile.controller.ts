import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  AuthUser,
  CreateProfileRequest,
  UpdateProfileRequest,
} from '@campus-skill-exchange/contracts';
import {
  createProfileRequestSchema,
  updateProfileRequestSchema,
} from '@campus-skill-exchange/contracts';
import { ZodSchema } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { ProfileService } from './profile.service';

class CreateProfileDto {
  declare displayName?: string | null;
  declare department?: string | null;
  declare academicYear?: string | null;
  declare institution?: string | null;
  declare bio?: string | null;
  declare profileImageUrl?: string | null;
  declare interests?: string[];
  declare githubUrl?: string | null;
  declare portfolioUrl?: string | null;
  declare visibility?: 'PUBLIC' | 'PRIVATE';
}
ZodSchema(createProfileRequestSchema, 'PROFILE_INVALID_INPUT')(CreateProfileDto);

class UpdateProfileDto {
  declare displayName?: string | null;
  declare department?: string | null;
  declare academicYear?: string | null;
  declare institution?: string | null;
  declare bio?: string | null;
  declare profileImageUrl?: string | null;
  declare interests?: string[];
  declare githubUrl?: string | null;
  declare portfolioUrl?: string | null;
  declare visibility?: 'PUBLIC' | 'PRIVATE';
}
ZodSchema(updateProfileRequestSchema, 'PROFILE_INVALID_INPUT')(UpdateProfileDto);

@ApiTags('profile')
@Controller({ path: 'profile', version: '1' })
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profileService: ProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get the current user profile' })
  async getCurrent(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.profileService.getCurrentProfile(user.id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Initialize the current user profile' })
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateProfileDto) {
    return {
      success: true,
      data: await this.profileService.createProfile(user.id, body as CreateProfileRequest),
    };
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update the current user profile' })
  async update(@CurrentUser() user: AuthUser, @Body() body: UpdateProfileDto) {
    return {
      success: true,
      data: await this.profileService.updateProfile(user, user.id, body as UpdateProfileRequest),
    };
  }
}

@ApiTags('profile')
@Controller({ path: 'users', version: '1' })
export class UserProfileController {
  constructor(@Inject(ProfileService) private readonly profileService: ProfileService) {}

  @Public()
  @Get(':userId/profile')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'userId', description: 'The profile owner user identifier' })
  @ApiOperation({ summary: 'Get another user public profile' })
  async getPublic(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string) {
    return { success: true, data: await this.profileService.getPublicProfile(userId) };
  }

  @Patch(':userId/profile')
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiParam({ name: 'userId', description: 'The profile owner user identifier' })
  @ApiOperation({ summary: 'Update a user profile when authorized' })
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: UpdateProfileDto,
  ) {
    return {
      success: true,
      data: await this.profileService.updateProfile(actor, userId, body as UpdateProfileRequest),
    };
  }
}
