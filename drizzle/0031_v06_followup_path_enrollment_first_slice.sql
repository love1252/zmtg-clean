CREATE TABLE IF NOT EXISTS "follow_up_path_enrollments" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "customer_id" varchar(64) NOT NULL,
  "treatment_summary_id" varchar(64),
  "source_type" varchar(40) NOT NULL,
  "source_id" varchar(64) NOT NULL,
  "template_key" varchar(64) NOT NULL,
  "template_version" varchar(64) DEFAULT 'v0.6-static' NOT NULL,
  "template_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "safe_reason_code" varchar(96) NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_treatment_summary_fk" FOREIGN KEY ("tenant_id","treatment_summary_id") REFERENCES "public"."treatment_summaries"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_path_enrollments_tenant_id_id_unique" ON "follow_up_path_enrollments" USING btree ("tenant_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_path_enrollments_active_source_template_unique_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","source_type","source_id","template_key") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "follow_up_path_enrollments_tenant_status_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "follow_up_path_enrollments_tenant_institution_status_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","institution_id","status");
CREATE INDEX IF NOT EXISTS "follow_up_path_enrollments_tenant_customer_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_tasks_tenant_id_id_unique" ON "follow_up_tasks" USING btree ("tenant_id","id");

CREATE TABLE IF NOT EXISTS "follow_up_path_stages" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "enrollment_id" varchar(64) NOT NULL,
  "node_key" varchar(96) NOT NULL,
  "stage_key" varchar(64) NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" "follow_up_status" DEFAULT 'scheduled' NOT NULL,
  "follow_up_task_id" varchar(64),
  "handler_role" varchar(64) NOT NULL,
  "risk_level" "follow_up_risk_level" NOT NULL,
  "safe_message" varchar(240) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_enrollment_fk" FOREIGN KEY ("tenant_id","enrollment_id") REFERENCES "public"."follow_up_path_enrollments"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_follow_up_task_fk" FOREIGN KEY ("tenant_id","follow_up_task_id") REFERENCES "public"."follow_up_tasks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_path_stages_enrollment_node_unique" ON "follow_up_path_stages" USING btree ("tenant_id","enrollment_id","node_key");
CREATE INDEX IF NOT EXISTS "follow_up_path_stages_tenant_enrollment_idx" ON "follow_up_path_stages" USING btree ("tenant_id","enrollment_id");
CREATE INDEX IF NOT EXISTS "follow_up_path_stages_tenant_due_status_idx" ON "follow_up_path_stages" USING btree ("tenant_id","status","due_at");
