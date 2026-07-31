SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

LOCK TABLE "public"."auth_account_institution_bindings" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "public"."institution_scopes" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  expected_predecessor_count CONSTANT integer := 39;
  expected_predecessor_when CONSTANT bigint := 1784688468000;
  expected_predecessor_hash CONSTANT text :=
    '5e7fcf3a0fecdc7efed4dd66ccd9c87a5f8af0705d320d2ea1ae6b5751078948';
  index_named_count integer;
  index_exact_named_count integer;
  index_equivalent_count integer;
  fk_named_count integer;
  fk_exact_named_count integer;
  fk_equivalent_count integer;
  planned_count CONSTANT integer := 2;
  created_count integer := 0;
  reused_count integer := 0;
  conflict_count integer := 0;
  unexpected_count integer := 0;
  catalog_state text;
  pre_binding_total bigint;
  pre_binding_null_pair_count bigint;
  pre_binding_duplicate_group_count bigint;
  pre_binding_scope_orphan_count bigint;
  pre_binding_historical_orphan_count bigint;
  pre_scope_count bigint;
  pre_context_version_count bigint;
  pre_context_head_count bigint;
  post_binding_total bigint;
  post_binding_null_pair_count bigint;
  post_binding_duplicate_group_count bigint;
  post_binding_scope_orphan_count bigint;
  post_binding_historical_orphan_count bigint;
  post_scope_count bigint;
  post_context_version_count bigint;
  post_context_head_count bigint;
BEGIN
  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_JOURNAL_MISSING';
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
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_JOURNAL_DRIFT';
  END IF;

  IF to_regclass('public.auth_account_institution_bindings') IS NULL
    OR to_regclass('public.institution_scopes') IS NULL
    OR to_regclass('public.institution_operating_context_versions') IS NULL
    OR to_regclass('public.institution_operating_contexts') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_REQUIRED_RELATION_MISSING';
  END IF;

  IF (
    SELECT count(*) <> 4
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'auth_account_institution_bindings'
          AND column_name IN ('tenant_id', 'institution_id'))
        OR
        (table_name = 'institution_scopes'
          AND column_name IN ('tenant_id', 'institution_id'))
      )
      AND data_type = 'character varying'
      AND character_maximum_length = 64
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_COLUMN_SHAPE_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.institution_scopes'::regclass
      AND constraint_row.conname = 'institution_scopes_pk'
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
      ) = ARRAY['tenant_id', 'institution_id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_SCOPE_PRIMARY_KEY_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    JOIN pg_index index_row ON index_row.indexrelid = constraint_row.conindid
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE constraint_row.conrelid = 'public.institution_scopes'::regclass
      AND constraint_row.conname = 'institution_scopes_pk'
      AND access_method.amname = 'btree'
      AND index_row.indisunique
      AND index_row.indisprimary
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
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_SCOPE_PRIMARY_INDEX_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    JOIN pg_index index_row ON index_row.indexrelid = constraint_row.conindid
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname = 'auth_account_institution_bindings_pkey'
      AND constraint_row.contype = 'p'
      AND constraint_row.convalidated
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND access_method.amname = 'btree'
      AND index_row.indisunique
      AND index_row.indisprimary
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indislive
      AND NOT index_row.indisexclusion
      AND index_row.indnkeyatts = 1
      AND index_row.indnatts = 1
      AND index_row.indexprs IS NULL
      AND index_row.indpred IS NULL
      AND index_relation.reloptions IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'id'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_PRIMARY_KEY_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname = 'auth_account_institution_bindings_tenant_account_fk'
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.tenant_members'::regclass
      AND constraint_row.convalidated
      AND constraint_row.confmatchtype = 's'
      AND constraint_row.confupdtype = 'a'
      AND constraint_row.confdeltype = 'a'
      AND NOT constraint_row.condeferrable
      AND NOT constraint_row.condeferred
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'account_id']::text[]
      AND ARRAY(
        SELECT attribute_row.attname::text
        FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_row(attnum, ordinal)
        JOIN pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.confrelid
         AND attribute_row.attnum = key_row.attnum
        ORDER BY key_row.ordinal
      ) = ARRAY['tenant_id', 'user_id']::text[]
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_TENANT_ACCOUNT_FK_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.auth_account_institution_bindings'::regclass
      AND index_relation.relname =
        'auth_account_institution_bindings_active_account_tenant_unique_'
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
      AND index_row.indpred IS NOT NULL
      AND index_relation.reloptions IS NULL
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'account_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'tenant_id'
      AND pg_get_expr(index_row.indpred, index_row.indrelid, true) =
        'status = ''active''::auth_institution_binding_status'
  ) OR (
    SELECT count(*) <> 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.auth_account_institution_bindings'::regclass
      AND index_relation.relname =
        'auth_account_institution_bindings_account_tenant_status_idx'
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
      AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'account_id'
      AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'tenant_id'
      AND pg_get_indexdef(index_row.indexrelid, 3, true) = 'status'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_INDEX_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 4
      OR count(*) FILTER (
        WHERE constraint_row.conname =
          'auth_account_institution_bindings_status_shape_check'
          AND regexp_replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
            '[[:space:]"]',
            '',
            'g'
          ) =
            '(((status=''active''::auth_institution_binding_status)and(revoked_atisnull)and'
            '(institution_idisnotnull))or((status=''revoked''::auth_institution_binding_status)'
            'and(revoked_atisnotnull)and(institution_idisnotnull)and'
            '(revoked_at>=assigned_at)))'
      ) <> 1
      OR count(*) FILTER (
        WHERE constraint_row.conname =
          'auth_account_institution_bindings_expiry_check'
          AND regexp_replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
            '[[:space:]"]',
            '',
            'g'
          ) = '((expires_atisnull)or(expires_at>assigned_at))'
      ) <> 1
      OR count(*) FILTER (
        WHERE constraint_row.conname =
          'auth_account_institution_bindings_source_authority_check'
          AND regexp_replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
            '[[:space:]"]',
            '',
            'g'
          ) =
            '((status<>''active''::auth_institution_binding_status)or(source=any(array['
            '''manual_admin''::auth_institution_binding_source,'
            '''system''::auth_institution_binding_source])))'
      ) <> 1
      OR count(*) FILTER (
        WHERE constraint_row.conname =
          'auth_account_institution_bindings_version_positive_check'
          AND regexp_replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)),
            '[[:space:]"]',
            '',
            'g'
          ) = '(version>0)'
      ) <> 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
      AND constraint_row.contype = 'c'
      AND constraint_row.convalidated
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_CHECK_DRIFT';
  END IF;

  IF ARRAY(
    SELECT constraint_row.conname::text
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid =
      'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname <> 'auth_account_institution_bindings_scope_fk'
    ORDER BY constraint_row.conname
  ) IS DISTINCT FROM ARRAY[
    'auth_account_institution_bindings_expiry_check',
    'auth_account_institution_bindings_pkey',
    'auth_account_institution_bindings_source_authority_check',
    'auth_account_institution_bindings_status_shape_check',
    'auth_account_institution_bindings_tenant_account_fk',
    'auth_account_institution_bindings_version_positive_check'
  ]::text[] OR ARRAY(
    SELECT index_relation.relname::text
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    WHERE index_row.indrelid =
      'public.auth_account_institution_bindings'::regclass
      AND index_relation.relname <> 'auth_account_institution_bindings_scope_idx'
    ORDER BY index_relation.relname
  ) IS DISTINCT FROM ARRAY[
    'auth_account_institution_bindings_account_tenant_status_idx',
    'auth_account_institution_bindings_active_account_tenant_unique_',
    'auth_account_institution_bindings_pkey'
  ]::text[] THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_CATALOG_SET_DRIFT';
  END IF;

  SELECT count(*) INTO pre_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO pre_context_version_count
  FROM public.institution_operating_context_versions;
  SELECT count(*) INTO pre_context_head_count FROM public.institution_operating_contexts;
  SELECT count(*) INTO pre_binding_total FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO pre_binding_null_pair_count
  FROM public.auth_account_institution_bindings
  WHERE tenant_id IS NULL OR institution_id IS NULL;
  SELECT count(*) INTO pre_binding_duplicate_group_count
  FROM (
    SELECT tenant_id, institution_id
    FROM public.auth_account_institution_bindings
    GROUP BY tenant_id, institution_id
    HAVING count(*) > 1
  ) duplicate_group;
  SELECT count(*) INTO pre_binding_scope_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row
    USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;
  SELECT count(*) INTO pre_binding_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row
    USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (
      SELECT min(scope_created.created_at)
      FROM public.institution_scopes scope_created
    );

  IF pre_scope_count <> 1
    OR pre_context_version_count <> 1
    OR pre_context_head_count <> 1
    OR pre_binding_total <> 1
    OR pre_binding_null_pair_count <> 0
    OR pre_binding_duplicate_group_count <> 0
    OR pre_binding_scope_orphan_count <> 1
    OR pre_binding_historical_orphan_count <> 1
  THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_DATA_SHAPE_DRIFT';
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
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_TERMINAL_STATE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.institution_operating_context_versions version_row
    LEFT JOIN public.institution_scopes scope_row
      USING (tenant_id, institution_id)
    WHERE scope_row.tenant_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.institution_operating_contexts head_row
    LEFT JOIN public.institution_scopes scope_row
      USING (tenant_id, institution_id)
    WHERE scope_row.tenant_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.institution_operating_contexts head_row
    LEFT JOIN public.institution_operating_context_versions version_row
      ON version_row.tenant_id = head_row.tenant_id
     AND version_row.institution_id = head_row.institution_id
     AND version_row.version = head_row.latest_version
    WHERE version_row.tenant_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    LEFT JOIN public.tenants tenant_row ON tenant_row.id = binding_row.tenant_id
    WHERE tenant_row.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    LEFT JOIN public.tenant_members member_row
      ON member_row.tenant_id = binding_row.tenant_id
     AND member_row.user_id = binding_row.account_id
    WHERE member_row.user_id IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_RELATION_SHAPE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger trigger_row
    WHERE trigger_row.tgrelid = 'public.auth_account_institution_bindings'::regclass
      AND NOT trigger_row.tgisinternal
  ) OR EXISTS (
    SELECT 1
    FROM pg_rewrite rule_row
    WHERE rule_row.ev_class = 'public.auth_account_institution_bindings'::regclass
      AND rule_row.rulename <> '_RETURN'
  ) OR EXISTS (
    SELECT 1
    FROM pg_class relation_row
    WHERE relation_row.oid = 'public.auth_account_institution_bindings'::regclass
      AND (relation_row.relrowsecurity OR relation_row.relforcerowsecurity)
  ) OR EXISTS (
    SELECT 1
    FROM pg_policy policy_row
    WHERE policy_row.polrelid = 'public.auth_account_institution_bindings'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_inherits inheritance_row
    WHERE inheritance_row.inhrelid IN (
      'public.auth_account_institution_bindings'::regclass,
      'public.institution_scopes'::regclass
    ) OR inheritance_row.inhparent IN (
      'public.auth_account_institution_bindings'::regclass,
      'public.institution_scopes'::regclass
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_publication_rel publication_row
    WHERE publication_row.prrelid IN (
      'public.auth_account_institution_bindings'::regclass,
      'public.institution_scopes'::regclass
    )
  ) OR EXISTS (
    SELECT 1
    FROM pg_depend dependency_row
    JOIN pg_rewrite rewrite_row
      ON dependency_row.classid = 'pg_rewrite'::regclass
     AND dependency_row.objid = rewrite_row.oid
    WHERE dependency_row.refobjid IN (
      'public.auth_account_institution_bindings'::regclass,
      'public.institution_scopes'::regclass
    )
      AND dependency_row.refclassid = 'pg_class'::regclass
      AND rewrite_row.ev_class NOT IN (
        'public.auth_account_institution_bindings'::regclass,
        'public.institution_scopes'::regclass
      )
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_DEPENDENCY_DRIFT';
  END IF;

  SELECT count(*) INTO index_named_count
  FROM pg_class index_relation
  JOIN pg_namespace index_namespace ON index_namespace.oid = index_relation.relnamespace
  WHERE index_namespace.nspname = 'public'
    AND index_relation.relname = 'auth_account_institution_bindings_scope_idx';

  SELECT
    count(*) FILTER (
      WHERE index_relation.relname = 'auth_account_institution_bindings_scope_idx'
        AND access_method.amname = 'btree'
        AND NOT index_row.indisunique
        AND NOT index_row.indisprimary
        AND NOT index_row.indisexclusion
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND NOT index_row.indisreplident
        AND NOT index_row.indnullsnotdistinct
        AND index_row.indnkeyatts = 2
        AND index_row.indnatts = 2
        AND index_row.indexprs IS NULL
        AND index_row.indpred IS NULL
        AND index_relation.reloptions IS NULL
        AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
        AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'institution_id'
    ),
    count(*) FILTER (
      WHERE access_method.amname = 'btree'
        AND NOT index_row.indisunique
        AND NOT index_row.indisprimary
        AND NOT index_row.indisexclusion
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indislive
        AND NOT index_row.indisreplident
        AND NOT index_row.indnullsnotdistinct
        AND index_row.indnkeyatts = 2
        AND index_row.indnatts = 2
        AND index_row.indexprs IS NULL
        AND index_row.indpred IS NULL
        AND index_relation.reloptions IS NULL
        AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
        AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'institution_id'
    )
  INTO index_exact_named_count, index_equivalent_count
  FROM pg_index index_row
  JOIN pg_class source_relation ON source_relation.oid = index_row.indrelid
  JOIN pg_namespace source_namespace ON source_namespace.oid = source_relation.relnamespace
  JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
  JOIN pg_am access_method ON access_method.oid = index_relation.relam
  WHERE source_namespace.nspname = 'public'
    AND source_relation.relname = 'auth_account_institution_bindings';

  SELECT count(*) INTO fk_named_count
  FROM pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
    AND constraint_row.conname = 'auth_account_institution_bindings_scope_fk';

  SELECT
    count(*) FILTER (
      WHERE constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
        AND target_namespace.nspname = 'public'
        AND target_relation.relname = 'institution_scopes'
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
        AND constraint_row.confmatchtype = 's'
        AND constraint_row.confupdtype = 'a'
        AND constraint_row.confdeltype = 'a'
        AND NOT constraint_row.condeferrable
        AND NOT constraint_row.condeferred
        AND NOT constraint_row.convalidated
    ),
    count(*) FILTER (
      WHERE target_namespace.nspname = 'public'
        AND target_relation.relname = 'institution_scopes'
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
        AND constraint_row.confmatchtype = 's'
        AND constraint_row.confupdtype = 'a'
        AND constraint_row.confdeltype = 'a'
        AND NOT constraint_row.condeferrable
        AND NOT constraint_row.condeferred
        AND NOT constraint_row.convalidated
    )
  INTO fk_exact_named_count, fk_equivalent_count
  FROM pg_constraint constraint_row
  JOIN pg_class source_relation ON source_relation.oid = constraint_row.conrelid
  JOIN pg_namespace source_namespace ON source_namespace.oid = source_relation.relnamespace
  JOIN pg_class target_relation ON target_relation.oid = constraint_row.confrelid
  JOIN pg_namespace target_namespace ON target_namespace.oid = target_relation.relnamespace
  WHERE source_namespace.nspname = 'public'
    AND source_relation.relname = 'auth_account_institution_bindings'
    AND constraint_row.contype = 'f';

  IF index_named_count = 0
    AND index_exact_named_count = 0
    AND index_equivalent_count = 0
    AND fk_named_count = 0
    AND fk_exact_named_count = 0
    AND fk_equivalent_count = 0
  THEN
    catalog_state := 'all_missing';
    EXECUTE 'CREATE INDEX "auth_account_institution_bindings_scope_idx" '
      'ON "public"."auth_account_institution_bindings" '
      'USING btree ("tenant_id", "institution_id")';
    EXECUTE 'ALTER TABLE "public"."auth_account_institution_bindings" '
      'ADD CONSTRAINT "auth_account_institution_bindings_scope_fk" '
      'FOREIGN KEY ("tenant_id", "institution_id") '
      'REFERENCES "public"."institution_scopes" ("tenant_id", "institution_id") '
      'MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION '
      'NOT DEFERRABLE INITIALLY IMMEDIATE NOT VALID';
    created_count := 2;
  ELSIF index_named_count = 1
    AND index_exact_named_count = 1
    AND index_equivalent_count = 1
    AND fk_named_count = 1
    AND fk_exact_named_count = 1
    AND fk_equivalent_count = 1
  THEN
    catalog_state := 'all_exact';
    reused_count := 2;
  ELSE
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_CATALOG_CONFLICT';
  END IF;

  SELECT count(*) INTO index_named_count
  FROM pg_class index_relation
  JOIN pg_namespace index_namespace ON index_namespace.oid = index_relation.relnamespace
  WHERE index_namespace.nspname = 'public'
    AND index_relation.relname = 'auth_account_institution_bindings_scope_idx';

  SELECT
    count(*) FILTER (
      WHERE index_relation.relname = 'auth_account_institution_bindings_scope_idx'
    ),
    count(*)
  INTO index_exact_named_count, index_equivalent_count
  FROM pg_index index_row
  JOIN pg_class source_relation ON source_relation.oid = index_row.indrelid
  JOIN pg_namespace source_namespace ON source_namespace.oid = source_relation.relnamespace
  JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
  JOIN pg_am access_method ON access_method.oid = index_relation.relam
  WHERE source_namespace.nspname = 'public'
    AND source_relation.relname = 'auth_account_institution_bindings'
    AND index_relation.relname = 'auth_account_institution_bindings_scope_idx'
    AND access_method.amname = 'btree'
    AND NOT index_row.indisunique
    AND NOT index_row.indisprimary
    AND NOT index_row.indisexclusion
    AND index_row.indisvalid
    AND index_row.indisready
    AND index_row.indislive
    AND NOT index_row.indisreplident
    AND NOT index_row.indnullsnotdistinct
    AND index_row.indnkeyatts = 2
    AND index_row.indnatts = 2
    AND index_row.indexprs IS NULL
    AND index_row.indpred IS NULL
    AND index_relation.reloptions IS NULL
    AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
    AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'institution_id';

  SELECT
    count(*) FILTER (
      WHERE constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
    ),
    count(*)
  INTO fk_exact_named_count, fk_equivalent_count
  FROM pg_constraint constraint_row
  JOIN pg_class target_relation ON target_relation.oid = constraint_row.confrelid
  JOIN pg_namespace target_namespace ON target_namespace.oid = target_relation.relnamespace
  WHERE constraint_row.conrelid = 'public.auth_account_institution_bindings'::regclass
    AND constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
    AND constraint_row.contype = 'f'
    AND target_namespace.nspname = 'public'
    AND target_relation.relname = 'institution_scopes'
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
    AND constraint_row.confmatchtype = 's'
    AND constraint_row.confupdtype = 'a'
    AND constraint_row.confdeltype = 'a'
    AND NOT constraint_row.condeferrable
    AND NOT constraint_row.condeferred
    AND NOT constraint_row.convalidated;

  SELECT count(*) INTO post_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO post_context_version_count
  FROM public.institution_operating_context_versions;
  SELECT count(*) INTO post_context_head_count FROM public.institution_operating_contexts;
  SELECT count(*) INTO post_binding_total FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO post_binding_null_pair_count
  FROM public.auth_account_institution_bindings
  WHERE tenant_id IS NULL OR institution_id IS NULL;
  SELECT count(*) INTO post_binding_duplicate_group_count
  FROM (
    SELECT tenant_id, institution_id
    FROM public.auth_account_institution_bindings
    GROUP BY tenant_id, institution_id
    HAVING count(*) > 1
  ) duplicate_group;
  SELECT count(*) INTO post_binding_scope_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row
    USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL;
  SELECT count(*) INTO post_binding_historical_orphan_count
  FROM public.auth_account_institution_bindings binding_row
  LEFT JOIN public.institution_scopes scope_row
    USING (tenant_id, institution_id)
  WHERE scope_row.tenant_id IS NULL
    AND binding_row.status = 'active'
    AND binding_row.created_at < (
      SELECT min(scope_created.created_at)
      FROM public.institution_scopes scope_created
    );

  IF (
    SELECT count(*) <> expected_predecessor_count
      OR max(created_at) <> expected_predecessor_when
      OR count(*) FILTER (
        WHERE created_at = expected_predecessor_when
          AND hash = expected_predecessor_hash
      ) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_JOURNAL_POSTCHECK_FAILED';
  END IF;

  IF ARRAY(
    SELECT constraint_row.conname::text
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid =
      'public.auth_account_institution_bindings'::regclass
    ORDER BY constraint_row.conname
  ) IS DISTINCT FROM ARRAY[
    'auth_account_institution_bindings_expiry_check',
    'auth_account_institution_bindings_pkey',
    'auth_account_institution_bindings_scope_fk',
    'auth_account_institution_bindings_source_authority_check',
    'auth_account_institution_bindings_status_shape_check',
    'auth_account_institution_bindings_tenant_account_fk',
    'auth_account_institution_bindings_version_positive_check'
  ]::text[] OR ARRAY(
    SELECT index_relation.relname::text
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    WHERE index_row.indrelid =
      'public.auth_account_institution_bindings'::regclass
    ORDER BY index_relation.relname
  ) IS DISTINCT FROM ARRAY[
    'auth_account_institution_bindings_account_tenant_status_idx',
    'auth_account_institution_bindings_active_account_tenant_unique_',
    'auth_account_institution_bindings_pkey',
    'auth_account_institution_bindings_scope_idx'
  ]::text[] THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_BINDING_CATALOG_POSTCHECK_FAILED';
  END IF;

  IF index_named_count <> 1
    OR index_exact_named_count <> 1
    OR index_equivalent_count <> 1
    OR fk_exact_named_count <> 1
    OR fk_equivalent_count <> 1
    OR catalog_state NOT IN ('all_missing', 'all_exact')
    OR planned_count <> created_count + reused_count
    OR conflict_count <> 0
    OR unexpected_count <> 0
    OR pre_scope_count <> post_scope_count
    OR pre_context_version_count <> post_context_version_count
    OR pre_context_head_count <> post_context_head_count
    OR pre_binding_total <> post_binding_total
    OR pre_binding_null_pair_count <> post_binding_null_pair_count
    OR pre_binding_duplicate_group_count <> post_binding_duplicate_group_count
    OR pre_binding_scope_orphan_count <> post_binding_scope_orphan_count
    OR pre_binding_historical_orphan_count <> post_binding_historical_orphan_count
  THEN
    RAISE EXCEPTION USING MESSAGE = 'A2_P2_P1_POSTCHECK_FAILED';
  END IF;
END $$;
