CREATE TABLE "knowledge_qa_audit_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"actor_scope" varchar(24) NOT NULL,
	"actor_user_id" varchar(96) NOT NULL,
	"question" varchar(512) NOT NULL,
	"answer_preview" varchar(1024) NOT NULL,
	"retrieval_mode" varchar(24) NOT NULL,
	"citation_count" integer NOT NULL,
	"safe_status" varchar(32) NOT NULL,
	"safe_failure_message" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_qa_audit_logs" ADD CONSTRAINT "knowledge_qa_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_qa_audit_logs" ADD CONSTRAINT "knowledge_qa_audit_logs_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_institution_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","institution_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_scope_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","actor_scope","created_at");
