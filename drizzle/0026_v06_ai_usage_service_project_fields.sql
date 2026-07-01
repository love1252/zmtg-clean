ALTER TABLE "ai_call_usage_records" ADD COLUMN "service_category" varchar(64);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "service_name" varchar(128);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "service_source" varchar(96);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "service_action" varchar(96);--> statement-breakpoint
ALTER TABLE "ai_call_usage_records" ADD COLUMN "service_version" varchar(64);
