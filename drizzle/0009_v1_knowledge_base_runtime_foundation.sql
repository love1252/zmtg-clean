CREATE TYPE "public"."knowledge_base_runtime_source_kind" AS ENUM('mock', 'seed', 'demo');--> statement-breakpoint
CREATE TYPE "public"."knowledge_base_runtime_status" AS ENUM('disabled', 'denied', 'empty', 'ready');--> statement-breakpoint
CREATE TYPE "public"."knowledge_base_runtime_readonly_status" AS ENUM('readonly', 'blocked');--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"source_kind" "knowledge_base_runtime_source_kind" DEFAULT 'demo' NOT NULL,
	"status" "knowledge_base_runtime_status" DEFAULT 'ready' NOT NULL,
	"readonly_status" "knowledge_base_runtime_readonly_status" DEFAULT 'readonly' NOT NULL,
	"source_label" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"source_kind" "knowledge_base_runtime_source_kind" DEFAULT 'demo' NOT NULL,
	"status" "knowledge_base_runtime_status" DEFAULT 'ready' NOT NULL,
	"readonly_status" "knowledge_base_runtime_readonly_status" DEFAULT 'readonly' NOT NULL,
	"title" varchar(200) NOT NULL,
	"version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_documents_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"source_kind" "knowledge_base_runtime_source_kind" DEFAULT 'demo' NOT NULL,
	"status" "knowledge_base_runtime_status" DEFAULT 'ready' NOT NULL,
	"readonly_status" "knowledge_base_runtime_readonly_status" DEFAULT 'readonly' NOT NULL,
	"chunk_label" varchar(160) NOT NULL,
	"chunk_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_index_jobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"source_kind" "knowledge_base_runtime_source_kind" DEFAULT 'demo' NOT NULL,
	"status" "knowledge_base_runtime_status" DEFAULT 'ready' NOT NULL,
	"readonly_status" "knowledge_base_runtime_readonly_status" DEFAULT 'readonly' NOT NULL,
	"job_kind" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."knowledge_sources"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_sources_tenant_workspace_status_idx" ON "knowledge_sources" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_sources_tenant_institution_workspace_idx" ON "knowledge_sources" USING btree ("tenant_id","institution_id","workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_tenant_workspace_status_idx" ON "knowledge_documents" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_documents_tenant_source_idx" ON "knowledge_documents" USING btree ("tenant_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_tenant_id_id_unique" ON "knowledge_chunks" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_tenant_document_idx" ON "knowledge_chunks" USING btree ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_tenant_workspace_status_idx" ON "knowledge_chunks" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_index_jobs_tenant_id_id_unique" ON "knowledge_index_jobs" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "knowledge_index_jobs_tenant_document_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","document_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_index_jobs_tenant_workspace_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","workspace_id","status");
