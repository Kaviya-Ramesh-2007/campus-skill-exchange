import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { ApiException } from '../../common/errors/api-exception';
import { Public } from '../auth/auth.decorators';

@ApiTags('infrastructure')
@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API process liveness' })
  getHealth() {
    return {
      success: true,
      data: this.healthService.getLiveness(),
    };
  }
}

@ApiTags('infrastructure')
@Public()
@Controller({ path: 'ready', version: '1' })
export class ReadinessController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API dependency readiness' })
  async getReadiness() {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status !== 'ready') {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DEPENDENCY_UNAVAILABLE',
        'Required infrastructure is unavailable.',
        { checks: readiness.checks },
      );
    }

    return { success: true, data: readiness };
  }
}
