import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service';

export interface InfrastructureCheck {
  status: 'up' | 'down';
  latencyMs?: number;
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getLiveness() {
    const uptimeSeconds = process.uptime();
    const processIsRunning =
      typeof process.pid === 'number' && process.pid > 0 && Number.isFinite(uptimeSeconds);

    return {
      status: processIsRunning ? ('ok' as const) : ('error' as const),
      service: 'campus-skill-exchange-api',
      version: '0.0.0',
      uptimeSeconds: Math.floor(uptimeSeconds),
      startedAt: new Date(this.startedAt).toISOString(),
      checkedAt: new Date().toISOString(),
      checks: {
        process: {
          status: processIsRunning ? ('up' as const) : ('down' as const),
        },
      },
    };
  }

  async getReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    service: string;
    checkedAt: string;
    checks: { database: InfrastructureCheck };
  }> {
    const started = performance.now();
    let databaseStatus: InfrastructureCheck;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = { status: 'up', latencyMs: Math.round(performance.now() - started) };
    } catch {
      databaseStatus = { status: 'down' };
    }

    return {
      status: databaseStatus.status === 'up' ? 'ready' : 'not_ready',
      service: 'campus-skill-exchange-api',
      checkedAt: new Date().toISOString(),
      checks: { database: databaseStatus },
    };
  }
}
