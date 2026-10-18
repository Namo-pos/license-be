import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  baseDomain: process.env.BASE_DOMAIN || 'nomapos.com.placeholder',
  cfSandbox: process.env.CF_SANDBOX !== 'false',
  cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  cfApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  cfZoneId: process.env.CLOUDFLARE_ZONE_ID || '', // Optional — leave empty for domainless mode
  localTargetService: process.env.LOCAL_TARGET_SERVICE || 'http://localhost:5000',
  cfD1DatabaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || 'b9ddc5cd-83f3-4d24-ae1a-5adb2b62e7b8',
};
