SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_count CONSTANT integer := 45;
  expected_predecessor_when CONSTANT bigint := 1785681660893;
  expected_predecessor_hash CONSTANT text :=
    'ff472b70d8cd238782682f8ba30c78d703b2a844bc149c2496e5b47bbb1d2085';
  command_domain CONSTANT text := 'zmtg:binding-calibration-command:v1';
  transition_domain CONSTANT text := 'zmtg:binding-calibration-transition:v1';
  synthetic_tenant CONSTANT text := 'tenant_synthetic_binding_calibration';
  synthetic_binding CONSTANT text := 'binding_synthetic_calibration';
  expected_synthetic_command CONSTANT text :=
    'bcal1_605c8338a671fb4661977e19693bca6a52e497116bdedffd53073036f0967300';
  expected_synthetic_evidence CONSTANT text :=
    'btcl1_9a70c0740aa1cbe5bf6caa5e5b9416aff688d0392177af5fe98a6659261c884c';

  pre_binding_count bigint;
  pre_membership_count bigint;
  pre_transition_count bigint;
  pre_scope_count bigint;
  pre_context_version_count bigint;
  pre_context_head_count bigint;
  pre_scope_relation_orphan_count bigint;
  pre_active_historical_orphan_count bigint;
  post_binding_count bigint;
  post_membership_count bigint;
  post_transition_count bigint;
  post_scope_count bigint;
  post_context_version_count bigint;
  post_context_head_count bigint;
  post_scope_relation_orphan_count bigint;
  post_active_historical_orphan_count bigint;
  pre_binding_fingerprint text;
  pre_membership_fingerprint text;
  post_binding_fingerprint text;
  post_membership_fingerprint text;
  high_water_created_at timestamptz;
  high_water_id varchar(64);
  calibration_recorded_at timestamptz;
  candidate_binding_ids varchar(64)[];
  planned_count bigint := 0;
  inserted_count bigint := 0;
  created_count bigint := 0;
  reused_count bigint := 0;
  conflict_count bigint := 0;
  unexpected_count bigint := 0;
  exact_evidence_count bigint := 0;
  inserted_row_count bigint;
  candidate_row record;
  command_identity varchar(128);
  evidence_identity varchar(96);
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer < 160000
    OR pg_catalog.current_setting('server_version_num')::integer >= 170000
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_POSTGRES_VERSION_DRIFT';
  END IF;

  IF pg_catalog.to_regprocedure('pg_catalog.sha256(bytea)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.convert_to(text,name)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.decode(text,text)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.encode(bytea,text)') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_IDENTITY_FUNCTION_DRIFT';
  END IF;

  IF (
    'bcal1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(command_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_tenant, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_binding, 'UTF8')
      ),
      'hex'
    )
  ) <> expected_synthetic_command OR (
    'btcl1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transition_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_tenant, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(synthetic_binding, 'UTF8')
      ),
      'hex'
    )
  ) <> expected_synthetic_evidence THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_IDENTITY_VECTOR_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_JOURNAL_MISSING';
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
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.tenant_members') IS NULL
    OR pg_catalog.to_regclass('public.auth_account_institution_bindings') IS NULL
    OR pg_catalog.to_regclass('public.auth_account_institution_binding_transitions') IS NULL
    OR pg_catalog.to_regclass('public.institution_scopes') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_context_versions') IS NULL
    OR pg_catalog.to_regclass('public.institution_operating_contexts') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_REQUIRED_RELATION_MISSING';
  END IF;

  IF (
    SELECT pg_catalog.array_agg(enum_row.enumlabel::text ORDER BY enum_row.enumsortorder)
      IS DISTINCT FROM ARRAY[
        'create', 'rebind', 'revoke', 'expire', 'legacy_calibration'
      ]::text[]
    FROM pg_catalog.pg_enum enum_row
    JOIN pg_catalog.pg_type type_row ON type_row.oid = enum_row.enumtypid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'auth_institution_binding_transition_type'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_ENUM_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('auth_binding_transitions_tenant_command_unique'),
        ('auth_binding_transitions_binding_version_unique'),
        ('auth_binding_transitions_binding_fk'),
        ('auth_binding_transitions_replacement_fk'),
        ('auth_binding_transitions_identity_present_check'),
        ('auth_binding_transitions_version_shape_check'),
        ('auth_binding_transitions_status_shape_check'),
        ('auth_binding_transitions_observation_shape_check'),
        ('auth_binding_transitions_provenance_shape_check')
    ) AS expected_constraint(constraint_name)
    LEFT JOIN pg_catalog.pg_constraint constraint_row
      ON constraint_row.conrelid =
        'public.auth_account_institution_binding_transitions'::regclass
     AND constraint_row.conname = expected_constraint.constraint_name
    WHERE constraint_row.oid IS NULL OR NOT constraint_row.convalidated
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_TRANSITION_CONSTRAINT_DRIFT';
  END IF;

  IF (
    SELECT pg_catalog.array_agg(trigger_row.tgname::text ORDER BY trigger_row.tgname::text)
      IS DISTINCT FROM ARRAY[
        'auth_binding_transitions_reject_row_mutation',
        'auth_binding_transitions_reject_truncate'
      ]::text[]
    FROM pg_catalog.pg_trigger trigger_row
    WHERE trigger_row.tgrelid =
      'public.auth_account_institution_binding_transitions'::regclass
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_TRANSITION_TRIGGER_DRIFT';
  END IF;

  IF (
    SELECT count(*) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid =
      'public.auth_account_institution_bindings'::regclass
      AND constraint_row.conname = 'auth_account_institution_bindings_scope_fk'
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.institution_scopes'::regclass
      AND NOT constraint_row.convalidated
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_SCOPE_FK_DRIFT';
  END IF;

  LOCK TABLE "public"."tenant_members" IN SHARE MODE;
  LOCK TABLE "public"."auth_account_institution_bindings" IN SHARE MODE;
  LOCK TABLE "public"."auth_account_institution_binding_transitions"
    IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE "public"."institution_scopes" IN SHARE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    WHERE binding_row.version NOT BETWEEN 1 AND 2147483647
      OR binding_row.status NOT IN ('active', 'revoked')
      OR (binding_row.status = 'active' AND binding_row.revoked_at IS NOT NULL)
      OR (
        binding_row.status = 'revoked'
        AND (binding_row.revoked_at IS NULL OR binding_row.revoked_at < binding_row.assigned_at)
      )
      OR (binding_row.expires_at IS NOT NULL AND binding_row.expires_at <= binding_row.assigned_at)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_CURRENT_SHAPE_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.auth_account_institution_binding_transitions transition_row
      WHERE transition_row.binding_id = binding_row.id
    )
      AND (
        SELECT count(*)
        FROM public.tenant_members membership_row
        WHERE membership_row.tenant_id = binding_row.tenant_id
          AND membership_row.user_id = binding_row.account_id
      ) <> 1
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_MEMBERSHIP_MATCH_DRIFT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_account_institution_bindings binding_row
    JOIN public.tenant_members membership_row
      ON membership_row.tenant_id = binding_row.tenant_id
     AND membership_row.user_id = binding_row.account_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.auth_account_institution_binding_transitions transition_row
      WHERE transition_row.binding_id = binding_row.id
    )
      AND (
        membership_row.revision NOT BETWEEN 1 AND 2147483647
        OR membership_row.lifecycle_status IS NULL
        OR membership_row.current_provenance_source IS NULL
        OR membership_row.current_provenance_reason_code IS NULL
        OR membership_row.current_provenance_command_id IS NULL
        OR membership_row.current_provenance_recorded_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_MEMBERSHIP_ENVELOPE_DRIFT';
  END IF;

  SELECT count(*) INTO pre_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO pre_membership_count FROM public.tenant_members;
  SELECT count(*) INTO pre_transition_count FROM public.auth_account_institution_binding_transitions;
  SELECT count(*) INTO pre_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO pre_context_version_count FROM public.institution_operating_context_versions;
  SELECT count(*) INTO pre_context_head_count FROM public.institution_operating_contexts;

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(binding_row)
          ORDER BY binding_row.id COLLATE "C"
        ),
        '[]'::jsonb
      )::text,
      'UTF8'
    )),
    'hex'
  ) INTO pre_binding_fingerprint
  FROM public.auth_account_institution_bindings binding_row;

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(membership_row)
          ORDER BY
            membership_row.tenant_id COLLATE "C",
            membership_row.user_id COLLATE "C",
            membership_row.id COLLATE "C"
        ),
        '[]'::jsonb
      )::text,
      'UTF8'
    )),
    'hex'
  ) INTO pre_membership_fingerprint
  FROM public.tenant_members membership_row;

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

  SELECT binding_row.created_at, binding_row.id
  INTO high_water_created_at, high_water_id
  FROM public.auth_account_institution_bindings binding_row
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.auth_account_institution_binding_transitions transition_row
    WHERE transition_row.binding_id = binding_row.id
  )
  ORDER BY binding_row.created_at DESC, binding_row.id COLLATE "C" DESC
  LIMIT 1;

  IF high_water_created_at IS NULL OR high_water_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_NO_CANDIDATES';
  END IF;

  SELECT count(*) INTO planned_count
  FROM public.auth_account_institution_bindings binding_row
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.auth_account_institution_binding_transitions transition_row
    WHERE transition_row.binding_id = binding_row.id
  )
    AND (
      binding_row.created_at < high_water_created_at
      OR (
        binding_row.created_at = high_water_created_at
        AND binding_row.id COLLATE "C" <= high_water_id COLLATE "C"
      )
    );

  IF planned_count <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_PLANNED_COUNT_DRIFT';
  END IF;

  SELECT pg_catalog.array_agg(
    binding_row.id
    ORDER BY binding_row.created_at ASC, binding_row.id COLLATE "C" ASC
  ) INTO candidate_binding_ids
  FROM public.auth_account_institution_bindings binding_row
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.auth_account_institution_binding_transitions transition_row
    WHERE transition_row.binding_id = binding_row.id
  )
    AND (
      binding_row.created_at < high_water_created_at
      OR (
        binding_row.created_at = high_water_created_at
        AND binding_row.id COLLATE "C" <= high_water_id COLLATE "C"
      )
    );

  IF COALESCE(pg_catalog.array_length(candidate_binding_ids, 1), 0) <> planned_count THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_CANDIDATE_ARRAY_DRIFT';
  END IF;

  calibration_recorded_at := pg_catalog.clock_timestamp();

  FOR candidate_row IN
    SELECT
      binding_row.id,
      binding_row.tenant_id,
      binding_row.account_id,
      binding_row.source,
      binding_row.status,
      binding_row.version,
      binding_row.created_at,
      membership_row.revision AS membership_revision
    FROM public.auth_account_institution_bindings binding_row
    JOIN public.tenant_members membership_row
      ON membership_row.tenant_id = binding_row.tenant_id
     AND membership_row.user_id = binding_row.account_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.auth_account_institution_binding_transitions transition_row
      WHERE transition_row.binding_id = binding_row.id
    )
      AND (
        binding_row.created_at < high_water_created_at
        OR (
          binding_row.created_at = high_water_created_at
          AND binding_row.id COLLATE "C" <= high_water_id COLLATE "C"
        )
      )
    ORDER BY binding_row.created_at ASC, binding_row.id COLLATE "C" ASC
  LOOP
    command_identity := 'bcal1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(command_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.id, 'UTF8')
      ),
      'hex'
    );

    evidence_identity := 'btcl1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transition_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(candidate_row.id, 'UTF8')
      ),
      'hex'
    );

    IF command_identity !~ '^bcal1_[0-9a-f]{64}$'
      OR evidence_identity !~ '^btcl1_[0-9a-f]{64}$'
      OR EXISTS (
        SELECT 1
        FROM public.auth_account_institution_binding_transitions transition_row
        WHERE transition_row.id = evidence_identity
          OR (
            transition_row.tenant_id = candidate_row.tenant_id
            AND transition_row.command_id = command_identity
          )
          OR (
            transition_row.binding_id = candidate_row.id
            AND transition_row.to_version = candidate_row.version
          )
      )
    THEN
      conflict_count := conflict_count + 1;
      RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_IDENTITY_CONFLICT';
    END IF;

    INSERT INTO public.auth_account_institution_binding_transitions (
      id,
      tenant_id,
      binding_id,
      replacement_binding_id,
      command_id,
      transition_type,
      provenance_source,
      assignment_source,
      actor_id,
      reason_code,
      from_status,
      to_status,
      from_version,
      to_version,
      membership_revision,
      scope_revision,
      occurred_at,
      recorded_at
    ) VALUES (
      evidence_identity,
      candidate_row.tenant_id,
      candidate_row.id,
      NULL,
      command_identity,
      'legacy_calibration',
      'legacy_calibration',
      candidate_row.source,
      NULL,
      'legacy_unknown',
      NULL,
      candidate_row.status,
      NULL,
      candidate_row.version,
      candidate_row.membership_revision,
      NULL,
      NULL,
      calibration_recorded_at
    );

    GET DIAGNOSTICS inserted_row_count = ROW_COUNT;
    IF inserted_row_count <> 1 THEN
      unexpected_count := unexpected_count + 1;
      RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_INSERT_DRIFT';
    END IF;

    inserted_count := inserted_count + inserted_row_count;
    created_count := created_count + 1;
  END LOOP;

  SELECT count(*) INTO post_binding_count FROM public.auth_account_institution_bindings;
  SELECT count(*) INTO post_membership_count FROM public.tenant_members;
  SELECT count(*) INTO post_transition_count FROM public.auth_account_institution_binding_transitions;
  SELECT count(*) INTO post_scope_count FROM public.institution_scopes;
  SELECT count(*) INTO post_context_version_count FROM public.institution_operating_context_versions;
  SELECT count(*) INTO post_context_head_count FROM public.institution_operating_contexts;

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(binding_row)
          ORDER BY binding_row.id COLLATE "C"
        ),
        '[]'::jsonb
      )::text,
      'UTF8'
    )),
    'hex'
  ) INTO post_binding_fingerprint
  FROM public.auth_account_institution_bindings binding_row;

  SELECT pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(membership_row)
          ORDER BY
            membership_row.tenant_id COLLATE "C",
            membership_row.user_id COLLATE "C",
            membership_row.id COLLATE "C"
        ),
        '[]'::jsonb
      )::text,
      'UTF8'
    )),
    'hex'
  ) INTO post_membership_fingerprint
  FROM public.tenant_members membership_row;

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

  SELECT count(*) INTO exact_evidence_count
  FROM public.auth_account_institution_binding_transitions transition_row
  JOIN public.auth_account_institution_bindings binding_row
    ON binding_row.tenant_id = transition_row.tenant_id
   AND binding_row.id = transition_row.binding_id
  JOIN public.tenant_members membership_row
    ON membership_row.tenant_id = binding_row.tenant_id
   AND membership_row.user_id = binding_row.account_id
  WHERE transition_row.binding_id = ANY(candidate_binding_ids)
    AND transition_row.id = 'btcl1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(transition_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(binding_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(binding_row.id, 'UTF8')
      ),
      'hex'
    )
    AND transition_row.command_id = 'bcal1_' || pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(command_domain, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(binding_row.tenant_id, 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(binding_row.id, 'UTF8')
      ),
      'hex'
    )
    AND transition_row.transition_type = 'legacy_calibration'
    AND transition_row.provenance_source = 'legacy_calibration'
    AND transition_row.assignment_source = binding_row.source
    AND transition_row.actor_id IS NULL
    AND transition_row.reason_code = 'legacy_unknown'
    AND transition_row.from_status IS NULL
    AND transition_row.to_status = binding_row.status
    AND transition_row.from_version IS NULL
    AND transition_row.to_version = binding_row.version
    AND transition_row.membership_revision = membership_row.revision
    AND transition_row.scope_revision IS NULL
    AND transition_row.occurred_at IS NULL
    AND transition_row.recorded_at = calibration_recorded_at
    AND transition_row.replacement_binding_id IS NULL;

  IF planned_count <> created_count
    OR planned_count <> inserted_count
    OR reused_count <> 0
    OR conflict_count <> 0
    OR unexpected_count <> 0
    OR exact_evidence_count <> created_count
    OR post_binding_count <> pre_binding_count
    OR post_membership_count <> pre_membership_count
    OR post_transition_count <> pre_transition_count + created_count
    OR post_scope_count <> pre_scope_count
    OR post_context_version_count <> pre_context_version_count
    OR post_context_head_count <> pre_context_head_count
    OR post_scope_relation_orphan_count <> pre_scope_relation_orphan_count
    OR post_active_historical_orphan_count <> pre_active_historical_orphan_count
    OR post_binding_fingerprint IS DISTINCT FROM pre_binding_fingerprint
    OR post_membership_fingerprint IS DISTINCT FROM pre_membership_fingerprint
  THEN
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_COUNT_POSTCHECK_FAILED';
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
    RAISE EXCEPTION USING MESSAGE = 'BASE02_BINDING_CALIBRATION_JOURNAL_POSTCHECK_FAILED';
  END IF;
END
$migration$;
