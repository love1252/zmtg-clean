SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  expected_predecessor_when CONSTANT bigint := 1785738060856;
  expected_role_shape_hash CONSTANT text :=
    '8563ca26c2662fd0a4b177ab2019c556dafe79035e74d8e5796c39e0480c2d97';
BEGIN
  IF pg_catalog.to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'S43_0046_JOURNAL_MISSING';
  END IF;

  IF (
    SELECT max(created_at) IS DISTINCT FROM expected_predecessor_when
      OR count(*) FILTER (WHERE created_at = expected_predecessor_when) <> 1
    FROM drizzle.__drizzle_migrations
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'S43_0046_JOURNAL_DRIFT';
  END IF;

  IF pg_catalog.to_regclass('public.tenant_membership_transitions') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.sha256(bytea)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.convert_to(text,name)') IS NULL
    OR pg_catalog.to_regprocedure('pg_catalog.encode(bytea,text)') IS NULL
  THEN
    RAISE EXCEPTION USING MESSAGE = 'S43_0046_ROLE_SHAPE_PREDECESSOR_DRIFT';
  END IF;

  LOCK TABLE "public"."tenant_membership_transitions" IN ACCESS EXCLUSIVE MODE;

  IF (
    SELECT count(*) <> 1
      OR count(*) FILTER (
        WHERE constraint_row.contype = 'c'
          AND constraint_row.convalidated
          AND pg_catalog.encode(
            pg_catalog.sha256(
              pg_catalog.convert_to(
                pg_catalog.pg_get_constraintdef(constraint_row.oid, false),
                'UTF8'
              )
            ),
            'hex'
          ) = expected_role_shape_hash
      ) <> 1
    FROM pg_catalog.pg_constraint constraint_row
    WHERE constraint_row.conrelid =
      'public.tenant_membership_transitions'::regclass
      AND constraint_row.conname =
        'tenant_membership_transitions_role_shape_check'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'S43_0046_ROLE_SHAPE_PREDECESSOR_DRIFT';
  END IF;
END
$migration$;

ALTER TABLE "public"."tenant_membership_transitions"
  DROP CONSTRAINT "tenant_membership_transitions_role_shape_check";

ALTER TABLE "public"."tenant_membership_transitions"
  ADD CONSTRAINT "tenant_membership_transitions_role_shape_check" CHECK (
    (
      transition_type IN ('create', 'legacy_calibration')
      AND from_role IS NULL
    )
    OR (
      transition_type = 'refresh'
      AND from_role IS NOT NULL
      AND (
        from_role <> to_role
        OR (
          from_role = to_role
          AND source = 'access_control_command'
          AND reason_code = 'post_rebuild_formal_identity_adoption'
          AND from_revision = 1
          AND to_revision = 2
        )
      )
    )
    OR (
      transition_type IN ('revoke', 'reactivate', 'delete')
      AND from_role IS NOT NULL
      AND from_role = to_role
    )
  );
