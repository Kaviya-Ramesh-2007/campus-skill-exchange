process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://foundation:foundation@localhost:5432/foundation?schema=public';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:3000';
