ALTER TYPE "public"."tenant_status" ADD VALUE 'trialing';
--> statement-breakpoint
ALTER TYPE "public"."tenant_status" ADD VALUE 'expired';
--> statement-breakpoint
CREATE TYPE "public"."auth_account_status" AS ENUM('active', 'password_reset_required', 'disabled', 'locked');
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
--> statement-breakpoint
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_contacts" ADD CONSTRAINT "tenant_contacts_initial_admin_user_id_auth_users_id_fk" FOREIGN KEY ("initial_admin_user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_username_unique_idx" ON "auth_users" USING btree ("username");
--> statement-breakpoint
CREATE INDEX "auth_users_phone_idx" ON "auth_users" USING btree ("phone");
--> statement-breakpoint
CREATE INDEX "auth_users_email_idx" ON "auth_users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "auth_users_status_idx" ON "auth_users" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_contacts_tenant_unique_idx" ON "tenant_contacts" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "tenant_contacts_admin_user_idx" ON "tenant_contacts" USING btree ("initial_admin_user_id");
