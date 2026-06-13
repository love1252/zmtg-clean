CREATE TABLE "knowledge_document_file_parses" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"parse_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"failure_reason_code" varchar(64),
	"safe_failure_message" varchar(240),
	"text_content" text DEFAULT '' NOT NULL,
	"text_length" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"parser_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_file_parse_chunks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"chunk_index" integer NOT NULL,
	"text_preview" text NOT NULL,
	"char_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_document_file_parses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_document_file_parse_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_file_unique" UNIQUE("tenant_id","file_id");--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_file_chunk_unique" UNIQUE("tenant_id","file_id","chunk_index");--> statement-breakpoint
CREATE INDEX "knowledge_file_parses_tenant_document_status_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","knowledge_document_id","parse_status");--> statement-breakpoint
CREATE INDEX "knowledge_file_parses_tenant_file_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","file_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunks_tenant_file_idx" ON "knowledge_document_file_parse_chunks" USING btree ("tenant_id","file_id");
