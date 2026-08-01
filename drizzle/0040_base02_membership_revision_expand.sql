SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

LOCK TABLE "public"."tenant_members" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."auth_account_institution_bindings" IN SHARE MODE;
LOCK TABLE "public"."institution_scopes" IN SHARE MODE;
LOCK TABLE "public"."institution_operating_context_versions" IN SHARE MODE;
LOCK TABLE "public"."institution_operating_contexts" IN SHARE MODE;

DO $migration$
DECLARE
  expected_predecessor_count CONSTANT integer := 40;
  expected_predecessor_when CONSTANT bigint := 1785511299153;
  expected_predecessor_hash CONSTANT text :=
    '6722ad35c976e90acca96492a4167c1b259ed0172055c21478f2fcbd9eea310a';
  enum_named_count integer;
  current_column_named_count integer;
  current_constraint_named_count integer;
  transition_table_count integer;
  function_named_count integer;
  trigger_named_count integer;
  catalog_state text;
  pre_membership_count bigint;
  pre_binding_count bigint;
  post_membership_count bigint;
  post_binding_count bigint;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT count(*) <> expected_predecessor_count
      OR max(created_at) <> expected_predecessor_when
      OR count(*) FILTER (
        WHERE created_at = expected_predecessor_when
          AND hash = expected_predecessor_hash
      ) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_JOURNAL_DRIFT';
  END IF;

  IF to_regclass('public.tenant_members') IS NULL
    OR to_regclass('public.auth_account_institution_bindings') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_REQUIRED_RELATION_MISSING';
  END IF;

  IF (
    WITH expected(column_name, udt_name, character_maximum_length, is_nullable) AS (
      VALUES
        ('id', 'varchar', 64, 'NO'),
        ('tenant_id', 'varchar', 64, 'NO'),
        ('user_id', 'varchar', 96, 'NO'),
        ('role', 'auth_role', NULL::integer, 'NO'),
        ('display_name', 'varchar', 120, 'NO'),
        ('created_at', 'timestamptz', NULL::integer, 'NO'),
        ('updated_at', 'timestamptz', NULL::integer, 'NO')
    )
    SELECT count(*) <> 7
    FROM expected
    JOIN information_schema.columns column_row
      ON column_row.table_schema = 'public'
     AND column_row.table_name = 'tenant_members'
     AND column_row.column_name = expected.column_name
     AND column_row.udt_name = expected.udt_name
     AND column_row.character_maximum_length IS NOT DISTINCT FROM
       expected.character_maximum_length
     AND column_row.is_nullable = expected.is_nullable
  ) OR (
    SELECT count(*) <> 7
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_members'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_EXISTING_COLUMN_SHAPE_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
      AND constraint_row.conname = 'tenant_members_pkey'
      AND constraint_row.contype = 'p'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_EXISTING_PRIMARY_KEY_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.tenant_members'::regclass
      AND index_relation.relname = 'tenant_members_tenant_user_unique_idx'
      AND access_method.amname = 'btree'
      AND index_row.indisunique
      AND NOT index_row.indisprimary
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indislive
      AND NOT index_row.indisexclusion
      AND index_row.indnkeyatts = 2
      AND index_row.indnatts = 2
      AND index_row.indexprs IS NULL
      AND index_row.indpred IS NULL
      AND index_relation.reloptions IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'user_id'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_EXISTING_UNIQUE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_index index_row
    WHERE index_row.indrelid = 'public.tenant_members'::regclass
      AND index_row.indisunique
      AND NOT index_row.indisprimary
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indislive
      AND NOT index_row.indisexclusion
      AND index_row.indnkeyatts = 2
      AND index_row.indnatts = 2
      AND index_row.indexprs IS NULL
      AND index_row.indpred IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'id'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_EQUIVALENT_UNIQUE_PREEXISTS';
  END IF;

  IF (
    SELECT count(*) <> 1 FROM public.institution_scopes
  ) OR (
    SELECT count(*) <> 1 FROM public.institution_operating_context_versions
  ) OR (
    SELECT count(*) <> 1 FROM public.institution_operating_contexts
  ) OR (
    SELECT count(*) <> 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.auth_account_institution_bindings'::regclass
      AND index_relation.relname = 'auth_account_institution_bindings_scope_idx'
      AND access_method.amname = 'btree'
      AND NOT index_row.indisunique
      AND NOT index_row.indisprimary
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indislive
      AND NOT index_row.indisexclusion
      AND index_row.indnkeyatts = 2
      AND index_row.indnatts = 2
      AND index_row.indexprs IS NULL
      AND index_row.indpred IS NULL
      AND index_relation.reloptions IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'institution_id'
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid =
        'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.institution_scopes'::regclass
      AND constraint_row.confmatchtype = 's'
      AND constraint_row.confupdtype = 'a'
      AND constraint_row.confdeltype = 'a'
      AND NOT constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'institution_id']::text[]
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.confrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'institution_id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_A2_P2_CATALOG_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM public.institution_scopes
    WHERE status = 'active'
      AND revision = 1
      AND provisioning_source = 'approved_migration_manifest'
  ) OR (
    SELECT count(*) <> 1
    FROM public.institution_operating_context_versions
    WHERE version = 1
      AND source IN ('institution_config', 'product_default')
      AND timezone = 'Asia/Shanghai'
      AND currency = 'CNY'
  ) OR (
    SELECT count(*) <> 1
    FROM public.institution_operating_contexts
    WHERE revision = 1
      AND latest_version = 1
  ) OR EXISTS (
    SELECT 1
    FROM public.institution_operating_context_versions version_row
    LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
    WHERE scope_row.tenant_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.institution_operating_contexts head_row
    LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
    WHERE scope_row.tenant_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.institution_operating_contexts head_row
    LEFT JOIN public.institution_operating_context_versions version_row
      ON version_row.tenant_id = head_row.tenant_id
     AND version_row.institution_id = head_row.institution_id
     AND version_row.version = head_row.latest_version
    WHERE version_row.tenant_id IS NULL
  ) OR (
    SELECT count(*) <> 1
    FROM public.auth_account_institution_bindings
  ) OR EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings
    WHERE tenant_id IS NULL OR institution_id IS NULL
  ) OR (
    SELECT count(*) <> 0
    FROM (
      SELECT tenant_id, institution_id
      FROM public.auth_account_institution_bindings
      GROUP BY tenant_id, institution_id
      HAVING count(*) > 1
    ) duplicate_group
  ) OR (
    SELECT count(*) <> 1
    FROM public.auth_account_institution_bindings binding_row
    LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
    WHERE scope_row.tenant_id IS NULL
      AND binding_row.status = 'active'
      AND binding_row.created_at < (
        SELECT min(scope_created.created_at)
        FROM public.institution_scopes scope_created
      )
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_UPSTREAM_STATE_DRIFT';
  END IF;

  SELECT count(*)
  INTO enum_named_count
  FROM pg_type type_row
  JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
  WHERE namespace_row.nspname = 'public'
    AND type_row.typname IN (
      'membership_lifecycle_status',
      'membership_provenance_source',
      'membership_transition_type'
    );

  SELECT count(*)
  INTO current_column_named_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tenant_members'
    AND column_name IN (
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at'
    );

  SELECT count(*)
  INTO current_constraint_named_count
  FROM pg_constraint
  WHERE conrelid = 'public.tenant_members'::regclass
    AND conname IN (
      'tenant_members_tenant_id_id_unique',
      'tenant_members_current_envelope_shape_check'
    );

  SELECT (to_regclass('public.tenant_membership_transitions') IS NOT NULL)::integer
  INTO transition_table_count;

  SELECT count(*)
  INTO function_named_count
  FROM pg_proc function_row
  JOIN pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND function_row.proname = 'reject_tenant_membership_transition_mutation';

  SELECT count(*)
  INTO trigger_named_count
  FROM pg_trigger
  WHERE tgname IN (
      'tenant_membership_transitions_reject_row_mutation',
      'tenant_membership_transitions_reject_truncate'
    )
    AND NOT tgisinternal;

  IF enum_named_count = 0
    AND current_column_named_count = 0
    AND current_constraint_named_count = 0
    AND transition_table_count = 0
    AND function_named_count = 0
    AND trigger_named_count = 0
  THEN
    catalog_state := 'all_missing';
  ELSE
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_PREEXISTING_CATALOG';
  END IF;

  SELECT count(*) INTO pre_membership_count FROM public.tenant_members;
  SELECT count(*) INTO pre_binding_count FROM public.auth_account_institution_bindings;

  IF catalog_state = 'all_missing' THEN
    CREATE TYPE public.membership_lifecycle_status AS ENUM (
      'active',
      'revoked',
      'deleted'
    );

    CREATE TYPE public.membership_provenance_source AS ENUM (
      'formal_onboarding',
      'access_control_command',
      'legacy_calibration'
    );

    CREATE TYPE public.membership_transition_type AS ENUM (
      'create',
      'refresh',
      'revoke',
      'reactivate',
      'delete',
      'legacy_calibration'
    );

    ALTER TABLE public.tenant_members
      ADD COLUMN revision integer,
      ADD COLUMN lifecycle_status public.membership_lifecycle_status,
      ADD COLUMN current_provenance_source public.membership_provenance_source,
      ADD COLUMN current_provenance_actor_id varchar(96),
      ADD COLUMN current_provenance_reason_code varchar(96),
      ADD COLUMN current_provenance_command_id varchar(128),
      ADD COLUMN current_provenance_occurred_at timestamp with time zone,
      ADD COLUMN current_provenance_recorded_at timestamp with time zone,
      ADD COLUMN revoked_at timestamp with time zone,
      ADD COLUMN deleted_at timestamp with time zone,
      ADD CONSTRAINT tenant_members_tenant_id_id_unique
        UNIQUE (tenant_id, id),
      ADD CONSTRAINT tenant_members_current_envelope_shape_check CHECK (
        (
          revision IS NULL
          AND lifecycle_status IS NULL
          AND current_provenance_source IS NULL
          AND current_provenance_actor_id IS NULL
          AND current_provenance_reason_code IS NULL
          AND current_provenance_command_id IS NULL
          AND current_provenance_occurred_at IS NULL
          AND current_provenance_recorded_at IS NULL
          AND revoked_at IS NULL
          AND deleted_at IS NULL
        )
        OR
        (
          revision IS NOT NULL
          AND revision BETWEEN 1 AND 2147483647
          AND lifecycle_status IS NOT NULL
          AND current_provenance_source IS NOT NULL
          AND current_provenance_reason_code IS NOT NULL
          AND current_provenance_command_id IS NOT NULL
          AND current_provenance_recorded_at IS NOT NULL
          AND (
            (
              current_provenance_source = 'legacy_calibration'
              AND revision = 1
              AND lifecycle_status = 'active'
              AND current_provenance_actor_id IS NULL
              AND current_provenance_reason_code = 'legacy_unknown'
              AND current_provenance_occurred_at IS NULL
            )
            OR
            (
              current_provenance_source = 'formal_onboarding'
              AND revision = 1
              AND lifecycle_status = 'active'
              AND current_provenance_actor_id IS NOT NULL
              AND current_provenance_occurred_at IS NOT NULL
              AND current_provenance_recorded_at >= current_provenance_occurred_at
            )
            OR
            (
              current_provenance_source = 'access_control_command'
              AND current_provenance_actor_id IS NOT NULL
              AND current_provenance_occurred_at IS NOT NULL
              AND current_provenance_recorded_at >= current_provenance_occurred_at
            )
          )
          AND (
            (
              lifecycle_status = 'active'
              AND revoked_at IS NULL
              AND deleted_at IS NULL
            )
            OR
            (
              lifecycle_status = 'revoked'
              AND revision >= 2
              AND revoked_at IS NOT NULL
              AND revoked_at = current_provenance_occurred_at
              AND deleted_at IS NULL
            )
            OR
            (
              lifecycle_status = 'deleted'
              AND revision >= 2
              AND deleted_at IS NOT NULL
              AND deleted_at = current_provenance_occurred_at
              AND (revoked_at IS NULL OR revoked_at <= deleted_at)
            )
          )
        )
      );

    CREATE TABLE public.tenant_membership_transitions (
      id varchar(96) NOT NULL,
      tenant_id varchar(64) NOT NULL,
      membership_id varchar(64) NOT NULL,
      command_id varchar(128) NOT NULL,
      transition_type public.membership_transition_type NOT NULL,
      source public.membership_provenance_source NOT NULL,
      actor_id varchar(96),
      reason_code varchar(96) NOT NULL,
      from_revision integer,
      to_revision integer NOT NULL,
      from_lifecycle_status public.membership_lifecycle_status,
      to_lifecycle_status public.membership_lifecycle_status NOT NULL,
      from_role public.auth_role,
      to_role public.auth_role NOT NULL,
      occurred_at timestamp with time zone,
      recorded_at timestamp with time zone NOT NULL,
      CONSTRAINT tenant_membership_transitions_pkey PRIMARY KEY (id),
      CONSTRAINT tenant_membership_transitions_tenant_membership_fk
        FOREIGN KEY (tenant_id, membership_id)
        REFERENCES public.tenant_members (tenant_id, id)
        MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
      CONSTRAINT tenant_membership_transitions_tenant_command_unique
        UNIQUE (tenant_id, command_id),
      CONSTRAINT tenant_membership_transitions_membership_revision_unique
        UNIQUE (membership_id, to_revision),
      CONSTRAINT tenant_membership_transitions_revision_shape_check CHECK (
        to_revision BETWEEN 1 AND 2147483647
        AND (
          (
            transition_type IN ('create', 'legacy_calibration')
            AND from_revision IS NULL
            AND to_revision = 1
          )
          OR
          (
            transition_type IN ('refresh', 'revoke', 'reactivate', 'delete')
            AND from_revision IS NOT NULL
            AND from_revision BETWEEN 1 AND 2147483646
            AND to_revision = from_revision + 1
          )
        )
      ),
      CONSTRAINT tenant_membership_transitions_lifecycle_shape_check CHECK (
        (
          transition_type IN ('create', 'legacy_calibration')
          AND from_lifecycle_status IS NULL
          AND to_lifecycle_status = 'active'
        )
        OR (
          transition_type = 'refresh'
          AND from_lifecycle_status IS NOT NULL
          AND from_lifecycle_status = 'active'
          AND to_lifecycle_status = 'active'
        )
        OR (
          transition_type = 'revoke'
          AND from_lifecycle_status IS NOT NULL
          AND from_lifecycle_status = 'active'
          AND to_lifecycle_status = 'revoked'
        )
        OR (
          transition_type = 'reactivate'
          AND from_lifecycle_status IS NOT NULL
          AND from_lifecycle_status = 'revoked'
          AND to_lifecycle_status = 'active'
        )
        OR (
          transition_type = 'delete'
          AND from_lifecycle_status IS NOT NULL
          AND from_lifecycle_status IN ('active', 'revoked')
          AND to_lifecycle_status = 'deleted'
        )
      ),
      CONSTRAINT tenant_membership_transitions_role_shape_check CHECK (
        (
          transition_type IN ('create', 'legacy_calibration')
          AND from_role IS NULL
        )
        OR (
          transition_type = 'refresh'
          AND from_role IS NOT NULL
          AND from_role <> to_role
        )
        OR (
          transition_type IN ('revoke', 'reactivate', 'delete')
          AND from_role IS NOT NULL
          AND from_role = to_role
        )
      ),
      CONSTRAINT tenant_membership_transitions_provenance_shape_check CHECK (
        (
          transition_type = 'legacy_calibration'
          AND source = 'legacy_calibration'
          AND actor_id IS NULL
          AND reason_code = 'legacy_unknown'
          AND occurred_at IS NULL
        )
        OR (
          transition_type = 'create'
          AND source IN ('formal_onboarding', 'access_control_command')
          AND actor_id IS NOT NULL
          AND occurred_at IS NOT NULL
          AND recorded_at >= occurred_at
        )
        OR (
          transition_type IN ('refresh', 'revoke', 'reactivate', 'delete')
          AND source = 'access_control_command'
          AND actor_id IS NOT NULL
          AND occurred_at IS NOT NULL
          AND recorded_at >= occurred_at
        )
      )
    );

    CREATE INDEX tenant_membership_transitions_tenant_membership_revision_idx
      ON public.tenant_membership_transitions
      USING btree (tenant_id, membership_id, to_revision);

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
  END IF;

  IF (
    SELECT array_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY['active', 'revoked', 'deleted']::text[]
    FROM pg_type type_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    JOIN pg_enum enum_row ON enum_row.enumtypid = type_row.oid
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_lifecycle_status'
  ) OR (
    SELECT array_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM
        ARRAY['formal_onboarding', 'access_control_command', 'legacy_calibration']::text[]
    FROM pg_type type_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    JOIN pg_enum enum_row ON enum_row.enumtypid = type_row.oid
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_provenance_source'
  ) OR (
    SELECT array_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM
        ARRAY['create', 'refresh', 'revoke', 'reactivate', 'delete', 'legacy_calibration']::text[]
    FROM pg_type type_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    JOIN pg_enum enum_row ON enum_row.enumtypid = type_row.oid
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_transition_type'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_ENUM_DEFINITION_DRIFT';
  END IF;

  IF (
    WITH expected(column_name, udt_name, character_maximum_length) AS (
      VALUES
        ('revision', 'int4', NULL::integer),
        ('lifecycle_status', 'membership_lifecycle_status', NULL::integer),
        ('current_provenance_source', 'membership_provenance_source', NULL::integer),
        ('current_provenance_actor_id', 'varchar', 96),
        ('current_provenance_reason_code', 'varchar', 96),
        ('current_provenance_command_id', 'varchar', 128),
        ('current_provenance_occurred_at', 'timestamptz', NULL::integer),
        ('current_provenance_recorded_at', 'timestamptz', NULL::integer),
        ('revoked_at', 'timestamptz', NULL::integer),
        ('deleted_at', 'timestamptz', NULL::integer)
    )
    SELECT count(*) <> 10
    FROM expected
    JOIN information_schema.columns column_row
      ON column_row.table_schema = 'public'
     AND column_row.table_name = 'tenant_members'
     AND column_row.column_name = expected.column_name
     AND column_row.udt_name = expected.udt_name
     AND column_row.character_maximum_length IS NOT DISTINCT FROM
       expected.character_maximum_length
     AND column_row.is_nullable = 'YES'
     AND column_row.column_default IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_CURRENT_COLUMN_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
      AND constraint_row.conname = 'tenant_members_tenant_id_id_unique'
      AND constraint_row.contype = 'u'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'id']::text[]
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
      AND constraint_row.conname = 'tenant_members_current_envelope_shape_check'
      AND constraint_row.contype = 'c'
      AND constraint_row.convalidated
      AND NOT constraint_row.connoinherit
      AND position(
        'revisionisnotnull'
        IN regexp_replace(
          lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
          '[[:space:]"]',
          '',
          'g'
        )
      ) > 0
      AND position(
        'formal_onboarding'
        IN lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false))
      ) > 0
      AND position(
        'access_control_command'
        IN lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false))
      ) > 0
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_CURRENT_CONSTRAINT_DRIFT';
  END IF;

  IF to_regclass('public.tenant_membership_transitions') IS NULL OR (
    WITH expected(column_name, udt_name, character_maximum_length, is_nullable) AS (
      VALUES
        ('id', 'varchar', 96, 'NO'),
        ('tenant_id', 'varchar', 64, 'NO'),
        ('membership_id', 'varchar', 64, 'NO'),
        ('command_id', 'varchar', 128, 'NO'),
        ('transition_type', 'membership_transition_type', NULL::integer, 'NO'),
        ('source', 'membership_provenance_source', NULL::integer, 'NO'),
        ('actor_id', 'varchar', 96, 'YES'),
        ('reason_code', 'varchar', 96, 'NO'),
        ('from_revision', 'int4', NULL::integer, 'YES'),
        ('to_revision', 'int4', NULL::integer, 'NO'),
        ('from_lifecycle_status', 'membership_lifecycle_status', NULL::integer, 'YES'),
        ('to_lifecycle_status', 'membership_lifecycle_status', NULL::integer, 'NO'),
        ('from_role', 'auth_role', NULL::integer, 'YES'),
        ('to_role', 'auth_role', NULL::integer, 'NO'),
        ('occurred_at', 'timestamptz', NULL::integer, 'YES'),
        ('recorded_at', 'timestamptz', NULL::integer, 'NO')
    )
    SELECT count(*) <> 16
    FROM expected
    JOIN information_schema.columns column_row
      ON column_row.table_schema = 'public'
     AND column_row.table_name = 'tenant_membership_transitions'
     AND column_row.column_name = expected.column_name
     AND column_row.udt_name = expected.udt_name
     AND column_row.character_maximum_length IS NOT DISTINCT FROM
       expected.character_maximum_length
     AND column_row.is_nullable = expected.is_nullable
     AND column_row.column_default IS NULL
  ) OR (
    SELECT count(*) <> 16
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_membership_transitions'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_TRANSITION_COLUMN_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 8
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_membership_transitions'::regclass
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname = 'tenant_membership_transitions_tenant_membership_fk'
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.tenant_members'::regclass
      AND constraint_row.confmatchtype = 's'
      AND constraint_row.confupdtype = 'a'
      AND constraint_row.confdeltype = 'a'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'membership_id']::text[]
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.confrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'id']::text[]
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname = 'tenant_membership_transitions_pkey'
      AND constraint_row.contype = 'p'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['id']::text[]
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname = 'tenant_membership_transitions_tenant_command_unique'
      AND constraint_row.contype = 'u'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'command_id']::text[]
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname =
        'tenant_membership_transitions_membership_revision_unique'
      AND constraint_row.contype = 'u'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['membership_id', 'to_revision']::text[]
  ) OR (
    SELECT count(*) <> 4
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname IN (
        'tenant_membership_transitions_revision_shape_check',
        'tenant_membership_transitions_lifecycle_shape_check',
        'tenant_membership_transitions_role_shape_check',
        'tenant_membership_transitions_provenance_shape_check'
      )
      AND constraint_row.contype = 'c'
      AND constraint_row.convalidated
      AND NOT constraint_row.connoinherit
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname = 'tenant_membership_transitions_revision_shape_check'
      AND position(
        'from_revisionisnotnull'
        IN regexp_replace(
          lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
          '[[:space:]"]',
          '',
          'g'
        )
      ) > 0
  ) OR (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname = 'tenant_membership_transitions_lifecycle_shape_check'
      AND position(
        'from_lifecycle_statusisnotnull'
        IN regexp_replace(
          lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
          '[[:space:]"]',
          '',
          'g'
        )
      ) > 0
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_TRANSITION_CONSTRAINT_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 4
    FROM pg_index
    WHERE indrelid = 'public.tenant_membership_transitions'::regclass
  ) OR (
    SELECT count(*) <> 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.tenant_membership_transitions'::regclass
      AND index_relation.relname =
        'tenant_membership_transitions_tenant_membership_revision_idx'
      AND access_method.amname = 'btree'
      AND NOT index_row.indisunique
      AND NOT index_row.indisprimary
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indislive
      AND NOT index_row.indisexclusion
      AND index_row.indnkeyatts = 3
      AND index_row.indnatts = 3
      AND index_row.indexprs IS NULL
      AND index_row.indpred IS NULL
      AND index_relation.reloptions IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'membership_id'
      AND pg_get_indexdef(index_row.indexrelid, 3, true) = 'to_revision'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_TRANSITION_INDEX_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_proc function_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND function_row.proname = 'reject_tenant_membership_transition_mutation'
      AND function_row.pronargs = 0
      AND function_row.prorettype = 'pg_catalog.trigger'::regtype
      AND function_row.prolang = (
        SELECT language_row.oid
        FROM pg_language language_row
        WHERE language_row.lanname = 'plpgsql'
      )
      AND NOT function_row.prosecdef
      AND NOT function_row.proleakproof
      AND function_row.provolatile = 'v'
      AND function_row.proparallel = 'u'
      AND function_row.proconfig = ARRAY['search_path=pg_catalog, public']::text[]
      AND btrim(regexp_replace(lower(function_row.prosrc), '[[:space:]]+', ' ', 'g')) =
        $expected_function_body$begin raise exception using errcode = '55000', message = 'tenant_membership_transition_immutable'; end;$expected_function_body$
  ) OR (
    SELECT count(*) <> 2
    FROM pg_trigger
    WHERE tgrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT tgisinternal
  ) OR (
    SELECT count(*) <> 1
    FROM pg_trigger
    WHERE tgrelid = 'public.tenant_membership_transitions'::regclass
      AND tgname = 'tenant_membership_transitions_reject_row_mutation'
      AND tgfoid = 'public.reject_tenant_membership_transition_mutation()'::regprocedure
      AND NOT tgisinternal
      AND tgtype = 27
      AND tgenabled = 'O'
      AND tgqual IS NULL
      AND tgconstraint = 0
  ) OR (
    SELECT count(*) <> 1
    FROM pg_trigger
    WHERE tgrelid = 'public.tenant_membership_transitions'::regclass
      AND tgname = 'tenant_membership_transitions_reject_truncate'
      AND tgfoid = 'public.reject_tenant_membership_transition_mutation()'::regprocedure
      AND NOT tgisinternal
      AND tgtype = 34
      AND tgenabled = 'O'
      AND tgqual IS NULL
      AND tgconstraint = 0
  ) OR (
    SELECT count(*) <> 1
    FROM pg_class relation_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    WHERE namespace_row.nspname = 'public'
      AND relation_row.relname = 'tenant_membership_transitions'
      AND relation_row.relkind = 'r'
      AND relation_row.relpersistence = 'p'
      AND NOT relation_row.relispartition
      AND NOT relation_row.relrowsecurity
      AND NOT relation_row.relforcerowsecurity
      AND NOT relation_row.relhasrules
  ) OR EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_inherits
    WHERE inhrelid = 'public.tenant_membership_transitions'::regclass
      OR inhparent = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_publication_rel
    WHERE prrelid = 'public.tenant_membership_transitions'::regclass
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_APPEND_ONLY_GUARD_DRIFT';
  END IF;

  SELECT count(*) INTO post_membership_count FROM public.tenant_members;
  SELECT count(*) INTO post_binding_count FROM public.auth_account_institution_bindings;

  IF post_membership_count <> pre_membership_count
    OR post_binding_count <> pre_binding_count
    OR EXISTS (
      SELECT 1
      FROM public.tenant_members
      WHERE revision IS NOT NULL
        OR lifecycle_status IS NOT NULL
        OR current_provenance_source IS NOT NULL
        OR current_provenance_actor_id IS NOT NULL
        OR current_provenance_reason_code IS NOT NULL
        OR current_provenance_command_id IS NOT NULL
        OR current_provenance_occurred_at IS NOT NULL
        OR current_provenance_recorded_at IS NOT NULL
        OR revoked_at IS NOT NULL
        OR deleted_at IS NOT NULL
    )
    OR EXISTS (SELECT 1 FROM public.tenant_membership_transitions)
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_DATA_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> expected_predecessor_count
      OR max(created_at) <> expected_predecessor_when
      OR count(*) FILTER (
        WHERE created_at = expected_predecessor_when
          AND hash = expected_predecessor_hash
      ) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M1_JOURNAL_POSTCHECK_FAILED';
  END IF;
END
$migration$;
