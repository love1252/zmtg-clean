CREATE TABLE IF NOT EXISTS "knowledge_quota_usage_records" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64),
  "actor_user_id" varchar(96),
  "resource_key" varchar(96) NOT NULL,
  "action" varchar(96) NOT NULL,
  "status" varchar(32) NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "safe_reason_code" varchar(96) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "knowledge_quota_usage_records" ADD CONSTRAINT "knowledge_quota_usage_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "knowledge_quota_usage_records_tenant_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "knowledge_quota_usage_records_tenant_institution_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","institution_id","created_at");
CREATE INDEX IF NOT EXISTS "knowledge_quota_usage_records_resource_status_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","resource_key","status","created_at");
