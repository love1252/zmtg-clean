SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1787750400000;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_KNOWLEDGE_0052_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_KNOWLEDGE_0052_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_documents') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_sources') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_document_files') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_formal_sources') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_formal_document_versions') IS NULL
    OR pg_catalog.to_regclass('public.knowledge_formal_document_publications') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_KNOWLEDGE_0052_PREREQUISITE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.institution_knowledge_upload_drafts') IS NOT NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_KNOWLEDGE_0052_TARGET_ALREADY_EXISTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum value
    JOIN pg_catalog.pg_type type ON type.oid = value.enumtypid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname IN (
        'knowledge_base_runtime_source_kind',
        'knowledge_formal_provenance_source'
      )
      AND value.enumlabel = 'institution_upload'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_KNOWLEDGE_0052_ENUM_VALUE_ALREADY_EXISTS';
  END IF;
END
$migration$;

ALTER TYPE "public"."knowledge_base_runtime_source_kind"
  ADD VALUE 'institution_upload';

ALTER TYPE "public"."knowledge_formal_provenance_source"
  ADD VALUE 'institution_upload';

CREATE TABLE "public"."institution_knowledge_upload_drafts" (
  "id" varchar(64) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "knowledge_document_id" varchar(64) NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "file_id" varchar(64) NOT NULL,
  "state" varchar(24) NOT NULL DEFAULT 'parsed',
  "title" varchar(200) NOT NULL,
  "category" varchar(160) NOT NULL,
  "file_digest" varchar(64) NOT NULL,
  "content_digest" varchar(64) NOT NULL,
  "parser_type" varchar(24) NOT NULL,
  "warning_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "revision" integer NOT NULL DEFAULT 1,
  "created_by" varchar(96) NOT NULL,
  "confirmed_by" varchar(96),
  "confirmed_at" timestamptz,
  "published_by" varchar(96),
  "published_at" timestamptz,
  "published_version" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "institution_knowledge_upload_drafts_scope_fk"
    FOREIGN KEY ("tenant_id", "institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id"),
  CONSTRAINT "institution_knowledge_upload_drafts_document_fk"
    FOREIGN KEY ("tenant_id", "knowledge_document_id")
    REFERENCES "public"."knowledge_documents" ("tenant_id", "id"),
  CONSTRAINT "institution_knowledge_upload_drafts_source_fk"
    FOREIGN KEY ("tenant_id", "source_id")
    REFERENCES "public"."knowledge_sources" ("tenant_id", "id"),
  CONSTRAINT "institution_knowledge_upload_drafts_file_fk"
    FOREIGN KEY ("tenant_id", "file_id")
    REFERENCES "public"."knowledge_document_files" ("tenant_id", "id"),
  CONSTRAINT "institution_knowledge_upload_drafts_scope_id_unique"
    UNIQUE ("tenant_id", "institution_id", "id"),
  CONSTRAINT "institution_knowledge_upload_drafts_scope_document_unique"
    UNIQUE ("tenant_id", "institution_id", "knowledge_document_id"),
  CONSTRAINT "institution_knowledge_upload_drafts_state_check"
    CHECK ("state" IN ('parsed', 'confirmed', 'published')),
  CONSTRAINT "institution_knowledge_upload_drafts_digest_check"
    CHECK (length("file_digest") = 64 AND length("content_digest") = 64),
  CONSTRAINT "institution_knowledge_upload_drafts_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "institution_knowledge_upload_drafts_publication_shape_check"
    CHECK (
      ("state" <> 'published'
        AND "published_by" IS NULL
        AND "published_at" IS NULL
        AND "published_version" IS NULL)
      OR
      ("state" = 'published'
        AND "published_by" IS NOT NULL
        AND "published_at" IS NOT NULL
        AND "published_version" > 0)
    )
);

CREATE INDEX "institution_knowledge_upload_drafts_scope_state_idx"
  ON "public"."institution_knowledge_upload_drafts"
  ("tenant_id", "institution_id", "state", "updated_at");
