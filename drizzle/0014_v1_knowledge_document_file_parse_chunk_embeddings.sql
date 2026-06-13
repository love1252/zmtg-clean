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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_document_file_parse_chunk_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_document_file_parse_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_unique" UNIQUE("tenant_id","chunk_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_document_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","knowledge_document_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_file_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","file_id");--> statement-breakpoint
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");
