ALTER TABLE "treatment_summaries" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD COLUMN "voided_by" varchar(96);--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD COLUMN "void_reason_code" varchar(64);--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD COLUMN "void_reason" varchar(200);--> statement-breakpoint
CREATE INDEX "treatment_summaries_tenant_voided_date_idx" ON "treatment_summaries" USING btree ("tenant_id","voided_at","treatment_date");