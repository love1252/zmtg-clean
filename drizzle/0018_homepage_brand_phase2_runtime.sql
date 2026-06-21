CREATE TYPE "homepage_brand_config_status" AS ENUM('draft', 'published', 'archived');
--> statement-breakpoint
CREATE TYPE "homepage_brand_asset_kind" AS ENUM('logo', 'night_logo', 'mark_logo', 'hero_background', 'share_image');
--> statement-breakpoint
CREATE TYPE "homepage_brand_audit_action" AS ENUM('save_draft', 'upload_asset', 'publish', 'rollback');
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
CREATE TABLE "homepage_brand_config_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"config_id" varchar(64) NOT NULL,
	"version_number" integer NOT NULL,
	"config_json" jsonb NOT NULL,
	"summary" varchar(240) NOT NULL,
	"published_by" varchar(96) NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
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
ALTER TABLE "homepage_brand_config_versions" ADD CONSTRAINT "homepage_brand_config_versions_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_version_id_homepage_brand_config_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."homepage_brand_config_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_asset_id_homepage_brand_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."homepage_brand_assets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "homepage_brand_configs_status_updated_idx" ON "homepage_brand_configs" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_brand_config_versions_config_version_unique" ON "homepage_brand_config_versions" USING btree ("config_id","version_number");
--> statement-breakpoint
CREATE INDEX "homepage_brand_config_versions_config_published_idx" ON "homepage_brand_config_versions" USING btree ("config_id","published_at");
--> statement-breakpoint
CREATE INDEX "homepage_brand_assets_kind_created_idx" ON "homepage_brand_assets" USING btree ("kind","created_at");
--> statement-breakpoint
CREATE INDEX "homepage_brand_assets_checksum_idx" ON "homepage_brand_assets" USING btree ("checksum_sha256");
--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_action_created_idx" ON "homepage_brand_audit_logs" USING btree ("action","created_at");
--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_config_created_idx" ON "homepage_brand_audit_logs" USING btree ("config_id","created_at");
--> statement-breakpoint
CREATE INDEX "homepage_brand_audit_logs_actor_created_idx" ON "homepage_brand_audit_logs" USING btree ("actor_id","created_at");
