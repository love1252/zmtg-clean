CREATE TYPE "public"."tenant_plan_version_status" AS ENUM('draft', 'published', 'retired');
--> statement-breakpoint
CREATE TYPE "public"."tenant_authorization_snapshot_status" AS ENUM('active', 'superseded', 'revoked');
--> statement-breakpoint
CREATE TYPE "public"."tenant_plan_change_status" AS ENUM('previewed', 'applied', 'cancelled', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."tenant_commercial_record_type" AS ENUM('order', 'contract', 'invoice', 'payment');
--> statement-breakpoint
CREATE TYPE "public"."tenant_commercial_record_status" AS ENUM('draft', 'pending', 'manual_review', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TABLE "tenant_plan_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"version_code" varchar(64) NOT NULL,
	"status" "tenant_plan_version_status" DEFAULT 'draft' NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"display_price" varchar(80) NOT NULL,
	"price_note" text DEFAULT '' NOT NULL,
	"agent_limit" integer,
	"seat_limit" integer,
	"monthly_ai_call_limit" integer,
	"knowledge_storage_gb" integer,
	"connector_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feature_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"change_summary" text DEFAULT '' NOT NULL,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"published_by" varchar(96),
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD COLUMN "plan_version_id" varchar(64);
--> statement-breakpoint
CREATE TABLE "tenant_authorization_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_assignment_id" varchar(64) NOT NULL,
	"plan_version_id" varchar(64) NOT NULL,
	"status" "tenant_authorization_snapshot_status" DEFAULT 'active' NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connector_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_change_record_id" varchar(64),
	"generated_by" varchar(96) NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_plan_change_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"from_plan_version_id" varchar(64),
	"to_plan_version_id" varchar(64) NOT NULL,
	"from_snapshot_id" varchar(64),
	"to_snapshot_id" varchar(64),
	"status" "tenant_plan_change_status" DEFAULT 'previewed' NOT NULL,
	"diff_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"requested_by" varchar(96) NOT NULL,
	"applied_by" varchar(96),
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_commercial_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"record_type" "tenant_commercial_record_type" NOT NULL,
	"status" "tenant_commercial_record_status" DEFAULT 'draft' NOT NULL,
	"display_code" varchar(96) NOT NULL,
	"display_amount" varchar(80),
	"period_label" varchar(80),
	"related_plan_change_id" varchar(64),
	"note" text,
	"occurred_at" timestamp with time zone,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_plan_versions" ADD CONSTRAINT "tenant_plan_versions_plan_id_tenant_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."tenant_plan_assignments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("from_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("to_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_related_plan_change_id_tenant_plan_change_records_id_fk" FOREIGN KEY ("related_plan_change_id") REFERENCES "public"."tenant_plan_change_records"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_plan_versions_plan_version_code_unique_idx" ON "tenant_plan_versions" USING btree ("plan_id","version_code");
--> statement-breakpoint
CREATE INDEX "tenant_plan_versions_plan_status_idx" ON "tenant_plan_versions" USING btree ("plan_id","status");
--> statement-breakpoint
CREATE INDEX "tenant_plan_versions_status_updated_idx" ON "tenant_plan_versions" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE INDEX "tenant_plan_assignments_plan_version_idx" ON "tenant_plan_assignments" USING btree ("plan_version_id");
--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_tenant_status_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_authorization_snapshots_active_tenant_unique_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id") WHERE "tenant_authorization_snapshots"."status" = 'active';
--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_assignment_generated_idx" ON "tenant_authorization_snapshots" USING btree ("plan_assignment_id","generated_at");
--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_plan_version_idx" ON "tenant_authorization_snapshots" USING btree ("plan_version_id");
--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_tenant_created_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","created_at");
--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_tenant_status_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_to_plan_version_idx" ON "tenant_plan_change_records" USING btree ("to_plan_version_id");
--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_tenant_type_status_idx" ON "tenant_commercial_records" USING btree ("tenant_id","record_type","status");
--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_tenant_created_idx" ON "tenant_commercial_records" USING btree ("tenant_id","created_at");
--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_related_plan_change_idx" ON "tenant_commercial_records" USING btree ("related_plan_change_id");
