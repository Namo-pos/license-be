import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  baseDomain: process.env.BASE_DOMAIN || 'nomapos.com',
  cfSandbox: process.env.CF_SANDBOX !== 'false',
  cfAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  cfApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  cfZoneId: process.env.CLOUDFLARE_ZONE_ID || '',
  localTargetService: process.env.LOCAL_TARGET_SERVICE || 'http://localhost:5000',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
};
