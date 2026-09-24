import { VersioningType, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/platform/database/prisma.service';

const queryRaw = vi.fn();

describe('infrastructure health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the shared error contract for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/not-a-route').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('returns a real process liveness response', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'campus-skill-exchange-api',
        checks: { process: { status: 'up' } },
      },
    });
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns ready when PostgreSQL responds', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer()).get('/api/v1/ready').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ready', checks: { database: { status: 'up' } } },
    });
  });

  it('returns a structured 503 when PostgreSQL is unavailable', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await request(app.getHttpServer()).get('/api/v1/ready').expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'DEPENDENCY_UNAVAILABLE' },
    });
    expect(response.body.error.message).not.toContain('database unavailable');
  });
});
