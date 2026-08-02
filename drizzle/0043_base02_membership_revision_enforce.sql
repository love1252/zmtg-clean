SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $$
DECLARE
  expected_predecessor_count CONSTANT integer := 43;
  expected_predecessor_when CONSTANT bigint := 1785634157848;
  predecessor_current_constraint_hash CONSTANT text :=
    '82796868c10f6bcd25a49786b9652badcf88c577b7b440da3545cd518016ec1f';
  final_current_constraint_hash CONSTANT text :=
    '545bbef114ba737b5c05bbd49f2ec6a0bbe2619db7543dcb471074e9f39f52ac';
  catalog_state text;
  current_constraint_hash text;
  required_not_null_count integer;
  journal_count bigint;
  journal_latest_when bigint;
  pre_membership_count bigint;
  pre_transition_count bigint;
  pre_binding_count bigint;
  pre_scope_count bigint;
  pre_context_version_count bigint;
  pre_context_head_count bigint;
  pre_all_null_count bigint;
  pre_partial_count bigint;
  pre_complete_count bigint;
  pre_exact_current_head_count bigint;
  pre_duplicate_command_count bigint;
  pre_duplicate_revision_count bigint;
  pre_scope_relation_orphan_count bigint;
  pre_active_historical_orphan_count bigint;
  post_membership_count bigint;
  post_transition_count bigint;
  post_binding_count bigint;
  post_scope_count bigint;
  post_context_version_count bigint;
  post_context_head_count bigint;
  post_all_null_count bigint;
  post_partial_count bigint;
  post_complete_count bigint;
  post_exact_current_head_count bigint;
  post_duplicate_command_count bigint;
  post_duplicate_revision_count bigint;
  post_scope_relation_orphan_count bigint;
  post_active_historical_orphan_count bigint;
  pre_membership_fingerprint bytea;
  pre_transition_fingerprint bytea;
  pre_binding_fingerprint bytea;
  pre_scope_fingerprint bytea;
  pre_context_version_fingerprint bytea;
  pre_context_head_fingerprint bytea;
  post_membership_fingerprint bytea;
  post_transition_fingerprint bytea;
  post_binding_fingerprint bytea;
  post_scope_fingerprint bytea;
  post_context_version_fingerprint bytea;
  post_context_head_fingerprint bytea;
  planned_count integer := 7;
  created_count integer := 0;
  reused_count integer := 0;
  conflict_count integer := 0;
  unexpected_count integer := 0;
BEGIN
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_POSTGRES_VERSION_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_JOURNAL_MISSING';
  END IF;

  SELECT count(*), max(created_at)
    INTO journal_count, journal_latest_when
  FROM drizzle.__drizzle_migrations;

  IF journal_count <> expected_predecessor_count
    OR journal_latest_when <> expected_predecessor_when
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.tenant_members') IS NULL
    OR pg_catalog.to_regclass('public.tenant_membership_transitions') IS NULL
    OR pg_catalog.to_regclass('public.auth_account_institution_bindings') IS NULL
    OR pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_context_versions') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_contexts') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_REQUIRED_RELATION_MISSING';
  END IF;

  LOCK TABLE "public"."tenant_members" IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE "public"."tenant_membership_transitions" IN SHARE MODE;
  LOCK TABLE "public"."auth_account_institution_bindings" IN SHARE MODE;
  LOCK TABLE "public"."institution_scopes" IN SHARE MODE;
  LOCK TABLE "public"."institution_operating_context_versions" IN SHARE MODE;
  LOCK TABLE "public"."institution_operating_contexts" IN SHARE MODE;

  SELECT count(*), max(created_at)
    INTO journal_count, journal_latest_when
  FROM drizzle.__drizzle_migrations;

  IF journal_count <> expected_predecessor_count
    OR journal_latest_when <> expected_predecessor_when
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_JOURNAL_AFTER_LOCK_DRIFT';
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
        'formal_onboarding', 'access_control_command', 'legacy_calibration'
      ]::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_provenance_source'
  ) OR (
    SELECT pg_catalog.array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY[
        'create', 'refresh', 'revoke', 'reactivate', 'delete', 'legacy_calibration'
      ]::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'membership_transition_type'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_ENUM_DRIFT';
  END IF;

  IF (
    WITH expected(column_name, udt_name, character_maximum_length, column_default) AS (
      VALUES
        ('id', 'varchar', 64, NULL::text),
        ('tenant_id', 'varchar', 64, NULL::text),
        ('user_id', 'varchar', 96, NULL::text),
        ('role', 'auth_role', NULL::integer, NULL::text),
        ('display_name', 'varchar', 120, NULL::text),
        ('created_at', 'timestamptz', NULL::integer, 'now()'),
        ('updated_at', 'timestamptz', NULL::integer, 'now()'),
        ('revision', 'int4', NULL::integer, NULL::text),
        ('lifecycle_status', 'membership_lifecycle_status', NULL::integer, NULL::text),
        ('current_provenance_source', 'membership_provenance_source', NULL::integer, NULL::text),
        ('current_provenance_actor_id', 'varchar', 96, NULL::text),
        ('current_provenance_reason_code', 'varchar', 96, NULL::text),
        ('current_provenance_command_id', 'varchar', 128, NULL::text),
        ('current_provenance_occurred_at', 'timestamptz', NULL::integer, NULL::text),
        ('current_provenance_recorded_at', 'timestamptz', NULL::integer, NULL::text),
        ('revoked_at', 'timestamptz', NULL::integer, NULL::text),
        ('deleted_at', 'timestamptz', NULL::integer, NULL::text)
    )
    SELECT count(*) <> 17
    FROM expected
    JOIN information_schema.columns column_row
      ON column_row.table_schema = 'public'
     AND column_row.table_name = 'tenant_members'
     AND column_row.column_name = expected.column_name
     AND column_row.udt_name = expected.udt_name
     AND column_row.character_maximum_length IS NOT DISTINCT FROM expected.character_maximum_length
     AND column_row.column_default IS NOT DISTINCT FROM expected.column_default
  ) OR (
    SELECT count(*) <> 17
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_members'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_members'
      AND column_name IN (
        'current_provenance_actor_id', 'current_provenance_occurred_at',
        'revoked_at', 'deleted_at'
      )
      AND is_nullable <> 'YES'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_CURRENT_COLUMN_DRIFT';
  END IF;

  SELECT count(*) INTO required_not_null_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tenant_members'
    AND column_name IN (
      'revision', 'lifecycle_status', 'current_provenance_source',
      'current_provenance_reason_code', 'current_provenance_command_id',
      'current_provenance_recorded_at'
    )
    AND is_nullable = 'NO';

  SELECT pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.pg_get_constraintdef(constraint_row.oid, false), 'UTF8'
      )), 'hex'
    )
    INTO current_constraint_hash
  FROM pg_catalog.pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
    AND constraint_row.conname = 'tenant_members_current_envelope_shape_check'
    AND constraint_row.contype = 'c'
    AND constraint_row.convalidated;

  IF required_not_null_count = 0
    AND current_constraint_hash = predecessor_current_constraint_hash
  THEN
    catalog_state := 'expected_m1_predecessor';
  ELSIF required_not_null_count = 6
    AND current_constraint_hash = final_current_constraint_hash
  THEN
    catalog_state := 'all_exact';
  ELSE
    conflict_count := conflict_count + 1;
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_CURRENT_CATALOG_CONFLICT';
  END IF;

  IF (
    SELECT pg_catalog.array_agg(
      constraint_row.conname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, false), 'UTF8'
        )), 'hex'
      ) ORDER BY constraint_row.conname::text
    ) IS DISTINCT FROM ARRAY[
      'tenant_members_pkey:8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5',
      'tenant_members_tenant_id_id_unique:df85201802c68cde29d160aa847142747ee29b47a7699f4a3b0d143b054cad73',
      'tenant_members_tenant_id_tenants_id_fk:d931da577fc120910fe105fe12727c52721a31800b4baf73445d56de61900526',
      'tenant_members_user_id_auth_users_id_fk:058d1e81ee627f1b5d45598b07bd6cdfe67fc541654147b661297e10fbf101b0'
    ]::text[]
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
      AND constraint_row.conname <> 'tenant_members_current_envelope_shape_check'
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
          pg_catalog.pg_get_indexdef(index_row.indexrelid), 'UTF8'
        )), 'hex'
      ) ORDER BY index_relation.relname::text
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
    SELECT 1 FROM pg_catalog.pg_index
    WHERE indrelid = 'public.tenant_members'::regclass
      AND NOT (indisvalid AND indisready AND indislive)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.tenant_members'::regclass AND NOT tgisinternal
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_rewrite
    WHERE ev_class = 'public.tenant_members'::regclass AND rulename <> '_RETURN'
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
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_CURRENT_DEPENDENCY_DRIFT';
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
     AND column_row.character_maximum_length IS NOT DISTINCT FROM expected.character_maximum_length
     AND column_row.is_nullable = expected.is_nullable
     AND column_row.column_default IS NULL
  ) OR (
    SELECT count(*) <> 16 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_membership_transitions'
  ) OR (
    SELECT pg_catalog.array_agg(
      constraint_row.conname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_constraintdef(constraint_row.oid, false), 'UTF8'
        )), 'hex'
      ) ORDER BY constraint_row.conname::text
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
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tenant_membership_transitions'::regclass AND NOT convalidated
  ) OR (
    SELECT pg_catalog.array_agg(
      index_relation.relname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_indexdef(index_row.indexrelid), 'UTF8'
        )), 'hex'
      ) ORDER BY index_relation.relname::text
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
    SELECT 1 FROM pg_catalog.pg_index
    WHERE indrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT (indisvalid AND indisready AND indislive)
  ) OR (
    SELECT pg_catalog.array_agg(
      trigger_row.tgname::text || ':' || pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.pg_get_triggerdef(trigger_row.oid, false), 'UTF8'
        )), 'hex'
      ) ORDER BY trigger_row.tgname::text
    ) IS DISTINCT FROM ARRAY[
      'tenant_membership_transitions_reject_row_mutation:ccf75bfb2a4814e1a2ac74288abc8d11b0f574dde0c2c9674ddca92346652ef6',
      'tenant_membership_transitions_reject_truncate:ba2700919090be08fc1666d3c10b24d4f3cbf34ed280979a4c068f7c871bcdf0'
    ]::text[]
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT trigger_row.tgisinternal
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.tenant_membership_transitions'::regclass
      AND NOT tgisinternal AND tgenabled <> 'O'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_TRANSITION_CATALOG_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_proc function_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND function_row.proname = 'reject_tenant_membership_transition_mutation'
      AND function_row.pronargs = 0
      AND function_row.prorettype = 'pg_catalog.trigger'::regtype
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.pg_get_functiondef(function_row.oid), 'UTF8'
      )), 'hex') = '076415514e37e9d4c6ebc4dfd3b6cb9f12f02c0ff5ed4f9935177d6b588e1a64'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_TRANSITION_FUNCTION_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
      AND constraint_row.contype = 'f'
      AND NOT constraint_row.convalidated
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid, false) =
        'FOREIGN KEY (tenant_id, institution_id) REFERENCES institution_scopes(tenant_id, institution_id) NOT VALID'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_SCOPE_FK_DRIFT';
  END IF;

  SELECT count(*) INTO pre_membership_count FROM public.tenant_members;
  SELECT count(*) INTO pre_transition_count FROM public.tenant_membership_transitions;
  SELECT count(*) INTO pre_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO pre_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO pre_context_version_count FROM public.institution_operating_context_versions;
  SELECT count(*) INTO pre_context_head_count FROM public.institution_operating_contexts;

  SELECT count(*) INTO pre_all_null_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision, member_row.lifecycle_status, member_row.current_provenance_source,
    member_row.current_provenance_actor_id, member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id, member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at, member_row.revoked_at, member_row.deleted_at
  ) = 0;

  SELECT count(*) INTO pre_partial_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision, member_row.lifecycle_status, member_row.current_provenance_source,
    member_row.current_provenance_actor_id, member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id, member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at, member_row.revoked_at, member_row.deleted_at
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

  SELECT count(*) INTO pre_exact_current_head_count
  FROM public.tenant_members current_member
  JOIN public.tenant_membership_transitions head_transition
    ON head_transition.tenant_id = current_member.tenant_id
   AND head_transition.membership_id = current_member.id
   AND head_transition.command_id = current_member.current_provenance_command_id
   AND head_transition.to_revision = current_member.revision
   AND head_transition.source = current_member.current_provenance_source
   AND head_transition.actor_id IS NOT DISTINCT FROM current_member.current_provenance_actor_id
   AND head_transition.reason_code = current_member.current_provenance_reason_code
   AND head_transition.to_lifecycle_status = current_member.lifecycle_status
   AND head_transition.to_role = current_member.role
   AND head_transition.occurred_at IS NOT DISTINCT FROM current_member.current_provenance_occurred_at
   AND head_transition.recorded_at = current_member.current_provenance_recorded_at
  WHERE current_member.revision IS NOT NULL;

  SELECT count(*) INTO pre_duplicate_command_count
  FROM (
    SELECT tenant_id, command_id FROM public.tenant_membership_transitions
    GROUP BY tenant_id, command_id HAVING count(*) > 1
  ) duplicate_command;

  SELECT count(*) INTO pre_duplicate_revision_count
  FROM (
    SELECT tenant_id, membership_id, to_revision FROM public.tenant_membership_transitions
    GROUP BY tenant_id, membership_id, to_revision HAVING count(*) > 1
  ) duplicate_revision;

  SELECT count(*) INTO pre_scope_relation_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;

  SELECT count(*) INTO pre_active_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (SELECT min(created_at) FROM public.institution_scopes);

  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(member_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(member_row)::text), ''), 'UTF8'
    )) INTO pre_membership_fingerprint
  FROM public.tenant_members member_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(transition_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(transition_row)::text), ''), 'UTF8'
    )) INTO pre_transition_fingerprint
  FROM public.tenant_membership_transitions transition_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(binding_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(binding_row)::text), ''), 'UTF8'
    )) INTO pre_binding_fingerprint
  FROM public.auth_account_institution_bindings binding_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(scope_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(scope_row)::text), ''), 'UTF8'
    )) INTO pre_scope_fingerprint
  FROM public.institution_scopes scope_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(context_version_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(context_version_row)::text), ''), 'UTF8'
    )) INTO pre_context_version_fingerprint
  FROM public.institution_operating_context_versions context_version_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(context_head_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(context_head_row)::text), ''), 'UTF8'
    )) INTO pre_context_head_fingerprint
  FROM public.institution_operating_contexts context_head_row;

  IF pre_membership_count <> 1
    OR pre_transition_count <> 1
    OR pre_binding_count <> 1
    OR pre_scope_count <> 1
    OR pre_context_version_count <> 1
    OR pre_context_head_count <> 1
    OR pre_all_null_count <> 0
    OR pre_partial_count <> 0
    OR pre_complete_count <> 1
    OR pre_exact_current_head_count <> 1
    OR pre_duplicate_command_count <> 0
    OR pre_duplicate_revision_count <> 0
    OR pre_scope_relation_orphan_count <> 1
    OR pre_active_historical_orphan_count <> 1
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_DATA_BASELINE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_members member_row
    LEFT JOIN public.tenants tenant_row ON tenant_row.id = member_row.tenant_id
    LEFT JOIN public.auth_users user_row ON user_row.id = member_row.user_id
    WHERE tenant_row.id IS NULL OR user_row.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.tenant_membership_transitions transition_row
    LEFT JOIN public.tenant_members member_row
      ON member_row.tenant_id = transition_row.tenant_id
     AND member_row.id = transition_row.membership_id
    WHERE member_row.id IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_PARENT_OR_IDENTITY_DRIFT';
  END IF;

  IF catalog_state = 'expected_m1_predecessor' THEN
    ALTER TABLE public.tenant_members
      DROP CONSTRAINT tenant_members_current_envelope_shape_check;

    ALTER TABLE public.tenant_members
      ADD CONSTRAINT tenant_members_current_envelope_shape_check CHECK (
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
          ) OR (
            current_provenance_source = 'formal_onboarding'
            AND revision = 1
            AND lifecycle_status = 'active'
            AND current_provenance_actor_id IS NOT NULL
            AND current_provenance_occurred_at IS NOT NULL
            AND current_provenance_recorded_at >= current_provenance_occurred_at
          ) OR (
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
          ) OR (
            lifecycle_status = 'revoked'
            AND revision >= 2
            AND revoked_at IS NOT NULL
            AND revoked_at = current_provenance_occurred_at
            AND deleted_at IS NULL
          ) OR (
            lifecycle_status = 'deleted'
            AND revision >= 2
            AND deleted_at IS NOT NULL
            AND deleted_at = current_provenance_occurred_at
            AND (revoked_at IS NULL OR revoked_at <= deleted_at)
          )
        )
      );

    ALTER TABLE public.tenant_members
      ALTER COLUMN revision SET NOT NULL,
      ALTER COLUMN lifecycle_status SET NOT NULL,
      ALTER COLUMN current_provenance_source SET NOT NULL,
      ALTER COLUMN current_provenance_reason_code SET NOT NULL,
      ALTER COLUMN current_provenance_command_id SET NOT NULL,
      ALTER COLUMN current_provenance_recorded_at SET NOT NULL;

    created_count := 7;
  ELSIF catalog_state = 'all_exact' THEN
    reused_count := 7;
  ELSE
    unexpected_count := unexpected_count + 1;
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_CATALOG_STATE_UNEXPECTED';
  END IF;

  SELECT count(*) INTO post_membership_count FROM public.tenant_members;
  SELECT count(*) INTO post_transition_count FROM public.tenant_membership_transitions;
  SELECT count(*) INTO post_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO post_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO post_context_version_count FROM public.institution_operating_context_versions;
  SELECT count(*) INTO post_context_head_count FROM public.institution_operating_contexts;

  SELECT count(*) INTO post_all_null_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision, member_row.lifecycle_status, member_row.current_provenance_source,
    member_row.current_provenance_actor_id, member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id, member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at, member_row.revoked_at, member_row.deleted_at
  ) = 0;

  SELECT count(*) INTO post_partial_count
  FROM public.tenant_members member_row
  WHERE pg_catalog.num_nonnulls(
    member_row.revision, member_row.lifecycle_status, member_row.current_provenance_source,
    member_row.current_provenance_actor_id, member_row.current_provenance_reason_code,
    member_row.current_provenance_command_id, member_row.current_provenance_occurred_at,
    member_row.current_provenance_recorded_at, member_row.revoked_at, member_row.deleted_at
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

  SELECT count(*) INTO post_exact_current_head_count
  FROM public.tenant_members current_member
  JOIN public.tenant_membership_transitions head_transition
    ON head_transition.tenant_id = current_member.tenant_id
   AND head_transition.membership_id = current_member.id
   AND head_transition.command_id = current_member.current_provenance_command_id
   AND head_transition.to_revision = current_member.revision
   AND head_transition.source = current_member.current_provenance_source
   AND head_transition.actor_id IS NOT DISTINCT FROM current_member.current_provenance_actor_id
   AND head_transition.reason_code = current_member.current_provenance_reason_code
   AND head_transition.to_lifecycle_status = current_member.lifecycle_status
   AND head_transition.to_role = current_member.role
   AND head_transition.occurred_at IS NOT DISTINCT FROM current_member.current_provenance_occurred_at
   AND head_transition.recorded_at = current_member.current_provenance_recorded_at
  WHERE current_member.revision IS NOT NULL;

  SELECT count(*) INTO post_duplicate_command_count
  FROM (
    SELECT tenant_id, command_id FROM public.tenant_membership_transitions
    GROUP BY tenant_id, command_id HAVING count(*) > 1
  ) duplicate_command;

  SELECT count(*) INTO post_duplicate_revision_count
  FROM (
    SELECT tenant_id, membership_id, to_revision FROM public.tenant_membership_transitions
    GROUP BY tenant_id, membership_id, to_revision HAVING count(*) > 1
  ) duplicate_revision;

  SELECT count(*) INTO post_scope_relation_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;

  SELECT count(*) INTO post_active_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (SELECT min(created_at) FROM public.institution_scopes);

  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(member_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(member_row)::text), ''), 'UTF8'
    )) INTO post_membership_fingerprint
  FROM public.tenant_members member_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(transition_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(transition_row)::text), ''), 'UTF8'
    )) INTO post_transition_fingerprint
  FROM public.tenant_membership_transitions transition_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(binding_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(binding_row)::text), ''), 'UTF8'
    )) INTO post_binding_fingerprint
  FROM public.auth_account_institution_bindings binding_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(scope_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(scope_row)::text), ''), 'UTF8'
    )) INTO post_scope_fingerprint
  FROM public.institution_scopes scope_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(context_version_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(context_version_row)::text), ''), 'UTF8'
    )) INTO post_context_version_fingerprint
  FROM public.institution_operating_context_versions context_version_row;
  SELECT pg_catalog.sha256(pg_catalog.convert_to(
      coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(context_head_row)::text, E'\n'
        ORDER BY pg_catalog.to_jsonb(context_head_row)::text), ''), 'UTF8'
    )) INTO post_context_head_fingerprint
  FROM public.institution_operating_contexts context_head_row;

  SELECT pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        pg_catalog.pg_get_constraintdef(constraint_row.oid, false), 'UTF8'
      )), 'hex'
    )
    INTO current_constraint_hash
  FROM pg_catalog.pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.tenant_members'::regclass
    AND constraint_row.conname = 'tenant_members_current_envelope_shape_check'
    AND constraint_row.contype = 'c'
    AND constraint_row.convalidated;

  SELECT count(*) INTO required_not_null_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tenant_members'
    AND column_name IN (
      'revision', 'lifecycle_status', 'current_provenance_source',
      'current_provenance_reason_code', 'current_provenance_command_id',
      'current_provenance_recorded_at'
    )
    AND is_nullable = 'NO';

  SELECT count(*), max(created_at)
    INTO journal_count, journal_latest_when
  FROM drizzle.__drizzle_migrations;

  IF planned_count <> created_count + reused_count
    OR conflict_count <> 0
    OR unexpected_count <> 0
    OR required_not_null_count <> 6
    OR current_constraint_hash <> final_current_constraint_hash
    OR post_membership_count <> pre_membership_count
    OR post_transition_count <> pre_transition_count
    OR post_binding_count <> pre_binding_count
    OR post_scope_count <> pre_scope_count
    OR post_context_version_count <> pre_context_version_count
    OR post_context_head_count <> pre_context_head_count
    OR post_all_null_count <> pre_all_null_count
    OR post_partial_count <> pre_partial_count
    OR post_complete_count <> pre_complete_count
    OR post_exact_current_head_count <> pre_exact_current_head_count
    OR post_duplicate_command_count <> 0
    OR post_duplicate_revision_count <> 0
    OR post_scope_relation_orphan_count <> pre_scope_relation_orphan_count
    OR post_active_historical_orphan_count <> pre_active_historical_orphan_count
    OR post_membership_fingerprint IS DISTINCT FROM pre_membership_fingerprint
    OR post_transition_fingerprint IS DISTINCT FROM pre_transition_fingerprint
    OR post_binding_fingerprint IS DISTINCT FROM pre_binding_fingerprint
    OR post_scope_fingerprint IS DISTINCT FROM pre_scope_fingerprint
    OR post_context_version_fingerprint IS DISTINCT FROM pre_context_version_fingerprint
    OR post_context_head_fingerprint IS DISTINCT FROM pre_context_head_fingerprint
    OR journal_count <> expected_predecessor_count
    OR journal_latest_when <> expected_predecessor_when
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_MEMBERSHIP_M7_POSTCHECK_FAILED';
  END IF;

  RAISE NOTICE
    'BASE02_MEMBERSHIP_M7_RESULT planned=% created=% reused=% conflict=% unexpected=%',
    planned_count, created_count, reused_count, conflict_count, unexpected_count;
END
$$;
