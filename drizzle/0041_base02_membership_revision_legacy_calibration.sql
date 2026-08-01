SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

LOCK TABLE "public"."tenant_members" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."tenant_membership_transitions" IN SHARE ROW EXCLUSIVE MODE;

DO $migration$
DECLARE
  expected_predecessor_count CONSTANT integer := 41;
  expected_predecessor_when CONSTANT bigint := 1785587487000;
  expected_predecessor_hash CONSTANT text :=
    '41b6572cb725ed5f7ff79a0e1d6172110caab52ad63c7971be87d3e2fe034641';
  command_domain CONSTANT text := 'zmtg:membership-calibration-command:v1';
  transition_domain CONSTANT text := 'zmtg:membership-calibration-transition:v1';
  synthetic_tenant CONSTANT text := 'tenant_synthetic_m4';
  synthetic_membership CONSTANT text := 'membership_synthetic_m4';
  expected_synthetic_command CONSTANT text :=
    'mcal1_fdbd37decb6f6af2edafaf56fd3f9fa0bd73b8cf6f6f152856a96d71f36c11d6';
  expected_synthetic_evidence CONSTANT text :=
    'mtcl1_77ad99278836422ed1074f3a3ca2fe9254f6607cbef4e6ae3028388b51ba11b6';
  pre_membership_count bigint;
  pre_transition_count bigint;
  pre_binding_count bigint;
  pre_scope_count bigint;
  pre_context_version_count bigint;
  pre_context_head_count bigint;
  pre_scope_relation_orphan_count bigint;
  pre_active_historical_orphan_count bigint;
  pre_all_null_count bigint;
  pre_partial_count bigint;
  pre_complete_count bigint;
  post_membership_count bigint;
  post_transition_count bigint;
  post_binding_count bigint;
  post_scope_count bigint;
  post_context_version_count bigint;
  post_context_head_count bigint;
  post_scope_relation_orphan_count bigint;
  post_active_historical_orphan_count bigint;
  post_all_null_count bigint;
  post_partial_count bigint;
  post_complete_count bigint;
  high_water_created_at timestamptz;
  high_water_id varchar(64);
  calibration_recorded_at timestamptz;
  planned_count bigint := 0;
  updated_count bigint := 0;
  inserted_count bigint := 0;
  created_count bigint := 0;
  reused_count bigint := 0;
  conflict_count bigint := 0;
  unexpected_count bigint := 0;
  update_row_count bigint;
  insert_row_count bigint;
  candidate_row record;
  updated_row record;
  command_identity varchar(128);
  evidence_identity varchar(96);
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer < 160000
    OR pg_catalog.current_setting('server_version_num')::integer >= 170000
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_POSTGRES_VERSION_DRIFT';
  END IF;

  IF pg_catalog.to_regprocedure('pg_catalog.sha256(bytea)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.convert_to(text,name)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.decode(text,text)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.encode(bytea,text)') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_IDENTITY_FUNCTION_DRIFT';
  END IF;

  IF (
    'mcal1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(command_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_tenant, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_membership, 'UTF8')
      ),
      'hex'
    )
  ) <> expected_synthetic_command OR (
    'mtcl1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transition_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_tenant, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_membership, 'UTF8')
      ),
      'hex'
    )
  ) <> expected_synthetic_evidence THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_IDENTITY_VECTOR_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_JOURNAL_MISSING';
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
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.tenant_members') IS NULL
    OR pg_catalog.to_regclass('public.tenant_membership_transitions') IS NULL
    OR pg_catalog.to_regclass('public.tenants') IS NULL
    OR pg_catalog.to_regclass('public.auth_users') IS NULL
    OR pg_catalog.to_regclass('public.auth_account_institution_bindings') IS NULL
    OR pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_context_versions') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_contexts') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_REQUIRED_RELATION_MISSING';
  END IF;

  IF (
    SELECT pg_catalog.array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY['active', 'revoked', 'deleted']::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_lifecycle_status'
  ) OR (
    SELECT pg_catalog.array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY[
        'formal_onboarding',
        'access_control_command',
        'legacy_calibration'
      ]::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_provenance_source'
  ) OR (
    SELECT pg_catalog.array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY[
        'create',
        'refresh',
        'revoke',
        'reactivate',
        'delete',
        'legacy_calibration'
      ]::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_transition_type'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_ENUM_DRIFT';
  END IF;

  IF (
    WITH expected(
      column_name,
      udt_name,
      character_maximum_length,
      is_nullable,
      column_default
    ) AS (
      VALUES
        ('id', 'varchar', 64, 'NO', NULL::text),
        ('tenant_id', 'varchar', 64, 'NO', NULL::text),
        ('user_id', 'varchar', 96, 'NO', NULL::text),
        ('role', 'auth_role', NULL::integer, 'NO', NULL::text),
        ('display_name', 'varchar', 120, 'NO', NULL::text),
        ('created_at', 'timestamptz', NULL::integer, 'NO', 'now()'),
        ('updated_at', 'timestamptz', NULL::integer, 'NO', 'now()'),
        ('revision', 'int4', NULL::integer, 'YES', NULL::text),
        ('lifecycle_status', 'membership_lifecycle_status', NULL::integer, 'YES', NULL::text),
        ('current_provenance_source', 'membership_provenance_source', NULL::integer, 'YES', NULL::text),
        ('current_provenance_actor_id', 'varchar', 96, 'YES', NULL::text),
        ('current_provenance_reason_code', 'varchar', 96, 'YES', NULL::text),
        ('current_provenance_command_id', 'varchar', 128, 'YES', NULL::text),
        ('current_provenance_occurred_at', 'timestamptz', NULL::integer, 'YES', NULL::text),
        ('current_provenance_recorded_at', 'timestamptz', NULL::integer, 'YES', NULL::text),
        ('revoked_at', 'timestamptz', NULL::integer, 'YES', NULL::text),
        ('deleted_at', 'timestamptz', NULL::integer, 'YES', NULL::text)
    )
    SELECT count(*) <> 17
    FROM expected
    JOIN information_schema.columns column_row
      ON column_row.table_schema = 'public'
     AND column_row.table_name = 'tenant_members'
     AND column_row.column_name = expected.column_name
     AND column_row.udt_name = expected.udt_name
     AND column_row.character_maximum_length IS NOT DISTINCT FROM
       expected.character_maximum_length
     AND column_row.is_nullable = expected.is_nullable
     AND column_row.column_default IS NOT DISTINCT FROM expected.column_default
  ) OR (
    SELECT count(*) <> 17
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_members'
  ) OR (
    SELECT pg_catalog.array_agg(
      constraint_row.conname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
          'UTF8'
        )),
        'hex'
      )
      ORDER BY constraint_row.conname::text
    ) IS DISTINCT FROM ARRAY[
      'tenant_members_current_envelope_shape_check:82796868c10f6bcd25a49786b9652badcf88c577b7b440da3545cd518016ec1f',
      'tenant_members_pkey:8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5',
      'tenant_members_tenant_id_id_unique:df85201802c68cde29d160aa847142747ee29b47a7699f4a3b0d143b054cad73',
      'tenant_members_tenant_id_tenants_id_fk:d931da577fc120910fe105fe12727c52721a31800b4baf73445d56de61900526',
      'tenant_members_user_id_auth_users_id_fk:058d1e81ee627f1b5d45598b07bd6cdfe67fc541654147b661297e10fbf101b0'
    ]::text[]
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
  ) OR (
    SELECT count(*) FILTER (WHERE NOT constraint_row.convalidated) <> 1
      OR count(*) FILTER (
        WHERE NOT constraint_row.convalidated
          AND constraint_row.conname = 'tenant_members_user_id_auth_users_id_fk'
      ) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
  ) OR (
    SELECT pg_catalog.array_agg(
      index_relation.relname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_indexdef(index_row.indexrelid),
          'UTF8'
        )),
        'hex'
      )
      ORDER BY index_relation.relname::text
    ) IS DISTINCT FROM ARRAY[
      'tenant_members_pkey:7ae73a32a715719614e05bafb26e3b6bd9e1d2eb32d6c6a2fa014899f9f0da16',
      'tenant_members_tenant_id_id_unique:6e43c3122c3333c08151edda05e61e552d7bba6fc9373fe3b2b297996437a926',
      'tenant_members_tenant_role_idx:902c85e1272f42eb13ec1621649a530485879cfb5c0319fff87e0bc45e8151ec',
      'tenant_members_tenant_user_unique_idx:7acc4c982277001f8457e34060eac78374584e3bf21f9be0818a5ac8789c0cdb'
    ]::text[]
    FROM pg_catalog.pg_index index_row
    JOIN pg_catalog.pg_class index_relation ON index_relation.oid = index_row.indexrelid
    WHERE index_row.indrelid = 'public.tenant_members'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index index_row
    WHERE index_row.indrelid = 'public.tenant_members'::regclass
      AND NOT (index_row.indisvalid AND index_row.indisready AND index_row.indislive)
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.tenant_members'::regclass
      AND NOT trigger_row.tgisinternal
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_rewrite rule_row
    WHERE rule_row.ev_class = 'public.tenant_members'::regclass
      AND rule_row.rulename <> '_RETURN'
  ) OR (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_class relation_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    WHERE namespace_row.nspname = 'public'
      AND relation_row.relname = 'tenant_members'
      AND relation_row.relkind = 'r'
      AND relation_row.relpersistence = 'p'
      AND NOT relation_row.relispartition
      AND NOT relation_row.relrowsecurity
      AND NOT relation_row.relforcerowsecurity
      AND NOT relation_row.relhasrules
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenant_members'::regclass
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_inherits
    WHERE inhrelid = 'public.tenant_members'::regclass
      OR inhparent = 'public.tenant_members'::regclass
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_rel
    WHERE prrelid = 'public.tenant_members'::regclass
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_CURRENT_CATALOG_DRIFT';
  END IF;

  IF (
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
  ) OR (
    SELECT pg_catalog.array_agg(
      constraint_row.conname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
          'UTF8'
        )),
        'hex'
      )
      ORDER BY constraint_row.conname::text
    ) IS DISTINCT FROM ARRAY[
        'tenant_membership_transitions_lifecycle_shape_check:70dfcaf4c8bf10950f8ef6922785eb7ddf86074c62755582891cb857f64c66de',
        'tenant_membership_transitions_membership_revision_unique:cd57b2e0e2769a37d38f06102279ea2c2a09080002d3977d9621e4817a585b0c',
        'tenant_membership_transitions_pkey:8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5',
        'tenant_membership_transitions_provenance_shape_check:4cf86510af7b437df78fdabd5ba51f2ba1db5c050687502978eff5109d97197b',
        'tenant_membership_transitions_revision_shape_check:fb4db87e5708fc21c06e70b23f6890f02c0a78ec1d7e27ea839576fade715df3',
        'tenant_membership_transitions_role_shape_check:8563ca26c2662fd0a4b177ab2019c556dafe79035e74d8e5796c39e0480c2d97',
        'tenant_membership_transitions_tenant_command_unique:bf606fb60edbc83eafa9136366009a69ac18a74fb9c02fb17a41ebbaa024cb08',
        'tenant_membership_transitions_tenant_membership_fk:e6c34612976e004d31887ffaf8801efee9fbf10c7a5b07f11454acf58053e5cc'
      ]::text[]
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT constraint_row.convalidated
  ) OR (
    SELECT pg_catalog.array_agg(
      index_relation.relname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_indexdef(index_row.indexrelid),
          'UTF8'
        )),
        'hex'
      )
      ORDER BY index_relation.relname::text
    ) IS DISTINCT FROM ARRAY[
        'tenant_membership_transitions_membership_revision_unique:56dd77b2f14f6e15b878cf31e73912138521d484ca64e7ef21c959da8eef2d9a',
        'tenant_membership_transitions_pkey:ca8a0aa892429195d3dd8e245587e0a56a3c9e8d28a13611c72f1c4470980e37',
        'tenant_membership_transitions_tenant_command_unique:1cec9eef095a4b7c6845707649db8965a33d5cfba5ae82a69c463b50ac250687',
        'tenant_membership_transitions_tenant_membership_revision_idx:271306c04b53ae45db169680d91245ef45a9e8b007bec0444f2c34d662019b8c'
      ]::text[]
    FROM pg_catalog.pg_index index_row
    JOIN pg_catalog.pg_class index_relation ON index_relation.oid = index_row.indexrelid
    WHERE index_row.indrelid = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index index_row
    WHERE index_row.indrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT (index_row.indisvalid AND index_row.indisready AND index_row.indislive)
  ) OR (
    SELECT pg_catalog.array_agg(
      trigger_row.tgname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_triggerdef(trigger_row.oid, false),
          'UTF8'
        )),
        'hex'
      )
      ORDER BY trigger_row.tgname::text
    ) IS DISTINCT FROM ARRAY[
        'tenant_membership_transitions_reject_row_mutation:ccf75bfb2a4814e1a2ac74288abc8d11b0f574dde0c2c9674ddca92346652ef6',
        'tenant_membership_transitions_reject_truncate:ba2700919090be08fc1666d3c10b24d4f3cbf34ed280979a4c068f7c871bcdf0'
      ]::text[]
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT trigger_row.tgisinternal
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'O'
  ) OR (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_proc function_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND function_row.proname = 'reject_tenant_membership_transition_mutation'
      AND function_row.pronargs = 0
      AND function_row.prorettype = 'pg_catalog.trigger'::regtype
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.pg_get_functiondef(function_row.oid),
        'UTF8'
      )), 'hex') = '076415514e37e9d4c6ebc4dfd3b6cb9f12f02c0ff5ed4f9935177d6b588e1a64'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_rewrite rule_row
    WHERE rule_row.ev_class = 'public.tenant_membership_transitions'::regclass
      AND rule_row.rulename <> '_RETURN'
  ) OR (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_class relation_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    WHERE namespace_row.nspname = 'public'
      AND relation_row.relname = 'tenant_membership_transitions'
      AND relation_row.relkind = 'r'
      AND relation_row.relpersistence = 'p'
      AND NOT relation_row.relispartition
      AND NOT relation_row.relrowsecurity
      AND NOT relation_row.relforcerowsecurity
      AND NOT relation_row.relhasrules
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_inherits
    WHERE inhrelid = 'public.tenant_membership_transitions'::regclass
      OR inhparent = 'public.tenant_membership_transitions'::regclass
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_rel
    WHERE prrelid = 'public.tenant_membership_transitions'::regclass
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_TRANSITION_CATALOG_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
      AND constraint_row.conname = 'tenant_members_user_id_auth_users_id_fk'
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.auth_users'::regclass
      AND constraint_row.confmatchtype = 's'
      AND constraint_row.confupdtype = 'a'
      AND constraint_row.confdeltype = 'a'
      AND NOT constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM pg_catalog.unnest(constraint_row.conkey)
          WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_catalog.pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['user_id']::text[]
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM pg_catalog.unnest(constraint_row.confkey)
          WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_catalog.pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.confrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_USER_FK_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
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
        FROM pg_catalog.unnest(constraint_row.conkey)
          WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_catalog.pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'institution_id']::text[]
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM pg_catalog.unnest(constraint_row.confkey)
          WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_catalog.pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.confrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'institution_id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_SCOPE_FK_DRIFT';
  END IF;

  SELECT count(*) INTO pre_membership_count FROM public.tenant_members;
  SELECT count(*) INTO pre_transition_count FROM public.tenant_membership_transitions;
  SELECT count(*) INTO pre_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO pre_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO pre_context_version_count
  FROM public.institution_operating_context_versions;
  SELECT count(*) INTO pre_context_head_count
  FROM public.institution_operating_contexts;

  SELECT count(*) INTO pre_all_null_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) = 0;

  SELECT count(*) INTO pre_partial_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) > 0
    AND NOT (
      member_row.revision IS NOT NULL
      AND member_row.lifecycle_status IS NOT NULL
      AND member_row.current_provenance_source IS NOT NULL
      AND member_row.current_provenance_reason_code IS NOT NULL
      AND member_row.current_provenance_command_id IS NOT NULL
      AND member_row.current_provenance_recorded_at IS NOT NULL
    );
  pre_complete_count := pre_membership_count - pre_all_null_count - pre_partial_count;

  SELECT count(*) INTO pre_scope_relation_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;

  SELECT count(*) INTO pre_active_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (
      SELECT min(scope_created.created_at)
      FROM public.institution_scopes scope_created
    );

  IF pre_membership_count <> 1
    OR pre_transition_count <> 0
    OR pre_binding_count <> 1
    OR pre_scope_count <> 1
    OR pre_context_version_count <> 1
    OR pre_context_head_count <> 1
    OR pre_all_null_count <> 1
    OR pre_partial_count <> 0
    OR pre_complete_count <> 0
    OR pre_scope_relation_orphan_count <> 1
    OR pre_active_historical_orphan_count <> 1
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_DATA_BASELINE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_members candidate_member
    LEFT JOIN public.tenants tenant_row ON tenant_row.id = candidate_member.tenant_id
    LEFT JOIN public.auth_users user_row ON user_row.id = candidate_member.user_id
    WHERE pg_catalog.num_nonnulls(
      candidate_member.revision,
      candidate_member.lifecycle_status,
      candidate_member.current_provenance_source,
      candidate_member.current_provenance_actor_id,
      candidate_member.current_provenance_reason_code,
      candidate_member.current_provenance_command_id,
      candidate_member.current_provenance_occurred_at,
      candidate_member.current_provenance_recorded_at,
      candidate_member.revoked_at,
      candidate_member.deleted_at
    ) = 0
      AND (tenant_row.id IS NULL OR user_row.id IS NULL)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_CANDIDATE_PARENT_MISSING';
  END IF;

  SELECT member_row.created_at, member_row.id
  INTO high_water_created_at, high_water_id
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) = 0
  ORDER BY member_row.created_at DESC, member_row.id COLLATE "C" DESC
  LIMIT 1;

  IF high_water_created_at IS NULL OR high_water_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_NO_CANDIDATES';
  END IF;

  SELECT count(*) INTO planned_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) = 0
    AND (
      member_row.created_at < high_water_created_at
      OR (
        member_row.created_at = high_water_created_at
        AND member_row.id COLLATE "C" <= high_water_id COLLATE "C"
      )
    );

  IF planned_count <= 0 OR planned_count <> pre_all_null_count THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_PLANNED_COUNT_DRIFT';
  END IF;

  calibration_recorded_at := pg_catalog.clock_timestamp();

  FOR candidate_row IN
    SELECT
      member_row.id,
      member_row.tenant_id,
      member_row.user_id,
      member_row.role,
      member_row.display_name,
      member_row.created_at,
      member_row.updated_at
    FROM public.tenant_members member_row
    WHERE pg_catalog.num_nonnulls(
      member_row.revision,
      member_row.lifecycle_status,
      member_row.current_provenance_source,
      member_row.current_provenance_actor_id,
      member_row.current_provenance_reason_code,
      member_row.current_provenance_command_id,
      member_row.current_provenance_occurred_at,
      member_row.current_provenance_recorded_at,
      member_row.revoked_at,
      member_row.deleted_at
    ) = 0
      AND (
        member_row.created_at < high_water_created_at
        OR (
          member_row.created_at = high_water_created_at
          AND member_row.id COLLATE "C" <= high_water_id COLLATE "C"
        )
      )
    ORDER BY member_row.created_at ASC, member_row.id COLLATE "C" ASC
  LOOP
    command_identity := 'mcal1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(command_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.id, 'UTF8')
      ),
      'hex'
    );
    evidence_identity := 'mtcl1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transition_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.id, 'UTF8')
      ),
      'hex'
    );

    IF command_identity !~ '^mcal1_[0-9a-f]{64}$'
      OR evidence_identity !~ '^mtcl1_[0-9a-f]{64}$'
      OR EXISTS (
        SELECT 1
        FROM public.tenant_members existing_member
        WHERE existing_member.current_provenance_command_id = command_identity
      ) OR EXISTS (
        SELECT 1
        FROM public.tenant_membership_transitions existing_transition
        WHERE existing_transition.command_id = command_identity
          OR existing_transition.id = evidence_identity
          OR (
            existing_transition.membership_id = candidate_row.id
            AND existing_transition.to_revision = 1
          )
      )
    THEN
      conflict_count := conflict_count + 1;
      RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_IDENTITY_CONFLICT';
    END IF;

    UPDATE public.tenant_members AS target_member
    SET
      revision = 1,
      lifecycle_status = 'active',
      current_provenance_source = 'legacy_calibration',
      current_provenance_actor_id = NULL,
      current_provenance_reason_code = 'legacy_unknown',
      current_provenance_command_id = command_identity,
      current_provenance_occurred_at = NULL,
      current_provenance_recorded_at = calibration_recorded_at,
      revoked_at = NULL,
      deleted_at = NULL
    WHERE target_member.id = candidate_row.id
      AND target_member.tenant_id = candidate_row.tenant_id
      AND pg_catalog.num_nonnulls(
        target_member.revision,
        target_member.lifecycle_status,
        target_member.current_provenance_source,
        target_member.current_provenance_actor_id,
        target_member.current_provenance_reason_code,
        target_member.current_provenance_command_id,
        target_member.current_provenance_occurred_at,
        target_member.current_provenance_recorded_at,
        target_member.revoked_at,
        target_member.deleted_at
      ) = 0
    RETURNING
      target_member.id,
      target_member.tenant_id,
      target_member.user_id,
      target_member.role,
      target_member.display_name,
      target_member.created_at,
      target_member.updated_at
    INTO updated_row;
    GET DIAGNOSTICS update_row_count = ROW_COUNT;

    IF update_row_count <> 1
      OR updated_row.id IS DISTINCT FROM candidate_row.id
      OR updated_row.tenant_id IS DISTINCT FROM candidate_row.tenant_id
      OR updated_row.user_id IS DISTINCT FROM candidate_row.user_id
      OR updated_row.role IS DISTINCT FROM candidate_row.role
      OR updated_row.display_name IS DISTINCT FROM candidate_row.display_name
      OR updated_row.created_at IS DISTINCT FROM candidate_row.created_at
      OR updated_row.updated_at IS DISTINCT FROM candidate_row.updated_at
    THEN
      unexpected_count := unexpected_count + 1;
      RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_CURRENT_UPDATE_DRIFT';
    END IF;
    updated_count := updated_count + update_row_count;

    INSERT INTO public.tenant_membership_transitions (
      id,
      tenant_id,
      membership_id,
      command_id,
      transition_type,
      source,
      actor_id,
      reason_code,
      from_revision,
      to_revision,
      from_lifecycle_status,
      to_lifecycle_status,
      from_role,
      to_role,
      occurred_at,
      recorded_at
    ) VALUES (
      evidence_identity,
      candidate_row.tenant_id,
      candidate_row.id,
      command_identity,
      'legacy_calibration',
      'legacy_calibration',
      NULL,
      'legacy_unknown',
      NULL,
      1,
      NULL,
      'active',
      NULL,
      candidate_row.role,
      NULL,
      calibration_recorded_at
    );
    GET DIAGNOSTICS insert_row_count = ROW_COUNT;

    IF insert_row_count <> 1 THEN
      unexpected_count := unexpected_count + 1;
      RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_TRANSITION_INSERT_DRIFT';
    END IF;
    inserted_count := inserted_count + insert_row_count;

    created_count := created_count + 1;
  END LOOP;

  SELECT count(*) INTO post_membership_count FROM public.tenant_members;
  SELECT count(*) INTO post_transition_count FROM public.tenant_membership_transitions;
  SELECT count(*) INTO post_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO post_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO post_context_version_count
  FROM public.institution_operating_context_versions;
  SELECT count(*) INTO post_context_head_count
  FROM public.institution_operating_contexts;

  SELECT count(*) INTO post_all_null_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) = 0;

  SELECT count(*) INTO post_partial_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision,
    member_row.lifecycle_status,
    member_row.current_provenance_source,
    member_row.current_provenance_actor_id,
    member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id,
    member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at,
    member_row.revoked_at,
    member_row.deleted_at
  ) > 0
    AND NOT (
      member_row.revision IS NOT NULL
      AND member_row.lifecycle_status IS NOT NULL
      AND member_row.current_provenance_source IS NOT NULL
      AND member_row.current_provenance_reason_code IS NOT NULL
      AND member_row.current_provenance_command_id IS NOT NULL
      AND member_row.current_provenance_recorded_at IS NOT NULL
    );
  post_complete_count := post_membership_count - post_all_null_count - post_partial_count;

  SELECT count(*) INTO post_scope_relation_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;

  SELECT count(*) INTO post_active_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (
      SELECT min(scope_created.created_at)
      FROM public.institution_scopes scope_created
    );

  IF planned_count <> created_count + reused_count
    OR updated_count <> inserted_count
    OR updated_count <> created_count
    OR inserted_count <> created_count
    OR created_count <> planned_count
    OR reused_count <> 0
    OR conflict_count <> 0
    OR unexpected_count <> 0
    OR post_membership_count <> pre_membership_count
    OR post_transition_count <> pre_transition_count + created_count
    OR post_binding_count <> pre_binding_count
    OR post_scope_count <> pre_scope_count
    OR post_context_version_count <> pre_context_version_count
    OR post_context_head_count <> pre_context_head_count
    OR post_all_null_count <> pre_all_null_count - planned_count
    OR post_partial_count <> 0
    OR post_complete_count <> pre_complete_count + created_count
    OR post_scope_relation_orphan_count <> pre_scope_relation_orphan_count
    OR post_active_historical_orphan_count <> pre_active_historical_orphan_count
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_COUNT_POSTCHECK_FAILED';
  END IF;

  IF (
    SELECT count(*) <> created_count
    FROM public.tenant_members calibrated_member
    JOIN public.tenant_membership_transitions transition_row
      ON transition_row.tenant_id = calibrated_member.tenant_id
     AND transition_row.membership_id = calibrated_member.id
     AND transition_row.command_id = calibrated_member.current_provenance_command_id
     AND transition_row.to_revision = calibrated_member.revision
    WHERE calibrated_member.current_provenance_source = 'legacy_calibration'
      AND calibrated_member.revision = 1
      AND calibrated_member.lifecycle_status = 'active'
      AND calibrated_member.current_provenance_actor_id IS NULL
      AND calibrated_member.current_provenance_reason_code = 'legacy_unknown'
      AND calibrated_member.current_provenance_occurred_at IS NULL
      AND calibrated_member.revoked_at IS NULL
      AND calibrated_member.deleted_at IS NULL
      AND transition_row.transition_type = 'legacy_calibration'
      AND transition_row.source = 'legacy_calibration'
      AND transition_row.actor_id IS NULL
      AND transition_row.reason_code = 'legacy_unknown'
      AND transition_row.from_revision IS NULL
      AND transition_row.to_revision = 1
      AND transition_row.from_lifecycle_status IS NULL
      AND transition_row.to_lifecycle_status = 'active'
      AND transition_row.from_role IS NULL
      AND transition_row.to_role = calibrated_member.role
      AND transition_row.occurred_at IS NULL
      AND transition_row.recorded_at = calibrated_member.current_provenance_recorded_at
      AND transition_row.recorded_at = calibration_recorded_at
  ) OR EXISTS (
    SELECT 1
    FROM public.tenant_members calibrated_member
    WHERE calibrated_member.current_provenance_source = 'legacy_calibration'
      AND NOT EXISTS (
        SELECT 1
        FROM public.tenant_membership_transitions transition_row
        WHERE transition_row.tenant_id = calibrated_member.tenant_id
          AND transition_row.membership_id = calibrated_member.id
          AND transition_row.command_id = calibrated_member.current_provenance_command_id
          AND transition_row.to_revision = calibrated_member.revision
      )
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_CURRENT_EVIDENCE_POSTCHECK_FAILED';
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
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M4_JOURNAL_POSTCHECK_FAILED';
  END IF;
END
$migration$;
