CREATE TYPE "public"."auth_account_status" AS ENUM('active', 'password_reset_required', 'disabled', 'locked');--> statement-breakpoint
CREATE TYPE "public"."homepage_brand_asset_kind" AS ENUM('logo', 'night_logo', 'mark_logo', 'hero_background', 'share_image');--> statement-breakpoint
CREATE TYPE "public"."homepage_brand_audit_action" AS ENUM('save_draft', 'upload_asset', 'publish', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."homepage_brand_config_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."knowledge_base_runtime_readonly_status" AS ENUM('readonly', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."knowledge_base_runtime_source_kind" AS ENUM('mock', 'seed', 'demo');--> statement-breakpoint
CREATE TYPE "public"."knowledge_base_runtime_status" AS ENUM('disabled', 'denied', 'empty', 'pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tenant_authorization_snapshot_status" AS ENUM('active', 'superseded', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."tenant_commercial_record_status" AS ENUM('draft', 'pending', 'manual_review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_commercial_record_type" AS ENUM('order', 'contract', 'invoice', 'payment');--> statement-breakpoint
CREATE TYPE "public"."tenant_plan_change_status" AS ENUM('previewed', 'applied', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tenant_plan_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
ALTER TYPE "public"."tenant_status" ADD VALUE 'trialing';--> statement-breakpoint
ALTER TYPE "public"."tenant_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"username" varchar(96) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"phone" varchar(32),
	"email" varchar(160),
	"password_hash" text NOT NULL,
	"password_updated_at" timestamp with time zone NOT NULL,
	"password_reset_required" boolean DEFAULT true NOT NULL,
	"status" "auth_account_status" DEFAULT 'password_reset_required' NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_brand_assets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"kind" "homepage_brand_asset_kind" NOT NULL,
	"original_filename" varchar(180) NOT NULL,
	"mime_type" varchar(96) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" varchar(240) NOT NULL,
	"public_url" varchar(240) NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"uploaded_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homepage_brand_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "homepage_brand_audit_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"action" "homepage_brand_audit_action" NOT NULL,
	"config_id" varchar(64),
	"version_id" varchar(64),
	"asset_id" varchar(64),
	"actor_id" varchar(96) NOT NULL,
	"summary" varchar(240) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_brand_config_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"config_id" varchar(64) NOT NULL,
	"version_number" integer NOT NULL,
	"config_json" jsonb NOT NULL,
	"summary" varchar(240) NOT NULL,
	"published_by" varchar(96) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homepage_brand_config_versions_config_version_unique" UNIQUE("config_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "homepage_brand_configs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"status" "homepage_brand_config_status" DEFAULT 'draft' NOT NULL,
	"draft_config_json" jsonb NOT NULL,
	"published_version_id" varchar(64),
	"draft_updated_by" varchar(96) NOT NULL,
	"published_by" varchar(96),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunk_embeddings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"chunk_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"embedding_provider" varchar(64) DEFAULT 'mock_demo_embedding' NOT NULL,
	"embedding_model" varchar(96) DEFAULT 'mock-demo-embedding-v1' NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"embedding_vector_json" jsonb NOT NULL,
	"status" "knowledge_base_runtime_status" DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_chunk_embeddings_tenant_id_id_unique" UNIQUE("tenant_id","id")
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_chunks_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_file_parse_chunk_embeddings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"chunk_id" varchar(64) NOT NULL,
	"embedding_provider" varchar(64) DEFAULT 'mock_local_embedding' NOT NULL,
	"embedding_model" varchar(96) DEFAULT 'mock-local-embedding-v1' NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"embedding_vector_json" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_unique" UNIQUE("tenant_id","chunk_id")
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_file_parse_chunks_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "knowledge_file_parse_chunks_tenant_file_chunk_unique" UNIQUE("tenant_id","file_id","chunk_index")
);
--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_file_parses_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "knowledge_file_parses_tenant_file_unique" UNIQUE("tenant_id","file_id")
);
--> statement-breakpoint
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
	"archived_at" timestamp with time zone,
	CONSTRAINT "knowledge_document_files_tenant_id_id_unique" UNIQUE("tenant_id","id")
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_index_jobs_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_qa_audit_logs_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
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
CREATE TABLE "platform_ai_model_config_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"scenario_defaults" jsonb NOT NULL,
	"agent_inheritance" jsonb NOT NULL,
	"model_states" jsonb NOT NULL,
	"provider_states" jsonb NOT NULL,
	"dry_run_results" jsonb NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_ai_provider_configs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"base_url" varchar(256) NOT NULL,
	"model" varchar(128) NOT NULL,
	"encrypted_api_key" jsonb NOT NULL,
	"configured" boolean DEFAULT false NOT NULL,
	"last_check_status" varchar(32) DEFAULT 'not_checked' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_knowledge_institution_visibility" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_kb_visibility_tenant_document_institution_unique" UNIQUE("tenant_id","knowledge_document_id","institution_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_authorization_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_assignment_id" varchar(64) NOT NULL,
	"plan_version_id" varchar(64) NOT NULL,
	"status" "tenant_authorization_snapshot_status" DEFAULT 'active' NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connector_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_change_record_id" varchar(64),
	"generated_by" varchar(96) NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_commercial_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"record_type" "tenant_commercial_record_type" NOT NULL,
	"status" "tenant_commercial_record_status" DEFAULT 'draft' NOT NULL,
	"display_code" varchar(96) NOT NULL,
	"display_amount" varchar(80),
	"period_label" varchar(80),
	"related_plan_change_id" varchar(64),
	"note" text,
	"occurred_at" timestamp with time zone,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_contacts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"contact_name" varchar(120) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"contact_email" varchar(160),
	"initial_admin_user_id" varchar(96) NOT NULL,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_plan_change_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"from_plan_version_id" varchar(64),
	"to_plan_version_id" varchar(64) NOT NULL,
	"from_snapshot_id" varchar(64),
	"to_snapshot_id" varchar(64),
	"status" "tenant_plan_change_status" DEFAULT 'previewed' NOT NULL,
	"diff_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"requested_by" varchar(96) NOT NULL,
	"applied_by" varchar(96),
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_plan_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"version_code" varchar(64) NOT NULL,
	"status" "tenant_plan_version_status" DEFAULT 'draft' NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"display_price" varchar(80) NOT NULL,
	"price_note" text DEFAULT '' NOT NULL,
	"agent_limit" integer,
	"seat_limit" integer,
	"monthly_ai_call_limit" integer,
	"knowledge_storage_gb" integer,
	"connector_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feature_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quota_entitlements_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"change_summary" text DEFAULT '' NOT NULL,
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"published_by" varchar(96),
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "gender" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "birth_date" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referral_source" varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD COLUMN "plan_version_id" varchar(64);--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_version_id_homepage_brand_config_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."homepage_brand_config_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_asset_id_homepage_brand_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."homepage_brand_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_brand_config_versions" ADD CONSTRAINT "homepage_brand_config_versions_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_document_file_parse_chunk_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_document_file_parse_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_document_file_parse_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_document_file_parses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."knowledge_sources"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_qa_audit_logs" ADD CONSTRAINT "knowledge_qa_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_knowledge_institution_visibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_kb_visibility_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."tenant_plan_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_related_plan_change_id_tenant_plan_change_records_id_fk" FOREIGN KEY ("related_plan_change_id") REFERENCES "public"."tenant_plan_change_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_initial_admin_user_id_auth_users_id_fk" FOREIGN KEY ("initial_admin_user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("from_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("to_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_versions" ADD CONSTRAINT "tenant_plan_versions_plan_id_tenant_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_username_unique_idx" ON "auth_users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "auth_users_phone_idx" ON "auth_users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "auth_users_email_idx" ON "auth_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_users_status_idx" ON "auth_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "homepage_brand_assets_kind_created_idx" ON "homepage_brand_assets" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "homepage_brand_assets_checksum_idx" ON "homepage_brand_assets" USING btree ("checksum_sha256");--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_action_created_idx" ON "homepage_brand_audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_config_created_idx" ON "homepage_brand_audit_logs" USING btree ("config_id","created_at");--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_actor_created_idx" ON "homepage_brand_audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "homepage_brand_config_versions_config_published_idx" ON "homepage_brand_config_versions" USING btree ("config_id","published_at");--> statement-breakpoint
CREATE INDEX "homepage_brand_configs_status_updated_idx" ON "homepage_brand_configs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_chunk_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","chunk_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_workspace_status_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_tenant_document_idx" ON "knowledge_chunks" USING btree ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_tenant_workspace_status_idx" ON "knowledge_chunks" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_document_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","knowledge_document_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_file_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","file_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunks_tenant_file_idx" ON "knowledge_document_file_parse_chunks" USING btree ("tenant_id","file_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parses_tenant_document_status_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","knowledge_document_id","parse_status");--> statement-breakpoint
CREATE INDEX "knowledge_file_parses_tenant_file_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","file_id");--> statement-breakpoint
CREATE INDEX "knowledge_document_files_tenant_document_status_idx" ON "knowledge_document_files" USING btree ("tenant_id","knowledge_document_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_document_files_tenant_storage_key_unique" ON "knowledge_document_files" USING btree ("tenant_id","storage_key");--> statement-breakpoint
CREATE INDEX "knowledge_documents_tenant_workspace_status_idx" ON "knowledge_documents" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_documents_tenant_source_idx" ON "knowledge_documents" USING btree ("tenant_id","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_index_jobs_tenant_document_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","document_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_index_jobs_tenant_workspace_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_institution_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","institution_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_qa_audit_logs_tenant_scope_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","actor_scope","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_sources_tenant_workspace_status_idx" ON "knowledge_sources" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_sources_tenant_institution_workspace_idx" ON "knowledge_sources" USING btree ("tenant_id","institution_id","workspace_id");--> statement-breakpoint
CREATE INDEX "platform_ai_model_config_snapshots_updated_at_idx" ON "platform_ai_model_config_snapshots" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "platform_ai_provider_configs_provider_idx" ON "platform_ai_provider_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "platform_ai_provider_configs_updated_at_idx" ON "platform_ai_provider_configs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "platform_kb_visibility_tenant_document_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","knowledge_document_id");--> statement-breakpoint
CREATE INDEX "platform_kb_visibility_tenant_institution_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","institution_id");--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_tenant_status_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_authorization_snapshots_active_tenant_unique_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id") WHERE "tenant_authorization_snapshots"."status" = 'active';--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_assignment_generated_idx" ON "tenant_authorization_snapshots" USING btree ("plan_assignment_id","generated_at");--> statement-breakpoint
CREATE INDEX "tenant_authorization_snapshots_plan_version_idx" ON "tenant_authorization_snapshots" USING btree ("plan_version_id");--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_tenant_type_status_idx" ON "tenant_commercial_records" USING btree ("tenant_id","record_type","status");--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_tenant_created_idx" ON "tenant_commercial_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_commercial_records_related_plan_change_idx" ON "tenant_commercial_records" USING btree ("related_plan_change_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_contacts_tenant_unique_idx" ON "tenant_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_contacts_admin_user_idx" ON "tenant_contacts" USING btree ("initial_admin_user_id");--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_tenant_created_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_tenant_status_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_plan_change_records_to_plan_version_idx" ON "tenant_plan_change_records" USING btree ("to_plan_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_plan_versions_plan_version_code_unique_idx" ON "tenant_plan_versions" USING btree ("plan_id","version_code");--> statement-breakpoint
CREATE INDEX "tenant_plan_versions_plan_status_idx" ON "tenant_plan_versions" USING btree ("plan_id","status");--> statement-breakpoint
CREATE INDEX "tenant_plan_versions_status_updated_idx" ON "tenant_plan_versions" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_plan_assignments_plan_version_idx" ON "tenant_plan_assignments" USING btree ("plan_version_id");