CREATE TYPE "knowledge_indexing_job_type" AS ENUM ('parse_file', 'generate_embeddings', 'rebuild_embeddings', 'rebuild_knowledge_index');
CREATE TYPE "knowledge_indexing_job_status" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "knowledge_indexing_jobs" (
  "job_id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "actor_user_id" varchar(96),
  "knowledge_id" varchar(64),
  "file_id" varchar(64),
  "job_type" "knowledge_indexing_job_type" NOT NULL,
  "status" "knowledge_indexing_job_status" DEFAULT 'pending' NOT NULL,
  "total_count" integer DEFAULT 0 NOT NULL,
  "processed_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "failure_reason_code" varchar(64),
  "safe_message" varchar(240),
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_indexing_jobs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX "knowledge_indexing_jobs_tenant_status_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id", "status", "created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_institution_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id", "institution_id", "created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_knowledge_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id", "knowledge_id", "created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_file_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id", "file_id", "created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_job_type_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id", "job_type", "created_at");
