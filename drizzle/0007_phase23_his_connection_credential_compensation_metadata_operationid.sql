CREATE TYPE "public"."his_connection_credential_compensation_operation_type" AS ENUM('credential_compensation');--> statement-breakpoint
CREATE TYPE "public"."his_connection_credential_compensation_state" AS ENUM('compensation_pending', 'compensation_running', 'compensation_succeeded', 'compensation_failed', 'manual_review_required');--> statement-breakpoint
CREATE TYPE "public"."his_connection_credential_provider_failure_category" AS ENUM('provider_unavailable', 'timeout', 'retry_exhausted', 'circuit_open', 'validation_failed', 'tenant_connection_mismatch', 'idempotency_conflict', 'invalid_state', 'provider_write_failed', 'provider_revoke_failed', 'provider_describe_failed', 'provider_health_failed', 'repository_after_provider_failed', 'audit_after_provider_failed');--> statement-breakpoint
CREATE TABLE "his_connection_credential_compensation_operations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_id" varchar(64) NOT NULL,
	"operation_id" varchar(96) NOT NULL,
	"operation_type" "his_connection_credential_compensation_operation_type" DEFAULT 'credential_compensation' NOT NULL,
	"state" "his_connection_credential_compensation_state" DEFAULT 'compensation_pending' NOT NULL,
	"failure_category" "his_connection_credential_provider_failure_category" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "his_connection_credential_compensation_operations" ADD CONSTRAINT "his_conn_cred_comp_ops_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "his_connection_credential_compensation_operations" ADD CONSTRAINT "his_conn_cred_comp_ops_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."his_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "his_conn_cred_comp_ops_operation_id_unique_idx" ON "his_connection_credential_compensation_operations" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "his_conn_cred_comp_ops_tenant_connection_state_idx" ON "his_connection_credential_compensation_operations" USING btree ("tenant_id","connection_id","state");--> statement-breakpoint
CREATE INDEX "his_conn_cred_comp_ops_tenant_state_updated_idx" ON "his_connection_credential_compensation_operations" USING btree ("tenant_id","state","updated_at");