CREATE TYPE "public"."follow_up_message_draft_status" AS ENUM('draft', 'approved', 'rejected', 'marked_sent', 'cancelled');

CREATE TABLE IF NOT EXISTS "follow_up_message_templates" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64),
  "institution_id" varchar(64),
  "template_key" varchar(96) NOT NULL,
  "template_name" varchar(160) NOT NULL,
  "template_type" varchar(40) NOT NULL,
  "applicable_template_key" varchar(64),
  "applicable_node_key" varchar(96),
  "channel_type" varchar(32) DEFAULT 'manual' NOT NULL,
  "content_template" text NOT NULL,
  "variables_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "requires_human_approval" boolean DEFAULT true NOT NULL,
  "forbid_auto_send" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "follow_up_message_templates" ADD CONSTRAINT "follow_up_message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "follow_up_message_templates_tenant_institution_idx" ON "follow_up_message_templates" USING btree ("tenant_id","institution_id");
CREATE INDEX IF NOT EXISTS "follow_up_message_templates_template_key_idx" ON "follow_up_message_templates" USING btree ("template_key");
CREATE INDEX IF NOT EXISTS "follow_up_message_templates_status_idx" ON "follow_up_message_templates" USING btree ("status");
CREATE INDEX IF NOT EXISTS "follow_up_message_templates_applicable_idx" ON "follow_up_message_templates" USING btree ("applicable_template_key","applicable_node_key");

CREATE TABLE IF NOT EXISTS "follow_up_message_drafts" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "follow_up_task_id" varchar(64) NOT NULL,
  "enrollment_id" varchar(64),
  "stage_id" varchar(64),
  "customer_id" varchar(64) NOT NULL,
  "template_id" varchar(64),
  "channel_type" varchar(32) DEFAULT 'manual' NOT NULL,
  "status" "follow_up_message_draft_status" DEFAULT 'draft' NOT NULL,
  "draft_content" text NOT NULL,
  "edited_content" text,
  "safe_preview" varchar(240) NOT NULL,
  "approved_by" varchar(96),
  "approved_at" timestamp with time zone,
  "rejected_by" varchar(96),
  "rejected_at" timestamp with time zone,
  "marked_sent_by" varchar(96),
  "marked_sent_at" timestamp with time zone,
  "safe_reason_code" varchar(96) NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_follow_up_task_fk" FOREIGN KEY ("tenant_id","follow_up_task_id") REFERENCES "public"."follow_up_tasks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_enrollment_fk" FOREIGN KEY ("tenant_id","enrollment_id") REFERENCES "public"."follow_up_path_enrollments"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_id_id_unique" UNIQUE ("tenant_id","id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_stage_fk" FOREIGN KEY ("tenant_id","stage_id") REFERENCES "public"."follow_up_path_stages"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."follow_up_message_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "follow_up_message_drafts_tenant_institution_idx" ON "follow_up_message_drafts" USING btree ("tenant_id","institution_id");
CREATE INDEX IF NOT EXISTS "follow_up_message_drafts_follow_up_task_idx" ON "follow_up_message_drafts" USING btree ("follow_up_task_id");
CREATE INDEX IF NOT EXISTS "follow_up_message_drafts_customer_idx" ON "follow_up_message_drafts" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "follow_up_message_drafts_status_idx" ON "follow_up_message_drafts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "follow_up_message_drafts_created_at_idx" ON "follow_up_message_drafts" USING btree ("created_at");
