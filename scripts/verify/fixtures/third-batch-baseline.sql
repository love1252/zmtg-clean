-- 仅用于本任务新建的空隔离库。源于 c6b51102 的相关七张表，不是生产迁移链。
CREATE TYPE "public"."appointment_status" AS ENUM('pending_confirmation', 'confirmed', 'arrived', 'completed', 'reschedule_requested', 'cancelled');
CREATE TYPE "public"."audit_institution_attribution" AS ENUM('not_applicable', 'verified', 'legacy_unattributed');
CREATE TYPE "public"."audit_result" AS ENUM('allowed', 'denied', 'transitioned');
CREATE TYPE "public"."auth_role" AS ENUM('tenant_admin', 'tenant_operator', 'consultant', 'customer_service', 'platform_admin', 'platform_operator', 'security_auditor');
CREATE TYPE "public"."care_formal_follow_up_assignment_kind" AS ENUM('user', 'role_pool');
CREATE TYPE "public"."care_formal_follow_up_cancellation_reason" AS ENUM('created_in_error', 'duplicate_task', 'source_invalidated', 'superseded', 'customer_requested_stop');
CREATE TYPE "public"."care_formal_follow_up_completion_code" AS ENUM('contact_completed', 'no_response_closed', 'his_appointment_linked', 'customer_declined', 'invalid_or_duplicate');
CREATE TYPE "public"."care_formal_follow_up_event_type" AS ENUM('created', 'claimed', 'reassigned', 'unclaimed', 'state_changed', 'risk_escalated', 'completed', 'cancelled');
CREATE TYPE "public"."care_formal_follow_up_risk_kind" AS ENUM('clinical', 'complaint', 'refund_dispute', 'privacy_request', 'opt_out');
CREATE TYPE "public"."care_formal_follow_up_risk_level" AS ENUM('none', 'high');
CREATE TYPE "public"."care_formal_follow_up_source_kind" AS ENUM('manual_controlled_create');
CREATE TYPE "public"."care_formal_follow_up_state" AS ENUM('pending', 'in_progress', 'waiting_customer', 'escalated', 'completed', 'cancelled');
CREATE TYPE "public"."customer_lifecycle" AS ENUM('consulting', 'scheduled', 'post_care', 'repurchase_window', 'silent_reactivation');
CREATE TYPE "public"."customer_priority" AS ENUM('high', 'medium', 'observe');
CREATE TYPE "public"."institution_provisioning_source" AS ENUM('formal_onboarding', 'approved_migration_manifest');
CREATE TYPE "public"."institution_scope_status" AS ENUM('active', 'suspended');
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'trialing', 'expired');
CREATE TABLE "appointments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"project" varchar(160) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"consultant_user_id" varchar(96) NOT NULL,
	"status" "appointment_status" NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
CREATE TABLE "audit_events" (
	"event_id" varchar(96) PRIMARY KEY NOT NULL,
	"actor_id" varchar(96) NOT NULL,
	"actor_role" "auth_role" NOT NULL,
	"tenant_id" varchar(64),
	"institution_id" varchar(64),
	"institution_attribution" "audit_institution_attribution",
	"scope" varchar(24) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"resource_id" varchar(96),
	"action" varchar(64) NOT NULL,
	"result" "audit_result" NOT NULL,
	"reason" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" varchar(48) NOT NULL
);
CREATE TABLE "care_formal_follow_up_events" (
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"id" varchar(64) NOT NULL,
	"task_id" varchar(64) NOT NULL,
	"task_revision" integer NOT NULL,
	"event_type" "care_formal_follow_up_event_type" NOT NULL,
	"actor_id" varchar(96) NOT NULL,
	"actor_role" "auth_role" NOT NULL,
	"from_state" "care_formal_follow_up_state",
	"to_state" "care_formal_follow_up_state",
	"reason_code" varchar(96) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_formal_follow_up_events_pk" PRIMARY KEY("tenant_id","institution_id","id"),
	CONSTRAINT "care_formal_follow_up_events_task_revision_unique" UNIQUE("tenant_id","institution_id","task_id","task_revision"),
	CONSTRAINT "care_formal_follow_up_events_revision_check" CHECK ("care_formal_follow_up_events"."task_revision" > 0),
	CONSTRAINT "care_formal_follow_up_events_text_check" CHECK (length(trim("care_formal_follow_up_events"."actor_id")) > 0
        AND length(trim("care_formal_follow_up_events"."reason_code")) > 0
        AND "care_formal_follow_up_events"."created_at" >= "care_formal_follow_up_events"."occurred_at")
);
CREATE TABLE "care_formal_follow_up_tasks" (
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"customer_masked_reference" varchar(160),
	"stage_code" varchar(64) NOT NULL,
	"action_code" varchar(64) NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"state" "care_formal_follow_up_state" DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"risk_level" "care_formal_follow_up_risk_level" DEFAULT 'none' NOT NULL,
	"risk_kind" "care_formal_follow_up_risk_kind",
	"risk_event_id" varchar(128),
	"completion_code" "care_formal_follow_up_completion_code",
	"completion_feedback" varchar(240),
	"cancellation_reason" "care_formal_follow_up_cancellation_reason",
	"assignee_kind" "care_formal_follow_up_assignment_kind" NOT NULL,
	"assignee_user_id" varchar(96),
	"assignee_display_name" varchar(120),
	"assignee_role" "auth_role",
	"claimed_from_role_pool" "auth_role",
	"idempotency_key" varchar(128) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"source_kind" "care_formal_follow_up_source_kind" DEFAULT 'manual_controlled_create' NOT NULL,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_formal_follow_up_tasks_pk" PRIMARY KEY("tenant_id","institution_id","id"),
	CONSTRAINT "care_formal_follow_up_tasks_idempotency_unique" UNIQUE("tenant_id","institution_id","idempotency_key"),
	CONSTRAINT "care_formal_follow_up_tasks_revision_check" CHECK ("care_formal_follow_up_tasks"."revision" > 0),
	CONSTRAINT "care_formal_follow_up_tasks_request_digest_check" CHECK (length("care_formal_follow_up_tasks"."request_digest") = 64 AND "care_formal_follow_up_tasks"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "care_formal_follow_up_tasks_required_text_check" CHECK (length(trim("care_formal_follow_up_tasks"."customer_display_name")) > 0
        AND length(trim("care_formal_follow_up_tasks"."stage_code")) > 0
        AND length(trim("care_formal_follow_up_tasks"."action_code")) > 0
        AND length(trim("care_formal_follow_up_tasks"."idempotency_key")) > 0
        AND length(trim("care_formal_follow_up_tasks"."created_by")) > 0
        AND length(trim("care_formal_follow_up_tasks"."updated_by")) > 0
        AND "care_formal_follow_up_tasks"."updated_at" >= "care_formal_follow_up_tasks"."created_at"),
	CONSTRAINT "care_formal_follow_up_tasks_assignment_shape_check" CHECK ((
        "care_formal_follow_up_tasks"."assignee_kind" = 'user'
        AND "care_formal_follow_up_tasks"."assignee_user_id" IS NOT NULL
        AND "care_formal_follow_up_tasks"."assignee_display_name" IS NOT NULL
        AND "care_formal_follow_up_tasks"."assignee_role" IS NULL
        AND ("care_formal_follow_up_tasks"."claimed_from_role_pool" IS NULL
          OR "care_formal_follow_up_tasks"."claimed_from_role_pool" IN ('tenant_admin','tenant_operator','consultant','customer_service'))
      ) OR (
        "care_formal_follow_up_tasks"."assignee_kind" = 'role_pool'
        AND "care_formal_follow_up_tasks"."assignee_user_id" IS NULL
        AND "care_formal_follow_up_tasks"."assignee_display_name" IS NULL
        AND "care_formal_follow_up_tasks"."assignee_role" IN ('tenant_admin','tenant_operator','consultant','customer_service')
        AND "care_formal_follow_up_tasks"."claimed_from_role_pool" IS NULL
      )),
	CONSTRAINT "care_formal_follow_up_tasks_state_shape_check" CHECK ((
        "care_formal_follow_up_tasks"."state" IN ('pending','in_progress','waiting_customer')
        AND "care_formal_follow_up_tasks"."risk_level" = 'none'
        AND "care_formal_follow_up_tasks"."risk_kind" IS NULL
        AND "care_formal_follow_up_tasks"."risk_event_id" IS NULL
        AND "care_formal_follow_up_tasks"."completion_code" IS NULL
        AND "care_formal_follow_up_tasks"."completion_feedback" IS NULL
        AND "care_formal_follow_up_tasks"."cancellation_reason" IS NULL
      ) OR (
        "care_formal_follow_up_tasks"."state" = 'escalated'
        AND "care_formal_follow_up_tasks"."risk_level" = 'high'
        AND "care_formal_follow_up_tasks"."risk_kind" IS NOT NULL
        AND "care_formal_follow_up_tasks"."risk_event_id" IS NOT NULL
        AND "care_formal_follow_up_tasks"."completion_code" IS NULL
        AND "care_formal_follow_up_tasks"."completion_feedback" IS NULL
        AND "care_formal_follow_up_tasks"."cancellation_reason" IS NULL
      ) OR (
        "care_formal_follow_up_tasks"."state" = 'completed'
        AND "care_formal_follow_up_tasks"."risk_level" = 'none'
        AND "care_formal_follow_up_tasks"."risk_kind" IS NULL
        AND "care_formal_follow_up_tasks"."risk_event_id" IS NULL
        AND "care_formal_follow_up_tasks"."completion_code" IS NOT NULL
        AND "care_formal_follow_up_tasks"."cancellation_reason" IS NULL
      ) OR (
        "care_formal_follow_up_tasks"."state" = 'cancelled'
        AND "care_formal_follow_up_tasks"."risk_level" = 'none'
        AND "care_formal_follow_up_tasks"."risk_kind" IS NULL
        AND "care_formal_follow_up_tasks"."risk_event_id" IS NULL
        AND "care_formal_follow_up_tasks"."completion_code" IS NULL
        AND "care_formal_follow_up_tasks"."completion_feedback" IS NULL
        AND "care_formal_follow_up_tasks"."cancellation_reason" IS NOT NULL
      ))
);
CREATE TABLE "customers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"display_name" varchar(120) NOT NULL,
	"lifecycle" "customer_lifecycle" NOT NULL,
	"priority" "customer_priority" NOT NULL,
	"owner_user_id" varchar(96) NOT NULL,
	"project_interest" varchar(160) NOT NULL,
	"masked_phone" varchar(32) NOT NULL,
	"masked_medical_record_no" varchar(64) NOT NULL,
	"last_touch_summary" text NOT NULL,
	"next_action" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gender" varchar(20) DEFAULT '' NOT NULL,
	"birth_date" varchar(20) DEFAULT '' NOT NULL,
	"referral_source" varchar(80) DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "customers_tenant_institution_id_id_unique" UNIQUE("tenant_id","institution_id","id")
);
CREATE TABLE "institution_scopes" (
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
	CONSTRAINT "institution_scopes_pk" PRIMARY KEY("tenant_id","institution_id"),
	CONSTRAINT "institution_scopes_revision_positive_check" CHECK ("institution_scopes"."revision" > 0),
	CONSTRAINT "institution_scopes_provisioning_reference_digest_length_check" CHECK (length("institution_scopes"."provisioning_reference_digest") = 64)
);
CREATE TABLE "tenants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "care_formal_follow_up_events" ADD CONSTRAINT "care_formal_follow_up_events_task_fk" FOREIGN KEY ("tenant_id","institution_id","task_id") REFERENCES "public"."care_formal_follow_up_tasks"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "care_formal_follow_up_tasks" ADD CONSTRAINT "care_formal_follow_up_tasks_scope_fk" FOREIGN KEY ("tenant_id","institution_id") REFERENCES "public"."institution_scopes"("tenant_id","institution_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "care_formal_follow_up_tasks" ADD CONSTRAINT "care_formal_follow_up_tasks_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_scopes" ADD CONSTRAINT "institution_scopes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "appointments_tenant_status_idx" ON "appointments" USING btree ("tenant_id","status");
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events" USING btree ("tenant_id","occurred_at");
CREATE INDEX "audit_events_actor_occurred_idx" ON "audit_events" USING btree ("actor_id","occurred_at");
CREATE INDEX "audit_events_tenant_resource_id_occurred_idx" ON "audit_events" USING btree ("tenant_id","resource","resource_id","occurred_at");
CREATE INDEX "care_formal_follow_up_events_task_idx" ON "care_formal_follow_up_events" USING btree ("tenant_id","institution_id","task_id","occurred_at");
CREATE INDEX "care_formal_follow_up_tasks_queue_idx" ON "care_formal_follow_up_tasks" USING btree ("tenant_id","institution_id","state","due_at","id");
CREATE INDEX "care_formal_follow_up_tasks_assignee_idx" ON "care_formal_follow_up_tasks" USING btree ("tenant_id","institution_id","assignee_kind","assignee_user_id","assignee_role");
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");
CREATE INDEX "customers_tenant_priority_idx" ON "customers" USING btree ("tenant_id","priority");
CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('isolated-synthetic-baseline',1788162722000);
