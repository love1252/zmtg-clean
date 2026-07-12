CREATE TYPE "public"."wecom_real_send_proof_operation_status" AS ENUM('requested', 'aborted', 'attempted', 'succeeded', 'failed', 'unknown_outcome');
CREATE TYPE "public"."wecom_real_send_proof_control_scope_kind" AS ENUM('global', 'tenant', 'institution', 'channel', 'customer', 'operator_role');
CREATE TYPE "public"."wecom_real_send_proof_provider_result_category" AS ENUM('accepted', 'rejected', 'transport_error', 'timeout', 'indeterminate');
CREATE TYPE "public"."wecom_real_send_proof_postcheck_status" AS ENUM('ready', 'blocked', 'expired');

CREATE TABLE IF NOT EXISTS "wecom_real_send_production_attestations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "environment_ref" varchar(96) NOT NULL,
  "database_identity_ref" varchar(96) NOT NULL,
  "migration_target" varchar(128) NOT NULL,
  "migration_hash" varchar(64) NOT NULL,
  "journal_latest" varchar(128) NOT NULL,
  "postcheck_status" "wecom_real_send_proof_postcheck_status" NOT NULL,
  "approval_ref" varchar(96) NOT NULL,
  "reviewed_by" varchar(96) NOT NULL,
  "attested_by" varchar(96) NOT NULL,
  "attested_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_real_send_production_attestations_identity_unique" UNIQUE("environment_ref", "database_identity_ref", "migration_target"),
  CONSTRAINT "wecom_real_send_production_attestations_expiry_check" CHECK ("expires_at" > "attested_at"),
  CONSTRAINT "wecom_real_send_production_attestations_hash_check" CHECK (length("migration_hash") = 64),
  CONSTRAINT "wecom_real_send_production_attestations_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE IF NOT EXISTS "wecom_real_send_proof_controls" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64),
  "institution_id" varchar(64),
  "customer_id" varchar(64),
  "channel_type" "customer_channel_type",
  "operator_id" varchar(96),
  "role" "auth_role",
  "scope_kind" "wecom_real_send_proof_control_scope_kind" NOT NULL,
  "proof_enabled" boolean DEFAULT false NOT NULL,
  "kill_switch_engaged" boolean DEFAULT true NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "approval_ref" varchar(96) NOT NULL,
  "approved_by" varchar(96) NOT NULL,
  "updated_by" varchar(96) NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_real_send_proof_controls_scope_identity_unique" UNIQUE NULLS NOT DISTINCT("scope_kind", "tenant_id", "institution_id", "customer_id", "channel_type", "operator_id", "role"),
  CONSTRAINT "wecom_real_send_proof_controls_timing_check" CHECK ("expires_at" > "effective_at"),
  CONSTRAINT "wecom_real_send_proof_controls_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "wecom_real_send_proof_controls_scope_shape_check" CHECK (("scope_kind" = 'global' AND "tenant_id" IS NULL AND "institution_id" IS NULL AND "customer_id" IS NULL AND "channel_type" IS NULL AND "operator_id" IS NULL AND "role" IS NULL) OR ("scope_kind" = 'tenant' AND "tenant_id" IS NOT NULL AND "institution_id" IS NULL AND "customer_id" IS NULL AND "channel_type" IS NULL AND "operator_id" IS NULL AND "role" IS NULL) OR ("scope_kind" = 'institution' AND "tenant_id" IS NOT NULL AND "institution_id" IS NOT NULL AND "customer_id" IS NULL AND "channel_type" IS NULL AND "operator_id" IS NULL AND "role" IS NULL) OR ("scope_kind" = 'channel' AND "tenant_id" IS NULL AND "institution_id" IS NULL AND "customer_id" IS NULL AND "channel_type" IS NOT NULL AND "channel_type" = 'wechat_work' AND "operator_id" IS NULL AND "role" IS NULL) OR ("scope_kind" = 'customer' AND "tenant_id" IS NOT NULL AND "institution_id" IS NOT NULL AND "customer_id" IS NOT NULL AND "channel_type" IS NULL AND "operator_id" IS NULL AND "role" IS NULL) OR ("scope_kind" = 'operator_role' AND "tenant_id" IS NOT NULL AND "institution_id" IS NOT NULL AND "customer_id" IS NULL AND "channel_type" IS NULL AND "operator_id" IS NOT NULL AND "role" IS NOT NULL)),
  CONSTRAINT "wecom_real_send_proof_controls_operator_self_approval_check" CHECK ("scope_kind" <> 'operator_role' OR "approved_by" <> "operator_id")
);

ALTER TABLE "wecom_customer_mapping_states" ADD CONSTRAINT "wecom_customer_mapping_states_scope_customer_id_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "id");
ALTER TABLE "customer_channel_contact_consents" ADD CONSTRAINT "customer_channel_contact_consents_scope_id_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "channel_type", "id");
ALTER TABLE "customer_channel_frequency_states" ADD CONSTRAINT "customer_channel_frequency_states_scope_id_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "channel_type", "id");
ALTER TABLE "institution_channel_dry_run_snapshots" ADD CONSTRAINT "institution_channel_dry_run_snapshots_scope_id_unique" UNIQUE("tenant_id", "institution_id", "channel_type", "id");
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_id_id_unique" UNIQUE("tenant_id", "id");
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_scope_customer_id_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "id");

CREATE TABLE IF NOT EXISTS "wecom_real_send_proof_operations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "channel_type" "customer_channel_type" DEFAULT 'wechat_work' NOT NULL,
  "draft_id" varchar(64) NOT NULL,
  "delivery_id" varchar(96) NOT NULL,
  "source_ready_no_send_ref" varchar(128) NOT NULL,
  "source_ready_no_send_digest" varchar(64) NOT NULL,
  "readiness_fingerprint" varchar(64) NOT NULL,
  "mapping_id" varchar(64) NOT NULL,
  "consent_id" varchar(64) NOT NULL,
  "frequency_state_id" varchar(64) NOT NULL,
  "dry_run_snapshot_id" varchar(64) NOT NULL,
  "production_attestation_id" varchar(64) NOT NULL,
  "operation_ref" varchar(96) NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "recipient_binding_ref" varchar(96) NOT NULL,
  "recipient_binding_digest" varchar(64) NOT NULL,
  "status" "wecom_real_send_proof_operation_status" DEFAULT 'requested' NOT NULL,
  "confirmation_token_digest" varchar(64) NOT NULL,
  "confirmation_issued_at" timestamp with time zone NOT NULL,
  "confirmation_expires_at" timestamp with time zone NOT NULL,
  "confirmation_consumed_at" timestamp with time zone,
  "operator_id" varchar(96) NOT NULL,
  "session_provenance" varchar(32) NOT NULL,
  "requested_at" timestamp with time zone NOT NULL,
  "attempted_at" timestamp with time zone,
  "terminal_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "provider_result_category" "wecom_real_send_proof_provider_result_category",
  "completed_frequency_ref" varchar(96),
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_real_send_proof_operations_operation_ref_unique" UNIQUE("operation_ref"),
  CONSTRAINT "wecom_real_send_proof_operations_token_digest_unique" UNIQUE("confirmation_token_digest"),
  CONSTRAINT "wecom_real_send_proof_operations_source_unique" UNIQUE("tenant_id", "institution_id", "draft_id", "source_ready_no_send_ref"),
  CONSTRAINT "wecom_real_send_proof_operations_attempt_count_check" CHECK ("attempt_count" BETWEEN 0 AND 1),
  CONSTRAINT "wecom_real_send_proof_operations_token_timing_check" CHECK ("confirmation_expires_at" > "confirmation_issued_at" AND ("confirmation_consumed_at" IS NULL OR ("confirmation_consumed_at" > "confirmation_issued_at" AND "confirmation_consumed_at" < "confirmation_expires_at"))),
  CONSTRAINT "wecom_real_send_proof_operations_consumed_operator_check" CHECK ("confirmation_consumed_at" IS NULL OR "operator_id" IS NOT NULL),
  CONSTRAINT "wecom_real_send_proof_operations_session_provenance_check" CHECK ("session_provenance" IN ('server_session', 'formal_session')),
  CONSTRAINT "wecom_real_send_proof_operations_attempted_check" CHECK ("status" NOT IN ('attempted', 'succeeded', 'failed', 'unknown_outcome') OR ("attempted_at" IS NOT NULL AND "confirmation_consumed_at" IS NOT NULL AND "attempt_count" = 1)),
  CONSTRAINT "wecom_real_send_proof_operations_terminal_check" CHECK (("status" IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND "terminal_at" IS NOT NULL) OR ("status" NOT IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND "terminal_at" IS NULL)),
  CONSTRAINT "wecom_real_send_proof_operations_status_shape_check" CHECK (("status" = 'requested' AND "confirmation_consumed_at" IS NULL AND "attempted_at" IS NULL AND "terminal_at" IS NULL AND "attempt_count" = 0) OR ("status" = 'aborted' AND "confirmation_consumed_at" IS NULL AND "attempted_at" IS NULL AND "terminal_at" IS NOT NULL AND "attempt_count" = 0) OR ("status" = 'attempted' AND "confirmation_consumed_at" IS NOT NULL AND "attempted_at" IS NOT NULL AND "terminal_at" IS NULL AND "attempt_count" = 1) OR ("status" IN ('succeeded', 'failed', 'unknown_outcome') AND "confirmation_consumed_at" IS NOT NULL AND "attempted_at" IS NOT NULL AND "terminal_at" IS NOT NULL AND "attempt_count" = 1)),
  CONSTRAINT "wecom_real_send_proof_operations_completed_frequency_check" CHECK (("status" = 'succeeded' AND "completed_frequency_ref" IS NOT NULL AND "completed_frequency_ref" = "operation_ref") OR ("status" <> 'succeeded' AND "completed_frequency_ref" IS NULL)),
  CONSTRAINT "wecom_real_send_proof_operations_provider_result_check" CHECK (("status" = 'succeeded' AND "provider_result_category" IS NOT NULL AND "provider_result_category" = 'accepted') OR ("status" = 'failed' AND "provider_result_category" IS NOT NULL AND "provider_result_category" = 'rejected') OR ("status" = 'unknown_outcome' AND "provider_result_category" IS NOT NULL AND "provider_result_category" IN ('transport_error', 'timeout', 'indeterminate')) OR ("status" IN ('requested', 'aborted', 'attempted') AND "provider_result_category" IS NULL)),
  CONSTRAINT "wecom_real_send_proof_operations_digest_lengths_check" CHECK (length("source_ready_no_send_digest") = 64 AND length("readiness_fingerprint") = 64 AND length("content_hash") = 64 AND length("recipient_binding_digest") = 64 AND length("confirmation_token_digest") = 64),
  CONSTRAINT "wecom_real_send_proof_operations_version_positive_check" CHECK ("version" > 0)
);

DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_controls" ADD CONSTRAINT "wecom_real_send_proof_controls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_controls" ADD CONSTRAINT "wecom_real_send_proof_controls_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id") REFERENCES "public"."customers"("tenant_id", "institution_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id") REFERENCES "public"."customers"("tenant_id", "institution_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_draft_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "draft_id") REFERENCES "public"."follow_up_message_drafts"("tenant_id", "institution_id", "customer_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_mapping_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "mapping_id") REFERENCES "public"."wecom_customer_mapping_states"("tenant_id", "institution_id", "customer_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_consent_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "channel_type", "consent_id") REFERENCES "public"."customer_channel_contact_consents"("tenant_id", "institution_id", "customer_id", "channel_type", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_frequency_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id", "channel_type", "frequency_state_id") REFERENCES "public"."customer_channel_frequency_states"("tenant_id", "institution_id", "customer_id", "channel_type", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_dry_run_snapshot_fk" FOREIGN KEY ("tenant_id", "institution_id", "channel_type", "dry_run_snapshot_id") REFERENCES "public"."institution_channel_dry_run_snapshots"("tenant_id", "institution_id", "channel_type", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_production_attestation_fk" FOREIGN KEY ("production_attestation_id") REFERENCES "public"."wecom_real_send_production_attestations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX "wecom_real_send_production_attestations_status_expires_idx" ON "wecom_real_send_production_attestations" USING btree ("postcheck_status", "expires_at");
CREATE INDEX "wecom_real_send_proof_controls_scope_expires_idx" ON "wecom_real_send_proof_controls" USING btree ("scope_kind", "expires_at");
CREATE INDEX "wecom_real_send_proof_operations_tenant_status_idx" ON "wecom_real_send_proof_operations" USING btree ("tenant_id", "institution_id", "status");
