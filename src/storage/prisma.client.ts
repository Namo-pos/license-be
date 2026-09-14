import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export function isPrismaConfigured(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return Boolean(dbUrl && !dbUrl.includes('[YOUR-PASSWORD]') && !dbUrl.includes('placeholder'));
}
