SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;
DO $migration$
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'THIRD_BATCH_0053_JOURNAL_MISSING';
  END IF;
  IF (SELECT max(created_at) IS DISTINCT FROM 1788162722000 OR count(*) FILTER (WHERE created_at = 1788162722000) <> 1 FROM drizzle.__drizzle_migrations) THEN
    RAISE EXCEPTION 'THIRD_BATCH_0053_JOURNAL_DRIFT';
  END IF;
  IF pg_catalog.to_regclass('public.customer_profile_suggestions') IS NOT NULL OR pg_catalog.to_regclass('public.institution_opportunity_confirmations') IS NOT NULL THEN
    RAISE EXCEPTION 'THIRD_BATCH_0053_TARGET_EXISTS';
  END IF;
END
$migration$;

CREATE TABLE "public"."customer_profile_suggestions" (
	"id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"field_name" varchar(24) NOT NULL,
	"before_value" varchar(160) NOT NULL,
	"proposed_value" varchar(120) NOT NULL,
	"source_appointment_id" varchar(64) NOT NULL,
	"source_project" varchar(120) NOT NULL,
	"source_status" varchar(24) NOT NULL,
	"source_scheduled_at" timestamp with time zone NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"source_version" varchar(64) NOT NULL,
	"customer_updated_at" timestamp with time zone NOT NULL,
	"rule_version" varchar(64) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"state" varchar(24) DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"creation_audit_event_id" varchar(96) NOT NULL,
	"decided_by" varchar(96),
	"decided_role" "auth_role",
	"decided_at" timestamp with time zone,
	"decision_audit_event_id" varchar(96),
	"reason_code" varchar(32),
	"applied_customer_updated_at" timestamp with time zone,
	CONSTRAINT "customer_profile_suggestions_pk" PRIMARY KEY("tenant_id","institution_id","id"),
	CONSTRAINT "customer_profile_suggestions_fingerprint_unique" UNIQUE("tenant_id","institution_id","fingerprint"),
	CONSTRAINT "customer_profile_suggestions_rule_check" CHECK ("customer_profile_suggestions"."field_name" = 'projectInterest' AND "customer_profile_suggestions"."before_value" = '' AND length(trim("customer_profile_suggestions"."proposed_value")) > 0 AND "customer_profile_suggestions"."proposed_value" = "customer_profile_suggestions"."source_project" AND "customer_profile_suggestions"."source_status" = 'confirmed' AND "customer_profile_suggestions"."rule_version" = 'appointment-project.v1' AND "customer_profile_suggestions"."source_version" ~ '^[0-9a-f]{64}$' AND "customer_profile_suggestions"."fingerprint" ~ '^[0-9a-f]{64}$' AND "customer_profile_suggestions"."expires_at" > "customer_profile_suggestions"."created_at"),
	CONSTRAINT "customer_profile_suggestions_state_check" CHECK ((
    "customer_profile_suggestions"."state" = 'pending' AND "customer_profile_suggestions"."revision" = 1 AND "customer_profile_suggestions"."decided_by" IS NULL AND "customer_profile_suggestions"."decided_role" IS NULL AND "customer_profile_suggestions"."decided_at" IS NULL AND "customer_profile_suggestions"."decision_audit_event_id" IS NULL AND "customer_profile_suggestions"."reason_code" IS NULL AND "customer_profile_suggestions"."applied_customer_updated_at" IS NULL
  ) OR (
    "customer_profile_suggestions"."state" IN ('applied','rejected','expired') AND "customer_profile_suggestions"."revision" = 2 AND "customer_profile_suggestions"."decided_by" IS NOT NULL AND "customer_profile_suggestions"."decided_role" IS NOT NULL AND "customer_profile_suggestions"."decided_at" IS NOT NULL AND "customer_profile_suggestions"."decided_at" >= "customer_profile_suggestions"."created_at" AND "customer_profile_suggestions"."decision_audit_event_id" IS NOT NULL AND "customer_profile_suggestions"."reason_code" IS NOT NULL
    AND (("customer_profile_suggestions"."state" = 'applied' AND "customer_profile_suggestions"."applied_customer_updated_at" IS NOT NULL AND "customer_profile_suggestions"."applied_customer_updated_at" > "customer_profile_suggestions"."customer_updated_at") OR ("customer_profile_suggestions"."state" <> 'applied' AND "customer_profile_suggestions"."applied_customer_updated_at" IS NULL))
  ))
);

CREATE TABLE "public"."institution_opportunity_confirmations" (
	"id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"opportunity_type" varchar(24) NOT NULL,
	"rule_version" varchar(64) NOT NULL,
	"source_version" varchar(80) NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"source_lifecycle" "customer_lifecycle" NOT NULL,
	"source_priority" "customer_priority" NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"confirmed_by" varchar(96) NOT NULL,
	"confirmed_role" "auth_role" NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"follow_up_task_id" varchar(64) NOT NULL,
	"audit_event_id" varchar(96) NOT NULL,
	CONSTRAINT "institution_opportunity_confirmations_pk" PRIMARY KEY("tenant_id","institution_id","id"),
	CONSTRAINT "opportunity_confirmations_key_unique" UNIQUE("tenant_id","institution_id","idempotency_key"),
	CONSTRAINT "opportunity_confirmations_candidate_unique" UNIQUE("tenant_id","institution_id","customer_id","opportunity_type"),
	CONSTRAINT "opportunity_confirmations_task_unique" UNIQUE("tenant_id","institution_id","follow_up_task_id"),
	CONSTRAINT "opportunity_confirmations_rule_check" CHECK ("institution_opportunity_confirmations"."rule_version" = 'customer-lifecycle.v1' AND "institution_opportunity_confirmations"."source_version" ~ '^opp-src-v1:[0-9a-f]{64}$' AND "institution_opportunity_confirmations"."request_digest" ~ '^[0-9a-f]{64}$' AND "institution_opportunity_confirmations"."confirmed_role" IN ('tenant_admin','tenant_operator') AND (("institution_opportunity_confirmations"."opportunity_type" = 'revisit' AND "institution_opportunity_confirmations"."source_lifecycle" = 'post_care') OR ("institution_opportunity_confirmations"."opportunity_type" = 'repurchase' AND "institution_opportunity_confirmations"."source_lifecycle" = 'repurchase_window') OR ("institution_opportunity_confirmations"."opportunity_type" = 'reactivation' AND "institution_opportunity_confirmations"."source_lifecycle" = 'silent_reactivation')))
);

ALTER TABLE "public"."customer_profile_suggestions" ADD CONSTRAINT "customer_profile_suggestions_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "public"."customer_profile_suggestions" ADD CONSTRAINT "customer_profile_suggestions_appointment_fk" FOREIGN KEY ("tenant_id","source_appointment_id") REFERENCES "public"."appointments"("tenant_id","id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "public"."institution_opportunity_confirmations" ADD CONSTRAINT "opportunity_confirmations_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "public"."institution_opportunity_confirmations" ADD CONSTRAINT "opportunity_confirmations_task_fk" FOREIGN KEY ("tenant_id","institution_id","follow_up_task_id") REFERENCES "public"."care_formal_follow_up_tasks"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "customer_profile_suggestions_customer_idx" ON "public"."customer_profile_suggestions" USING btree ("tenant_id","institution_id","customer_id","state","created_at");

CREATE INDEX "customer_profile_suggestions_source_idx" ON "public"."customer_profile_suggestions" USING btree ("tenant_id","source_appointment_id");

CREATE INDEX "opportunity_confirmations_history_idx" ON "public"."institution_opportunity_confirmations" USING btree ("tenant_id","institution_id","customer_id","confirmed_at");
