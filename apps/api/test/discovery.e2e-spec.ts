import { VersioningType, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Reflector } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/platform/database/prisma.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/auth.types';
import { DISCOVERY_REPOSITORY } from '../src/modules/discovery/discovery.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const registration = {
  displayName: 'Ada Lovelace',
  email: 'ada-discovery@example.test',
  password: 'correct horse battery staple',
};

describe('user discovery API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();
  const discoveryRepository = { searchUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }) };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(DISCOVERY_REPOSITORY)
      .useValue(discoveryRepository)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn(), $disconnect: vi.fn() })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.getHttpAdapter().getInstance().register(fastifyCookie);
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe(new Reflector()));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/discovery/users?skill=Java').expect(401);
  });

  it('normalizes skill search and returns the paginated envelope', async () => {
    const authClient = request.agent(app.getHttpServer());
    const registrationResponse = await authClient
      .post('/api/v1/auth/register')
      .send(registration)
      .expect(201);
    const userId = registrationResponse.body.data.user.id as string;
    discoveryRepository.searchUsers.mockResolvedValueOnce({ items: [], total: 0 });

    const response = await authClient
      .get('/api/v1/discovery/users?skill=Java&page=1&limit=20')
      .expect(200);

    expect(response.body.data).toMatchObject({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(discoveryRepository.searchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ requesterId: userId, skill: 'java', search: undefined }),
    );
  });
});
