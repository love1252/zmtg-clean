CREATE TYPE "public"."tenant_plan_assignment_status" AS ENUM('active', 'scheduled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tenant_plan_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TABLE "tenant_plan_assignments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"status" "tenant_plan_assignment_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_plans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"status" "tenant_plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_quota_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_assignment_id" varchar(64) NOT NULL,
	"max_customers" integer NOT NULL,
	"max_appointments" integer NOT NULL,
	"max_follow_ups" integer NOT NULL,
	"max_ai_calls" integer NOT NULL,
	"current_customers" integer NOT NULL,
	"current_appointments" integer NOT NULL,
	"current_follow_ups" integer NOT NULL,
	"current_ai_calls" integer NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_plan_id_tenant_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_quota_snapshots" ADD CONSTRAINT "tenant_quota_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_quota_snapshots" ADD CONSTRAINT "tenant_quota_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."tenant_plan_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_plan_assignments_tenant_status_idx" ON "tenant_plan_assignments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_plan_assignments_plan_status_idx" ON "tenant_plan_assignments" USING btree ("plan_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_plans_code_unique_idx" ON "tenant_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tenant_plans_status_idx" ON "tenant_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_quota_snapshots_tenant_snapshot_idx" ON "tenant_quota_snapshots" USING btree ("tenant_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "tenant_quota_snapshots_plan_assignment_snapshot_idx" ON "tenant_quota_snapshots" USING btree ("plan_assignment_id","snapshot_at");