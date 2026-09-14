-- ============================================================================
-- NOMA POS Supabase Migration Script
-- Table: LICENSE_MASTER (Benefit Master Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "LICENSE_MASTER" (
    "LICENSE_MASTER_ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "LICENSE_PLAN_CODE" VARCHAR(100) NOT NULL UNIQUE,
    "LICENSE_JSON" JSONB NOT NULL,
    "CREATED_AT" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UPDATED_AT" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_LICENSE_MASTER_PLAN_CODE" ON "LICENSE_MASTER"("LICENSE_PLAN_CODE");

COMMENT ON TABLE "LICENSE_MASTER" IS 'Master configuration table for license plan benefits and tier features';
