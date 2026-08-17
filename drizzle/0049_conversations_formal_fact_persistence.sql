SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1786900800000;
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.institution_scopes') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_SCOPE_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_CUSTOMERS_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regtype('public.auth_role') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_AUTH_ROLE_MISSING';
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
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_CUSTOMER_SCOPE_UNIQUE_MISSING';
  END IF;

  IF pg_catalog.to_regclass('public.conversation_formal_sources') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversations') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversation_segments') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversation_messages') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversation_assignments') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversation_risks') IS NOT NULL
    OR pg_catalog.to_regclass('public.conversation_message_results') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_formal_source_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_root_identity_state') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_segment_state') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_segment_close_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_segment_resolution_state') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_message_direction') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_message_sender_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_assignment_status') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_assignment_reason_code') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_risk_event_kind') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_risk_domain') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_message_result_stage') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_message_result_status') IS NOT NULL
    OR pg_catalog.to_regtype('public.conversation_message_result_failure_code') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.conversation_formal_immutable_guard_v1()') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.conversation_current_state_guard_v1()') IS NOT NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATIONS_0049_TARGET_OBJECT_ALREADY_EXISTS';
  END IF;
END
$migration$;

CREATE TYPE "public"."conversation_formal_source_kind" AS ENUM (
  'approved_channel_connection',
  'approved_internal_operation'
);

CREATE TYPE "public"."conversation_root_identity_state" AS ENUM (
  'matched',
  'pending_review',
  'unmatched',
  'conflict'
);

CREATE TYPE "public"."conversation_segment_state" AS ENUM (
  'ai_handling',
  'awaiting_human',
  'human_handling',
  'waiting_customer',
  'closed'
);

CREATE TYPE "public"."conversation_segment_close_kind" AS ENUM ('open', 'normal', 'forced');
CREATE TYPE "public"."conversation_segment_resolution_state" AS ENUM ('open', 'resolved');

CREATE TYPE "public"."conversation_message_direction" AS ENUM ('inbound', 'outbound', 'system');
CREATE TYPE "public"."conversation_message_sender_kind" AS ENUM ('customer', 'human', 'ai', 'system');

CREATE TYPE "public"."conversation_assignment_status" AS ENUM (
  'assigned',
  'accepted',
  'rejected',
  'released'
);

CREATE TYPE "public"."conversation_assignment_reason_code" AS ENUM (
  'manual_assign',
  'manual_reassign',
  'manual_fallback',
  'assignee_reject',
  'handler_release'
);

CREATE TYPE "public"."conversation_risk_event_kind" AS ENUM (
  'risk_unconfirmed',
  'risk_confirmed',
  'risk_resolved'
);

CREATE TYPE "public"."conversation_risk_domain" AS ENUM ('clinical', 'non_clinical');

CREATE TYPE "public"."conversation_message_result_stage" AS ENUM (
  'message_transport',
  'provider_acceptance',
  'channel_delivery'
);

CREATE TYPE "public"."conversation_message_result_status" AS ENUM (
  'inbound_received',
  'outbound_created',
  'outbound_submitted',
  'outbound_failed',
  'outbound_skipped',
  'outbound_unknown',
  'provider_accepted',
  'provider_rejected',
  'provider_unknown',
  'delivery_not_reported',
  'channel_delivered',
  'channel_failed',
  'channel_unknown'
);

CREATE TYPE "public"."conversation_message_result_failure_code" AS ENUM (
  'outbound_submission_failed',
  'outbound_submission_skipped',
  'outbound_submission_timeout',
  'outbound_submission_indeterminate',
  'provider_rejected',
  'provider_timeout',
  'provider_unavailable',
  'provider_indeterminate',
  'channel_failed',
  'channel_receipt_timeout',
  'channel_receipt_unavailable',
  'channel_receipt_indeterminate'
);

CREATE TABLE "public"."conversation_formal_sources" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "source_kind" "public"."conversation_formal_source_kind" NOT NULL,
  "source_label" varchar(160) NOT NULL,
  "channel_type" varchar(64) NOT NULL,
  "service_provider_type" varchar(64) NOT NULL,
  "connection_instance_id" varchar(128) NOT NULL,
  "provenance_reference_digest" varchar(64) NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "approved_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_formal_sources_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_formal_sources_scope_fk"
    FOREIGN KEY ("tenant_id", "institution_id")
    REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id"),
  CONSTRAINT "conversation_formal_sources_connection_unique"
    UNIQUE (
      "tenant_id",
      "institution_id",
      "channel_type",
      "service_provider_type",
      "connection_instance_id"
    ),
  CONSTRAINT "conversation_formal_sources_required_check"
    CHECK (
      length(trim("source_label")) > 0
      AND length(trim("channel_type")) > 0
      AND length(trim("service_provider_type")) > 0
      AND length(trim("connection_instance_id")) > 0
      AND length(trim("approved_by")) > 0
    ),
  CONSTRAINT "conversation_formal_sources_digest_check"
    CHECK (
      length("provenance_reference_digest") = 64
      AND "provenance_reference_digest" ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX "conversation_formal_sources_scope_idx"
  ON "public"."conversation_formal_sources" ("tenant_id", "institution_id");

CREATE TABLE "public"."conversations" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "channel_conversation_ref" varchar(128) NOT NULL,
  "customer_id" varchar(64),
  "identity_state" "public"."conversation_root_identity_state" NOT NULL,
  "active_segment_id" varchar(64),
  "latest_customer_inbound_message_id" varchar(64),
  "latest_customer_inbound_at" timestamptz,
  "latest_customer_inbound_revision" integer,
  "last_closed_segment_id" varchar(64),
  "last_segment_closed_at" timestamptz,
  "last_closed_segment_inbound_message_id" varchar(64),
  "last_closed_segment_inbound_at" timestamptz,
  "last_closed_segment_inbound_revision" integer,
  "identity_updated_at" timestamptz NOT NULL,
  "segment_updated_at" timestamptz NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  CONSTRAINT "conversations_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversations_source_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "source_id")
    REFERENCES "public"."conversation_formal_sources" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversations_customer_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "customer_id")
    REFERENCES "public"."customers" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversations_source_channel_ref_unique"
    UNIQUE ("tenant_id", "institution_id", "source_id", "channel_conversation_ref"),
  CONSTRAINT "conversations_required_check"
    CHECK (
      length(trim("channel_conversation_ref")) > 0
      AND "revision" > 0
      AND "updated_at" >= "created_at"
      AND "identity_updated_at" >= "created_at"
      AND "segment_updated_at" >= "created_at"
    ),
  CONSTRAINT "conversations_identity_customer_check"
    CHECK (
      ("identity_state" = 'matched' AND "customer_id" IS NOT NULL)
      OR ("identity_state" <> 'matched' AND "customer_id" IS NULL)
    ),
  CONSTRAINT "conversations_latest_inbound_shape_check"
    CHECK (
      (
        "latest_customer_inbound_message_id" IS NULL
        AND "latest_customer_inbound_at" IS NULL
        AND "latest_customer_inbound_revision" IS NULL
      )
      OR (
        "latest_customer_inbound_message_id" IS NOT NULL
        AND "latest_customer_inbound_at" IS NOT NULL
        AND "latest_customer_inbound_revision" > 0
      )
    ),
  CONSTRAINT "conversations_last_closed_shape_check"
    CHECK (
      (
        "last_closed_segment_id" IS NULL
        AND "last_segment_closed_at" IS NULL
        AND "last_closed_segment_inbound_message_id" IS NULL
        AND "last_closed_segment_inbound_at" IS NULL
        AND "last_closed_segment_inbound_revision" IS NULL
      )
      OR (
        "last_closed_segment_id" IS NOT NULL
        AND "last_segment_closed_at" IS NOT NULL
        AND "last_closed_segment_inbound_message_id" IS NOT NULL
        AND "last_closed_segment_inbound_at" IS NOT NULL
        AND "last_closed_segment_inbound_revision" > 0
      )
    )
);

CREATE INDEX "conversations_queue_idx"
  ON "public"."conversations" ("tenant_id", "institution_id", "updated_at", "id");

CREATE INDEX "conversations_identity_idx"
  ON "public"."conversations" ("tenant_id", "institution_id", "identity_state", "updated_at");

CREATE TABLE "public"."conversation_segments" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "conversation_id" varchar(64) NOT NULL,
  "sequence_no" integer NOT NULL,
  "state" "public"."conversation_segment_state" NOT NULL,
  "current_handler_id" varchar(96),
  "ever_human_handled" boolean NOT NULL DEFAULT false,
  "opened_by_customer_message_id" varchar(64) NOT NULL,
  "opened_at" timestamptz NOT NULL,
  "last_customer_message_id" varchar(64) NOT NULL,
  "last_customer_message_at" timestamptz NOT NULL,
  "latest_inbound_revision" integer NOT NULL,
  "waiting_after_customer_message_id" varchar(64),
  "waiting_after_customer_message_at" timestamptz,
  "waiting_after_inbound_revision" integer,
  "state_changed_at" timestamptz NOT NULL,
  "closed_at" timestamptz,
  "segment_close_kind" "public"."conversation_segment_close_kind" NOT NULL,
  "resolution_state" "public"."conversation_segment_resolution_state" NOT NULL,
  "resolved_at" timestamptz,
  "blocking_reason_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_segments_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_segments_conversation_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "conversation_id")
    REFERENCES "public"."conversations" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_segments_sequence_unique"
    UNIQUE ("tenant_id", "institution_id", "conversation_id", "sequence_no"),
  CONSTRAINT "conversation_segments_target_unique"
    UNIQUE ("tenant_id", "institution_id", "conversation_id", "id"),
  CONSTRAINT "conversation_segments_revision_check"
    CHECK (
      "sequence_no" > 0
      AND "latest_inbound_revision" > 0
      AND "revision" > 0
      AND "updated_at" >= "created_at"
      AND jsonb_typeof("blocking_reason_codes") = 'array'
    ),
  CONSTRAINT "conversation_segments_waiting_shape_check"
    CHECK (
      (
        "waiting_after_customer_message_id" IS NULL
        AND "waiting_after_customer_message_at" IS NULL
        AND "waiting_after_inbound_revision" IS NULL
      )
      OR (
        "waiting_after_customer_message_id" IS NOT NULL
        AND "waiting_after_customer_message_at" IS NOT NULL
        AND "waiting_after_inbound_revision" > 0
      )
    ),
  CONSTRAINT "conversation_segments_close_shape_check"
    CHECK (
      (
        "state" = 'closed'
        AND "closed_at" IS NOT NULL
        AND "segment_close_kind" IN ('normal', 'forced')
      )
      OR (
        "state" <> 'closed'
        AND "closed_at" IS NULL
        AND "segment_close_kind" = 'open'
      )
    ),
  CONSTRAINT "conversation_segments_resolution_shape_check"
    CHECK (
      ("resolution_state" = 'open' AND "resolved_at" IS NULL)
      OR ("resolution_state" = 'resolved' AND "resolved_at" IS NOT NULL)
    )
);

CREATE INDEX "conversation_segments_queue_idx"
  ON "public"."conversation_segments"
  ("tenant_id", "institution_id", "state", "state_changed_at");

CREATE TABLE "public"."conversation_messages" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "id" varchar(64) NOT NULL,
  "conversation_id" varchar(64) NOT NULL,
  "segment_id" varchar(64) NOT NULL,
  "direction" "public"."conversation_message_direction" NOT NULL,
  "sender_kind" "public"."conversation_message_sender_kind" NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "received_at" timestamptz NOT NULL,
  "authorized_content_reference" varchar(128) NOT NULL,
  "safe_summary_code" varchar(64),
  "source_message_ref" varchar(128),
  "idempotency_key" varchar(128),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_messages_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_messages_conversation_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "conversation_id")
    REFERENCES "public"."conversations" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_messages_segment_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "conversation_id", "segment_id")
    REFERENCES "public"."conversation_segments" ("tenant_id", "institution_id", "conversation_id", "id"),
  CONSTRAINT "conversation_messages_source_ref_unique"
    UNIQUE ("tenant_id", "institution_id", "source_message_ref"),
  CONSTRAINT "conversation_messages_idempotency_unique"
    UNIQUE ("tenant_id", "institution_id", "idempotency_key"),
  CONSTRAINT "conversation_messages_timestamp_check"
    CHECK ("received_at" >= "occurred_at"),
  CONSTRAINT "conversation_messages_sender_direction_check"
    CHECK (
      ("direction" = 'inbound' AND "sender_kind" = 'customer')
      OR ("direction" = 'outbound' AND "sender_kind" IN ('human', 'ai'))
      OR ("direction" = 'system' AND "sender_kind" = 'system')
    ),
  CONSTRAINT "conversation_messages_reference_shape_check"
    CHECK (
      "authorized_content_reference" ~ '^content:authorized:ref_[a-f][0-9a-f]{15,63}$'
      AND (
        (
          "direction" = 'inbound'
          AND "source_message_ref" ~ '^source:message:ref_[a-f][0-9a-f]{15,63}$'
          AND "idempotency_key" ~ '^[A-Za-z0-9_-]{16,128}$'
        )
        OR (
          "direction" <> 'inbound'
          AND "source_message_ref" IS NULL
          AND "idempotency_key" IS NULL
        )
      )
    ),
  CONSTRAINT "conversation_messages_safe_summary_check"
    CHECK (
      "safe_summary_code" IS NULL
      OR "safe_summary_code" IN (
        'customer_message_received',
        'human_message_recorded',
        'ai_message_recorded',
        'system_event_recorded'
      )
    )
);

CREATE INDEX "conversation_messages_timeline_idx"
  ON "public"."conversation_messages"
  ("tenant_id", "institution_id", "conversation_id", "occurred_at", "id");

CREATE TABLE "public"."conversation_assignments" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "event_id" varchar(64) NOT NULL,
  "assignment_id" varchar(64) NOT NULL,
  "conversation_id" varchar(64) NOT NULL,
  "segment_id" varchar(64) NOT NULL,
  "revision" integer NOT NULL,
  "status" "public"."conversation_assignment_status" NOT NULL,
  "assignee_user_id" varchar(96) NOT NULL,
  "assignee_role" "public"."auth_role" NOT NULL,
  "actor_user_id" varchar(96) NOT NULL,
  "actor_role" "public"."auth_role" NOT NULL,
  "reason_code" "public"."conversation_assignment_reason_code" NOT NULL,
  "source_segment_state" "public"."conversation_segment_state" NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_assignments_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "event_id"),
  CONSTRAINT "conversation_assignments_segment_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "conversation_id", "segment_id")
    REFERENCES "public"."conversation_segments" ("tenant_id", "institution_id", "conversation_id", "id"),
  CONSTRAINT "conversation_assignments_revision_unique"
    UNIQUE ("tenant_id", "institution_id", "segment_id", "revision"),
  CONSTRAINT "conversation_assignments_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "conversation_assignments_role_check"
    CHECK (
      "assignee_role" IN ('tenant_admin', 'tenant_operator', 'consultant', 'customer_service')
      AND "actor_role" IN ('tenant_admin', 'tenant_operator', 'consultant', 'customer_service')
    ),
  CONSTRAINT "conversation_assignments_required_check"
    CHECK (
      length(trim("assignment_id")) > 0
      AND length(trim("conversation_id")) > 0
      AND length(trim("assignee_user_id")) > 0
      AND length(trim("actor_user_id")) > 0
      AND "idempotency_key" ~ '^idem_[a-f][a-f0-9]{31,63}$'
    )
);

CREATE INDEX "conversation_assignments_segment_idx"
  ON "public"."conversation_assignments"
  ("tenant_id", "institution_id", "segment_id", "revision");

CREATE INDEX "conversation_assignments_idempotency_idx"
  ON "public"."conversation_assignments"
  ("tenant_id", "institution_id", "idempotency_key");

CREATE TABLE "public"."conversation_risks" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "event_id" varchar(64) NOT NULL,
  "risk_id" varchar(64) NOT NULL,
  "conversation_id" varchar(64) NOT NULL,
  "segment_id" varchar(64) NOT NULL,
  "source_message_id" varchar(64) NOT NULL,
  "event_kind" "public"."conversation_risk_event_kind" NOT NULL,
  "risk_domain" "public"."conversation_risk_domain" NOT NULL,
  "risk_code" varchar(64) NOT NULL,
  "actor_id" varchar(96),
  "clinical_closure_reference_id" varchar(128),
  "clinical_closure_verified_at" timestamptz,
  "occurred_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_risks_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "event_id"),
  CONSTRAINT "conversation_risks_segment_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "conversation_id", "segment_id")
    REFERENCES "public"."conversation_segments" ("tenant_id", "institution_id", "conversation_id", "id"),
  CONSTRAINT "conversation_risks_message_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "source_message_id")
    REFERENCES "public"."conversation_messages" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_risks_kind_unique"
    UNIQUE ("tenant_id", "institution_id", "risk_id", "event_kind"),
  CONSTRAINT "conversation_risks_code_check"
    CHECK ("risk_code" ~ '^[a-z][a-z0-9._-]{0,63}$'),
  CONSTRAINT "conversation_risks_event_shape_check"
    CHECK (
      (
        "event_kind" = 'risk_unconfirmed'
        AND "actor_id" IS NULL
        AND "clinical_closure_reference_id" IS NULL
        AND "clinical_closure_verified_at" IS NULL
      )
      OR (
        "event_kind" = 'risk_confirmed'
        AND "actor_id" IS NOT NULL
        AND "clinical_closure_reference_id" IS NULL
        AND "clinical_closure_verified_at" IS NULL
      )
      OR (
        "event_kind" = 'risk_resolved'
        AND "actor_id" IS NOT NULL
        AND (
          (
            "risk_domain" = 'clinical'
            AND "clinical_closure_reference_id" IS NOT NULL
            AND "clinical_closure_verified_at" IS NOT NULL
          )
          OR (
            "risk_domain" = 'non_clinical'
            AND "clinical_closure_reference_id" IS NULL
            AND "clinical_closure_verified_at" IS NULL
          )
        )
      )
    )
);

CREATE INDEX "conversation_risks_segment_idx"
  ON "public"."conversation_risks"
  ("tenant_id", "institution_id", "segment_id", "occurred_at");

CREATE TABLE "public"."conversation_message_results" (
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "result_id" varchar(64) NOT NULL,
  "message_id" varchar(64) NOT NULL,
  "stage" "public"."conversation_message_result_stage" NOT NULL,
  "status" "public"."conversation_message_result_status" NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "attempt_no" integer NOT NULL,
  "dedupe_key" varchar(128) NOT NULL,
  "provider_message_ref" varchar(128),
  "failure_code" "public"."conversation_message_result_failure_code",
  "channel_receipt_reference_id" varchar(128),
  "channel_receipt_verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversation_message_results_pk"
    PRIMARY KEY ("tenant_id", "institution_id", "result_id"),
  CONSTRAINT "conversation_message_results_message_fk"
    FOREIGN KEY ("tenant_id", "institution_id", "message_id")
    REFERENCES "public"."conversation_messages" ("tenant_id", "institution_id", "id"),
  CONSTRAINT "conversation_message_results_dedupe_unique"
    UNIQUE ("tenant_id", "institution_id", "message_id", "dedupe_key"),
  CONSTRAINT "conversation_message_results_attempt_check"
    CHECK ("attempt_no" > 0),
  CONSTRAINT "conversation_message_results_stage_status_check"
    CHECK (
      (
        "stage" = 'message_transport'
        AND "status" IN (
          'inbound_received',
          'outbound_created',
          'outbound_submitted',
          'outbound_failed',
          'outbound_skipped',
          'outbound_unknown'
        )
      )
      OR (
        "stage" = 'provider_acceptance'
        AND "status" IN ('provider_accepted', 'provider_rejected', 'provider_unknown')
      )
      OR (
        "stage" = 'channel_delivery'
        AND "status" IN (
          'delivery_not_reported',
          'channel_delivered',
          'channel_failed',
          'channel_unknown'
        )
      )
    ),
  CONSTRAINT "conversation_message_results_failure_check"
    CHECK (
      ("status" IN (
        'inbound_received',
        'outbound_created',
        'outbound_submitted',
        'provider_accepted',
        'delivery_not_reported',
        'channel_delivered'
      ) AND "failure_code" IS NULL)
      OR ("status" = 'outbound_failed' AND "failure_code" = 'outbound_submission_failed')
      OR ("status" = 'outbound_skipped' AND "failure_code" = 'outbound_submission_skipped')
      OR (
        "status" = 'outbound_unknown'
        AND "failure_code" IN (
          'outbound_submission_timeout',
          'outbound_submission_indeterminate'
        )
      )
      OR ("status" = 'provider_rejected' AND "failure_code" = 'provider_rejected')
      OR (
        "status" = 'provider_unknown'
        AND "failure_code" IN (
          'provider_timeout',
          'provider_unavailable',
          'provider_indeterminate'
        )
      )
      OR ("status" = 'channel_failed' AND "failure_code" = 'channel_failed')
      OR (
        "status" = 'channel_unknown'
        AND "failure_code" IN (
          'channel_receipt_timeout',
          'channel_receipt_unavailable',
          'channel_receipt_indeterminate'
        )
      )
    ),
  CONSTRAINT "conversation_message_results_provider_ref_check"
    CHECK (
      "provider_message_ref" IS NULL
      OR "provider_message_ref" ~ '^provider:message:ref_[a-f][0-9a-f]{15,63}$'
    ),
  CONSTRAINT "conversation_message_results_receipt_check"
    CHECK (
      (
        "status" = 'channel_delivered'
        AND "channel_receipt_reference_id" ~ '^channel:receipt:ref_[a-f][0-9a-f]{15,63}$'
        AND "channel_receipt_verified_at" IS NOT NULL
      )
      OR (
        "status" <> 'channel_delivered'
        AND "channel_receipt_reference_id" IS NULL
        AND "channel_receipt_verified_at" IS NULL
      )
    )
);

CREATE INDEX "conversation_message_results_message_idx"
  ON "public"."conversation_message_results"
  ("tenant_id", "institution_id", "message_id", "attempt_no", "occurred_at");

CREATE FUNCTION "public"."conversation_formal_immutable_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'CONVERSATION_FORMAL_FACT_IMMUTABLE';
END
$function$;

CREATE FUNCTION "public"."conversation_current_state_guard_v1"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATION_CURRENT_STATE_DELETE_FORBIDDEN';
  END IF;

  IF NEW."revision" <> OLD."revision" + 1
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."institution_id" IS DISTINCT FROM OLD."institution_id"
    OR NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATION_CURRENT_STATE_REVISION_GUARD';
  END IF;

  IF TG_TABLE_NAME = 'conversations' AND (
    NEW."source_id" IS DISTINCT FROM OLD."source_id"
    OR NEW."channel_conversation_ref" IS DISTINCT FROM OLD."channel_conversation_ref"
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATION_ROOT_IDENTITY_IMMUTABLE';
  END IF;

  IF TG_TABLE_NAME = 'conversation_segments' AND (
    NEW."conversation_id" IS DISTINCT FROM OLD."conversation_id"
    OR NEW."sequence_no" IS DISTINCT FROM OLD."sequence_no"
    OR NEW."opened_by_customer_message_id" IS DISTINCT FROM OLD."opened_by_customer_message_id"
    OR NEW."opened_at" IS DISTINCT FROM OLD."opened_at"
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'CONVERSATION_SEGMENT_IDENTITY_IMMUTABLE';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER "conversation_sources_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_formal_sources"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_formal_immutable_guard_v1"();

CREATE TRIGGER "conversation_messages_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_messages"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_formal_immutable_guard_v1"();

CREATE TRIGGER "conversation_assignments_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_assignments"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_formal_immutable_guard_v1"();

CREATE TRIGGER "conversation_risks_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_risks"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_formal_immutable_guard_v1"();

CREATE TRIGGER "conversation_message_results_immutable_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_message_results"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_formal_immutable_guard_v1"();

CREATE TRIGGER "conversations_current_state_guard"
BEFORE UPDATE OR DELETE ON "public"."conversations"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_current_state_guard_v1"();

CREATE TRIGGER "conversation_segments_current_state_guard"
BEFORE UPDATE OR DELETE ON "public"."conversation_segments"
FOR EACH ROW EXECUTE FUNCTION "public"."conversation_current_state_guard_v1"();
