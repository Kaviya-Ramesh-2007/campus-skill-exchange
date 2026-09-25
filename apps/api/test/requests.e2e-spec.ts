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
import {
  REQUESTS_REPOSITORY,
  type RequestsRepository,
  type SessionRequestRecord,
} from '../src/modules/requests/requests.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const now = new Date('2026-09-29T00:00:00.000Z');

function createRepository() {
  const rows = new Map<string, SessionRequestRecord>();
  const repository = {
    findById: vi.fn(async (id: string) => rows.get(id) ?? null),
    list: vi.fn(async (userId: string, page: number, limit: number) => {
      const items = [...rows.values()].filter(
        (item) => item.requester.userId === userId || item.recipient.userId === userId,
      );
      return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
    }),
    create: vi.fn(
      async (
        id: string,
        requesterUserId: string,
        input: { recipientUserId: string; skillId?: string; message?: string },
      ) => {
        const row: SessionRequestRecord = {
          id,
          requester: { userId: requesterUserId, displayName: 'Requester' },
          recipient: { userId: input.recipientUserId, displayName: 'Recipient' },
          skill: input.skillId ? { id: input.skillId, name: 'AWS' } : null,
          message: input.message ?? null,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        };
        rows.set(id, row);
        return row;
      },
    ),
    updateStatus: vi.fn(async (id: string, status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') => {
      const row = rows.get(id);
      if (!row || row.status !== 'PENDING') return null;
      const updated = { ...row, status, updatedAt: new Date() };
      rows.set(id, updated);
      return updated;
    }),
  } as unknown as RequestsRepository;
  return repository;
}

describe('session request API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();
  const requestsRepository = createRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(REQUESTS_REPOSITORY)
      .useValue(requestsRepository)
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
    await request(app.getHttpServer()).get('/api/v1/requests').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .send({ recipientUserId: '00000000-0000-4000-8000-000000000002' })
      .expect(401);
  });

  it('creates, lists, and updates a request through the authenticated routes', async () => {
    const requesterClient = request.agent(app.getHttpServer());
    const recipientClient = request.agent(app.getHttpServer());
    const requester = await requesterClient
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Requester',
        email: 'request-sender@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);
    const recipient = await recipientClient
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Recipient',
        email: 'request-recipient@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);
    const recipientId = recipient.body.data.user.id as string;

    const created = await requesterClient
      .post('/api/v1/requests')
      .send({ recipientUserId: recipientId, message: 'Could we meet?' })
      .expect(201);
    const requestId = created.body.data.id as string;

    const listed = await requesterClient.get('/api/v1/requests?page=1&limit=20').expect(200);
    expect(listed.body.data.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(listed.body.data.items[0]).toMatchObject({
      requester: { userId: requester.body.data.user.id },
      status: 'PENDING',
    });

    const accepted = await recipientClient
      .patch(`/api/v1/requests/${requestId}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
  });
});
