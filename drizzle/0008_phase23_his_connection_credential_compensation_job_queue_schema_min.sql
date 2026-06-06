CREATE TYPE "public"."his_connection_credential_compensation_dead_letter_reason" AS ENUM('retry_exhausted', 'claim_conflict', 'stale_recovery_conflict', 'provider_result_unknown', 'audit_write_unavailable', 'operation_state_conflict', 'unsafe_payload_summary');--> statement-breakpoint
CREATE TYPE "public"."his_connection_credential_compensation_job_state" AS ENUM('queued', 'claimed', 'running', 'succeeded', 'failed', 'dead_lettered', 'manual_review_required', 'cancelled');--> statement-breakpoint
CREATE TABLE "his_connection_credential_compensation_jobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_id" varchar(64) NOT NULL,
	"operation_id" varchar(96) NOT NULL,
	"operation_type" "his_connection_credential_compensation_operation_type" DEFAULT 'credential_compensation' NOT NULL,
	"job_state" "his_connection_credential_compensation_job_state" DEFAULT 'queued' NOT NULL,
	"failure_category" "his_connection_credential_provider_failure_category" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retry_count" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"claim_id" varchar(96),
	"claim_version" integer DEFAULT 0 NOT NULL,
	"claimed_by" varchar(96),
	"claimed_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"dead_letter_reason" "his_connection_credential_compensation_dead_letter_reason",
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."his_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_operation_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."his_connection_credential_compensation_operations"("operation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "his_conn_cred_comp_jobs_operation_id_unique_idx" ON "his_connection_credential_compensation_jobs" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "his_conn_cred_comp_jobs_tenant_connection_operation_idx" ON "his_connection_credential_compensation_jobs" USING btree ("tenant_id","connection_id","operation_id");--> statement-breakpoint
CREATE INDEX "his_conn_cred_comp_jobs_tenant_state_next_attempt_idx" ON "his_connection_credential_compensation_jobs" USING btree ("tenant_id","job_state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "his_conn_cred_comp_jobs_lock_idx" ON "his_connection_credential_compensation_jobs" USING btree ("job_state","locked_until","claim_version");