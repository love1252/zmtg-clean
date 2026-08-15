CREATE TYPE "public"."appointment_status" AS ENUM('pending_confirmation', 'confirmed', 'arrived', 'completed', 'reschedule_requested', 'cancelled');
CREATE TYPE "public"."audit_institution_attribution" AS ENUM('not_applicable', 'verified', 'legacy_unattributed');
CREATE TYPE "public"."audit_result" AS ENUM('allowed', 'denied', 'transitioned');
CREATE TYPE "public"."auth_account_status" AS ENUM('active', 'password_reset_required', 'disabled', 'locked');
CREATE TYPE "public"."auth_institution_binding_source" AS ENUM('manual_admin', 'migration_placeholder', 'system');
CREATE TYPE "public"."auth_institution_binding_status" AS ENUM('active', 'revoked');
CREATE TYPE "public"."auth_institution_binding_transition_type" AS ENUM('create', 'rebind', 'revoke', 'expire', 'legacy_calibration');
CREATE TYPE "public"."auth_role" AS ENUM('tenant_admin', 'tenant_operator', 'consultant', 'customer_service', 'platform_admin', 'platform_operator', 'security_auditor');
CREATE TYPE "public"."customer_channel_contact_consent_source_type" AS ENUM('customer_explicit_verbal', 'customer_explicit_written', 'customer_opt_out_request', 'customer_consent_revocation');
CREATE TYPE "public"."customer_channel_contact_consent_status" AS ENUM('unknown', 'consented', 'opted_out', 'consent_revoked');
CREATE TYPE "public"."customer_channel_type" AS ENUM('wechat_work');
CREATE TYPE "public"."customer_lifecycle" AS ENUM('consulting', 'scheduled', 'post_care', 'repurchase_window', 'silent_reactivation');
CREATE TYPE "public"."customer_priority" AS ENUM('high', 'medium', 'observe');
CREATE TYPE "public"."follow_up_customer_timeline_event_type" AS ENUM('followup_path_enrolled', 'followup_path_cancelled', 'followup_tasks_generated', 'followup_task_status_changed', 'followup_task_escalated', 'message_draft_created', 'message_draft_updated', 'message_draft_approved', 'message_draft_rejected', 'message_draft_marked_sent', 'manual_feedback_recorded');
CREATE TYPE "public"."follow_up_customer_timeline_source_type" AS ENUM('path_enrollment', 'followup_task', 'message_draft', 'manual_note');
CREATE TYPE "public"."follow_up_message_draft_status" AS ENUM('draft', 'approved', 'rejected', 'marked_sent', 'cancelled');
CREATE TYPE "public"."follow_up_risk_level" AS ENUM('normal', 'watch', 'urgent');
CREATE TYPE "public"."follow_up_status" AS ENUM('scheduled', 'due', 'in_progress', 'escalated', 'completed', 'cancelled');
CREATE TYPE "public"."his_connection_credential_compensation_dead_letter_reason" AS ENUM('retry_exhausted', 'claim_conflict', 'stale_recovery_conflict', 'provider_result_unknown', 'audit_write_unavailable', 'operation_state_conflict', 'unsafe_payload_summary');
CREATE TYPE "public"."his_connection_credential_compensation_job_state" AS ENUM('queued', 'claimed', 'running', 'succeeded', 'failed', 'dead_lettered', 'manual_review_required', 'cancelled');
CREATE TYPE "public"."his_connection_credential_compensation_operation_type" AS ENUM('credential_compensation');
CREATE TYPE "public"."his_connection_credential_compensation_state" AS ENUM('compensation_pending', 'compensation_running', 'compensation_succeeded', 'compensation_failed', 'manual_review_required');
CREATE TYPE "public"."his_connection_credential_provider_failure_category" AS ENUM('provider_unavailable', 'timeout', 'retry_exhausted', 'circuit_open', 'validation_failed', 'tenant_connection_mismatch', 'idempotency_conflict', 'invalid_state', 'provider_write_failed', 'provider_revoke_failed', 'provider_describe_failed', 'provider_health_failed', 'repository_after_provider_failed', 'audit_after_provider_failed');
CREATE TYPE "public"."his_connection_health_status" AS ENUM('unknown', 'healthy', 'degraded', 'failed');
CREATE TYPE "public"."his_connection_status" AS ENUM('draft', 'active', 'paused', 'revoked', 'deleted', 'error');
CREATE TYPE "public"."homepage_brand_asset_kind" AS ENUM('logo', 'night_logo', 'mark_logo', 'hero_background', 'share_image');
CREATE TYPE "public"."homepage_brand_audit_action" AS ENUM('save_draft', 'upload_asset', 'publish', 'rollback');
CREATE TYPE "public"."homepage_brand_config_status" AS ENUM('draft', 'published', 'archived');
CREATE TYPE "public"."institution_operating_context_source" AS ENUM('institution_config', 'product_default');
CREATE TYPE "public"."institution_provisioning_source" AS ENUM('formal_onboarding', 'approved_migration_manifest');
CREATE TYPE "public"."institution_scope_status" AS ENUM('active', 'suspended');
CREATE TYPE "public"."knowledge_base_runtime_readonly_status" AS ENUM('readonly', 'blocked');
CREATE TYPE "public"."knowledge_base_runtime_source_kind" AS ENUM('mock', 'seed', 'demo');
CREATE TYPE "public"."knowledge_base_runtime_status" AS ENUM('disabled', 'denied', 'empty', 'ready', 'pending', 'failed');
CREATE TYPE "public"."knowledge_indexing_job_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "public"."knowledge_indexing_job_type" AS ENUM('parse_file', 'generate_embeddings', 'rebuild_embeddings', 'rebuild_knowledge_index', 'ocr_file');
CREATE TYPE "public"."membership_lifecycle_status" AS ENUM('active', 'revoked', 'deleted');
CREATE TYPE "public"."membership_provenance_source" AS ENUM('formal_onboarding', 'access_control_command', 'legacy_calibration');
CREATE TYPE "public"."membership_transition_type" AS ENUM('create', 'refresh', 'revoke', 'reactivate', 'delete', 'legacy_calibration');
CREATE TYPE "public"."tenant_authorization_snapshot_status" AS ENUM('active', 'superseded', 'revoked');
CREATE TYPE "public"."tenant_commercial_record_status" AS ENUM('draft', 'pending', 'manual_review', 'completed', 'cancelled');
CREATE TYPE "public"."tenant_commercial_record_type" AS ENUM('order', 'contract', 'invoice', 'payment', 'tenant_opening', 'account_opening', 'plan_binding', 'plan_change', 'account_status_change');
CREATE TYPE "public"."tenant_plan_assignment_status" AS ENUM('active', 'scheduled', 'expired');
CREATE TYPE "public"."tenant_plan_change_status" AS ENUM('previewed', 'applied', 'cancelled', 'failed');
CREATE TYPE "public"."tenant_plan_status" AS ENUM('active', 'retired');
CREATE TYPE "public"."tenant_plan_version_status" AS ENUM('draft', 'published', 'retired');
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'trialing', 'expired');
CREATE TYPE "public"."wecom_customer_broadcast_recipient_binding_source_kind" AS ENUM('protected_vault_reference', 'protected_resolver_reference');
CREATE TYPE "public"."wecom_customer_broadcast_recipient_binding_status" AS ENUM('active', 'revoked', 'stale');
CREATE TYPE "public"."wecom_customer_broadcast_task_dispatch_state" AS ENUM('not_started', 'task_create_attempted', 'task_created', 'task_create_failed', 'task_create_unknown');
CREATE TYPE "public"."wecom_customer_broadcast_task_finalize_state" AS ENUM('not_finalized', 'success_recorded', 'failure_recorded', 'unknown_recorded');
CREATE TYPE "public"."wecom_customer_broadcast_task_reconciliation_state" AS ENUM('none', 'manual_review_required', 'reconciled');
CREATE TYPE "public"."wecom_customer_broadcast_task_send_result_status" AS ENUM('not_checked', 'awaiting_member_confirmation', 'target_sent', 'target_failed', 'target_unknown');
CREATE TYPE "public"."wecom_customer_mapping_source_mode" AS ENUM('real_readonly_proof');
CREATE TYPE "public"."wecom_customer_mapping_status" AS ENUM('confirmed', 'rejected', 'revoked');
CREATE TYPE "public"."wecom_real_send_proof_control_scope_kind" AS ENUM('global', 'tenant', 'institution', 'channel', 'customer', 'operator_role');
CREATE TYPE "public"."wecom_real_send_proof_operation_status" AS ENUM('requested', 'aborted', 'attempted', 'succeeded', 'failed', 'unknown_outcome');
CREATE TYPE "public"."wecom_real_send_proof_postcheck_status" AS ENUM('ready', 'blocked', 'expired');
CREATE TYPE "public"."wecom_real_send_proof_provider_result_category" AS ENUM('accepted', 'rejected', 'transport_error', 'timeout', 'indeterminate');
CREATE TABLE "ai_call_usage_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"actor_user_id" varchar(96) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"latency_ms" integer,
	"status" varchar(32) NOT NULL,
	"error_code" varchar(64),
	"metadata" jsonb,
	"ai_credits_consumed" integer,
	"metering_status" varchar(32),
	"metering_version" varchar(64),
	"metering_details" jsonb,
	"service_category" varchar(64),
	"service_name" varchar(128),
	"service_source" varchar(96),
	"service_action" varchar(96),
	"service_version" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_call_usage_records_tenant_id_unique" UNIQUE("tenant_id","id")
);

CREATE TABLE "appointments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"project" varchar(160) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"consultant_user_id" varchar(96) NOT NULL,
	"status" "appointment_status" NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_tenant_id_id_unique" UNIQUE("tenant_id","id")
);

CREATE TABLE "audit_events" (
	"event_id" varchar(96) PRIMARY KEY NOT NULL,
	"actor_id" varchar(96) NOT NULL,
	"actor_role" "auth_role" NOT NULL,
	"tenant_id" varchar(64),
	"institution_id" varchar(64),
	"institution_attribution" "audit_institution_attribution",
	"scope" varchar(24) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"resource_id" varchar(96),
	"action" varchar(64) NOT NULL,
	"result" "audit_result" NOT NULL,
	"reason" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" varchar(48) NOT NULL
);

CREATE TABLE "auth_account_institution_binding_transitions" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"binding_id" varchar(64) NOT NULL,
	"replacement_binding_id" varchar(64),
	"command_id" varchar(128) NOT NULL,
	"transition_type" "auth_institution_binding_transition_type" NOT NULL,
	"provenance_source" "membership_provenance_source" NOT NULL,
	"assignment_source" "auth_institution_binding_source" NOT NULL,
	"actor_id" varchar(96),
	"reason_code" varchar(96) NOT NULL,
	"from_status" "auth_institution_binding_status",
	"to_status" "auth_institution_binding_status" NOT NULL,
	"from_version" integer,
	"to_version" integer NOT NULL,
	"membership_revision" integer NOT NULL,
	"scope_revision" integer,
	"occurred_at" timestamp with time zone,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_binding_transitions_tenant_command_unique" UNIQUE("tenant_id","command_id"),
	CONSTRAINT "auth_binding_transitions_binding_version_unique" UNIQUE("binding_id","to_version"),
	CONSTRAINT "auth_binding_transitions_identity_present_check" CHECK (length(trim("auth_account_institution_binding_transitions"."id")) > 0
        AND length(trim("auth_account_institution_binding_transitions"."command_id")) > 0
        AND length(trim("auth_account_institution_binding_transitions"."reason_code")) > 0),
	CONSTRAINT "auth_binding_transitions_version_shape_check" CHECK ("auth_account_institution_binding_transitions"."to_version" BETWEEN 1 AND 2147483647
        AND "auth_account_institution_binding_transitions"."membership_revision" BETWEEN 1 AND 2147483647
        AND (
          (
            "auth_account_institution_binding_transitions"."transition_type" = 'create'
            AND "auth_account_institution_binding_transitions"."from_version" IS NULL
            AND "auth_account_institution_binding_transitions"."to_version" = 1
          ) OR (
            "auth_account_institution_binding_transitions"."transition_type" = 'legacy_calibration'
            AND "auth_account_institution_binding_transitions"."from_version" IS NULL
          ) OR (
            "auth_account_institution_binding_transitions"."transition_type" IN ('rebind', 'revoke', 'expire')
            AND "auth_account_institution_binding_transitions"."from_version" BETWEEN 1 AND 2147483646
            AND "auth_account_institution_binding_transitions"."to_version" = "auth_account_institution_binding_transitions"."from_version" + 1
          )
        )),
	CONSTRAINT "auth_binding_transitions_status_shape_check" CHECK ((
          "auth_account_institution_binding_transitions"."transition_type" = 'create'
          AND "auth_account_institution_binding_transitions"."from_status" IS NULL
          AND "auth_account_institution_binding_transitions"."to_status" = 'active'
          AND "auth_account_institution_binding_transitions"."replacement_binding_id" IS NULL
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" = 'legacy_calibration'
          AND "auth_account_institution_binding_transitions"."from_status" IS NULL
          AND "auth_account_institution_binding_transitions"."to_status" IN ('active', 'revoked')
          AND "auth_account_institution_binding_transitions"."replacement_binding_id" IS NULL
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" = 'rebind'
          AND "auth_account_institution_binding_transitions"."from_status" = 'active'
          AND "auth_account_institution_binding_transitions"."to_status" = 'revoked'
          AND "auth_account_institution_binding_transitions"."replacement_binding_id" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."replacement_binding_id" <> "auth_account_institution_binding_transitions"."binding_id"
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" IN ('revoke', 'expire')
          AND "auth_account_institution_binding_transitions"."from_status" = 'active'
          AND "auth_account_institution_binding_transitions"."to_status" = 'revoked'
          AND "auth_account_institution_binding_transitions"."replacement_binding_id" IS NULL
        )),
	CONSTRAINT "auth_binding_transitions_observation_shape_check" CHECK ((
          "auth_account_institution_binding_transitions"."transition_type" IN ('create', 'rebind')
          AND "auth_account_institution_binding_transitions"."scope_revision" BETWEEN 1 AND 2147483647
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" IN ('revoke', 'expire', 'legacy_calibration')
          AND "auth_account_institution_binding_transitions"."scope_revision" IS NULL
        )),
	CONSTRAINT "auth_binding_transitions_provenance_shape_check" CHECK ((
          "auth_account_institution_binding_transitions"."transition_type" = 'legacy_calibration'
          AND "auth_account_institution_binding_transitions"."provenance_source" = 'legacy_calibration'
          AND "auth_account_institution_binding_transitions"."actor_id" IS NULL
          AND "auth_account_institution_binding_transitions"."reason_code" = 'legacy_unknown'
          AND "auth_account_institution_binding_transitions"."occurred_at" IS NULL
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" = 'create'
          AND "auth_account_institution_binding_transitions"."provenance_source" IN ('formal_onboarding', 'access_control_command')
          AND "auth_account_institution_binding_transitions"."assignment_source" IN ('manual_admin', 'system')
          AND "auth_account_institution_binding_transitions"."actor_id" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."occurred_at" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."recorded_at" >= "auth_account_institution_binding_transitions"."occurred_at"
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" = 'rebind'
          AND "auth_account_institution_binding_transitions"."provenance_source" = 'access_control_command'
          AND "auth_account_institution_binding_transitions"."assignment_source" IN ('manual_admin', 'system')
          AND "auth_account_institution_binding_transitions"."actor_id" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."occurred_at" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."recorded_at" >= "auth_account_institution_binding_transitions"."occurred_at"
        ) OR (
          "auth_account_institution_binding_transitions"."transition_type" IN ('revoke', 'expire')
          AND "auth_account_institution_binding_transitions"."provenance_source" = 'access_control_command'
          AND "auth_account_institution_binding_transitions"."actor_id" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."occurred_at" IS NOT NULL
          AND "auth_account_institution_binding_transitions"."recorded_at" >= "auth_account_institution_binding_transitions"."occurred_at"
        ))
);

CREATE TABLE "auth_account_institution_bindings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"account_id" varchar(96) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"status" "auth_institution_binding_status" DEFAULT 'active' NOT NULL,
	"source" "auth_institution_binding_source" NOT NULL,
	"assigned_by" varchar(96) NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_account_institution_bindings_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "auth_account_institution_bindings_status_shape_check" CHECK (("auth_account_institution_bindings"."status" = 'active' AND "auth_account_institution_bindings"."revoked_at" IS NULL AND "auth_account_institution_bindings"."institution_id" IS NOT NULL) OR ("auth_account_institution_bindings"."status" = 'revoked' AND "auth_account_institution_bindings"."revoked_at" IS NOT NULL AND "auth_account_institution_bindings"."institution_id" IS NOT NULL AND "auth_account_institution_bindings"."revoked_at" >= "auth_account_institution_bindings"."assigned_at")),
	CONSTRAINT "auth_account_institution_bindings_expiry_check" CHECK ("auth_account_institution_bindings"."expires_at" IS NULL OR "auth_account_institution_bindings"."expires_at" > "auth_account_institution_bindings"."assigned_at"),
	CONSTRAINT "auth_account_institution_bindings_source_authority_check" CHECK ("auth_account_institution_bindings"."status" <> 'active' OR "auth_account_institution_bindings"."source" IN ('manual_admin', 'system')),
	CONSTRAINT "auth_account_institution_bindings_version_positive_check" CHECK ("auth_account_institution_bindings"."version" > 0)
);

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

CREATE TABLE "customer_channel_contact_consents" (
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
	CONSTRAINT "customer_channel_contact_consents_scope_unique" UNIQUE("tenant_id","institution_id","customer_id","channel_type"),
	CONSTRAINT "customer_channel_contact_consents_scope_id_unique" UNIQUE("tenant_id","institution_id","customer_id","channel_type","id"),
	CONSTRAINT "customer_channel_contact_consents_version_positive_check" CHECK ("customer_channel_contact_consents"."version" > 0),
	CONSTRAINT "customer_channel_contact_consents_status_source_check" CHECK (("customer_channel_contact_consents"."status" = 'consented' AND "customer_channel_contact_consents"."source_type" IN ('customer_explicit_verbal', 'customer_explicit_written')) OR ("customer_channel_contact_consents"."status" = 'opted_out' AND "customer_channel_contact_consents"."source_type" = 'customer_opt_out_request') OR ("customer_channel_contact_consents"."status" = 'consent_revoked' AND "customer_channel_contact_consents"."source_type" = 'customer_consent_revocation'))
);

CREATE TABLE "customer_channel_frequency_states" (
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
	CONSTRAINT "customer_channel_frequency_states_scope_unique" UNIQUE("tenant_id","institution_id","customer_id","channel_type"),
	CONSTRAINT "customer_channel_frequency_states_scope_id_unique" UNIQUE("tenant_id","institution_id","customer_id","channel_type","id"),
	CONSTRAINT "customer_channel_frequency_states_counts_check" CHECK ("customer_channel_frequency_states"."prepared_count" >= 0 AND "customer_channel_frequency_states"."completed_count" >= 0 AND "customer_channel_frequency_states"."prepared_count" <= "customer_channel_frequency_states"."max_prepared_count" AND "customer_channel_frequency_states"."completed_count" <= "customer_channel_frequency_states"."max_completed_count"),
	CONSTRAINT "customer_channel_frequency_states_fixed_caps_check" CHECK ("customer_channel_frequency_states"."max_prepared_count" = 1 AND "customer_channel_frequency_states"."max_completed_count" = 1),
	CONSTRAINT "customer_channel_frequency_states_window_check" CHECK ("customer_channel_frequency_states"."window_ends_at" = "customer_channel_frequency_states"."window_started_at" + interval '24 hours' AND "customer_channel_frequency_states"."next_allowed_at" = "customer_channel_frequency_states"."window_ends_at"),
	CONSTRAINT "customer_channel_frequency_states_version_positive_check" CHECK ("customer_channel_frequency_states"."version" > 0)
);

CREATE TABLE "customers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"display_name" varchar(120) NOT NULL,
	"lifecycle" "customer_lifecycle" NOT NULL,
	"priority" "customer_priority" NOT NULL,
	"owner_user_id" varchar(96) NOT NULL,
	"project_interest" varchar(160) NOT NULL,
	"masked_phone" varchar(32) NOT NULL,
	"masked_medical_record_no" varchar(64) NOT NULL,
	"last_touch_summary" text NOT NULL,
	"next_action" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gender" varchar(20) DEFAULT '' NOT NULL,
	"birth_date" varchar(20) DEFAULT '' NOT NULL,
	"referral_source" varchar(80) DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "customers_tenant_institution_id_id_unique" UNIQUE("tenant_id","institution_id","id")
);

CREATE TABLE "follow_up_customer_timeline_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"source_type" "follow_up_customer_timeline_source_type" NOT NULL,
	"source_id" varchar(96) NOT NULL,
	"event_type" "follow_up_customer_timeline_event_type" NOT NULL,
	"event_title" varchar(160) NOT NULL,
	"safe_summary" varchar(240) NOT NULL,
	"risk_level" "follow_up_risk_level",
	"occurred_at" timestamp with time zone NOT NULL,
	"safe_actor_role" varchar(64),
	"safe_reason_code" varchar(96) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "follow_up_message_drafts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"follow_up_task_id" varchar(64) NOT NULL,
	"enrollment_id" varchar(64),
	"stage_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"template_id" varchar(64),
	"channel_type" varchar(32) DEFAULT 'manual' NOT NULL,
	"status" "follow_up_message_draft_status" DEFAULT 'draft' NOT NULL,
	"draft_content" text NOT NULL,
	"edited_content" text,
	"safe_preview" varchar(240) NOT NULL,
	"approved_by" varchar(96),
	"approved_at" timestamp with time zone,
	"rejected_by" varchar(96),
	"rejected_at" timestamp with time zone,
	"marked_sent_by" varchar(96),
	"marked_sent_at" timestamp with time zone,
	"safe_reason_code" varchar(96) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_message_drafts_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "follow_up_message_drafts_scope_customer_id_unique" UNIQUE("tenant_id","institution_id","customer_id","id")
);

CREATE TABLE "follow_up_message_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64),
	"institution_id" varchar(64),
	"template_key" varchar(96) NOT NULL,
	"template_name" varchar(160) NOT NULL,
	"template_type" varchar(40) NOT NULL,
	"applicable_template_key" varchar(64),
	"applicable_node_key" varchar(96),
	"channel_type" varchar(32) DEFAULT 'manual' NOT NULL,
	"content_template" text NOT NULL,
	"variables_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"requires_human_approval" boolean DEFAULT true NOT NULL,
	"forbid_auto_send" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "follow_up_path_enrollments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"treatment_summary_id" varchar(64),
	"source_type" varchar(40) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"template_key" varchar(64) NOT NULL,
	"template_version" varchar(64) DEFAULT 'v0.6-static' NOT NULL,
	"template_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"safe_reason_code" varchar(96) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_path_enrollments_tenant_id_id_unique" UNIQUE("tenant_id","id")
);

CREATE TABLE "follow_up_path_stages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"enrollment_id" varchar(64) NOT NULL,
	"node_key" varchar(96) NOT NULL,
	"stage_key" varchar(64) NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "follow_up_status" DEFAULT 'scheduled' NOT NULL,
	"follow_up_task_id" varchar(64),
	"handler_role" varchar(64) NOT NULL,
	"risk_level" "follow_up_risk_level" NOT NULL,
	"safe_message" varchar(240) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_path_stages_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "follow_up_path_stages_enrollment_node_unique" UNIQUE("tenant_id","enrollment_id","node_key")
);

CREATE TABLE "follow_up_tasks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(120) NOT NULL,
	"journey_id" varchar(96) NOT NULL,
	"stage" varchar(120) NOT NULL,
	"status" "follow_up_status" NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"suggested_action" text NOT NULL,
	"risk_level" "follow_up_risk_level" NOT NULL,
	"source_treatment_summary_id" varchar(64),
	"source_suggestion_key" varchar(180),
	"updated_by" varchar(96),
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_tasks_tenant_id_id_unique" UNIQUE("tenant_id","id")
);

CREATE TABLE "his_connection_credential_compensation_jobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_id" varchar(64) NOT NULL,
	"operation_id" varchar(96) NOT NULL,
	"operation_type" "his_connection_credential_compensation_operation_type" DEFAULT 'credential_compensation' NOT NULL,
	"job_state" "his_connection_credential_compensation_job_state" DEFAULT 'queued' NOT NULL,
	"failure_category" "his_connection_credential_provider_failure_category" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retry_count" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"claim_id" varchar(96),
	"claim_version" integer DEFAULT 0 NOT NULL,
	"claimed_by" varchar(96),
	"claimed_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"dead_letter_reason" "his_connection_credential_compensation_dead_letter_reason",
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE "his_connection_credential_compensation_operations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_id" varchar(64) NOT NULL,
	"operation_id" varchar(96) NOT NULL,
	"operation_type" "his_connection_credential_compensation_operation_type" DEFAULT 'credential_compensation' NOT NULL,
	"state" "his_connection_credential_compensation_state" DEFAULT 'compensation_pending' NOT NULL,
	"failure_category" "his_connection_credential_provider_failure_category" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);

CREATE TABLE "his_connections" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"connection_name" varchar(160) NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"vendor_type" varchar(64) NOT NULL,
	"system_type" varchar(64) NOT NULL,
	"status" "his_connection_status" DEFAULT 'draft' NOT NULL,
	"credential_ref" varchar(128),
	"health_status" "his_connection_health_status" DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error_code" varchar(96),
	"created_by" varchar(96) NOT NULL,
	"updated_by" varchar(96),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "his_connections_tenant_id_id_unique" UNIQUE("tenant_id","id")
);

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

CREATE TABLE "institution_channel_dry_run_snapshots" (
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
	CONSTRAINT "institution_channel_dry_run_snapshots_scope_unique" UNIQUE("tenant_id","institution_id","channel_type"),
	CONSTRAINT "institution_channel_dry_run_snapshots_scope_id_unique" UNIQUE("tenant_id","institution_id","channel_type","id"),
	CONSTRAINT "institution_channel_dry_run_snapshots_safety_check" CHECK ("institution_channel_dry_run_snapshots"."allow_real_send" = false AND "institution_channel_dry_run_snapshots"."external_channel_enabled" = false AND "institution_channel_dry_run_snapshots"."real_send_allowed" = false AND "institution_channel_dry_run_snapshots"."dry_run_only" = true),
	CONSTRAINT "institution_channel_dry_run_snapshots_route_check" CHECK ("institution_channel_dry_run_snapshots"."official_route" IN ('official_wecom_self_built', 'official_wecom_third_party', 'official_wecom_service_provider')),
	CONSTRAINT "institution_channel_dry_run_snapshots_ready_check" CHECK ("institution_channel_dry_run_snapshots"."config_status" <> 'dry_run_ready' OR ("institution_channel_dry_run_snapshots"."official_route" = 'official_wecom_self_built' AND "institution_channel_dry_run_snapshots"."preflight_status" = 'mock_ready' AND "institution_channel_dry_run_snapshots"."proof_eligible_mock" = true)),
	CONSTRAINT "institution_channel_dry_run_snapshots_version_positive_check" CHECK ("institution_channel_dry_run_snapshots"."version" > 0)
);

CREATE TABLE "institution_operating_context_versions" (
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"effective_from_business_date" date NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"source" "institution_operating_context_source" NOT NULL,
	"migration_provenance" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(96) NOT NULL,
	CONSTRAINT "institution_operating_context_versions_pk" PRIMARY KEY("tenant_id","institution_id","version"),
	CONSTRAINT "institution_operating_context_versions_effective_at_unique" UNIQUE("tenant_id","institution_id","effective_at"),
	CONSTRAINT "institution_operating_context_versions_version_positive_check" CHECK ("institution_operating_context_versions"."version" > 0),
	CONSTRAINT "institution_operating_context_versions_timezone_present_check" CHECK (length(trim("institution_operating_context_versions"."timezone")) > 0),
	CONSTRAINT "institution_operating_context_versions_currency_format_check" CHECK (length("institution_operating_context_versions"."currency") = 3 AND "institution_operating_context_versions"."currency" = upper("institution_operating_context_versions"."currency"))
);

CREATE TABLE "institution_operating_contexts" (
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"revision" integer NOT NULL,
	"latest_version" integer NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_operating_contexts_pk" PRIMARY KEY("tenant_id","institution_id"),
	CONSTRAINT "institution_operating_contexts_revision_positive_check" CHECK ("institution_operating_contexts"."revision" > 0),
	CONSTRAINT "institution_operating_contexts_latest_version_positive_check" CHECK ("institution_operating_contexts"."latest_version" > 0)
);

CREATE TABLE "institution_scopes" (
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"status" "institution_scope_status" NOT NULL,
	"revision" integer NOT NULL,
	"provisioning_source" "institution_provisioning_source" NOT NULL,
	"provisioning_reference_digest" varchar(64) NOT NULL,
	"approved_by" varchar(96) NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_scopes_pk" PRIMARY KEY("tenant_id","institution_id"),
	CONSTRAINT "institution_scopes_revision_positive_check" CHECK ("institution_scopes"."revision" > 0),
	CONSTRAINT "institution_scopes_provisioning_reference_digest_length_check" CHECK (length("institution_scopes"."provisioning_reference_digest") = 64)
);

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
	"failure_reason_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_unique" UNIQUE("tenant_id","chunk_id")
);

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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE "knowledge_quota_usage_records" (
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

CREATE TABLE "platform_ai_credit_metering_rules" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(128) NOT NULL,
	"metering_version" varchar(64) NOT NULL,
	"input_token_weight" numeric(12, 6) NOT NULL,
	"output_token_weight" numeric(12, 6) NOT NULL,
	"model_multiplier" numeric(12, 6) NOT NULL,
	"rag_credit_surcharge" integer NOT NULL,
	"credits_per_standard_token_unit" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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

CREATE TABLE "platform_knowledge_institution_visibility" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"knowledge_document_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_kb_visibility_tenant_document_institution_unique" UNIQUE("tenant_id","knowledge_document_id","institution_id")
);

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

CREATE TABLE "tenant_members" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"user_id" varchar(96) NOT NULL,
	"role" "auth_role" NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"revision" integer NOT NULL,
	"lifecycle_status" "membership_lifecycle_status" NOT NULL,
	"current_provenance_source" "membership_provenance_source" NOT NULL,
	"current_provenance_actor_id" varchar(96),
	"current_provenance_reason_code" varchar(96) NOT NULL,
	"current_provenance_command_id" varchar(128) NOT NULL,
	"current_provenance_occurred_at" timestamp with time zone,
	"current_provenance_recorded_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_members_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tenant_members_current_envelope_shape_check" CHECK ((
        "tenant_members"."revision" IS NOT NULL
        AND "tenant_members"."revision" BETWEEN 1 AND 2147483647
        AND "tenant_members"."lifecycle_status" IS NOT NULL
        AND "tenant_members"."current_provenance_source" IS NOT NULL
        AND "tenant_members"."current_provenance_reason_code" IS NOT NULL
        AND "tenant_members"."current_provenance_command_id" IS NOT NULL
        AND "tenant_members"."current_provenance_recorded_at" IS NOT NULL
        AND (
          (
            "tenant_members"."current_provenance_source" = 'legacy_calibration'
            AND "tenant_members"."revision" = 1
            AND "tenant_members"."lifecycle_status" = 'active'
            AND "tenant_members"."current_provenance_actor_id" IS NULL
            AND "tenant_members"."current_provenance_reason_code" = 'legacy_unknown'
            AND "tenant_members"."current_provenance_occurred_at" IS NULL
          ) OR (
            "tenant_members"."current_provenance_source" = 'formal_onboarding'
            AND "tenant_members"."revision" = 1
            AND "tenant_members"."lifecycle_status" = 'active'
            AND "tenant_members"."current_provenance_actor_id" IS NOT NULL
            AND "tenant_members"."current_provenance_occurred_at" IS NOT NULL
            AND "tenant_members"."current_provenance_recorded_at" >= "tenant_members"."current_provenance_occurred_at"
          ) OR (
            "tenant_members"."current_provenance_source" = 'access_control_command'
            AND "tenant_members"."current_provenance_actor_id" IS NOT NULL
            AND "tenant_members"."current_provenance_occurred_at" IS NOT NULL
            AND "tenant_members"."current_provenance_recorded_at" >= "tenant_members"."current_provenance_occurred_at"
          )
        )
        AND (
          (
            "tenant_members"."lifecycle_status" = 'active'
            AND "tenant_members"."revoked_at" IS NULL
            AND "tenant_members"."deleted_at" IS NULL
          ) OR (
            "tenant_members"."lifecycle_status" = 'revoked'
            AND "tenant_members"."revision" >= 2
            AND "tenant_members"."revoked_at" IS NOT NULL
            AND "tenant_members"."revoked_at" = "tenant_members"."current_provenance_occurred_at"
            AND "tenant_members"."deleted_at" IS NULL
          ) OR (
            "tenant_members"."lifecycle_status" = 'deleted'
            AND "tenant_members"."revision" >= 2
            AND "tenant_members"."deleted_at" IS NOT NULL
            AND "tenant_members"."deleted_at" = "tenant_members"."current_provenance_occurred_at"
            AND ("tenant_members"."revoked_at" IS NULL OR "tenant_members"."revoked_at" <= "tenant_members"."deleted_at")
          )
        )
      ))
);

CREATE TABLE "tenant_membership_transitions" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"membership_id" varchar(64) NOT NULL,
	"command_id" varchar(128) NOT NULL,
	"transition_type" "membership_transition_type" NOT NULL,
	"source" "membership_provenance_source" NOT NULL,
	"actor_id" varchar(96),
	"reason_code" varchar(96) NOT NULL,
	"from_revision" integer,
	"to_revision" integer NOT NULL,
	"from_lifecycle_status" "membership_lifecycle_status",
	"to_lifecycle_status" "membership_lifecycle_status" NOT NULL,
	"from_role" "auth_role",
	"to_role" "auth_role" NOT NULL,
	"occurred_at" timestamp with time zone,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tenant_membership_transitions_tenant_command_unique" UNIQUE("tenant_id","command_id"),
	CONSTRAINT "tenant_membership_transitions_membership_revision_unique" UNIQUE("membership_id","to_revision"),
	CONSTRAINT "tenant_membership_transitions_revision_shape_check" CHECK ("tenant_membership_transitions"."to_revision" BETWEEN 1 AND 2147483647 AND (
        (
          "tenant_membership_transitions"."transition_type" IN ('create', 'legacy_calibration')
          AND "tenant_membership_transitions"."from_revision" IS NULL
          AND "tenant_membership_transitions"."to_revision" = 1
        ) OR (
          "tenant_membership_transitions"."transition_type" IN ('refresh', 'revoke', 'reactivate', 'delete')
          AND "tenant_membership_transitions"."from_revision" IS NOT NULL
          AND "tenant_membership_transitions"."from_revision" BETWEEN 1 AND 2147483646
          AND "tenant_membership_transitions"."to_revision" = "tenant_membership_transitions"."from_revision" + 1
        )
      )),
	CONSTRAINT "tenant_membership_transitions_lifecycle_shape_check" CHECK ((
        "tenant_membership_transitions"."transition_type" IN ('create', 'legacy_calibration')
        AND "tenant_membership_transitions"."from_lifecycle_status" IS NULL
        AND "tenant_membership_transitions"."to_lifecycle_status" = 'active'
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'refresh'
        AND "tenant_membership_transitions"."from_lifecycle_status" IS NOT NULL
        AND "tenant_membership_transitions"."from_lifecycle_status" = 'active'
        AND "tenant_membership_transitions"."to_lifecycle_status" = 'active'
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'revoke'
        AND "tenant_membership_transitions"."from_lifecycle_status" IS NOT NULL
        AND "tenant_membership_transitions"."from_lifecycle_status" = 'active'
        AND "tenant_membership_transitions"."to_lifecycle_status" = 'revoked'
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'reactivate'
        AND "tenant_membership_transitions"."from_lifecycle_status" IS NOT NULL
        AND "tenant_membership_transitions"."from_lifecycle_status" = 'revoked'
        AND "tenant_membership_transitions"."to_lifecycle_status" = 'active'
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'delete'
        AND "tenant_membership_transitions"."from_lifecycle_status" IS NOT NULL
        AND "tenant_membership_transitions"."from_lifecycle_status" IN ('active', 'revoked')
        AND "tenant_membership_transitions"."to_lifecycle_status" = 'deleted'
      )),
	CONSTRAINT "tenant_membership_transitions_role_shape_check" CHECK ((
        "tenant_membership_transitions"."transition_type" IN ('create', 'legacy_calibration')
        AND "tenant_membership_transitions"."from_role" IS NULL
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'refresh'
        AND "tenant_membership_transitions"."from_role" IS NOT NULL
        AND "tenant_membership_transitions"."from_role" <> "tenant_membership_transitions"."to_role"
      ) OR (
        "tenant_membership_transitions"."transition_type" IN ('revoke', 'reactivate', 'delete')
        AND "tenant_membership_transitions"."from_role" IS NOT NULL
        AND "tenant_membership_transitions"."from_role" = "tenant_membership_transitions"."to_role"
      )),
	CONSTRAINT "tenant_membership_transitions_provenance_shape_check" CHECK ((
        "tenant_membership_transitions"."transition_type" = 'legacy_calibration'
        AND "tenant_membership_transitions"."source" = 'legacy_calibration'
        AND "tenant_membership_transitions"."actor_id" IS NULL
        AND "tenant_membership_transitions"."reason_code" = 'legacy_unknown'
        AND "tenant_membership_transitions"."occurred_at" IS NULL
      ) OR (
        "tenant_membership_transitions"."transition_type" = 'create'
        AND "tenant_membership_transitions"."source" IN ('formal_onboarding', 'access_control_command')
        AND "tenant_membership_transitions"."actor_id" IS NOT NULL
        AND "tenant_membership_transitions"."occurred_at" IS NOT NULL
        AND "tenant_membership_transitions"."recorded_at" >= "tenant_membership_transitions"."occurred_at"
      ) OR (
        "tenant_membership_transitions"."transition_type" IN ('refresh', 'revoke', 'reactivate', 'delete')
        AND "tenant_membership_transitions"."source" = 'access_control_command'
        AND "tenant_membership_transitions"."actor_id" IS NOT NULL
        AND "tenant_membership_transitions"."occurred_at" IS NOT NULL
        AND "tenant_membership_transitions"."recorded_at" >= "tenant_membership_transitions"."occurred_at"
      ))
);

CREATE TABLE "tenant_plan_assignments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"plan_version_id" varchar(64),
	"status" "tenant_plan_assignment_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

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
	"monthly_ai_credit_limit" integer,
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

CREATE TABLE "tenant_plans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"status" "tenant_plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tenant_quota_snapshots" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_assignment_id" varchar(64) NOT NULL,
	"max_customers" integer NOT NULL,
	"max_appointments" integer NOT NULL,
	"max_follow_ups" integer NOT NULL,
	"max_ai_calls" integer NOT NULL,
	"max_ai_credits" integer,
	"current_customers" integer NOT NULL,
	"current_appointments" integer NOT NULL,
	"current_follow_ups" integer NOT NULL,
	"current_ai_calls" integer NOT NULL,
	"current_ai_credits" integer,
	"snapshot_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tenants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "treatment_summaries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64),
	"customer_id" varchar(64) NOT NULL,
	"appointment_id" varchar(64),
	"treatment_date" timestamp with time zone NOT NULL,
	"treatment_project" varchar(160) NOT NULL,
	"treatment_category" varchar(96) NOT NULL,
	"treatment_stage" varchar(120) NOT NULL,
	"recovery_stage" varchar(120) NOT NULL,
	"risk_level" "follow_up_risk_level" NOT NULL,
	"owner_user_id" varchar(96) NOT NULL,
	"summary" text NOT NULL,
	"next_care_action" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" varchar(96),
	"void_reason_code" varchar(64),
	"void_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_summaries_tenant_id_id_unique" UNIQUE("tenant_id","id")
);

CREATE TABLE "wecom_customer_broadcast_recipient_bindings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"operation_id" varchar(64) NOT NULL,
	"operation_ref" varchar(96) NOT NULL,
	"mapping_id" varchar(64) NOT NULL,
	"recipient_binding_ref" varchar(96) NOT NULL,
	"recipient_binding_digest" varchar(64) NOT NULL,
	"recipient_binding_version" integer NOT NULL,
	"opaque_handle_ref" varchar(128) NOT NULL,
	"source_kind" "wecom_customer_broadcast_recipient_binding_source_kind" NOT NULL,
	"status" "wecom_customer_broadcast_recipient_binding_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wecom_customer_broadcast_recipient_bindings_scope_ref_unique" UNIQUE("tenant_id","institution_id","recipient_binding_ref"),
	CONSTRAINT "wecom_customer_broadcast_recipient_bindings_digest_length_check" CHECK (length("wecom_customer_broadcast_recipient_bindings"."recipient_binding_digest") = 64 AND "wecom_customer_broadcast_recipient_bindings"."recipient_binding_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "wecom_customer_broadcast_recipient_bindings_version_positive_check" CHECK ("wecom_customer_broadcast_recipient_bindings"."recipient_binding_version" > 0),
	CONSTRAINT "wecom_customer_broadcast_recipient_bindings_reference_check" CHECK (length(trim("wecom_customer_broadcast_recipient_bindings"."recipient_binding_ref")) > 0 AND length(trim("wecom_customer_broadcast_recipient_bindings"."opaque_handle_ref")) > 0),
	CONSTRAINT "wecom_customer_broadcast_recipient_bindings_status_shape_check" CHECK (("wecom_customer_broadcast_recipient_bindings"."status" = 'active' AND "wecom_customer_broadcast_recipient_bindings"."revoked_at" IS NULL) OR ("wecom_customer_broadcast_recipient_bindings"."status" IN ('revoked', 'stale') AND "wecom_customer_broadcast_recipient_bindings"."revoked_at" IS NOT NULL AND "wecom_customer_broadcast_recipient_bindings"."revoked_at" >= "wecom_customer_broadcast_recipient_bindings"."created_at"))
);

CREATE TABLE "wecom_customer_broadcast_task_provider_attempts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"operation_id" varchar(64) NOT NULL,
	"operation_ref" varchar(96) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"capability_kind" varchar(64) DEFAULT 'customer_broadcast_task' NOT NULL,
	"provider_kind" varchar(64) DEFAULT 'wecom_official_customer_broadcast' NOT NULL,
	"dispatch_state" "wecom_customer_broadcast_task_dispatch_state" DEFAULT 'not_started' NOT NULL,
	"dispatch_count" integer DEFAULT 0 NOT NULL,
	"dispatch_started_at" timestamp with time zone,
	"dispatch_terminal_at" timestamp with time zone,
	"task_ref_digest" varchar(64),
	"member_confirmation_required" boolean DEFAULT true NOT NULL,
	"provider_result_category" "wecom_real_send_proof_provider_result_category",
	"send_result_status" "wecom_customer_broadcast_task_send_result_status" DEFAULT 'not_checked' NOT NULL,
	"send_result_checked_at" timestamp with time zone,
	"finalize_state" "wecom_customer_broadcast_task_finalize_state" DEFAULT 'not_finalized' NOT NULL,
	"reconciliation_state" "wecom_customer_broadcast_task_reconciliation_state" DEFAULT 'none' NOT NULL,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"automatic_retry_allowed" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_operation_unique" UNIQUE("operation_id"),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_capability_check" CHECK ("wecom_customer_broadcast_task_provider_attempts"."capability_kind" = 'customer_broadcast_task' AND "wecom_customer_broadcast_task_provider_attempts"."provider_kind" = 'wecom_official_customer_broadcast' AND "wecom_customer_broadcast_task_provider_attempts"."member_confirmation_required" = true),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_dispatch_once_check" CHECK ("wecom_customer_broadcast_task_provider_attempts"."dispatch_count" BETWEEN 0 AND 1 AND (("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'not_started' AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_count" = 0) OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" <> 'not_started' AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_count" = 1))),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_dispatch_timing_check" CHECK (("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'not_started' AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_started_at" IS NULL AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at" IS NULL) OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_create_attempted' AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_started_at" IS NOT NULL AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at" IS NULL) OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" IN ('task_created', 'task_create_failed', 'task_create_unknown') AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_started_at" IS NOT NULL AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at" IS NOT NULL AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at" >= "wecom_customer_broadcast_task_provider_attempts"."dispatch_started_at")),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_task_ref_digest_check" CHECK (("wecom_customer_broadcast_task_provider_attempts"."task_ref_digest" IS NULL OR (length("wecom_customer_broadcast_task_provider_attempts"."task_ref_digest") = 64 AND "wecom_customer_broadcast_task_provider_attempts"."task_ref_digest" ~ '^[0-9a-f]{64}$')) AND ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" <> 'task_created' OR "wecom_customer_broadcast_task_provider_attempts"."task_ref_digest" IS NOT NULL)),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_provider_result_check" CHECK (("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" IN ('not_started', 'task_create_attempted') AND "wecom_customer_broadcast_task_provider_attempts"."provider_result_category" IS NULL) OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_created' AND "wecom_customer_broadcast_task_provider_attempts"."provider_result_category" = 'accepted') OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_create_failed' AND "wecom_customer_broadcast_task_provider_attempts"."provider_result_category" = 'rejected') OR ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_create_unknown' AND "wecom_customer_broadcast_task_provider_attempts"."provider_result_category" IN ('transport_error', 'timeout', 'indeterminate'))),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_send_result_check" CHECK (("wecom_customer_broadcast_task_provider_attempts"."send_result_status" = 'not_checked' OR "wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_created') AND (("wecom_customer_broadcast_task_provider_attempts"."send_result_status" IN ('not_checked', 'awaiting_member_confirmation') AND "wecom_customer_broadcast_task_provider_attempts"."send_result_checked_at" IS NULL) OR ("wecom_customer_broadcast_task_provider_attempts"."send_result_status" IN ('target_sent', 'target_failed', 'target_unknown') AND "wecom_customer_broadcast_task_provider_attempts"."send_result_checked_at" IS NOT NULL AND "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at" IS NOT NULL AND "wecom_customer_broadcast_task_provider_attempts"."send_result_checked_at" >= "wecom_customer_broadcast_task_provider_attempts"."dispatch_terminal_at"))),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_finalize_candidate_check" CHECK ("wecom_customer_broadcast_task_provider_attempts"."finalize_state" = 'not_finalized' OR ("wecom_customer_broadcast_task_provider_attempts"."finalize_state" = 'success_recorded' AND "wecom_customer_broadcast_task_provider_attempts"."send_result_status" = 'target_sent') OR ("wecom_customer_broadcast_task_provider_attempts"."finalize_state" = 'failure_recorded' AND ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_create_failed' OR "wecom_customer_broadcast_task_provider_attempts"."send_result_status" = 'target_failed')) OR ("wecom_customer_broadcast_task_provider_attempts"."finalize_state" = 'unknown_recorded' AND ("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" = 'task_create_unknown' OR "wecom_customer_broadcast_task_provider_attempts"."send_result_status" = 'target_unknown'))),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_reconciliation_check" CHECK (("wecom_customer_broadcast_task_provider_attempts"."reconciliation_state" = 'manual_review_required' AND "wecom_customer_broadcast_task_provider_attempts"."manual_review_required" = true) OR ("wecom_customer_broadcast_task_provider_attempts"."reconciliation_state" IN ('none', 'reconciled') AND "wecom_customer_broadcast_task_provider_attempts"."manual_review_required" = false)),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_unknown_review_check" CHECK ("wecom_customer_broadcast_task_provider_attempts"."automatic_retry_allowed" = false AND (("wecom_customer_broadcast_task_provider_attempts"."dispatch_state" <> 'task_create_unknown' AND "wecom_customer_broadcast_task_provider_attempts"."send_result_status" <> 'target_unknown') OR "wecom_customer_broadcast_task_provider_attempts"."reconciliation_state" IN ('manual_review_required', 'reconciled'))),
	CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_version_positive_check" CHECK ("wecom_customer_broadcast_task_provider_attempts"."version" > 0)
);

CREATE TABLE "wecom_customer_mapping_states" (
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
	CONSTRAINT "wecom_customer_mapping_states_tenant_institution_proof_contact_unique" UNIQUE("tenant_id","institution_id","proof_contact_id"),
	CONSTRAINT "wecom_customer_mapping_states_scope_customer_id_unique" UNIQUE("tenant_id","institution_id","customer_id","id")
);

CREATE TABLE "wecom_real_send_production_attestations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"environment_ref" varchar(96) NOT NULL,
	"database_identity_ref" varchar(96) NOT NULL,
	"migration_target" varchar(128) NOT NULL,
	"migration_hash" varchar(64) NOT NULL,
	"journal_latest" varchar(128) NOT NULL,
	"postcheck_status" "wecom_real_send_proof_postcheck_status" NOT NULL,
	"approval_ref" varchar(96) NOT NULL,
	"reviewed_by" varchar(96) NOT NULL,
	"attested_by" varchar(96) NOT NULL,
	"attested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wecom_real_send_production_attestations_identity_unique" UNIQUE("environment_ref","database_identity_ref","migration_target"),
	CONSTRAINT "wecom_real_send_production_attestations_expiry_check" CHECK ("wecom_real_send_production_attestations"."expires_at" > "wecom_real_send_production_attestations"."attested_at"),
	CONSTRAINT "wecom_real_send_production_attestations_hash_check" CHECK (length("wecom_real_send_production_attestations"."migration_hash") = 64),
	CONSTRAINT "wecom_real_send_production_attestations_version_positive_check" CHECK ("wecom_real_send_production_attestations"."version" > 0)
);

CREATE TABLE "wecom_real_send_proof_controls" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64),
	"institution_id" varchar(64),
	"customer_id" varchar(64),
	"channel_type" "customer_channel_type",
	"operator_id" varchar(96),
	"role" "auth_role",
	"scope_kind" "wecom_real_send_proof_control_scope_kind" NOT NULL,
	"proof_enabled" boolean DEFAULT false NOT NULL,
	"kill_switch_engaged" boolean DEFAULT true NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approval_ref" varchar(96) NOT NULL,
	"approved_by" varchar(96) NOT NULL,
	"updated_by" varchar(96) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wecom_real_send_proof_controls_scope_identity_unique" UNIQUE NULLS NOT DISTINCT("scope_kind","tenant_id","institution_id","customer_id","channel_type","operator_id","role"),
	CONSTRAINT "wecom_real_send_proof_controls_timing_check" CHECK ("wecom_real_send_proof_controls"."expires_at" > "wecom_real_send_proof_controls"."effective_at"),
	CONSTRAINT "wecom_real_send_proof_controls_version_positive_check" CHECK ("wecom_real_send_proof_controls"."version" > 0),
	CONSTRAINT "wecom_real_send_proof_controls_scope_shape_check" CHECK (("wecom_real_send_proof_controls"."scope_kind" = 'global' AND "wecom_real_send_proof_controls"."tenant_id" IS NULL AND "wecom_real_send_proof_controls"."institution_id" IS NULL AND "wecom_real_send_proof_controls"."customer_id" IS NULL AND "wecom_real_send_proof_controls"."channel_type" IS NULL AND "wecom_real_send_proof_controls"."operator_id" IS NULL AND "wecom_real_send_proof_controls"."role" IS NULL) OR ("wecom_real_send_proof_controls"."scope_kind" = 'tenant' AND "wecom_real_send_proof_controls"."tenant_id" IS NOT NULL AND "wecom_real_send_proof_controls"."institution_id" IS NULL AND "wecom_real_send_proof_controls"."customer_id" IS NULL AND "wecom_real_send_proof_controls"."channel_type" IS NULL AND "wecom_real_send_proof_controls"."operator_id" IS NULL AND "wecom_real_send_proof_controls"."role" IS NULL) OR ("wecom_real_send_proof_controls"."scope_kind" = 'institution' AND "wecom_real_send_proof_controls"."tenant_id" IS NOT NULL AND "wecom_real_send_proof_controls"."institution_id" IS NOT NULL AND "wecom_real_send_proof_controls"."customer_id" IS NULL AND "wecom_real_send_proof_controls"."channel_type" IS NULL AND "wecom_real_send_proof_controls"."operator_id" IS NULL AND "wecom_real_send_proof_controls"."role" IS NULL) OR ("wecom_real_send_proof_controls"."scope_kind" = 'channel' AND "wecom_real_send_proof_controls"."tenant_id" IS NULL AND "wecom_real_send_proof_controls"."institution_id" IS NULL AND "wecom_real_send_proof_controls"."customer_id" IS NULL AND "wecom_real_send_proof_controls"."channel_type" IS NOT NULL AND "wecom_real_send_proof_controls"."channel_type" = 'wechat_work' AND "wecom_real_send_proof_controls"."operator_id" IS NULL AND "wecom_real_send_proof_controls"."role" IS NULL) OR ("wecom_real_send_proof_controls"."scope_kind" = 'customer' AND "wecom_real_send_proof_controls"."tenant_id" IS NOT NULL AND "wecom_real_send_proof_controls"."institution_id" IS NOT NULL AND "wecom_real_send_proof_controls"."customer_id" IS NOT NULL AND "wecom_real_send_proof_controls"."channel_type" IS NULL AND "wecom_real_send_proof_controls"."operator_id" IS NULL AND "wecom_real_send_proof_controls"."role" IS NULL) OR ("wecom_real_send_proof_controls"."scope_kind" = 'operator_role' AND "wecom_real_send_proof_controls"."tenant_id" IS NOT NULL AND "wecom_real_send_proof_controls"."institution_id" IS NOT NULL AND "wecom_real_send_proof_controls"."customer_id" IS NULL AND "wecom_real_send_proof_controls"."channel_type" IS NULL AND "wecom_real_send_proof_controls"."operator_id" IS NOT NULL AND "wecom_real_send_proof_controls"."role" IS NOT NULL)),
	CONSTRAINT "wecom_real_send_proof_controls_operator_self_approval_check" CHECK ("wecom_real_send_proof_controls"."scope_kind" <> 'operator_role' OR "wecom_real_send_proof_controls"."approved_by" <> "wecom_real_send_proof_controls"."operator_id")
);

CREATE TABLE "wecom_real_send_proof_operations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"institution_id" varchar(64) NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"channel_type" "customer_channel_type" DEFAULT 'wechat_work' NOT NULL,
	"draft_id" varchar(64) NOT NULL,
	"delivery_id" varchar(96) NOT NULL,
	"source_ready_no_send_ref" varchar(128) NOT NULL,
	"source_ready_no_send_digest" varchar(64) NOT NULL,
	"readiness_fingerprint" varchar(64) NOT NULL,
	"mapping_id" varchar(64) NOT NULL,
	"consent_id" varchar(64) NOT NULL,
	"frequency_state_id" varchar(64) NOT NULL,
	"dry_run_snapshot_id" varchar(64) NOT NULL,
	"production_attestation_id" varchar(64) NOT NULL,
	"operation_ref" varchar(96) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"recipient_binding_ref" varchar(96) NOT NULL,
	"recipient_binding_digest" varchar(64) NOT NULL,
	"status" "wecom_real_send_proof_operation_status" DEFAULT 'requested' NOT NULL,
	"confirmation_token_digest" varchar(64) NOT NULL,
	"confirmation_issued_at" timestamp with time zone NOT NULL,
	"confirmation_expires_at" timestamp with time zone NOT NULL,
	"confirmation_consumed_at" timestamp with time zone,
	"operator_id" varchar(96) NOT NULL,
	"session_provenance" varchar(32) NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"attempted_at" timestamp with time zone,
	"terminal_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_result_category" "wecom_real_send_proof_provider_result_category",
	"completed_frequency_ref" varchar(96),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wecom_real_send_proof_operations_operation_ref_unique" UNIQUE("operation_ref"),
	CONSTRAINT "wecom_real_send_proof_operations_token_digest_unique" UNIQUE("confirmation_token_digest"),
	CONSTRAINT "wecom_real_send_proof_operations_source_unique" UNIQUE("tenant_id","institution_id","draft_id","source_ready_no_send_ref"),
	CONSTRAINT "wecom_real_send_proof_operations_scope_ref_id_unique" UNIQUE("tenant_id","institution_id","customer_id","operation_ref","id"),
	CONSTRAINT "wecom_real_send_proof_operations_attempt_count_check" CHECK ("wecom_real_send_proof_operations"."attempt_count" BETWEEN 0 AND 1),
	CONSTRAINT "wecom_real_send_proof_operations_token_timing_check" CHECK ("wecom_real_send_proof_operations"."confirmation_expires_at" > "wecom_real_send_proof_operations"."confirmation_issued_at" AND ("wecom_real_send_proof_operations"."confirmation_consumed_at" IS NULL OR ("wecom_real_send_proof_operations"."confirmation_consumed_at" > "wecom_real_send_proof_operations"."confirmation_issued_at" AND "wecom_real_send_proof_operations"."confirmation_consumed_at" < "wecom_real_send_proof_operations"."confirmation_expires_at"))),
	CONSTRAINT "wecom_real_send_proof_operations_consumed_operator_check" CHECK ("wecom_real_send_proof_operations"."confirmation_consumed_at" IS NULL OR "wecom_real_send_proof_operations"."operator_id" IS NOT NULL),
	CONSTRAINT "wecom_real_send_proof_operations_session_provenance_check" CHECK ("wecom_real_send_proof_operations"."session_provenance" IN ('server_session', 'formal_session')),
	CONSTRAINT "wecom_real_send_proof_operations_attempted_check" CHECK ("wecom_real_send_proof_operations"."status" NOT IN ('attempted', 'succeeded', 'failed', 'unknown_outcome') OR ("wecom_real_send_proof_operations"."attempted_at" IS NOT NULL AND "wecom_real_send_proof_operations"."confirmation_consumed_at" IS NOT NULL AND "wecom_real_send_proof_operations"."attempt_count" = 1)),
	CONSTRAINT "wecom_real_send_proof_operations_terminal_check" CHECK (("wecom_real_send_proof_operations"."status" IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND "wecom_real_send_proof_operations"."terminal_at" IS NOT NULL) OR ("wecom_real_send_proof_operations"."status" NOT IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND "wecom_real_send_proof_operations"."terminal_at" IS NULL)),
	CONSTRAINT "wecom_real_send_proof_operations_status_shape_check" CHECK (("wecom_real_send_proof_operations"."status" = 'requested' AND "wecom_real_send_proof_operations"."confirmation_consumed_at" IS NULL AND "wecom_real_send_proof_operations"."attempted_at" IS NULL AND "wecom_real_send_proof_operations"."terminal_at" IS NULL AND "wecom_real_send_proof_operations"."attempt_count" = 0) OR ("wecom_real_send_proof_operations"."status" = 'aborted' AND "wecom_real_send_proof_operations"."confirmation_consumed_at" IS NULL AND "wecom_real_send_proof_operations"."attempted_at" IS NULL AND "wecom_real_send_proof_operations"."terminal_at" IS NOT NULL AND "wecom_real_send_proof_operations"."attempt_count" = 0) OR ("wecom_real_send_proof_operations"."status" = 'attempted' AND "wecom_real_send_proof_operations"."confirmation_consumed_at" IS NOT NULL AND "wecom_real_send_proof_operations"."attempted_at" IS NOT NULL AND "wecom_real_send_proof_operations"."terminal_at" IS NULL AND "wecom_real_send_proof_operations"."attempt_count" = 1) OR ("wecom_real_send_proof_operations"."status" IN ('succeeded', 'failed', 'unknown_outcome') AND "wecom_real_send_proof_operations"."confirmation_consumed_at" IS NOT NULL AND "wecom_real_send_proof_operations"."attempted_at" IS NOT NULL AND "wecom_real_send_proof_operations"."terminal_at" IS NOT NULL AND "wecom_real_send_proof_operations"."attempt_count" = 1)),
	CONSTRAINT "wecom_real_send_proof_operations_completed_frequency_check" CHECK (("wecom_real_send_proof_operations"."status" = 'succeeded' AND "wecom_real_send_proof_operations"."completed_frequency_ref" IS NOT NULL AND "wecom_real_send_proof_operations"."completed_frequency_ref" = "wecom_real_send_proof_operations"."operation_ref") OR ("wecom_real_send_proof_operations"."status" <> 'succeeded' AND "wecom_real_send_proof_operations"."completed_frequency_ref" IS NULL)),
	CONSTRAINT "wecom_real_send_proof_operations_provider_result_check" CHECK (("wecom_real_send_proof_operations"."status" = 'succeeded' AND "wecom_real_send_proof_operations"."provider_result_category" IS NOT NULL AND "wecom_real_send_proof_operations"."provider_result_category" = 'accepted') OR ("wecom_real_send_proof_operations"."status" = 'failed' AND "wecom_real_send_proof_operations"."provider_result_category" IS NOT NULL AND "wecom_real_send_proof_operations"."provider_result_category" = 'rejected') OR ("wecom_real_send_proof_operations"."status" = 'unknown_outcome' AND "wecom_real_send_proof_operations"."provider_result_category" IS NOT NULL AND "wecom_real_send_proof_operations"."provider_result_category" IN ('transport_error', 'timeout', 'indeterminate')) OR ("wecom_real_send_proof_operations"."status" IN ('requested', 'aborted', 'attempted') AND "wecom_real_send_proof_operations"."provider_result_category" IS NULL)),
	CONSTRAINT "wecom_real_send_proof_operations_digest_lengths_check" CHECK (length("wecom_real_send_proof_operations"."source_ready_no_send_digest") = 64 AND length("wecom_real_send_proof_operations"."readiness_fingerprint") = 64 AND length("wecom_real_send_proof_operations"."content_hash") = 64 AND length("wecom_real_send_proof_operations"."recipient_binding_digest") = 64 AND length("wecom_real_send_proof_operations"."confirmation_token_digest") = 64),
	CONSTRAINT "wecom_real_send_proof_operations_version_positive_check" CHECK ("wecom_real_send_proof_operations"."version" > 0)
);

CREATE UNIQUE INDEX "tenant_members_tenant_user_unique_idx" ON "tenant_members" USING btree ("tenant_id","user_id");
CREATE UNIQUE INDEX "his_conn_cred_comp_ops_tenant_connection_operation_unique_idx" ON "his_connection_credential_compensation_operations" USING btree ("tenant_id","connection_id","operation_id");
ALTER TABLE "ai_call_usage_records" ADD CONSTRAINT "ai_call_usage_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auth_account_institution_binding_transitions" ADD CONSTRAINT "auth_binding_transitions_binding_fk" FOREIGN KEY ("tenant_id","binding_id") REFERENCES "public"."auth_account_institution_bindings"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auth_account_institution_binding_transitions" ADD CONSTRAINT "auth_binding_transitions_replacement_fk" FOREIGN KEY ("tenant_id","replacement_binding_id") REFERENCES "public"."auth_account_institution_bindings"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auth_account_institution_bindings" ADD CONSTRAINT "auth_account_institution_bindings_tenant_account_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."tenant_members"("tenant_id","user_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auth_account_institution_bindings" ADD CONSTRAINT "auth_account_institution_bindings_scope_fk" FOREIGN KEY ("tenant_id","institution_id") REFERENCES "public"."institution_scopes"("tenant_id","institution_id") ON DELETE no action ON UPDATE no action NOT VALID;
ALTER TABLE "customer_channel_contact_consents" ADD CONSTRAINT "customer_channel_contact_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customer_channel_contact_consents" ADD CONSTRAINT "customer_channel_contact_consents_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customer_channel_frequency_states" ADD CONSTRAINT "customer_channel_frequency_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customer_channel_frequency_states" ADD CONSTRAINT "customer_channel_frequency_states_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_customer_timeline_events" ADD CONSTRAINT "follow_up_customer_timeline_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_customer_timeline_events" ADD CONSTRAINT "follow_up_customer_timeline_events_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_follow_up_task_fk" FOREIGN KEY ("tenant_id","follow_up_task_id") REFERENCES "public"."follow_up_tasks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_enrollment_fk" FOREIGN KEY ("tenant_id","enrollment_id") REFERENCES "public"."follow_up_path_enrollments"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_tenant_stage_fk" FOREIGN KEY ("tenant_id","stage_id") REFERENCES "public"."follow_up_path_stages"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_drafts" ADD CONSTRAINT "follow_up_message_drafts_template_fk" FOREIGN KEY ("template_id") REFERENCES "public"."follow_up_message_templates"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_message_templates" ADD CONSTRAINT "follow_up_message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_enrollments" ADD CONSTRAINT "follow_up_path_enrollments_tenant_treatment_summary_fk" FOREIGN KEY ("tenant_id","treatment_summary_id") REFERENCES "public"."treatment_summaries"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_enrollment_fk" FOREIGN KEY ("tenant_id","enrollment_id") REFERENCES "public"."follow_up_path_enrollments"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_path_stages" ADD CONSTRAINT "follow_up_path_stages_tenant_follow_up_task_fk" FOREIGN KEY ("tenant_id","follow_up_task_id") REFERENCES "public"."follow_up_tasks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_tenant_source_treatment_summary_fk" FOREIGN KEY ("tenant_id","source_treatment_summary_id") REFERENCES "public"."treatment_summaries"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."his_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connection_credential_compensation_jobs" ADD CONSTRAINT "his_conn_cred_comp_jobs_operation_scope_fk" FOREIGN KEY ("tenant_id","connection_id","operation_id") REFERENCES "public"."his_connection_credential_compensation_operations"("tenant_id","connection_id","operation_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connection_credential_compensation_operations" ADD CONSTRAINT "his_conn_cred_comp_ops_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connection_credential_compensation_operations" ADD CONSTRAINT "his_conn_cred_comp_ops_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."his_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "his_connections" ADD CONSTRAINT "his_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_version_id_homepage_brand_config_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."homepage_brand_config_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "homepage_brand_audit_logs" ADD CONSTRAINT "homepage_brand_audit_logs_asset_id_homepage_brand_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."homepage_brand_assets"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "homepage_brand_config_versions" ADD CONSTRAINT "homepage_brand_config_versions_config_id_homepage_brand_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."homepage_brand_configs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_channel_dry_run_snapshots" ADD CONSTRAINT "institution_channel_dry_run_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_operating_context_versions" ADD CONSTRAINT "institution_operating_context_versions_scope_fk" FOREIGN KEY ("tenant_id","institution_id") REFERENCES "public"."institution_scopes"("tenant_id","institution_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_operating_contexts" ADD CONSTRAINT "institution_operating_contexts_scope_fk" FOREIGN KEY ("tenant_id","institution_id") REFERENCES "public"."institution_scopes"("tenant_id","institution_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_operating_contexts" ADD CONSTRAINT "institution_operating_contexts_latest_version_fk" FOREIGN KEY ("tenant_id","institution_id","latest_version") REFERENCES "public"."institution_operating_context_versions"("tenant_id","institution_id","version") ON DELETE no action ON UPDATE no action;
ALTER TABLE "institution_scopes" ADD CONSTRAINT "institution_scopes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_chunk_embeddings" ADD CONSTRAINT "knowledge_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_document_file_parse_chunk_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunk_embeddings" ADD CONSTRAINT "knowledge_file_parse_chunk_embeddings_tenant_chunk_fk" FOREIGN KEY ("tenant_id","chunk_id") REFERENCES "public"."knowledge_document_file_parse_chunks"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_document_file_parse_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parse_chunks" ADD CONSTRAINT "knowledge_file_parse_chunks_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_document_file_parses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_file_parses" ADD CONSTRAINT "knowledge_file_parses_tenant_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."knowledge_document_files"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_document_files" ADD CONSTRAINT "knowledge_document_files_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."knowledge_sources"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_index_jobs" ADD CONSTRAINT "knowledge_index_jobs_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_indexing_jobs" ADD CONSTRAINT "knowledge_indexing_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_qa_audit_logs" ADD CONSTRAINT "knowledge_qa_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_quota_usage_records" ADD CONSTRAINT "knowledge_quota_usage_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_knowledge_institution_visibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "platform_knowledge_institution_visibility" ADD CONSTRAINT "platform_kb_visibility_tenant_document_fk" FOREIGN KEY ("tenant_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."tenant_plan_assignments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_authorization_snapshots" ADD CONSTRAINT "tenant_authorization_snapshots_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_commercial_records" ADD CONSTRAINT "tenant_commercial_records_related_plan_change_id_tenant_plan_change_records_id_fk" FOREIGN KEY ("related_plan_change_id") REFERENCES "public"."tenant_plan_change_records"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_initial_admin_user_id_auth_users_id_fk" FOREIGN KEY ("initial_admin_user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
ALTER TABLE "tenant_membership_transitions" ADD CONSTRAINT "tenant_membership_transitions_tenant_membership_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_members"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_plan_id_tenant_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_plans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_assignments" ADD CONSTRAINT "tenant_plan_assignments_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("from_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_plan_version_id_tenant_plan_versions_id_fk" FOREIGN KEY ("to_plan_version_id") REFERENCES "public"."tenant_plan_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_from_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("from_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_change_records" ADD CONSTRAINT "tenant_plan_change_records_to_snapshot_id_tenant_authorization_snapshots_id_fk" FOREIGN KEY ("to_snapshot_id") REFERENCES "public"."tenant_authorization_snapshots"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_plan_versions" ADD CONSTRAINT "tenant_plan_versions_plan_id_tenant_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_plans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_quota_snapshots" ADD CONSTRAINT "tenant_quota_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tenant_quota_snapshots" ADD CONSTRAINT "tenant_quota_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" FOREIGN KEY ("plan_assignment_id") REFERENCES "public"."tenant_plan_assignments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_customer_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "treatment_summaries" ADD CONSTRAINT "treatment_summaries_tenant_appointment_fk" FOREIGN KEY ("tenant_id","appointment_id") REFERENCES "public"."appointments"("tenant_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_customer_broadcast_recipient_bindings" ADD CONSTRAINT "wecom_customer_broadcast_recipient_bindings_operation_scope_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","operation_ref","operation_id") REFERENCES "public"."wecom_real_send_proof_operations"("tenant_id","institution_id","customer_id","operation_ref","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_customer_broadcast_recipient_bindings" ADD CONSTRAINT "wecom_customer_broadcast_recipient_bindings_mapping_scope_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","mapping_id") REFERENCES "public"."wecom_customer_mapping_states"("tenant_id","institution_id","customer_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_customer_broadcast_task_provider_attempts" ADD CONSTRAINT "wecom_customer_broadcast_task_provider_attempts_operation_scope_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","operation_ref","operation_id") REFERENCES "public"."wecom_real_send_proof_operations"("tenant_id","institution_id","customer_id","operation_ref","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_customer_mapping_states" ADD CONSTRAINT "wecom_customer_mapping_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_customer_mapping_states" ADD CONSTRAINT "wecom_customer_mapping_states_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_controls" ADD CONSTRAINT "wecom_real_send_proof_controls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_controls" ADD CONSTRAINT "wecom_real_send_proof_controls_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_tenant_institution_customer_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id") REFERENCES "public"."customers"("tenant_id","institution_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_draft_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","draft_id") REFERENCES "public"."follow_up_message_drafts"("tenant_id","institution_id","customer_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_mapping_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","mapping_id") REFERENCES "public"."wecom_customer_mapping_states"("tenant_id","institution_id","customer_id","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_consent_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","channel_type","consent_id") REFERENCES "public"."customer_channel_contact_consents"("tenant_id","institution_id","customer_id","channel_type","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_frequency_fk" FOREIGN KEY ("tenant_id","institution_id","customer_id","channel_type","frequency_state_id") REFERENCES "public"."customer_channel_frequency_states"("tenant_id","institution_id","customer_id","channel_type","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_scope_dry_run_snapshot_fk" FOREIGN KEY ("tenant_id","institution_id","channel_type","dry_run_snapshot_id") REFERENCES "public"."institution_channel_dry_run_snapshots"("tenant_id","institution_id","channel_type","id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wecom_real_send_proof_operations" ADD CONSTRAINT "wecom_real_send_proof_operations_production_attestation_fk" FOREIGN KEY ("production_attestation_id") REFERENCES "public"."wecom_real_send_production_attestations"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "ai_call_usage_records_tenant_created_idx" ON "ai_call_usage_records" USING btree ("tenant_id","created_at");
CREATE INDEX "ai_call_usage_records_tenant_institution_created_idx" ON "ai_call_usage_records" USING btree ("tenant_id","institution_id","created_at");
CREATE INDEX "appointments_tenant_status_idx" ON "appointments" USING btree ("tenant_id","status");
CREATE INDEX "audit_events_tenant_occurred_idx" ON "audit_events" USING btree ("tenant_id","occurred_at");
CREATE INDEX "audit_events_actor_occurred_idx" ON "audit_events" USING btree ("actor_id","occurred_at");
CREATE INDEX "audit_events_tenant_resource_id_occurred_idx" ON "audit_events" USING btree ("tenant_id","resource","resource_id","occurred_at");
CREATE INDEX "auth_binding_transitions_tenant_binding_version_idx" ON "auth_account_institution_binding_transitions" USING btree ("tenant_id","binding_id","to_version");
CREATE INDEX "auth_account_institution_bindings_scope_idx" ON "auth_account_institution_bindings" USING btree ("tenant_id","institution_id");
CREATE UNIQUE INDEX "auth_account_institution_bindings_active_account_tenant_unique_idx" ON "auth_account_institution_bindings" USING btree ("account_id","tenant_id") WHERE "auth_account_institution_bindings"."status" = 'active';
CREATE INDEX "auth_account_institution_bindings_account_tenant_status_idx" ON "auth_account_institution_bindings" USING btree ("account_id","tenant_id","status");
CREATE UNIQUE INDEX "auth_users_username_unique_idx" ON "auth_users" USING btree ("username");
CREATE INDEX "auth_users_phone_idx" ON "auth_users" USING btree ("phone");
CREATE INDEX "auth_users_email_idx" ON "auth_users" USING btree ("email");
CREATE INDEX "auth_users_status_idx" ON "auth_users" USING btree ("status");
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");
CREATE INDEX "customers_tenant_priority_idx" ON "customers" USING btree ("tenant_id","priority");
CREATE INDEX "follow_up_customer_timeline_events_tenant_institution_customer_occurred_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","institution_id","customer_id","occurred_at");
CREATE INDEX "follow_up_customer_timeline_events_tenant_source_event_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","source_type","source_id","event_type");
CREATE INDEX "follow_up_customer_timeline_events_tenant_event_type_occurred_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","event_type","occurred_at");
CREATE UNIQUE INDEX "follow_up_customer_timeline_events_source_event_unique_idx" ON "follow_up_customer_timeline_events" USING btree ("tenant_id","source_type","source_id","event_type");
CREATE INDEX "follow_up_message_drafts_tenant_institution_idx" ON "follow_up_message_drafts" USING btree ("tenant_id","institution_id");
CREATE INDEX "follow_up_message_drafts_follow_up_task_idx" ON "follow_up_message_drafts" USING btree ("follow_up_task_id");
CREATE INDEX "follow_up_message_drafts_customer_idx" ON "follow_up_message_drafts" USING btree ("customer_id");
CREATE INDEX "follow_up_message_drafts_status_idx" ON "follow_up_message_drafts" USING btree ("status");
CREATE INDEX "follow_up_message_drafts_created_at_idx" ON "follow_up_message_drafts" USING btree ("created_at");
CREATE INDEX "follow_up_message_templates_tenant_institution_idx" ON "follow_up_message_templates" USING btree ("tenant_id","institution_id");
CREATE INDEX "follow_up_message_templates_template_key_idx" ON "follow_up_message_templates" USING btree ("template_key");
CREATE INDEX "follow_up_message_templates_status_idx" ON "follow_up_message_templates" USING btree ("status");
CREATE INDEX "follow_up_message_templates_applicable_idx" ON "follow_up_message_templates" USING btree ("applicable_template_key","applicable_node_key");
CREATE UNIQUE INDEX "follow_up_path_enrollments_active_source_template_unique_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","source_type","source_id","template_key") WHERE "follow_up_path_enrollments"."status" = 'active';
CREATE INDEX "follow_up_path_enrollments_tenant_status_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","status");
CREATE INDEX "follow_up_path_enrollments_tenant_institution_status_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","institution_id","status");
CREATE INDEX "follow_up_path_enrollments_tenant_customer_idx" ON "follow_up_path_enrollments" USING btree ("tenant_id","customer_id");
CREATE INDEX "follow_up_path_stages_tenant_enrollment_idx" ON "follow_up_path_stages" USING btree ("tenant_id","enrollment_id");
CREATE INDEX "follow_up_path_stages_tenant_due_status_idx" ON "follow_up_path_stages" USING btree ("tenant_id","status","due_at");
CREATE INDEX "follow_up_tasks_tenant_status_idx" ON "follow_up_tasks" USING btree ("tenant_id","status");
CREATE INDEX "follow_up_tasks_tenant_source_treatment_summary_idx" ON "follow_up_tasks" USING btree ("tenant_id","source_treatment_summary_id");
CREATE UNIQUE INDEX "follow_up_tasks_active_source_unique_idx" ON "follow_up_tasks" USING btree ("tenant_id","source_treatment_summary_id","source_suggestion_key") WHERE "follow_up_tasks"."source_treatment_summary_id" is not null and "follow_up_tasks"."source_suggestion_key" is not null and "follow_up_tasks"."status" not in ('completed','cancelled');
CREATE UNIQUE INDEX "his_conn_cred_comp_jobs_operation_id_unique_idx" ON "his_connection_credential_compensation_jobs" USING btree ("operation_id");
CREATE INDEX "his_conn_cred_comp_jobs_tenant_connection_operation_idx" ON "his_connection_credential_compensation_jobs" USING btree ("tenant_id","connection_id","operation_id");
CREATE INDEX "his_conn_cred_comp_jobs_tenant_state_next_attempt_idx" ON "his_connection_credential_compensation_jobs" USING btree ("tenant_id","job_state","next_attempt_at");
CREATE INDEX "his_conn_cred_comp_jobs_lock_idx" ON "his_connection_credential_compensation_jobs" USING btree ("job_state","locked_until","claim_version");
CREATE UNIQUE INDEX "his_conn_cred_comp_ops_operation_id_unique_idx" ON "his_connection_credential_compensation_operations" USING btree ("operation_id");
CREATE INDEX "his_conn_cred_comp_ops_tenant_connection_state_idx" ON "his_connection_credential_compensation_operations" USING btree ("tenant_id","connection_id","state");
CREATE INDEX "his_conn_cred_comp_ops_tenant_state_updated_idx" ON "his_connection_credential_compensation_operations" USING btree ("tenant_id","state","updated_at");
CREATE INDEX "his_connections_tenant_idx" ON "his_connections" USING btree ("tenant_id");
CREATE INDEX "his_connections_tenant_status_idx" ON "his_connections" USING btree ("tenant_id","status");
CREATE INDEX "his_connections_tenant_source_system_idx" ON "his_connections" USING btree ("tenant_id","source_system");
CREATE INDEX "his_connections_tenant_deleted_at_idx" ON "his_connections" USING btree ("tenant_id","deleted_at");
CREATE INDEX "his_connections_tenant_credential_ref_idx" ON "his_connections" USING btree ("tenant_id","credential_ref");
CREATE INDEX "his_connections_tenant_last_checked_at_idx" ON "his_connections" USING btree ("tenant_id","last_checked_at");
CREATE UNIQUE INDEX "his_connections_active_name_unique_idx" ON "his_connections" USING btree ("tenant_id","connection_name") WHERE "his_connections"."deleted_at" is null;
CREATE INDEX "homepage_brand_assets_kind_created_idx" ON "homepage_brand_assets" USING btree ("kind","created_at");
CREATE INDEX "homepage_brand_assets_checksum_idx" ON "homepage_brand_assets" USING btree ("checksum_sha256");
CREATE INDEX "homepage_brand_audit_logs_action_created_idx" ON "homepage_brand_audit_logs" USING btree ("action","created_at");
CREATE INDEX "homepage_brand_audit_logs_config_created_idx" ON "homepage_brand_audit_logs" USING btree ("config_id","created_at");
CREATE INDEX "homepage_brand_audit_logs_actor_created_idx" ON "homepage_brand_audit_logs" USING btree ("actor_id","created_at");
CREATE INDEX "homepage_brand_config_versions_config_published_idx" ON "homepage_brand_config_versions" USING btree ("config_id","published_at");
CREATE INDEX "homepage_brand_configs_status_updated_idx" ON "homepage_brand_configs" USING btree ("status","updated_at");
CREATE INDEX "knowledge_chunk_embeddings_tenant_chunk_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","chunk_id");
CREATE INDEX "knowledge_chunk_embeddings_tenant_workspace_status_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","workspace_id","status");
CREATE INDEX "knowledge_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");
CREATE INDEX "knowledge_chunks_tenant_document_idx" ON "knowledge_chunks" USING btree ("tenant_id","document_id");
CREATE INDEX "knowledge_chunks_tenant_workspace_status_idx" ON "knowledge_chunks" USING btree ("tenant_id","workspace_id","status");
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_document_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","knowledge_document_id");
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_file_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","file_id");
CREATE INDEX "knowledge_file_parse_chunk_embeddings_tenant_provider_model_idx" ON "knowledge_document_file_parse_chunk_embeddings" USING btree ("tenant_id","embedding_provider","embedding_model");
CREATE INDEX "knowledge_file_parse_chunks_tenant_file_idx" ON "knowledge_document_file_parse_chunks" USING btree ("tenant_id","file_id");
CREATE INDEX "knowledge_file_parses_tenant_document_status_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","knowledge_document_id","parse_status");
CREATE INDEX "knowledge_file_parses_tenant_file_idx" ON "knowledge_document_file_parses" USING btree ("tenant_id","file_id");
CREATE INDEX "knowledge_document_files_tenant_document_status_idx" ON "knowledge_document_files" USING btree ("tenant_id","knowledge_document_id","status");
CREATE UNIQUE INDEX "knowledge_document_files_tenant_storage_key_unique" ON "knowledge_document_files" USING btree ("tenant_id","storage_key");
CREATE INDEX "knowledge_documents_tenant_workspace_status_idx" ON "knowledge_documents" USING btree ("tenant_id","workspace_id","status");
CREATE INDEX "knowledge_documents_tenant_source_idx" ON "knowledge_documents" USING btree ("tenant_id","source_id");
CREATE INDEX "knowledge_index_jobs_tenant_document_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","document_id","status");
CREATE INDEX "knowledge_index_jobs_tenant_workspace_status_idx" ON "knowledge_index_jobs" USING btree ("tenant_id","workspace_id","status");
CREATE INDEX "knowledge_indexing_jobs_tenant_status_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id","status","created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_institution_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id","institution_id","created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_knowledge_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id","knowledge_id","created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_file_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id","file_id","created_at");
CREATE INDEX "knowledge_indexing_jobs_tenant_job_type_created_idx" ON "knowledge_indexing_jobs" USING btree ("tenant_id","job_type","created_at");
CREATE INDEX "knowledge_qa_audit_logs_tenant_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","created_at");
CREATE INDEX "knowledge_qa_audit_logs_tenant_institution_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","institution_id","created_at");
CREATE INDEX "knowledge_qa_audit_logs_tenant_scope_created_idx" ON "knowledge_qa_audit_logs" USING btree ("tenant_id","actor_scope","created_at");
CREATE INDEX "knowledge_quota_usage_records_tenant_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","created_at");
CREATE INDEX "knowledge_quota_usage_records_tenant_institution_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","institution_id","created_at");
CREATE INDEX "knowledge_quota_usage_records_resource_status_created_idx" ON "knowledge_quota_usage_records" USING btree ("tenant_id","resource_key","status","created_at");
CREATE INDEX "knowledge_sources_tenant_workspace_status_idx" ON "knowledge_sources" USING btree ("tenant_id","workspace_id","status");
CREATE INDEX "knowledge_sources_tenant_institution_workspace_idx" ON "knowledge_sources" USING btree ("tenant_id","institution_id","workspace_id");
CREATE UNIQUE INDEX "platform_ai_credit_metering_rules_provider_model_version_unique_idx" ON "platform_ai_credit_metering_rules" USING btree ("provider","model","metering_version");
CREATE INDEX "platform_ai_credit_metering_rules_provider_model_enabled_idx" ON "platform_ai_credit_metering_rules" USING btree ("provider","model","enabled");
CREATE INDEX "platform_ai_credit_metering_rules_effective_from_idx" ON "platform_ai_credit_metering_rules" USING btree ("effective_from");
CREATE INDEX "platform_ai_model_config_snapshots_updated_at_idx" ON "platform_ai_model_config_snapshots" USING btree ("updated_at");
CREATE INDEX "platform_ai_provider_configs_provider_idx" ON "platform_ai_provider_configs" USING btree ("provider");
CREATE INDEX "platform_ai_provider_configs_updated_at_idx" ON "platform_ai_provider_configs" USING btree ("updated_at");
CREATE INDEX "platform_kb_visibility_tenant_document_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","knowledge_document_id");
CREATE INDEX "platform_kb_visibility_tenant_institution_idx" ON "platform_knowledge_institution_visibility" USING btree ("tenant_id","institution_id");
CREATE INDEX "tenant_authorization_snapshots_tenant_status_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id","status");
CREATE UNIQUE INDEX "tenant_authorization_snapshots_active_tenant_unique_idx" ON "tenant_authorization_snapshots" USING btree ("tenant_id") WHERE "tenant_authorization_snapshots"."status" = 'active';
CREATE INDEX "tenant_authorization_snapshots_assignment_generated_idx" ON "tenant_authorization_snapshots" USING btree ("plan_assignment_id","generated_at");
CREATE INDEX "tenant_authorization_snapshots_plan_version_idx" ON "tenant_authorization_snapshots" USING btree ("plan_version_id");
CREATE INDEX "tenant_commercial_records_tenant_type_status_idx" ON "tenant_commercial_records" USING btree ("tenant_id","record_type","status");
CREATE INDEX "tenant_commercial_records_tenant_created_idx" ON "tenant_commercial_records" USING btree ("tenant_id","created_at");
CREATE INDEX "tenant_commercial_records_related_plan_change_idx" ON "tenant_commercial_records" USING btree ("related_plan_change_id");
CREATE UNIQUE INDEX "tenant_contacts_tenant_unique_idx" ON "tenant_contacts" USING btree ("tenant_id");
CREATE INDEX "tenant_contacts_admin_user_idx" ON "tenant_contacts" USING btree ("initial_admin_user_id");
CREATE INDEX "tenant_members_tenant_role_idx" ON "tenant_members" USING btree ("tenant_id","role");
CREATE INDEX "tenant_membership_transitions_tenant_membership_revision_idx" ON "tenant_membership_transitions" USING btree ("tenant_id","membership_id","to_revision");
CREATE INDEX "tenant_plan_assignments_tenant_status_idx" ON "tenant_plan_assignments" USING btree ("tenant_id","status");
CREATE INDEX "tenant_plan_assignments_plan_status_idx" ON "tenant_plan_assignments" USING btree ("plan_id","status");
CREATE INDEX "tenant_plan_assignments_plan_version_idx" ON "tenant_plan_assignments" USING btree ("plan_version_id");
CREATE INDEX "tenant_plan_change_records_tenant_created_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","created_at");
CREATE INDEX "tenant_plan_change_records_tenant_status_idx" ON "tenant_plan_change_records" USING btree ("tenant_id","status");
CREATE INDEX "tenant_plan_change_records_to_plan_version_idx" ON "tenant_plan_change_records" USING btree ("to_plan_version_id");
CREATE UNIQUE INDEX "tenant_plan_versions_plan_version_code_unique_idx" ON "tenant_plan_versions" USING btree ("plan_id","version_code");
CREATE INDEX "tenant_plan_versions_plan_status_idx" ON "tenant_plan_versions" USING btree ("plan_id","status");
CREATE INDEX "tenant_plan_versions_status_updated_idx" ON "tenant_plan_versions" USING btree ("status","updated_at");
CREATE UNIQUE INDEX "tenant_plans_code_unique_idx" ON "tenant_plans" USING btree ("code");
CREATE INDEX "tenant_plans_status_idx" ON "tenant_plans" USING btree ("status");
CREATE INDEX "tenant_quota_snapshots_tenant_snapshot_idx" ON "tenant_quota_snapshots" USING btree ("tenant_id","snapshot_at");
CREATE INDEX "tenant_quota_snapshots_plan_assignment_snapshot_idx" ON "tenant_quota_snapshots" USING btree ("plan_assignment_id","snapshot_at");
CREATE INDEX "treatment_summaries_tenant_customer_date_idx" ON "treatment_summaries" USING btree ("tenant_id","customer_id","treatment_date");
CREATE INDEX "treatment_summaries_tenant_risk_date_idx" ON "treatment_summaries" USING btree ("tenant_id","risk_level","treatment_date");
CREATE INDEX "treatment_summaries_tenant_appointment_idx" ON "treatment_summaries" USING btree ("tenant_id","appointment_id");
CREATE INDEX "treatment_summaries_tenant_voided_date_idx" ON "treatment_summaries" USING btree ("tenant_id","voided_at","treatment_date");
CREATE UNIQUE INDEX "wecom_customer_broadcast_recipient_bindings_active_operation_unique_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("tenant_id","institution_id","customer_id","operation_ref") WHERE "wecom_customer_broadcast_recipient_bindings"."status" = 'active';
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_scope_status_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("tenant_id","institution_id","customer_id","status");
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_operation_id_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("operation_id");
CREATE INDEX "wecom_customer_broadcast_recipient_bindings_mapping_id_idx" ON "wecom_customer_broadcast_recipient_bindings" USING btree ("mapping_id");
CREATE INDEX "wecom_customer_broadcast_task_provider_attempts_scope_dispatch_idx" ON "wecom_customer_broadcast_task_provider_attempts" USING btree ("tenant_id","institution_id","dispatch_state");
CREATE INDEX "wecom_customer_mapping_states_tenant_institution_customer_status_idx" ON "wecom_customer_mapping_states" USING btree ("tenant_id","institution_id","customer_id","status");
CREATE INDEX "wecom_real_send_production_attestations_status_expires_idx" ON "wecom_real_send_production_attestations" USING btree ("postcheck_status","expires_at");
CREATE INDEX "wecom_real_send_proof_controls_scope_expires_idx" ON "wecom_real_send_proof_controls" USING btree ("scope_kind","expires_at");
CREATE INDEX "wecom_real_send_proof_operations_tenant_status_idx" ON "wecom_real_send_proof_operations" USING btree ("tenant_id","institution_id","status");

-- Reviewed final catalog additions not expressible by src/server/db/schema.ts.
CREATE FUNCTION public.reject_tenant_membership_transition_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'TENANT_MEMBERSHIP_TRANSITION_IMMUTABLE';
END;
$function$;

CREATE TRIGGER tenant_membership_transitions_reject_row_mutation
BEFORE UPDATE OR DELETE ON public.tenant_membership_transitions
FOR EACH ROW
EXECUTE FUNCTION public.reject_tenant_membership_transition_mutation();

CREATE TRIGGER tenant_membership_transitions_reject_truncate
BEFORE TRUNCATE ON public.tenant_membership_transitions
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_tenant_membership_transition_mutation();

CREATE FUNCTION "public"."reject_auth_binding_transition_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_TRANSITION_IMMUTABLE';
END;
$function$;

CREATE TRIGGER "auth_binding_transitions_reject_row_mutation"
BEFORE UPDATE OR DELETE
ON "public"."auth_account_institution_binding_transitions"
FOR EACH ROW
EXECUTE FUNCTION "public"."reject_auth_binding_transition_mutation"();

CREATE TRIGGER "auth_binding_transitions_reject_truncate"
BEFORE TRUNCATE
ON "public"."auth_account_institution_binding_transitions"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."reject_auth_binding_transition_mutation"();

CREATE FUNCTION "public"."enforce_auth_binding_current_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."account_id" IS DISTINCT FROM OLD."account_id"
    OR NEW."tenant_id" IS DISTINCT FROM OLD."tenant_id"
    OR NEW."institution_id" IS DISTINCT FROM OLD."institution_id"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."assigned_by" IS DISTINCT FROM OLD."assigned_by"
    OR NEW."assigned_at" IS DISTINCT FROM OLD."assigned_at"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_IMMUTABLE_FIELD_CHANGED';
  END IF;

  IF OLD."status" <> 'active'
    OR NEW."status" <> 'revoked'
    OR OLD."revoked_at" IS NOT NULL
    OR NEW."revoked_at" IS NULL
    OR NEW."revoked_at" < OLD."assigned_at"
    OR OLD."version" >= 2147483647
    OR NEW."version" <> OLD."version" + 1
    OR NEW."updated_at" < OLD."updated_at"
  THEN
    RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_INVALID_LIFECYCLE_MUTATION';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "auth_binding_current_enforce_update"
BEFORE UPDATE
ON "public"."auth_account_institution_bindings"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_auth_binding_current_mutation"();

CREATE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING MESSAGE = 'AUTH_BINDING_CURRENT_DESTRUCTIVE_MUTATION_REJECTED';
END;
$function$;

CREATE TRIGGER "auth_binding_current_reject_delete"
BEFORE DELETE
ON "public"."auth_account_institution_bindings"
FOR EACH ROW
EXECUTE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"();

CREATE TRIGGER "auth_binding_current_reject_truncate"
BEFORE TRUNCATE
ON "public"."auth_account_institution_bindings"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."reject_auth_binding_current_destructive_mutation"();
