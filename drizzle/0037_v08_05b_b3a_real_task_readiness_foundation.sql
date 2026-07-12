CREATE TYPE "public"."auth_institution_binding_status" AS ENUM('active', 'revoked');
CREATE TYPE "public"."auth_institution_binding_source" AS ENUM('manual_admin', 'migration_placeholder', 'system');
CREATE TYPE "public"."wecom_customer_broadcast_task_dispatch_state" AS ENUM('not_started', 'task_create_attempted', 'task_created', 'task_create_failed', 'task_create_unknown');
CREATE TYPE "public"."wecom_customer_broadcast_task_send_result_status" AS ENUM('not_checked', 'awaiting_member_confirmation', 'target_sent', 'target_failed', 'target_unknown');
CREATE TYPE "public"."wecom_customer_broadcast_task_finalize_state" AS ENUM('not_finalized', 'success_recorded', 'failure_recorded', 'unknown_recorded');
CREATE TYPE "public"."wecom_customer_broadcast_task_reconciliation_state" AS ENUM('none', 'manual_review_required', 'reconciled');
CREATE TYPE "public"."wecom_customer_broadcast_recipient_binding_source_kind" AS ENUM('protected_vault_reference', 'protected_resolver_reference');
CREATE TYPE "public"."wecom_customer_broadcast_recipient_binding_status" AS ENUM('active', 'revoked', 'stale');

CREATE TABLE IF NOT EXISTS "auth_account_institution_bindings" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "account_id" varchar(96) NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "status" "auth_institution_binding_status" DEFAULT 'active' NOT NULL,
  "source" "auth_institution_binding_source" NOT NULL,
  "assigned_by" varchar(96) NOT NULL,
  "assigned_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_account_institution_bindings_status_shape_check" CHECK (("status" = 'active' AND "revoked_at" IS NULL AND "institution_id" IS NOT NULL) OR ("status" = 'revoked' AND "revoked_at" IS NOT NULL AND "institution_id" IS NOT NULL AND "revoked_at" >= "assigned_at")),
  CONSTRAINT "auth_account_institution_bindings_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "assigned_at"),
  CONSTRAINT "auth_account_institution_bindings_source_authority_check" CHECK ("status" <> 'active' OR "source" IN ('manual_admin', 'system')),
  CONSTRAINT "auth_account_institution_bindings_version_positive_check" CHECK ("version" > 0)
);

ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_ref_id_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "operation_ref", "id");

CREATE TABLE IF NOT EXISTS "wecom_customer_broadcast_task_provider_attempts" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "operation_id" varchar(64) NOT NULL,
  "operation_ref" varchar(96) NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "capability_kind" varchar(64) DEFAULT 'customer_broadcast_task' NOT NULL,
  "provider_kind" varchar(64) DEFAULT 'wecom_official_customer_broadcast' NOT NULL,
  "dispatch_state" "wecom_customer_broadcast_task_dispatch_state" DEFAULT 'not_started' NOT NULL,
  "dispatch_count" integer DEFAULT 0 NOT NULL,
  "dispatch_started_at" timestamp with time zone,
  "dispatch_terminal_at" timestamp with time zone,
  "task_ref_digest" varchar(64),
  "member_confirmation_required" boolean DEFAULT true NOT NULL,
  "provider_result_category" "wecom_real_send_proof_provider_result_category",
  "send_result_status" "wecom_customer_broadcast_task_send_result_status" DEFAULT 'not_checked' NOT NULL,
  "send_result_checked_at" timestamp with time zone,
  "finalize_state" "wecom_customer_broadcast_task_finalize_state" DEFAULT 'not_finalized' NOT NULL,
  "reconciliation_state" "wecom_customer_broadcast_task_reconciliation_state" DEFAULT 'none' NOT NULL,
  "manual_review_required" boolean DEFAULT false NOT NULL,
  "automatic_retry_allowed" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_operation_unique" UNIQUE("operation_id"),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_capability_check" CHECK ("capability_kind" = 'customer_broadcast_task' AND "provider_kind" = 'wecom_official_customer_broadcast' AND "member_confirmation_required" = true),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_dispatch_once_check" CHECK ("dispatch_count" BETWEEN 0 AND 1 AND (("dispatch_state" = 'not_started' AND "dispatch_count" = 0) OR ("dispatch_state" <> 'not_started' AND "dispatch_count" = 1))),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_dispatch_timing_check" CHECK (("dispatch_state" = 'not_started' AND "dispatch_started_at" IS NULL AND "dispatch_terminal_at" IS NULL) OR ("dispatch_state" = 'task_create_attempted' AND "dispatch_started_at" IS NOT NULL AND "dispatch_terminal_at" IS NULL) OR ("dispatch_state" IN ('task_created', 'task_create_failed', 'task_create_unknown') AND "dispatch_started_at" IS NOT NULL AND "dispatch_terminal_at" IS NOT NULL AND "dispatch_terminal_at" >= "dispatch_started_at")),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_task_ref_digest_check" CHECK (("task_ref_digest" IS NULL OR (length("task_ref_digest") = 64 AND "task_ref_digest" ~ '^[0-9a-f]{64}$')) AND ("dispatch_state" <> 'task_created' OR "task_ref_digest" IS NOT NULL)),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_provider_result_check" CHECK (("dispatch_state" IN ('not_started', 'task_create_attempted') AND "provider_result_category" IS NULL) OR ("dispatch_state" = 'task_created' AND "provider_result_category" = 'accepted') OR ("dispatch_state" = 'task_create_failed' AND "provider_result_category" = 'rejected') OR ("dispatch_state" = 'task_create_unknown' AND "provider_result_category" IN ('transport_error', 'timeout', 'indeterminate'))),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_send_result_check" CHECK (("send_result_status" = 'not_checked' OR "dispatch_state" = 'task_created') AND (("send_result_status" IN ('not_checked', 'awaiting_member_confirmation') AND "send_result_checked_at" IS NULL) OR ("send_result_status" IN ('target_sent', 'target_failed', 'target_unknown') AND "send_result_checked_at" IS NOT NULL AND "dispatch_terminal_at" IS NOT NULL AND "send_result_checked_at" >= "dispatch_terminal_at"))),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_finalize_candidate_check" CHECK ("finalize_state" = 'not_finalized' OR ("finalize_state" = 'success_recorded' AND "send_result_status" = 'target_sent') OR ("finalize_state" = 'failure_recorded' AND ("dispatch_state" = 'task_create_failed' OR "send_result_status" = 'target_failed')) OR ("finalize_state" = 'unknown_recorded' AND ("dispatch_state" = 'task_create_unknown' OR "send_result_status" = 'target_unknown'))),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_reconciliation_check" CHECK (("reconciliation_state" = 'manual_review_required' AND "manual_review_required" = true) OR ("reconciliation_state" IN ('none', 'reconciled') AND "manual_review_required" = false)),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_unknown_review_check" CHECK ("automatic_retry_allowed" = false AND (("dispatch_state" <> 'task_create_unknown' AND "send_result_status" <> 'target_unknown') OR "reconciliation_state" IN ('manual_review_required', 'reconciled'))),
  CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE IF NOT EXISTS "wecom_customer_broadcast_recipient_bindings" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "operation_id" varchar(64) NOT NULL,
  "operation_ref" varchar(96) NOT NULL,
  "mapping_id" varchar(64) NOT NULL,
  "recipient_binding_ref" varchar(96) NOT NULL,
  "recipient_binding_digest" varchar(64) NOT NULL,
  "recipient_binding_version" integer NOT NULL,
  "opaque_handle_ref" varchar(128) NOT NULL,
  "source_kind" "wecom_customer_broadcast_recipient_binding_source_kind" NOT NULL,
  "status" "wecom_customer_broadcast_recipient_binding_status" DEFAULT 'active' NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_customer_broadcast_recipient_bindings_scope_ref_unique" UNIQUE("tenant_id", "institution_id", "recipient_binding_ref"),
  CONSTRAINT "wecom_customer_broadcast_recipient_bindings_digest_length_check" CHECK (length("recipient_binding_digest") = 64 AND "recipient_binding_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "wecom_customer_broadcast_recipient_bindings_version_positive_check" CHECK ("recipient_binding_version" > 0),
  CONSTRAINT "wecom_customer_broadcast_recipient_bindings_reference_check" CHECK (length(trim("recipient_binding_ref")) > 0 AND length(trim("opaque_handle_ref")) > 0),
  CONSTRAINT "wecom_customer_broadcast_recipient_bindings_status_shape_check" CHECK (("status" = 'active' AND "revoked_at" IS NULL) OR ("status" IN ('revoked', 'stale') AND "revoked_at" IS NOT NULL AND "revoked_at" >= "created_at"))
);

DO $$ BEGIN
  ALTER TABLE "auth_account_institution_bindings" ADD CONSTRAINT "auth_account_institution_bindings_tenant_account_fk" FOREIGN KEY ("tenant_id", "account_id") REFERENCES "public"."tenant_members"("tenant_id", "user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_customer_broadcast_task_provider_attempts" ADD CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_operation_scope_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "operation_ref", "operation_id") REFERENCES "public"."wecom_real_send_proof_operations"("tenant_id", "institution_id", "customer_id", "operation_ref", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_customer_broadcast_recipient_bindings" ADD CONSTRAINT "wecom_customer_broadcast_recipient_bindings_operation_scope_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "operation_ref", "operation_id") REFERENCES "public"."wecom_real_send_proof_operations"("tenant_id", "institution_id", "customer_id", "operation_ref", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_customer_broadcast_recipient_bindings" ADD CONSTRAINT "wecom_customer_broadcast_recipient_bindings_mapping_scope_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "mapping_id") REFERENCES "public"."wecom_customer_mapping_states"("tenant_id", "institution_id", "customer_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX "auth_account_institution_bindings_active_account_tenant_unique_idx" ON "auth_account_institution_bindings" USING btree ("account_id", "tenant_id") WHERE "status" = 'active';
CREATE INDEX "auth_account_institution_bindings_account_tenant_status_idx" ON "auth_account_institution_bindings" USING btree ("account_id", "tenant_id", "status");
CREATE INDEX "wecom_customer_broadcast_task_provider_attempts_scope_dispatch_idx" ON "wecom_customer_broadcast_task_provider_attempts" USING btree ("tenant_id", "institution_id", "dispatch_state");
CREATE UNIQUE INDEX "wecom_customer_broadcast_recipient_bindings_active_operation_unique_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("tenant_id", "institution_id", "customer_id", "operation_ref") WHERE "status" = 'active';
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_scope_status_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("tenant_id", "institution_id", "customer_id", "status");
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_operation_id_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("operation_id");
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_mapping_id_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("mapping_id");
