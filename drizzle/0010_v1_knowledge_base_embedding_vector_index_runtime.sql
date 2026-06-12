ALTER TYPE "public"."knowledge_base_runtime_status" ADD VALUE IF NOT EXISTS 'pending';--> statement-breakpoint
ALTER TYPE "public"."knowledge_base_runtime_status" ADD VALUE IF NOT EXISTS 'failed';--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunk_embeddings_tenant_id_id_unique" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_chunk_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","chunk_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_workspace_status_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");
