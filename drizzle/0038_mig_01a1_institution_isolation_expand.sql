CREATE TYPE "public"."institution_scope_status" AS ENUM('active', 'suspended');
CREATE TYPE "public"."institution_provisioning_source" AS ENUM('formal_onboarding', 'approved_migration_manifest');
CREATE TYPE "public"."institution_operating_context_source" AS ENUM('institution_config', 'product_default');
CREATE TYPE "public"."audit_institution_attribution" AS ENUM('not_applicable', 'verified', 'legacy_unattributed');

CREATE TABLE IF NOT EXISTS "institution_scopes" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "status" "institution_scope_status" NOT NULL,
  "revision" integer NOT NULL,
  "provisioning_source" "institution_provisioning_source" NOT NULL,
  "provisioning_reference_digest" varchar(64) NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "approved_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_scopes_pk" PRIMARY KEY("tenant_id", "institution_id"),
  CONSTRAINT "institution_scopes_revision_positive_check" CHECK ("revision" > 0),
  CONSTRAINT "institution_scopes_provisioning_reference_digest_length_check" CHECK (length("provisioning_reference_digest") = 64)
);

CREATE TABLE IF NOT EXISTS "institution_operating_context_versions" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "timezone" varchar(64) NOT NULL,
  "currency" varchar(3) NOT NULL,
  "effective_from_business_date" date NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "source" "institution_operating_context_source" NOT NULL,
  "migration_provenance" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(96) NOT NULL,
  CONSTRAINT "institution_operating_context_versions_pk" PRIMARY KEY("tenant_id", "institution_id", "version"),
  CONSTRAINT "institution_operating_context_versions_effective_at_unique" UNIQUE("tenant_id", "institution_id", "effective_at"),
  CONSTRAINT "institution_operating_context_versions_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "institution_operating_context_versions_timezone_present_check" CHECK (length(trim("timezone")) > 0),
  CONSTRAINT "institution_operating_context_versions_currency_format_check" CHECK (length("currency") = 3 AND "currency" = upper("currency"))
);

CREATE TABLE IF NOT EXISTS "institution_operating_contexts" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "revision" integer NOT NULL,
  "latest_version" integer NOT NULL,
  "updated_by" varchar(96) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_operating_contexts_pk" PRIMARY KEY("tenant_id", "institution_id"),
  CONSTRAINT "institution_operating_contexts_revision_positive_check" CHECK ("revision" > 0),
  CONSTRAINT "institution_operating_contexts_latest_version_positive_check" CHECK ("latest_version" > 0)
);

DO $$ BEGIN
  ALTER TABLE "institution_scopes" ADD CONSTRAINT "institution_scopes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "institution_operating_context_versions" ADD CONSTRAINT "institution_operating_context_versions_scope_fk" FOREIGN KEY ("tenant_id", "institution_id") REFERENCES "public"."institution_scopes"("tenant_id", "institution_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "institution_operating_contexts" ADD CONSTRAINT "institution_operating_contexts_scope_fk" FOREIGN KEY ("tenant_id", "institution_id") REFERENCES "public"."institution_scopes"("tenant_id", "institution_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "institution_operating_contexts" ADD CONSTRAINT "institution_operating_contexts_latest_version_fk" FOREIGN KEY ("tenant_id", "institution_id", "latest_version") REFERENCES "public"."institution_operating_context_versions"("tenant_id", "institution_id", "version") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "appointments" ADD COLUMN "institution_id" varchar(64);
ALTER TABLE "treatment_summaries" ADD COLUMN "institution_id" varchar(64);
ALTER TABLE "follow_up_tasks" ADD COLUMN "institution_id" varchar(64);
ALTER TABLE "audit_events" ADD COLUMN "institution_id" varchar(64);
ALTER TABLE "audit_events" ADD COLUMN "institution_attribution" "audit_institution_attribution";
