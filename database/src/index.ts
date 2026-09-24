import { PrismaClient } from '@prisma/client';

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';

export function createPrismaClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}
