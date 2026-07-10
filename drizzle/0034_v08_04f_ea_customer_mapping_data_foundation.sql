CREATE TYPE "public"."wecom_customer_mapping_source_mode" AS ENUM('real_readonly_proof');
CREATE TYPE "public"."wecom_customer_mapping_status" AS ENUM('confirmed', 'rejected', 'revoked');

ALTER TABLE "customers" ADD COLUMN "institution_id" varchar(64);
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_institution_id_id_unique" UNIQUE("tenant_id","institution_id","id");

CREATE TABLE IF NOT EXISTS "wecom_customer_mapping_states" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "proof_contact_id" varchar(64) NOT NULL,
  "proof_employee_id" varchar(64) NOT NULL,
  "source_mode" "wecom_customer_mapping_source_mode" NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "status" "wecom_customer_mapping_status" NOT NULL,
  "decided_by" varchar(96) NOT NULL,
  "decided_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wecom_customer_mapping_states_tenant_institution_proof_contact_unique" UNIQUE("tenant_id","institution_id","proof_contact_id")
);

DO $$ BEGIN
 ALTER TABLE "wecom_customer_mapping_states" ADD CONSTRAINT "wecom_customer_mapping_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "wecom_customer_mapping_states" ADD CONSTRAINT "wecom_customer_mapping_states_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "wecom_customer_mapping_states_tenant_institution_customer_status_idx" ON "wecom_customer_mapping_states" USING btree ("tenant_id","institution_id","customer_id","status");
