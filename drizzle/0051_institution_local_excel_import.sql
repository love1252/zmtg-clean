SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1786982400000;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_IMPORT_0051_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_IMPORT_0051_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.customers') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_IMPORT_0051_PREREQUISITE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.institution_excel_import_batches') IS NOT NULL
    OR pg_catalog.to_regclass('public.institution_excel_import_rows') IS NOT NULL
    OR pg_catalog.to_regclass('public.customer_sensitive_profiles') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.institution_excel_import_immutable_guard_v1()') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_IMPORT_0051_TARGET_ALREADY_EXISTS';
  END IF;
END
$migration$;

CREATE TABLE "public"."institution_excel_import_batches" (
  "id" varchar(64) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "file_digest" varchar(64) NOT NULL,
  "file_name_digest" varchar(64) NOT NULL,
  "customer_count" integer NOT NULL,
  "appointment_count" integer NOT NULL,
  "treatment_count" integer NOT NULL,
  "consumption_count" integer NOT NULL,
  "created_by" varchar(96) NOT NULL,
  "completed_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "institution_excel_import_batches_scope_fk"
    FOREIGN KEY ("tenant_id", "institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id"),
  CONSTRAINT "institution_excel_import_batches_scope_file_unique"
    UNIQUE ("tenant_id", "institution_id", "file_digest"),
  CONSTRAINT "institution_excel_import_batches_scope_id_unique"
    UNIQUE ("tenant_id", "institution_id", "id"),
  CONSTRAINT "institution_excel_import_batches_digest_check"
    CHECK (
      length("file_digest") = 64
      AND "file_digest" ~ '^[0-9a-f]{64}$'
      AND length("file_name_digest") = 64
      AND "file_name_digest" ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT "institution_excel_import_batches_counts_check"
    CHECK (
      "customer_count" > 0
      AND "appointment_count" >= 0
      AND "treatment_count" >= 0
      AND "consumption_count" >= 0
    )
);

CREATE INDEX "institution_excel_import_batches_scope_completed_idx"
  ON "public"."institution_excel_import_batches"
  ("tenant_id", "institution_id", "completed_at");

CREATE TABLE "public"."institution_excel_import_rows" (
  "id" varchar(64) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "batch_id" varchar(64) NOT NULL,
  "sheet_kind" varchar(24) NOT NULL,
  "row_number" integer NOT NULL,
  "external_reference_digest" varchar(64) NOT NULL,
  "canonical_record_id" varchar(64) NOT NULL,
  "protected_payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "institution_excel_import_rows_scope_batch_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "batch_id")
    REFERENCES "public"."institution_excel_import_batches"
    ("tenant_id", "institution_id", "id"),
  CONSTRAINT "institution_excel_import_rows_scope_batch_row_unique"
    UNIQUE ("tenant_id", "institution_id", "batch_id", "sheet_kind", "row_number"),
  CONSTRAINT "institution_excel_import_rows_scope_reference_unique"
    UNIQUE ("tenant_id", "institution_id", "sheet_kind", "external_reference_digest"),
  CONSTRAINT "institution_excel_import_rows_row_check" CHECK ("row_number" >= 5),
  CONSTRAINT "institution_excel_import_rows_kind_check"
    CHECK ("sheet_kind" IN ('customer', 'appointment', 'treatment', 'consumption')),
  CONSTRAINT "institution_excel_import_rows_digest_check"
    CHECK (
      length("external_reference_digest") = 64
      AND "external_reference_digest" ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT "institution_excel_import_rows_protected_payload_check"
    CHECK (jsonb_typeof("protected_payload") = 'object')
);

CREATE TABLE "public"."customer_sensitive_profiles" (
  "id" varchar(64) PRIMARY KEY,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "phone_digest" varchar(64),
  "protected_phone" jsonb,
  "national_id_digest" varchar(64),
  "protected_national_id" jsonb,
  "external_patient_id_digest" varchar(64),
  "protected_external_patient_id" jsonb,
  "created_by" varchar(96) NOT NULL,
  "updated_by" varchar(96) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "customer_sensitive_profiles_scope_customer_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "customer_id")
    REFERENCES "public"."customers" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "customer_sensitive_profiles_scope_customer_unique"
    UNIQUE ("tenant_id", "institution_id", "customer_id"),
  CONSTRAINT "customer_sensitive_profiles_phone_shape_check"
    CHECK (
      ("phone_digest" IS NULL AND "protected_phone" IS NULL)
      OR (
        length("phone_digest") = 64
        AND "phone_digest" ~ '^[0-9a-f]{64}$'
        AND jsonb_typeof("protected_phone") = 'object'
      )
    ),
  CONSTRAINT "customer_sensitive_profiles_national_id_shape_check"
    CHECK (
      ("national_id_digest" IS NULL AND "protected_national_id" IS NULL)
      OR (
        length("national_id_digest") = 64
        AND "national_id_digest" ~ '^[0-9a-f]{64}$'
        AND jsonb_typeof("protected_national_id") = 'object'
      )
    ),
  CONSTRAINT "customer_sensitive_profiles_external_patient_id_shape_check"
    CHECK (
      ("external_patient_id_digest" IS NULL AND "protected_external_patient_id" IS NULL)
      OR (
        length("external_patient_id_digest") = 64
        AND "external_patient_id_digest" ~ '^[0-9a-f]{64}$'
        AND jsonb_typeof("protected_external_patient_id") = 'object'
      )
    )
);

CREATE INDEX "customer_sensitive_profiles_scope_phone_digest_idx"
  ON "public"."customer_sensitive_profiles"
  ("tenant_id", "institution_id", "phone_digest");

CREATE FUNCTION "public"."institution_excel_import_immutable_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'INSTITUTION_EXCEL_IMPORT_RECORD_IMMUTABLE';
END
$function$;

CREATE TRIGGER "institution_excel_import_batches_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."institution_excel_import_batches"
FOR EACH ROW EXECUTE FUNCTION "public"."institution_excel_import_immutable_guard_v1"();

CREATE TRIGGER "institution_excel_import_rows_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."institution_excel_import_rows"
FOR EACH ROW EXECUTE FUNCTION "public"."institution_excel_import_immutable_guard_v1"();

CREATE TRIGGER "customer_sensitive_profiles_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."customer_sensitive_profiles"
FOR EACH ROW EXECUTE FUNCTION "public"."institution_excel_import_immutable_guard_v1"();
