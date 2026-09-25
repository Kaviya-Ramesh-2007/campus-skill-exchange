import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';
import fastifyCookie from '@fastify/cookie';
import { ZodValidationPipe } from './common/validation/zod-validation.pipe';
import { parseCorsOrigins } from './config/env';
import { AppModule } from './app.module';
import { AppLogger } from './platform/logging/app-logger';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);
  await app.getHttpAdapter().getInstance().register(fastifyCookie);

  app.useLogger(logger);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ZodValidationPipe(new Reflector()));
  app.enableCors({
    origin: parseCorsOrigins(config.getOrThrow<string>('CORS_ORIGINS')),
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Campus Skill Exchange API')
    .setDescription(
      'Campus Skill Exchange API. Authentication, identity, and professional profile endpoints are implemented locally; other product modules remain future work.',
    )
    .setVersion('0.0.0')
    .addCookieAuth(config.getOrThrow<string>('AUTH_SESSION_COOKIE_NAME'))
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = config.getOrThrow<number>('PORT');
  const host = config.getOrThrow<string>('HOST');
  await app.listen(port, host);
  logger.log({ port, host }, 'API infrastructure started');
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
