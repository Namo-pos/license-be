import { PrismaClient } from '@prisma/client';
import { PrismaD1, PrismaD1HTTP } from '@prisma/adapter-d1';
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';

let prismaInstance: PrismaClient | null = null;

/**
 * Attempt to read Wrangler's stored OAuth token if CLOUDFLARE_API_TOKEN is not in .env
 */
function getWranglerOAuthToken(): string | null {
  try {
    const p = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {}
  return null;
}

export function getPrisma(workerEnv?: any): PrismaClient {
  if (!prismaInstance) {
    // 1. Cloudflare Worker environment (env.DB binding)
    if (workerEnv?.DB || (globalThis as any).env?.DB) {
      const db = workerEnv?.DB || (globalThis as any).env?.DB;
      console.log('⚡ [D1] Initializing Prisma with Cloudflare Worker D1 binding (env.DB)');
      const adapter = new PrismaD1(db);
      prismaInstance = new PrismaClient({ adapter });
      return prismaInstance;
    }

    // 2. Node.js environment connecting to Cloudflare D1 via HTTP adapter
    const accountId = config.cfAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '4f5bacd660c9136bfe646f57a836c5d9';
    const databaseId = config.cfD1DatabaseId || process.env.CLOUDFLARE_D1_DATABASE_ID || 'b9ddc5cd-83f3-4d24-ae1a-5adb2b62e7b8';
    const apiToken = config.cfApiToken || process.env.CLOUDFLARE_API_TOKEN || getWranglerOAuthToken();

    if (accountId && databaseId && apiToken) {
      console.log(`🌐 [D1] Initializing Prisma with Remote Cloudflare D1 HTTP adapter (DB: ${databaseId})`);
      const adapter = new PrismaD1HTTP({
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_DATABASE_ID: databaseId,
        CLOUDFLARE_D1_TOKEN: apiToken,
      });
      prismaInstance = new PrismaClient({ adapter });
      return prismaInstance;
    }

    // 3. Fallback to local SQLite file
    console.log('📂 [D1] Initializing Prisma with local SQLite dev database');
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export function isPrismaConfigured(): boolean {
  return true;
}
