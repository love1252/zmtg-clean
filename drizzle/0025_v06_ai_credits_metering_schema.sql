CREATE TABLE "platform_ai_credit_metering_rules" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"metering_version" varchar(64) NOT NULL,
	"input_token_weight" numeric(12, 6) NOT NULL,
	"output_token_weight" numeric(12, 6) NOT NULL,
	"model_multiplier" numeric(12, 6) NOT NULL,
	"rag_credit_surcharge" integer NOT NULL,
	"credits_per_standard_token_unit" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "ai_credits_consumed" integer;--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "metering_status" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "metering_version" varchar(64);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "metering_details" jsonb;--> statement-breakpoint
ALTER TABLE "tenant_plan_versions" ADD COLUMN "monthly_ai_credit_limit" integer;--> statement-breakpoint
ALTER TABLE "tenant_quota_snapshots" ADD COLUMN "max_ai_credits" integer;--> statement-breakpoint
ALTER TABLE "tenant_quota_snapshots" ADD COLUMN "current_ai_credits" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_ai_credit_metering_rules_provider_model_version_unique_idx" ON "platform_ai_credit_metering_rules" USING btree ("provider","model","metering_version");--> statement-breakpoint
CREATE INDEX "platform_ai_credit_metering_rules_provider_model_enabled_idx" ON "platform_ai_credit_metering_rules" USING btree ("provider","model","enabled");--> statement-breakpoint
CREATE INDEX "platform_ai_credit_metering_rules_effective_from_idx" ON "platform_ai_credit_metering_rules" USING btree ("effective_from");