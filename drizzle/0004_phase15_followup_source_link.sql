ALTER TABLE "follow_up_tasks" ADD COLUMN "source_treatment_summary_id" varchar(64);--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD COLUMN "source_suggestion_key" varchar(180);--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_tenant_source_treatment_summary_fk" FOREIGN KEY ("tenant_id","source_treatment_summary_id") REFERENCES "public"."treatment_summaries"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_up_tasks_tenant_source_treatment_summary_idx" ON "follow_up_tasks" USING btree ("tenant_id","source_treatment_summary_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follow_up_tasks_active_source_unique_idx" ON "follow_up_tasks" USING btree ("tenant_id","source_treatment_summary_id","source_suggestion_key") WHERE "follow_up_tasks"."source_treatment_summary_id" is not null and "follow_up_tasks"."source_suggestion_key" is not null and "follow_up_tasks"."status" not in ('completed','cancelled');
