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
import { MATCH_REPOSITORY } from '../src/modules/matching/matching.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const candidateId = '00000000-0000-4000-8000-000000000002';
const skillId = '00000000-0000-4000-8000-000000000003';
const candidateSkillId = '00000000-0000-4000-8000-000000000004';

const matchRepository = {
  loadMatchData: vi.fn(async (userId: string) => ({
    requester: {
      userId,
      displayName: 'Requester',
      teachableSkills: [{ id: skillId, name: 'C++' }],
      learningGoals: [{ id: 'goal-1', skill: { id: candidateSkillId, name: 'AWS' } }],
    },
    candidates: [
      {
        userId: candidateId,
        displayName: 'Candidate',
        teachableSkills: [{ id: candidateSkillId, name: 'AWS' }],
        learningGoals: [{ id: 'goal-2', skill: { id: skillId, name: 'C++' } }],
      },
    ],
  })),
};

describe('matching API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(MATCH_REPOSITORY)
      .useValue(matchRepository)
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

  it('requires authentication for both routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/matching/users').expect(401);
    await request(app.getHttpServer()).get('/api/v1/exchanges/mutual').expect(401);
  });

  it('returns matching and mutual exchange envelopes for the authenticated User', async () => {
    const client = request.agent(app.getHttpServer());
    const registration = await client
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Requester',
        email: 'matcher@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);

    const matches = await client.get('/api/v1/matching/users?page=1&limit=20').expect(200);
    const exchanges = await client.get('/api/v1/exchanges/mutual?page=1&limit=20').expect(200);

    expect(matches.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(matches.body.data.items[0]).toMatchObject({ userId: candidateId, mutual: true });
    expect(exchanges.body.data.items[0]).toMatchObject({ partnerUserId: candidateId });
    const authenticatedUserId = registration.body.data.user.id as string;
    expect(authenticatedUserId).toBeTruthy();
    expect(matchRepository.loadMatchData).toHaveBeenCalledWith(authenticatedUserId);
  });
});
