CREATE TABLE "treatment_summaries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"appointment_id" varchar(64),
	"treatment_date" timestamp with time zone NOT NULL,
	"treatment_project" varchar(160) NOT NULL,
	"treatment_category" varchar(96) NOT NULL,
	"treatment_stage" varchar(120) NOT NULL,
	"recovery_stage" varchar(120) NOT NULL,
	"risk_level" "follow_up_risk_level" NOT NULL,
	"owner_user_id" varchar(96) NOT NULL,
	"summary" text NOT NULL,
	"next_care_action" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_appointment_fk" FOREIGN KEY ("tenant_id","appointment_id") REFERENCES "public"."appointments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treatment_summaries_tenant_customer_date_idx" ON "treatment_summaries" USING btree ("tenant_id","customer_id","treatment_date");--> statement-breakpoint
CREATE INDEX "treatment_summaries_tenant_risk_date_idx" ON "treatment_summaries" USING btree ("tenant_id","risk_level","treatment_date");--> statement-breakpoint
CREATE INDEX "treatment_summaries_tenant_appointment_idx" ON "treatment_summaries" USING btree ("tenant_id","appointment_id");
