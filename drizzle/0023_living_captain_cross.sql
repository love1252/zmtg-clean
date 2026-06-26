CREATE TABLE "ai_call_usage_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"actor_user_id" varchar(96) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"status" varchar(32) NOT NULL,
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_call_usage_records_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD CONSTRAINT "ai_call_usage_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_call_usage_records_tenant_created_idx" ON "ai_call_usage_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_call_usage_records_tenant_institution_created_idx" ON "ai_call_usage_records" USING btree ("tenant_id","institution_id","created_at");