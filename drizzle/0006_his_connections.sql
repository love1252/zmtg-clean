CREATE TYPE "public"."his_connection_health_status" AS ENUM('unknown', 'healthy', 'degraded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."his_connection_status" AS ENUM('draft', 'active', 'paused', 'revoked', 'deleted', 'error');--> statement-breakpoint
CREATE TABLE "his_connections" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_name" varchar(160) NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"vendor_type" varchar(64) NOT NULL,
	"system_type" varchar(64) NOT NULL,
	"status" "his_connection_status" DEFAULT 'draft' NOT NULL,
	"credential_ref" varchar(128),
	"health_status" "his_connection_health_status" DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error_code" varchar(96),
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "his_connections_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "his_connections" ADD CONSTRAINT "his_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "his_connections_tenant_idx" ON "his_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "his_connections_tenant_status_idx" ON "his_connections" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "his_connections_tenant_source_system_idx" ON "his_connections" USING btree ("tenant_id","source_system");--> statement-breakpoint
CREATE INDEX "his_connections_tenant_deleted_at_idx" ON "his_connections" USING btree ("tenant_id","deleted_at");--> statement-breakpoint
CREATE INDEX "his_connections_tenant_credential_ref_idx" ON "his_connections" USING btree ("tenant_id","credential_ref");--> statement-breakpoint
CREATE INDEX "his_connections_tenant_last_checked_at_idx" ON "his_connections" USING btree ("tenant_id","last_checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "his_connections_active_name_unique_idx" ON "his_connections" USING btree ("tenant_id","connection_name") WHERE "his_connections"."deleted_at" is null;