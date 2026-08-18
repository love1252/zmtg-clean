SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1786938000000;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_0050_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_0050_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.customers') IS NULL
    OR pg_catalog.to_regtype('public.auth_role') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_0050_PREREQUISITE_MISSING';
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
    RAISE EXCEPTION USING MESSAGE = 'CARE_0050_CUSTOMER_SCOPE_UNIQUE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.care_formal_follow_up_tasks') IS NOT NULL
    OR pg_catalog.to_regclass('public.care_formal_follow_up_events') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_state') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_risk_level') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_risk_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_completion_code') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_cancellation_reason') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_assignment_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_source_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.care_formal_follow_up_event_type') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.care_formal_follow_up_event_immutable_guard_v1()') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.care_formal_follow_up_task_state_guard_v1()') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_0050_TARGET_ALREADY_EXISTS';
  END IF;
END
$migration$;

CREATE TYPE "public"."care_formal_follow_up_state" AS ENUM (
  'pending','in_progress','waiting_customer','escalated','completed','cancelled'
);
CREATE TYPE "public"."care_formal_follow_up_risk_level" AS ENUM ('none','high');
CREATE TYPE "public"."care_formal_follow_up_risk_kind" AS ENUM (
  'clinical','complaint','refund_dispute','privacy_request','opt_out'
);
CREATE TYPE "public"."care_formal_follow_up_completion_code" AS ENUM (
  'contact_completed','no_response_closed','his_appointment_linked',
  'customer_declined','invalid_or_duplicate'
);
CREATE TYPE "public"."care_formal_follow_up_cancellation_reason" AS ENUM (
  'created_in_error','duplicate_task','source_invalidated','superseded','customer_requested_stop'
);
CREATE TYPE "public"."care_formal_follow_up_assignment_kind" AS ENUM ('user','role_pool');
CREATE TYPE "public"."care_formal_follow_up_source_kind" AS ENUM ('manual_controlled_create');
CREATE TYPE "public"."care_formal_follow_up_event_type" AS ENUM (
  'created','claimed','reassigned','unclaimed','state_changed',
  'risk_escalated','completed','cancelled'
);

CREATE TABLE "public"."care_formal_follow_up_tasks" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "customer_display_name" varchar(120) NOT NULL,
  "customer_masked_reference" varchar(160),
  "stage_code" varchar(64) NOT NULL,
  "action_code" varchar(64) NOT NULL,
  "due_at" timestamptz NOT NULL,
  "state" "public"."care_formal_follow_up_state" NOT NULL DEFAULT 'pending',
  "revision" integer NOT NULL DEFAULT 1,
  "risk_level" "public"."care_formal_follow_up_risk_level" NOT NULL DEFAULT 'none',
  "risk_kind" "public"."care_formal_follow_up_risk_kind",
  "risk_event_id" varchar(128),
  "completion_code" "public"."care_formal_follow_up_completion_code",
  "completion_feedback" varchar(240),
  "cancellation_reason" "public"."care_formal_follow_up_cancellation_reason",
  "assignee_kind" "public"."care_formal_follow_up_assignment_kind" NOT NULL,
  "assignee_user_id" varchar(96),
  "assignee_display_name" varchar(120),
  "assignee_role" "public"."auth_role",
  "claimed_from_role_pool" "public"."auth_role",
  "idempotency_key" varchar(128) NOT NULL,
  "request_digest" varchar(64) NOT NULL,
  "source_kind" "public"."care_formal_follow_up_source_kind" NOT NULL DEFAULT 'manual_controlled_create',
  "created_by" varchar(96) NOT NULL,
  "updated_by" varchar(96) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "care_formal_follow_up_tasks_pk"
    PRIMARY KEY ("tenant_id","institution_id","id"),
  CONSTRAINT "care_formal_follow_up_tasks_scope_fk"
    FOREIGN KEY ("tenant_id","institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id","institution_id"),
  CONSTRAINT "care_formal_follow_up_tasks_customer_fk"
    FOREIGN KEY ("tenant_id","institution_id","customer_id")
    REFERENCES "public"."customers" ("tenant_id","institution_id","id"),
  CONSTRAINT "care_formal_follow_up_tasks_idempotency_unique"
    UNIQUE ("tenant_id","institution_id","idempotency_key"),
  CONSTRAINT "care_formal_follow_up_tasks_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "care_formal_follow_up_tasks_request_digest_check"
    CHECK (length("request_digest") = 64 AND "request_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "care_formal_follow_up_tasks_required_text_check"
    CHECK (
      length(trim("customer_display_name")) > 0
      AND length(trim("stage_code")) > 0
      AND length(trim("action_code")) > 0
      AND length(trim("idempotency_key")) > 0
      AND length(trim("created_by")) > 0
      AND length(trim("updated_by")) > 0
      AND "updated_at" >= "created_at"
    ),
  CONSTRAINT "care_formal_follow_up_tasks_assignment_shape_check"
    CHECK (
      (
        "assignee_kind" = 'user'
        AND "assignee_user_id" IS NOT NULL
        AND "assignee_display_name" IS NOT NULL
        AND "assignee_role" IS NULL
        AND (
          "claimed_from_role_pool" IS NULL
          OR "claimed_from_role_pool" IN ('tenant_admin','tenant_operator','consultant','customer_service')
        )
      ) OR (
        "assignee_kind" = 'role_pool'
        AND "assignee_user_id" IS NULL
        AND "assignee_display_name" IS NULL
        AND "assignee_role" IN ('tenant_admin','tenant_operator','consultant','customer_service')
        AND "claimed_from_role_pool" IS NULL
      )
    ),
  CONSTRAINT "care_formal_follow_up_tasks_state_shape_check"
    CHECK (
      (
        "state" IN ('pending','in_progress','waiting_customer')
        AND "risk_level" = 'none'
        AND "risk_kind" IS NULL
        AND "risk_event_id" IS NULL
        AND "completion_code" IS NULL
        AND "completion_feedback" IS NULL
        AND "cancellation_reason" IS NULL
      ) OR (
        "state" = 'escalated'
        AND "risk_level" = 'high'
        AND "risk_kind" IS NOT NULL
        AND "risk_event_id" IS NOT NULL
        AND "completion_code" IS NULL
        AND "completion_feedback" IS NULL
        AND "cancellation_reason" IS NULL
      ) OR (
        "state" = 'completed'
        AND "risk_level" = 'none'
        AND "risk_kind" IS NULL
        AND "risk_event_id" IS NULL
        AND "completion_code" IS NOT NULL
        AND "cancellation_reason" IS NULL
      ) OR (
        "state" = 'cancelled'
        AND "risk_level" = 'none'
        AND "risk_kind" IS NULL
        AND "risk_event_id" IS NULL
        AND "completion_code" IS NULL
        AND "completion_feedback" IS NULL
        AND "cancellation_reason" IS NOT NULL
      )
    )
);

CREATE INDEX "care_formal_follow_up_tasks_queue_idx"
  ON "public"."care_formal_follow_up_tasks"
  ("tenant_id","institution_id","state","due_at","id");

CREATE INDEX "care_formal_follow_up_tasks_assignee_idx"
  ON "public"."care_formal_follow_up_tasks"
  ("tenant_id","institution_id","assignee_kind","assignee_user_id","assignee_role");

CREATE TABLE "public"."care_formal_follow_up_events" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "task_id" varchar(64) NOT NULL,
  "task_revision" integer NOT NULL,
  "event_type" "public"."care_formal_follow_up_event_type" NOT NULL,
  "actor_id" varchar(96) NOT NULL,
  "actor_role" "public"."auth_role" NOT NULL,
  "from_state" "public"."care_formal_follow_up_state",
  "to_state" "public"."care_formal_follow_up_state",
  "reason_code" varchar(96) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "care_formal_follow_up_events_pk"
    PRIMARY KEY ("tenant_id","institution_id","id"),
  CONSTRAINT "care_formal_follow_up_events_task_fk"
    FOREIGN KEY ("tenant_id","institution_id","task_id")
    REFERENCES "public"."care_formal_follow_up_tasks" ("tenant_id","institution_id","id"),
  CONSTRAINT "care_formal_follow_up_events_task_revision_unique"
    UNIQUE ("tenant_id","institution_id","task_id","task_revision"),
  CONSTRAINT "care_formal_follow_up_events_revision_check"
    CHECK ("task_revision" > 0),
  CONSTRAINT "care_formal_follow_up_events_text_check"
    CHECK (
      length(trim("actor_id")) > 0
      AND length(trim("reason_code")) > 0
      AND "created_at" >= "occurred_at"
    )
);

CREATE INDEX "care_formal_follow_up_events_task_idx"
  ON "public"."care_formal_follow_up_events"
  ("tenant_id","institution_id","task_id","occurred_at");

CREATE FUNCTION "public"."care_formal_follow_up_event_immutable_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'CARE_FORMAL_FOLLOW_UP_EVENT_IMMUTABLE';
END
$function$;

CREATE TRIGGER "care_formal_follow_up_events_immutable_guard_v1"
BEFORE UPDATE OR DELETE ON "public"."care_formal_follow_up_events"
FOR EACH ROW EXECUTE FUNCTION "public"."care_formal_follow_up_event_immutable_guard_v1"();

CREATE FUNCTION "public"."care_formal_follow_up_task_state_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_FORMAL_FOLLOW_UP_TASK_DELETE_FORBIDDEN';
  END IF;

  IF NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."institution_id" IS DISTINCT FROM OLD."institution_id"
    OR NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."customer_id" IS DISTINCT FROM OLD."customer_id"
    OR NEW."customer_display_name" IS DISTINCT FROM OLD."customer_display_name"
    OR NEW."customer_masked_reference" IS DISTINCT FROM OLD."customer_masked_reference"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."request_digest" IS DISTINCT FROM OLD."request_digest"
    OR NEW."source_kind" IS DISTINCT FROM OLD."source_kind"
    OR NEW."created_by" IS DISTINCT FROM OLD."created_by"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_FORMAL_FOLLOW_UP_TASK_ANCHOR_IMMUTABLE';
  END IF;

  IF NEW."revision" <> OLD."revision" + 1 THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_FORMAL_FOLLOW_UP_TASK_REVISION_CAS_REQUIRED';
  END IF;

  IF NEW."updated_at" < OLD."updated_at" THEN
    RAISE EXCEPTION USING MESSAGE = 'CARE_FORMAL_FOLLOW_UP_TASK_TIME_REGRESSION';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER "care_formal_follow_up_tasks_state_guard_v1"
BEFORE UPDATE OR DELETE ON "public"."care_formal_follow_up_tasks"
FOR EACH ROW EXECUTE FUNCTION "public"."care_formal_follow_up_task_state_guard_v1"();
