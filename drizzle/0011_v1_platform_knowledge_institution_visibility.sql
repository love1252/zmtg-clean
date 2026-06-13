CREATE TABLE "platform_knowledge_institution_visibility" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_knowledge_institution_visibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_kb_visibility_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_kb_visibility_tenant_document_institution_unique" UNIQUE("tenant_id","knowledge_document_id","institution_id");--> statement-breakpoint
CREATE INDEX "platform_kb_visibility_tenant_document_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","knowledge_document_id");--> statement-breakpoint
CREATE INDEX "platform_kb_visibility_tenant_institution_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","institution_id");
