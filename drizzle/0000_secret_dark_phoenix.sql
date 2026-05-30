CREATE TYPE "public"."appointment_status" AS ENUM('pending_confirmation', 'confirmed', 'arrived', 'completed', 'reschedule_requested', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_result" AS ENUM('allowed', 'denied', 'transitioned');--> statement-breakpoint
CREATE TYPE "public"."auth_role" AS ENUM('tenant_admin', 'tenant_operator', 'consultant', 'customer_service', 'platform_admin', 'platform_operator', 'security_auditor');--> statement-breakpoint
CREATE TYPE "public"."customer_lifecycle" AS ENUM('consulting', 'scheduled', 'post_care', 'repurchase_window', 'silent_reactivation');--> statement-breakpoint
CREATE TYPE "public"."customer_priority" AS ENUM('high', 'medium', 'observe');--> statement-breakpoint
CREATE TYPE "public"."follow_up_risk_level" AS ENUM('normal', 'watch', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('scheduled', 'due', 'in_progress', 'escalated', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"project" varchar(160) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"consultant_user_id" varchar(96) NOT NULL,
	"status" "appointment_status" NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"event_id" varchar(96) PRIMARY KEY NOT NULL,
	"actor_id" varchar(96) NOT NULL,
	"actor_role" "auth_role" NOT NULL,
	"tenant_id" varchar(64),
	"scope" varchar(24) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"result" "audit_result" NOT NULL,
	"reason" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" varchar(48) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_tasks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"journey_id" varchar(96) NOT NULL,
	"stage" varchar(120) NOT NULL,
	"status" "follow_up_status" NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"suggested_action" text NOT NULL,
	"risk_level" "follow_up_risk_level" NOT NULL,
	"updated_by" varchar(96),
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"user_id" varchar(96) NOT NULL,
	"role" "auth_role" NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_tenant_status_idx" ON "appointments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_occurred_idx" ON "audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_priority_idx" ON "customers" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "follow_up_tasks_tenant_status_idx" ON "follow_up_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_members_tenant_user_idx" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_members_tenant_role_idx" ON "tenant_members" USING btree ("tenant_id","role");