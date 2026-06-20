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
CREATE INDEX "platform_ai_model_config_snapshots_updated_at_idx" ON "platform_ai_model_config_snapshots" USING btree ("updated_at");
