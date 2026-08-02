SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

LOCK TABLE "public"."tenant_members" IN SHARE MODE;
LOCK TABLE "public"."auth_account_institution_bindings" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."institution_scopes" IN SHARE MODE;

DO $migration$
DECLARE
  expected_predecessor_count CONSTANT integer := 44;
  expected_predecessor_when CONSTANT bigint := 1785656610916;
  expected_predecessor_hash CONSTANT text := '85612368ac0fb2337085221d420ce6ffb92045317cade7e6f71c1f7b898929a2';
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT count(*) <> expected_predecessor_count
      OR max(created_at) <> expected_predecessor_when
      OR count(*) FILTER (
        WHERE created_at = expected_predecessor_when
          AND hash = expected_predecessor_hash
      ) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_JOURNAL_DRIFT';
  END IF;

  IF to_regclass('public.tenant_members') IS NULL
    OR to_regclass('public.auth_account_institution_bindings') IS NULL
    OR to_regclass('public.institution_scopes') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_REQUIRED_RELATION_MISSING';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint
    WHERE conrelid = 'public.auth_account_institution_bindings'::regclass
      AND conname = 'auth_account_institution_bindings_scope_fk'
      AND contype = 'f'
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_SCOPE_FK_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings
    WHERE version < 1
      OR version > 2147483647
      OR (status = 'active' AND revoked_at IS NOT NULL)
      OR (status = 'revoked' AND (revoked_at IS NULL OR revoked_at < assigned_at))
      OR (expires_at IS NOT NULL AND expires_at <= assigned_at)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_CURRENT_SHAPE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    LEFT JOIN public.tenant_members membership_row
      ON membership_row.tenant_id = binding_row.tenant_id
     AND membership_row.user_id = binding_row.account_id
    WHERE membership_row.id IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_MEMBERSHIP_ORPHAN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT account_id, tenant_id
      FROM public.auth_account_institution_bindings
      WHERE status = 'active'
      GROUP BY account_id, tenant_id
      HAVING count(*) > 1
    ) duplicate_active
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_DUPLICATE_ACTIVE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'auth_institution_binding_transition_type'
      AND typnamespace = 'public'::regnamespace
  ) OR to_regclass('public.auth_account_institution_binding_transitions') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.auth_account_institution_bindings'::regclass
        AND conname = 'auth_account_institution_bindings_tenant_id_id_unique'
    )
    OR to_regprocedure('public.reject_auth_binding_transition_mutation()') IS NOT NULL
    OR to_regprocedure('public.enforce_auth_binding_current_mutation()') IS NOT NULL
    OR to_regprocedure('public.reject_auth_binding_current_destructive_mutation()') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_OBJECT_PREEXISTS';
  END IF;
END
$migration$;

CREATE TYPE "public"."auth_institution_binding_transition_type" AS ENUM(
  'create',
  'rebind',
  'revoke',
  'expire',
  'legacy_calibration'
);

ALTER TABLE "public"."auth_account_institution_bindings"
  ADD CONSTRAINT "auth_account_institution_bindings_tenant_id_id_unique"
  UNIQUE ("tenant_id", "id");

CREATE TABLE "public"."auth_account_institution_binding_transitions" (
  "id" varchar(96) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "binding_id" varchar(64) NOT NULL,
  "replacement_binding_id" varchar(64),
  "command_id" varchar(128) NOT NULL,
  "transition_type" "public"."auth_institution_binding_transition_type" NOT NULL,
  "provenance_source" "public"."membership_provenance_source" NOT NULL,
  "assignment_source" "public"."auth_institution_binding_source" NOT NULL,
  "actor_id" varchar(96),
  "reason_code" varchar(96) NOT NULL,
  "from_status" "public"."auth_institution_binding_status",
  "to_status" "public"."auth_institution_binding_status" NOT NULL,
  "from_version" integer,
  "to_version" integer NOT NULL,
  "membership_revision" integer NOT NULL,
  "scope_revision" integer,
  "occurred_at" timestamptz,
  "recorded_at" timestamptz NOT NULL,
  CONSTRAINT "auth_binding_transitions_tenant_command_unique"
    UNIQUE ("tenant_id", "command_id"),
  CONSTRAINT "auth_binding_transitions_binding_version_unique"
    UNIQUE ("binding_id", "to_version"),
  CONSTRAINT "auth_binding_transitions_binding_fk"
    FOREIGN KEY ("tenant_id", "binding_id")
    REFERENCES "public"."auth_account_institution_bindings"("tenant_id", "id")
    ON UPDATE NO ACTION
    ON DELETE NO ACTION,
  CONSTRAINT "auth_binding_transitions_replacement_fk"
    FOREIGN KEY ("tenant_id", "replacement_binding_id")
    REFERENCES "public"."auth_account_institution_bindings"("tenant_id", "id")
    ON UPDATE NO ACTION
    ON DELETE NO ACTION,
  CONSTRAINT "auth_binding_transitions_identity_present_check"
    CHECK (
      length(trim("id")) > 0
      AND length(trim("command_id")) > 0
      AND length(trim("reason_code")) > 0
    ),
  CONSTRAINT "auth_binding_transitions_version_shape_check"
    CHECK (
      "to_version" BETWEEN 1 AND 2147483647
      AND "membership_revision" BETWEEN 1 AND 2147483647
      AND (
        (
          "transition_type" = 'create'
          AND "from_version" IS NULL
          AND "to_version" = 1
        ) OR (
          "transition_type" = 'legacy_calibration'
          AND "from_version" IS NULL
        ) OR (
          "transition_type" IN ('rebind', 'revoke', 'expire')
          AND "from_version" BETWEEN 1 AND 2147483646
          AND "to_version" = "from_version" + 1
        )
      )
    ),
  CONSTRAINT "auth_binding_transitions_status_shape_check"
    CHECK (
      (
        "transition_type" = 'create'
        AND "from_status" IS NULL
        AND "to_status" = 'active'
        AND "replacement_binding_id" IS NULL
      ) OR (
        "transition_type" = 'legacy_calibration'
        AND "from_status" IS NULL
        AND "to_status" IN ('active', 'revoked')
        AND "replacement_binding_id" IS NULL
      ) OR (
        "transition_type" = 'rebind'
        AND "from_status" = 'active'
        AND "to_status" = 'revoked'
        AND "replacement_binding_id" IS NOT NULL
        AND "replacement_binding_id" <> "binding_id"
      ) OR (
        "transition_type" IN ('revoke', 'expire')
        AND "from_status" = 'active'
        AND "to_status" = 'revoked'
        AND "replacement_binding_id" IS NULL
      )
    ),
  CONSTRAINT "auth_binding_transitions_observation_shape_check"
    CHECK (
      (
        "transition_type" IN ('create', 'rebind')
        AND "scope_revision" BETWEEN 1 AND 2147483647
      ) OR (
        "transition_type" IN ('revoke', 'expire', 'legacy_calibration')
        AND "scope_revision" IS NULL
      )
    ),
  CONSTRAINT "auth_binding_transitions_provenance_shape_check"
    CHECK (
      (
        "transition_type" = 'legacy_calibration'
        AND "provenance_source" = 'legacy_calibration'
        AND "actor_id" IS NULL
        AND "reason_code" = 'legacy_unknown'
        AND "occurred_at" IS NULL
      ) OR (
        "transition_type" = 'create'
        AND "provenance_source" IN ('formal_onboarding', 'access_control_command')
        AND "assignment_source" IN ('manual_admin', 'system')
        AND "actor_id" IS NOT NULL
        AND "occurred_at" IS NOT NULL
        AND "recorded_at" >= "occurred_at"
      ) OR (
        "transition_type" = 'rebind'
        AND "provenance_source" = 'access_control_command'
        AND "assignment_source" IN ('manual_admin', 'system')
        AND "actor_id" IS NOT NULL
        AND "occurred_at" IS NOT NULL
        AND "recorded_at" >= "occurred_at"
      ) OR (
        "transition_type" IN ('revoke', 'expire')
        AND "provenance_source" = 'access_control_command'
        AND "actor_id" IS NOT NULL
        AND "occurred_at" IS NOT NULL
        AND "recorded_at" >= "occurred_at"
      )
    )
);

CREATE INDEX "auth_binding_transitions_tenant_binding_version_idx"
  ON "public"."auth_account_institution_binding_transitions"
  USING btree ("tenant_id", "binding_id", "to_version");

CREATE FUNCTION "public"."reject_auth_binding_transition_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_TRANSITION_IMMUTABLE';
END
$function$;

CREATE TRIGGER "auth_binding_transitions_reject_row_mutation"
BEFORE UPDATE OR DELETE
ON "public"."auth_account_institution_binding_transitions"
FOR EACH ROW
EXECUTE FUNCTION "public"."reject_auth_binding_transition_mutation"();

CREATE TRIGGER "auth_binding_transitions_reject_truncate"
BEFORE TRUNCATE
ON "public"."auth_account_institution_binding_transitions"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."reject_auth_binding_transition_mutation"();

CREATE FUNCTION "public"."enforce_auth_binding_current_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."account_id" IS DISTINCT FROM OLD."account_id"
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."institution_id" IS DISTINCT FROM OLD."institution_id"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."assigned_by" IS DISTINCT FROM OLD."assigned_by"
    OR NEW."assigned_at" IS DISTINCT FROM OLD."assigned_at"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_IMMUTABLE_FIELD_CHANGED';
  END IF;

  IF OLD."status" <> 'active'
    OR NEW."status" <> 'revoked'
    OR OLD."revoked_at" IS NOT NULL
    OR NEW."revoked_at" IS NULL
    OR NEW."revoked_at" < OLD."assigned_at"
    OR OLD."version" >= 2147483647
    OR NEW."version" <> OLD."version" + 1
    OR NEW."updated_at" < OLD."updated_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_INVALID_LIFECYCLE_MUTATION';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER "auth_binding_current_enforce_update"
BEFORE UPDATE
ON "public"."auth_account_institution_bindings"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_auth_binding_current_mutation"();

CREATE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_DESTRUCTIVE_MUTATION_REJECTED';
END
$function$;

CREATE TRIGGER "auth_binding_current_reject_delete"
BEFORE DELETE
ON "public"."auth_account_institution_bindings"
FOR EACH ROW
EXECUTE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"();

CREATE TRIGGER "auth_binding_current_reject_truncate"
BEFORE TRUNCATE
ON "public"."auth_account_institution_bindings"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"();

DO $migration$
BEGIN
  IF (
    SELECT array_agg(enum_value.enumlabel::text ORDER BY enum_value.enumsortorder)
      <> ARRAY['create', 'rebind', 'revoke', 'expire', 'legacy_calibration']::text[]
    FROM pg_enum enum_value
    JOIN pg_type enum_type
      ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'auth_institution_binding_transition_type'
      AND enum_type.typnamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_ENUM_POSTCHECK_FAILED';
  END IF;

  IF to_regclass('public.auth_account_institution_binding_transitions') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_TABLE_POSTCHECK_FAILED';
  END IF;

  IF (
    SELECT count(*) <> 2
    FROM pg_trigger
    WHERE tgrelid = 'public.auth_account_institution_binding_transitions'::regclass
      AND NOT tgisinternal
  ) OR (
    SELECT count(*) <> 3
    FROM pg_trigger
    WHERE tgrelid = 'public.auth_account_institution_bindings'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_TRANSITION_TRIGGER_POSTCHECK_FAILED';
  END IF;
END
$migration$;
