CREATE TABLE "knowledge_document_files" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"uploaded_by_user_id" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE INDEX "knowledge_document_files_tenant_document_status_idx" ON "knowledge_document_files" USING btree ("tenant_id","knowledge_document_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_files_tenant_storage_key_unique" ON "knowledge_document_files" USING btree ("tenant_id","storage_key");
