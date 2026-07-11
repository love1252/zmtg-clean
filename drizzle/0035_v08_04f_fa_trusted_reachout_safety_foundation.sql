CREATE TYPE "public"."customer_channel_type" AS ENUM('wechat_work');
CREATE TYPE "public"."customer_channel_contact_consent_status" AS ENUM('unknown', 'consented', 'opted_out', 'consent_revoked');
CREATE TYPE "public"."customer_channel_contact_consent_source_type" AS ENUM('customer_explicit_verbal', 'customer_explicit_written', 'customer_opt_out_request', 'customer_consent_revocation');

CREATE TABLE IF NOT EXISTS "customer_channel_contact_consents" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "channel_type" "customer_channel_type" NOT NULL,
  "status" "customer_channel_contact_consent_status" NOT NULL,
  "source_type" "customer_channel_contact_consent_source_type" NOT NULL,
  "evidence_ref" varchar(96) NOT NULL,
  "recorded_by" varchar(96) NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_channel_contact_consents_scope_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "channel_type"),
  CONSTRAINT "customer_channel_contact_consents_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "customer_channel_contact_consents_status_source_check" CHECK (("status" = 'consented' AND "source_type" IN ('customer_explicit_verbal', 'customer_explicit_written')) OR ("status" = 'opted_out' AND "source_type" = 'customer_opt_out_request') OR ("status" = 'consent_revoked' AND "source_type" = 'customer_consent_revocation'))
);

CREATE TABLE IF NOT EXISTS "customer_channel_frequency_states" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "customer_id" varchar(64) NOT NULL,
  "channel_type" "customer_channel_type" NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "window_ends_at" timestamp with time zone NOT NULL,
  "prepared_count" integer DEFAULT 0 NOT NULL,
  "completed_count" integer DEFAULT 0 NOT NULL,
  "max_prepared_count" integer DEFAULT 1 NOT NULL,
  "max_completed_count" integer DEFAULT 1 NOT NULL,
  "next_allowed_at" timestamp with time zone NOT NULL,
  "last_prepared_ref" varchar(96),
  "last_completed_ref" varchar(96),
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_channel_frequency_states_scope_unique" UNIQUE("tenant_id", "institution_id", "customer_id", "channel_type"),
  CONSTRAINT "customer_channel_frequency_states_counts_check" CHECK ("prepared_count" >= 0 AND "completed_count" >= 0 AND "prepared_count" <= "max_prepared_count" AND "completed_count" <= "max_completed_count"),
  CONSTRAINT "customer_channel_frequency_states_fixed_caps_check" CHECK ("max_prepared_count" = 1 AND "max_completed_count" = 1),
  CONSTRAINT "customer_channel_frequency_states_window_check" CHECK ("window_ends_at" = "window_started_at" + interval '24 hours' AND "next_allowed_at" = "window_ends_at"),
  CONSTRAINT "customer_channel_frequency_states_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE IF NOT EXISTS "institution_channel_dry_run_snapshots" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "tenant_id" varchar(64) NOT NULL,
  "institution_id" varchar(64) NOT NULL,
  "channel_type" "customer_channel_type" NOT NULL,
  "official_route" varchar(64) NOT NULL,
  "proof_institution_ref" varchar(96) NOT NULL,
  "callback_placeholder_ref" varchar(96) NOT NULL,
  "config_status" varchar(64) NOT NULL,
  "preflight_status" varchar(64) NOT NULL,
  "proof_eligible_mock" boolean NOT NULL,
  "evaluated_by" varchar(96) NOT NULL,
  "evaluated_at" timestamp with time zone NOT NULL,
  "allow_real_send" boolean DEFAULT false NOT NULL,
  "external_channel_enabled" boolean DEFAULT false NOT NULL,
  "real_send_allowed" boolean DEFAULT false NOT NULL,
  "dry_run_only" boolean DEFAULT true NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "institution_channel_dry_run_snapshots_scope_unique" UNIQUE("tenant_id", "institution_id", "channel_type"),
  CONSTRAINT "institution_channel_dry_run_snapshots_safety_check" CHECK ("allow_real_send" = false AND "external_channel_enabled" = false AND "real_send_allowed" = false AND "dry_run_only" = true),
  CONSTRAINT "institution_channel_dry_run_snapshots_route_check" CHECK ("official_route" IN ('official_wecom_self_built', 'official_wecom_third_party', 'official_wecom_service_provider')),
  CONSTRAINT "institution_channel_dry_run_snapshots_ready_check" CHECK ("config_status" <> 'dry_run_ready' OR ("preflight_status" = 'mock_ready' AND "proof_eligible_mock" = true)),
  CONSTRAINT "institution_channel_dry_run_snapshots_version_positive_check" CHECK ("version" > 0)
);

DO $$ BEGIN
  ALTER TABLE "customer_channel_contact_consents" ADD CONSTRAINT "customer_channel_contact_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_channel_contact_consents" ADD CONSTRAINT "customer_channel_contact_consents_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id") REFERENCES "public"."customers"("tenant_id", "institution_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_channel_frequency_states" ADD CONSTRAINT "customer_channel_frequency_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_channel_frequency_states" ADD CONSTRAINT "customer_channel_frequency_states_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id", "institution_id", "customer_id") REFERENCES "public"."customers"("tenant_id", "institution_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "institution_channel_dry_run_snapshots" ADD CONSTRAINT "institution_channel_dry_run_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
