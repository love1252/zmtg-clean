SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1786886640000;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_SCOPE_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_CUSTOMERS_TABLE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class r ON r.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'customers'
      AND c.conname = 'customers_tenant_institution_id_id_unique'
      AND c.contype = 'u'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_CUSTOMER_SCOPE_UNIQUE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.analytics_formal_sources') IS NOT NULL
    OR pg_catalog.to_regclass('public.analytics_formal_ingestion_batches') IS NOT NULL
    OR pg_catalog.to_regclass('public.analytics_consumption_facts') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_formal_source_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_consumption_event_family') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_consumption_event_type') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_customer_attribution_status') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_project_attribution_status') IS NOT NULL
    OR pg_catalog.to_regtype('public.analytics_refund_link_status') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.analytics_formal_immutable_guard_v1()') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_0048_TARGET_OBJECT_ALREADY_EXISTS';
  END IF;
END
$migration$;

CREATE TYPE "public"."analytics_formal_source_kind" AS ENUM (
  'approved_import_manifest',
  'approved_integration_registration'
);

CREATE TYPE "public"."analytics_consumption_event_family" AS ENUM ('payment', 'refund');

CREATE TYPE "public"."analytics_consumption_event_type" AS ENUM (
  'payment_succeeded',
  'payment_pending',
  'payment_failed',
  'payment_cancelled',
  'refund_confirmed',
  'refund_pending',
  'refund_failed',
  'refund_cancelled'
);

CREATE TYPE "public"."analytics_customer_attribution_status" AS ENUM (
  'matched',
  'unmatched',
  'pending_review'
);

CREATE TYPE "public"."analytics_project_attribution_status" AS ENUM (
  'mapped',
  'unmapped',
  'pending_review'
);

CREATE TYPE "public"."analytics_refund_link_status" AS ENUM (
  'not_applicable',
  'linked',
  'orphan_verified'
);

CREATE TABLE "public"."analytics_formal_sources" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "source_label" varchar(160) NOT NULL,
  "source_kind" "public"."analytics_formal_source_kind" NOT NULL,
  "provenance_reference_digest" varchar(64) NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "approved_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "analytics_sources_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "analytics_sources_scope_fk"
    FOREIGN KEY ("tenant_id", "institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id"),
  CONSTRAINT "analytics_sources_label_check"
    CHECK (length(trim("source_label")) > 0),
  CONSTRAINT "analytics_sources_digest_check"
    CHECK (length("provenance_reference_digest") = 64)
);

CREATE INDEX "analytics_sources_scope_idx"
  ON "public"."analytics_formal_sources" ("tenant_id", "institution_id");

CREATE TABLE "public"."analytics_formal_ingestion_batches" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "batch_or_connection_ref" varchar(256) NOT NULL,
  "provenance_reference_digest" varchar(64) NOT NULL,
  "received_at" timestamptz NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "approved_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "analytics_batches_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "source_id", "batch_or_connection_ref"),
  CONSTRAINT "analytics_batches_source_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "source_id")
    REFERENCES "public"."analytics_formal_sources" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "analytics_batches_reference_check"
    CHECK (length(trim("batch_or_connection_ref")) > 0),
  CONSTRAINT "analytics_batches_digest_check"
    CHECK (length("provenance_reference_digest") = 64)
);

CREATE INDEX "analytics_batches_scope_received_idx"
  ON "public"."analytics_formal_ingestion_batches"
  ("tenant_id", "institution_id", "received_at");

CREATE TABLE "public"."analytics_consumption_facts" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "batch_or_connection_ref" varchar(256) NOT NULL,
  "source_record_ref" varchar(256) NOT NULL,
  "event_family" "public"."analytics_consumption_event_family" NOT NULL,
  "source_revision" varchar(256) NOT NULL,
  "supersedes_source_revision" varchar(256),
  "event_type" "public"."analytics_consumption_event_type" NOT NULL,
  "event_at" timestamptz NOT NULL,
  "received_at" timestamptz NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" varchar(3) NOT NULL,
  "stable_consumption_record_ref" varchar(256),
  "customer_attribution_status" "public"."analytics_customer_attribution_status" NOT NULL,
  "customer_id" varchar(64),
  "customer_candidate_reference" varchar(256),
  "project_attribution_status" "public"."analytics_project_attribution_status" NOT NULL,
  "his_directory_version" varchar(256),
  "canonical_project_id" varchar(64),
  "project_candidate_reference" varchar(256),
  "refund_link_status" "public"."analytics_refund_link_status" NOT NULL,
  "recorded_by" varchar(96) NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "analytics_facts_pk"
    PRIMARY KEY (
      "tenant_id",
      "institution_id",
      "source_id",
      "source_record_ref",
      "event_type",
      "source_revision"
    ),
  CONSTRAINT "analytics_facts_group_revision_unique"
    UNIQUE (
      "tenant_id",
      "institution_id",
      "source_id",
      "source_record_ref",
      "event_family",
      "source_revision"
    ),
  CONSTRAINT "analytics_facts_batch_fk"
    FOREIGN KEY (
      "tenant_id",
      "institution_id",
      "source_id",
      "batch_or_connection_ref"
    )
    REFERENCES "public"."analytics_formal_ingestion_batches" (
      "tenant_id",
      "institution_id",
      "source_id",
      "batch_or_connection_ref"
    ),
  CONSTRAINT "analytics_facts_customer_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "customer_id")
    REFERENCES "public"."customers" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "analytics_facts_required_ref_check"
    CHECK (
      length(trim("source_record_ref")) > 0
      AND length(trim("source_revision")) > 0
      AND length(trim("recorded_by")) > 0
    ),
  CONSTRAINT "analytics_facts_correction_check"
    CHECK (
      "supersedes_source_revision" IS NULL
      OR (
        length(trim("supersedes_source_revision")) > 0
        AND "supersedes_source_revision" <> "source_revision"
      )
    ),
  CONSTRAINT "analytics_facts_event_family_check"
    CHECK (
      (
        "event_family" = 'payment'
        AND "event_type" IN (
          'payment_succeeded',
          'payment_pending',
          'payment_failed',
          'payment_cancelled'
        )
      )
      OR (
        "event_family" = 'refund'
        AND "event_type" IN (
          'refund_confirmed',
          'refund_pending',
          'refund_failed',
          'refund_cancelled'
        )
      )
    ),
  CONSTRAINT "analytics_facts_amount_check"
    CHECK ("amount_minor" BETWEEN 1 AND 9007199254740991),
  CONSTRAINT "analytics_facts_currency_check"
    CHECK (
      length("currency") = 3
      AND "currency" = upper("currency")
      AND "currency" ~ '^[A-Z]{3}$'
    ),
  CONSTRAINT "analytics_facts_stable_ref_check"
    CHECK (
      "stable_consumption_record_ref" IS NULL
      OR length(trim("stable_consumption_record_ref")) > 0
    ),
  CONSTRAINT "analytics_facts_customer_attribution_check"
    CHECK (
      (
        "customer_attribution_status" = 'matched'
        AND "customer_id" IS NOT NULL
        AND length(trim("customer_id")) > 0
        AND "customer_candidate_reference" IS NULL
      )
      OR (
        "customer_attribution_status" = 'unmatched'
        AND "customer_id" IS NULL
        AND "customer_candidate_reference" IS NULL
      )
      OR (
        "customer_attribution_status" = 'pending_review'
        AND "customer_id" IS NULL
        AND "customer_candidate_reference" ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$'
      )
    ),
  CONSTRAINT "analytics_facts_project_attribution_check"
    CHECK (
      (
        "project_attribution_status" = 'mapped'
        AND "his_directory_version" IS NOT NULL
        AND length(trim("his_directory_version")) > 0
        AND "canonical_project_id" IS NOT NULL
        AND length(trim("canonical_project_id")) > 0
        AND "project_candidate_reference" IS NULL
      )
      OR (
        "project_attribution_status" = 'unmapped'
        AND "his_directory_version" IS NULL
        AND "canonical_project_id" IS NULL
        AND "project_candidate_reference" IS NULL
      )
      OR (
        "project_attribution_status" = 'pending_review'
        AND "his_directory_version" IS NULL
        AND "canonical_project_id" IS NULL
        AND "project_candidate_reference" ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$'
      )
    ),
  CONSTRAINT "analytics_facts_refund_link_check"
    CHECK (
      ("event_family" = 'payment' AND "refund_link_status" = 'not_applicable')
      OR (
        "event_family" = 'refund'
        AND "refund_link_status" IN ('linked', 'orphan_verified')
      )
    )
);

CREATE INDEX "analytics_facts_period_idx"
  ON "public"."analytics_consumption_facts"
  ("tenant_id", "institution_id", "event_at", "event_type");

CREATE INDEX "analytics_facts_chain_idx"
  ON "public"."analytics_consumption_facts"
  ("tenant_id", "institution_id", "source_id", "source_record_ref", "event_family");

CREATE INDEX "analytics_facts_stable_idx"
  ON "public"."analytics_consumption_facts"
  ("tenant_id", "institution_id", "source_id", "stable_consumption_record_ref");

CREATE FUNCTION "public"."analytics_formal_immutable_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'ANALYTICS_FORMAL_PERSISTENCE_IMMUTABLE';
END
$function$;

CREATE TRIGGER "analytics_sources_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."analytics_formal_sources"
FOR EACH ROW
EXECUTE FUNCTION "public"."analytics_formal_immutable_guard_v1"();

CREATE TRIGGER "analytics_batches_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."analytics_formal_ingestion_batches"
FOR EACH ROW
EXECUTE FUNCTION "public"."analytics_formal_immutable_guard_v1"();

CREATE TRIGGER "analytics_facts_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."analytics_consumption_facts"
FOR EACH ROW
EXECUTE FUNCTION "public"."analytics_formal_immutable_guard_v1"();
