CREATE TYPE "public"."follow_up_customer_timeline_source_type" AS ENUM('path_enrollment', 'followup_task', 'message_draft', 'manual_note');
CREATE TYPE "public"."follow_up_customer_timeline_event_type" AS ENUM('followup_path_enrolled', 'followup_path_cancelled', 'followup_tasks_generated', 'followup_task_status_changed', 'followup_task_escalated', 'message_draft_created', 'message_draft_updated', 'message_draft_approved', 'message_draft_rejected', 'message_draft_marked_sent', 'manual_feedback_recorded');

CREATE TABLE IF NOT EXISTS "follow_up_customer_timeline_events" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "customer_id" varchar(64) NOT NULL,
  "source_type" "follow_up_customer_timeline_source_type" NOT NULL,
  "source_id" varchar(96) NOT NULL,
  "event_type" "follow_up_customer_timeline_event_type" NOT NULL,
  "event_title" varchar(160) NOT NULL,
  "safe_summary" varchar(240) NOT NULL,
  "risk_level" "follow_up_risk_level",
  "occurred_at" timestamp with time zone NOT NULL,
  "safe_actor_role" varchar(64),
  "safe_reason_code" varchar(96) NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "follow_up_customer_timeline_events" ADD CONSTRAINT "follow_up_customer_timeline_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "follow_up_customer_timeline_events" ADD CONSTRAINT "follow_up_customer_timeline_events_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "follow_up_customer_timeline_events_tenant_institution_customer_occurred_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","institution_id","customer_id","occurred_at");
CREATE INDEX IF NOT EXISTS "follow_up_customer_timeline_events_tenant_source_event_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","source_type","source_id","event_type");
CREATE INDEX IF NOT EXISTS "follow_up_customer_timeline_events_tenant_event_type_occurred_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","event_type","occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_customer_timeline_events_source_event_unique_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","source_type","source_id","event_type");
