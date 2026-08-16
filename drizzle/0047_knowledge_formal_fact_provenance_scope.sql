SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1786867010908;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'KNOWLEDGE_0047_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'KNOWLEDGE_0047_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'KNOWLEDGE_0047_SCOPE_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.knowledge_formal_sources') IS NOT NULL
    OR pg_catalog.to_regclass('public.knowledge_formal_document_versions') IS NOT NULL
    OR pg_catalog.to_regclass('public.knowledge_formal_document_publications') IS NOT NULL
    OR pg_catalog.to_regtype('public.knowledge_formal_provenance_source') IS NOT NULL
    OR pg_catalog.to_regtype('public.knowledge_formal_publication_status') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'KNOWLEDGE_0047_TARGET_OBJECT_ALREADY_EXISTS';
  END IF;
END
$migration$;

CREATE TYPE "public"."knowledge_formal_provenance_source" AS ENUM (
  'formal_onboarding',
  'approved_migration_manifest'
);

CREATE TYPE "public"."knowledge_formal_publication_status" AS ENUM (
  'published',
  'retired'
);

CREATE TABLE "public"."knowledge_formal_sources" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "source_label" varchar(160) NOT NULL,
  "provenance_source" "public"."knowledge_formal_provenance_source" NOT NULL,
  "provenance_reference_digest" varchar(64) NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "approved_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_formal_sources_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "knowledge_formal_sources_scope_fk"
    FOREIGN KEY ("tenant_id", "institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id"),
  CONSTRAINT "knowledge_formal_sources_digest_check"
    CHECK (length("provenance_reference_digest") = 64)
);

CREATE INDEX "knowledge_formal_sources_scope_idx"
  ON "public"."knowledge_formal_sources" ("tenant_id", "institution_id");

CREATE TABLE "public"."knowledge_formal_document_versions" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "document_id" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "title" varchar(200) NOT NULL,
  "document_reference_digest" varchar(64) NOT NULL,
  "published_by" varchar(96) NOT NULL,
  "published_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_formal_document_versions_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "document_id", "version"),
  CONSTRAINT "knowledge_formal_document_versions_source_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "source_id")
    REFERENCES "public"."knowledge_formal_sources" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "knowledge_formal_document_versions_version_check"
    CHECK ("version" > 0),
  CONSTRAINT "knowledge_formal_document_versions_digest_check"
    CHECK (length("document_reference_digest") = 64)
);

CREATE INDEX "knowledge_formal_document_versions_scope_document_idx"
  ON "public"."knowledge_formal_document_versions"
  ("tenant_id", "institution_id", "document_id");

CREATE TABLE "public"."knowledge_formal_document_publications" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "document_id" varchar(64) NOT NULL,
  "current_version" integer NOT NULL,
  "status" "public"."knowledge_formal_publication_status" NOT NULL,
  "revision" integer NOT NULL,
  "updated_by" varchar(96) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_formal_document_publications_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "document_id"),
  CONSTRAINT "knowledge_formal_document_publications_version_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "document_id", "current_version")
    REFERENCES "public"."knowledge_formal_document_versions"
      ("tenant_id", "institution_id", "document_id", "version"),
  CONSTRAINT "knowledge_formal_document_publications_current_version_check"
    CHECK ("current_version" > 0),
  CONSTRAINT "knowledge_formal_document_publications_revision_check"
    CHECK ("revision" > 0)
);

CREATE INDEX "knowledge_formal_document_publications_scope_status_idx"
  ON "public"."knowledge_formal_document_publications"
  ("tenant_id", "institution_id", "status");

CREATE FUNCTION "public"."knowledge_formal_document_versions_immutable_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'KNOWLEDGE_FORMAL_DOCUMENT_VERSION_IMMUTABLE';
END
$function$;

CREATE TRIGGER "knowledge_formal_document_versions_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."knowledge_formal_document_versions"
FOR EACH ROW
EXECUTE FUNCTION "public"."knowledge_formal_document_versions_immutable_guard_v1"();
