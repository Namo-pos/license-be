/**
 * Backwards compatibility proxy for D1Database.
 * Database layer migrated from Supabase PostgreSQL to Cloudflare D1.
 */
export * from './d1.database.js';
export { D1Database as SupabaseDatabase } from './d1.database.js';
