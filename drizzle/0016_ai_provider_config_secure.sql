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
CREATE INDEX "platform_ai_provider_configs_provider_idx" ON "platform_ai_provider_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "platform_ai_provider_configs_updated_at_idx" ON "platform_ai_provider_configs" USING btree ("updated_at");
