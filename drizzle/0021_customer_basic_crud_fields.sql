ALTER TABLE "customers" ADD COLUMN "gender" varchar(20) DEFAULT '' NOT NULL;
ALTER TABLE "customers" ADD COLUMN "birth_date" varchar(20) DEFAULT '' NOT NULL;
ALTER TABLE "customers" ADD COLUMN "referral_source" varchar(80) DEFAULT '' NOT NULL;
ALTER TABLE "customers" ADD COLUMN "notes" text DEFAULT '' NOT NULL;
