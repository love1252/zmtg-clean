import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { afterEach, describe, test } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test');

import { SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL } from './guarded-migrate.mjs';

import {
  SYS01_BASELINE_ARTIFACT_PATH,
  SYS01_BASELINE_MANIFEST_PATH,
  SYS01_EXECUTION_CONFIRMATION,
  SYS01_IDENTITIES,
  SYS01_PARENT_JOURNAL,
  SYS01_SOURCE_BASELINE_COMMIT,
  SYS01_TABLE_CONTRACT,
  SYS01_TARGET_ONLY_CONTRACT,
  assertDatabaseIdentity,
  assertExcludedTargetsEmpty,
  assertSecretOpaqueEquality,
  buildBackupCapability,
  buildBaselineBootstrapCapability,
  buildBoundCutoverEvidenceReceipt,
  buildExecutionManifest,
  buildExpectedCatalogModel,
  buildPlan,
  buildRollbackCapability,
  buildTransferCapability,
  canonicalCatalogRecords,
  canonicalJson,
  catalogFingerprintFromRecords,
  classifyPhaseOutcome,
  expectedSchemaFingerprint,
  gitBlobOid,
  loadBaselineBundle,
  mapAuditRows,
  mapBindingRows,
  mapMembershipCalibrationRows,
  mapOwnerReconstructedRows,
  parseRunnerArguments,
  runSys01ControlledLocalDevRebuild,
  sha256Bytes,
  validateSourceInventory,
} from './sys01-controlled-local-dev-rebuild.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifactPath = path.join(repositoryRoot, SYS01_BASELINE_ARTIFACT_PATH);
const manifestPath = path.join(repositoryRoot, SYS01_BASELINE_MANIFEST_PATH);
const temporaryRoots = [];

function readBaseline() {
  return readFileSync(artifactPath, 'utf8');
}

function catalogCounts(model = buildExpectedCatalogModel(readBaseline())) {
  return model.reduce((counts, record) => {
    counts[record.objectClass] = (counts[record.objectClass] ?? 0) + 1;
    return counts;
  }, {});
}

function copyBaselineFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'zmtg-s26-runner-'));
  temporaryRoots.push(root);
  for (const relativePath of [
    SYS01_BASELINE_ARTIFACT_PATH,
    SYS01_BASELINE_MANIFEST_PATH,
    'scripts/db/sys01-controlled-local-dev-rebuild.mjs',
    'scripts/db/guarded-migrate.mjs',
  ]) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repositoryRoot, relativePath), target);
  }
  return root;
}

function sourceInventory() {
  const tables = SYS01_TABLE_CONTRACT.map((entry) => entry.table);
  return {
    tables,
    rowCounts: Object.fromEntries(tables.map((table) => [table, 0])),
  };
}

function localIdentities(overrides = {}) {
  return Object.fromEntries(
    Object.entries(SYS01_IDENTITIES).map(([role, identity]) => [
      role,
      {
        ...identity,
        environment: 'local-development',
        exists: role === 'original',
        conflict: false,
        ...(overrides[role] ?? {}),
      },
    ]),
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('S26 static baseline artifact', () => {
  test('baseline manifest freezes exact artifact, source base, parent and tooling blobs', () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    assert.equal(bundle.manifest.sourceBaselineCommit, SYS01_SOURCE_BASELINE_COMMIT);
    assert.equal(bundle.manifest.parentJournalTag, SYS01_PARENT_JOURNAL.tag);
    assert.equal(bundle.manifest.parentJournalWhen, SYS01_PARENT_JOURNAL.when);
    assert.equal(bundle.manifest.artifactSha256, sha256Bytes(Buffer.from(bundle.sqlSource, 'utf8')));
    assert.equal(bundle.manifest.schemaFingerprintSha256, expectedSchemaFingerprint(bundle.sqlSource));
    assert.equal(Object.hasOwn(bundle.manifest, 'manifestSha256'), false);
    assert.notEqual(bundle.validation.marker.hash, bundle.manifest.artifactSha256);
    for (const [relativePath, expected] of Object.entries(bundle.manifest.toolingBlobs)) {
      assert.equal(gitBlobOid(readFileSync(path.join(repositoryRoot, relativePath))), expected);
    }
    assert.equal(`${JSON.stringify(bundle.manifest, null, 2)}\n`, bundle.manifestSource);
  });

  test('canonical logical model has exact current catalog coverage', () => {
    const model = buildExpectedCatalogModel(readBaseline());
    assert.deepEqual(catalogCounts(model), {
      checks: 63,
      columns: 853,
      defaults: 227,
      enums: 59,
      foreign_keys: 110,
      functions: 4,
      indexes: 136,
      nullability: 853,
      primary_keys: 60,
      schemas: 1,
      tables: 60,
      triggers: 7,
      types: 59,
      uniques: 51,
    });
    const actualTables = model
      .filter((record) => record.objectClass === 'tables')
      .map((record) => record.name)
      .sort();
    const expectedTables = [
      ...SYS01_TABLE_CONTRACT.filter((entry) => entry.table !== 'drizzle.__drizzle_migrations').map(
        (entry) => entry.table,
      ),
      ...SYS01_TARGET_ONLY_CONTRACT.map((entry) => entry.table),
    ].sort();
    assert.deepEqual(actualTables, expectedTables);
  });

  test('reviewed final catalog state preserves two NOT VALID FKs and historic enum order', () => {
    const model = buildExpectedCatalogModel(readBaseline());
    const unvalidated = model
      .filter((record) => record.objectClass === 'foreign_keys' && record.signature.validated === false)
      .map((record) => record.name)
      .sort();
    assert.deepEqual(unvalidated, [
      'auth_account_institution_bindings.auth_account_institution_bindings_scope_fk',
      'tenant_members.tenant_members_user_id_auth_users_id_fk',
    ]);
    assert.deepEqual(
      model.find((record) => record.objectClass === 'enums' && record.name === 'knowledge_base_runtime_status')?.signature,
      ['disabled', 'denied', 'empty', 'ready', 'pending', 'failed'],
    );
    assert.deepEqual(
      model.find((record) => record.objectClass === 'enums' && record.name === 'knowledge_indexing_job_type')?.signature,
      ['parse_file', 'generate_embeddings', 'rebuild_embeddings', 'rebuild_knowledge_index', 'ocr_file'],
    );
    assert.equal(
      model
        .filter((record) => ['primary_keys', 'foreign_keys', 'uniques', 'checks'].includes(record.objectClass))
        .filter((record) => record.signature.validated !== true).length,
      2,
    );
  });

  test('explicit indexes preserve unique/partial traits and exclude constraint backing indexes', () => {
    const indexes = buildExpectedCatalogModel(readBaseline()).filter(
      (record) => record.objectClass === 'indexes',
    );
    assert.equal(indexes.length, 136);
    assert.equal(indexes.filter((record) => record.signature.unique === true).length, 17);
    assert.equal(indexes.filter((record) => record.signature.predicate !== null).length, 6);
    assert.equal(indexes.filter((record) => record.signature.keys.some((key) => key.includes('('))).length, 0);
    assert.equal(indexes.filter((record) => record.signature.method !== 'btree').length, 0);
  });

  test('baseline is schema-only and contains neither marker nor historical journal DML', () => {
    const sql = readBaseline();
    const functionAwareTopLevel = sql.replace(
      /CREATE FUNCTION[\s\S]*?\$function\$;/gu,
      'CREATE FUNCTION <reviewed-body-removed>;',
    );
    assert.equal(/^\s*(?:INSERT|UPDATE|DELETE|COPY|MERGE|TRUNCATE)\b/gimu.test(functionAwareTopLevel), false);
    assert.equal(/__drizzle_migrations/iu.test(sql), false);
    assert.equal(/004[0-5]_/u.test(sql), false);
    assert.equal(/postgres(?:ql)?:\/\//iu.test(sql), false);
    assert.equal(/(?:Bearer\s+|AKIA[0-9A-Z]{16}|\$2[aby]\$)/u.test(sql), false);
    assert.equal(Buffer.from(sql, 'utf8').subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);
    assert.equal(sql.endsWith('\n'), true);
    assert.equal(sql.includes('\r'), false);
  });

  test('artifact, manifest and tooling drift fail closed', () => {
    const artifactRoot = copyBaselineFixture();
    writeFileSync(path.join(artifactRoot, SYS01_BASELINE_ARTIFACT_PATH), `${readBaseline()}\n`);
    assert.throws(() => loadBaselineBundle(artifactRoot), /baseline_artifact_hash_drift/);

    const manifestRoot = copyBaselineFixture();
    const manifest = JSON.parse(readFileSync(path.join(manifestRoot, SYS01_BASELINE_MANIFEST_PATH), 'utf8'));
    manifest.sourceBaselineCommit = '0'.repeat(40);
    writeFileSync(
      path.join(manifestRoot, SYS01_BASELINE_MANIFEST_PATH),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    assert.throws(() => loadBaselineBundle(manifestRoot), /baseline_manifest_invalid/);

    const toolingRoot = copyBaselineFixture();
    writeFileSync(
      path.join(toolingRoot, 'scripts/db/guarded-migrate.mjs'),
      `${readFileSync(path.join(toolingRoot, 'scripts/db/guarded-migrate.mjs'), 'utf8')}\n`,
    );
    assert.throws(() => loadBaselineBundle(toolingRoot), /baseline_tool_blob_drift/);
  });

  test('catalog fingerprint changes for every governed semantic object class', () => {
    const original = readBaseline();
    const fingerprint = expectedSchemaFingerprint(original);
    const mutations = [
      original.replace('varchar(64)', 'varchar(63)'),
      original.replace("DEFAULT 'active'", "DEFAULT 'suspended'"),
      original.replace('"version" > 0)', '"version" > 999)'),
      original.replace('REFERENCES "public"."tenants"("id")', 'REFERENCES "public"."auth_users"("id")'),
      original.replace('USING btree ("tenant_id","institution_id")', 'USING btree ("institution_id","tenant_id")'),
      original.replace('TENANT_MEMBERSHIP_TRANSITION_IMMUTABLE', 'TENANT_MEMBERSHIP_TRANSITION_CHANGED'),
      original.replace('LANGUAGE plpgsql', 'LANGUAGE plpgsql STRICT'),
      original.replace(
        'BEFORE UPDATE OR DELETE ON public.tenant_membership_transitions',
        'AFTER UPDATE OR DELETE ON public.tenant_membership_transitions',
      ),
    ];
    for (const mutation of mutations) {
      assert.notEqual(mutation, original);
      assert.notEqual(expectedSchemaFingerprint(mutation), fingerprint);
    }
    const identityA = 'CREATE TABLE "identity_probe" ("id" integer NOT NULL);\n';
    const identityB =
      'CREATE TABLE "identity_probe" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL);\n';
    assert.notEqual(expectedSchemaFingerprint(identityA), expectedSchemaFingerprint(identityB));
  });

  test('actual catalog SQL and offline catalog share the rich canonical record contract', () => {
    for (const token of [
      "'generatedExpression'",
      "'nullsNotDistinct'",
      "'referencedTable'",
      "'onUpdate'",
      "'predicate'",
      "'volatility'",
      "'security'",
      "'parallel'",
      "'strict'",
      "'leakproof'",
      "'cost'",
      "'rows'",
      "'events'",
      "'ownedBy'",
      'pg_catalog.pg_get_functiondef',
      'pg_catalog.pg_get_triggerdef',
    ]) {
      assert.equal(SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL.includes(token), true);
    }
    const records = buildExpectedCatalogModel(readBaseline());
    assert.equal(
      catalogFingerprintFromRecords(canonicalCatalogRecords(records)),
      expectedSchemaFingerprint(readBaseline()),
    );
    const checkRecord = (expression) => [
      {
        objectClass: 'columns',
        schema: 'public',
        name: 'probe.source',
        signature: {
          type: 'character varying(64)',
          identity: '',
          generated: '',
          generatedExpression: null,
        },
      },
      {
        objectClass: 'columns',
        schema: 'public',
        name: 'probe.status',
        signature: {
          type: 'character varying(64)',
          identity: '',
          generated: '',
          generatedExpression: null,
        },
      },
      ...['recipient_binding_digest', 'id', 'currency'].map((name) => ({
        objectClass: 'columns',
        schema: 'public',
        name: `probe.${name}`,
        signature: {
          type: 'character varying(64)',
          identity: '',
          generated: '',
          generatedExpression: null,
        },
      })),
      {
        objectClass: 'checks',
        schema: 'public',
        name: 'probe.probe_check',
        signature: {
          validated: true,
          deferrable: false,
          deferred: false,
          expression,
        },
      },
    ];
    assert.equal(
      canonicalJson(canonicalCatalogRecords(checkRecord("source IN('manual_admin','system')"))),
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("((source = ANY (ARRAY['manual_admin'::text, 'system'::text])))"),
        ),
      ),
    );
    assert.equal(
      canonicalJson(canonicalCatalogRecords(checkRecord("status NOT IN('a','b')"))),
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("status <> ALL (ARRAY['a'::text, 'b'::text])"),
        ),
      ),
    );
    assert.equal(
      canonicalJson(canonicalCatalogRecords(checkRecord('status BETWEEN 0 AND 1'))),
      canonicalJson(canonicalCatalogRecords(checkRecord('status >= 0 AND status <= 1'))),
    );
    assert.equal(
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("recipient_binding_digest~'^[0-9a-f]{64}$'"),
        ),
      ),
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("recipient_binding_digest::text~'^[0-9a-f]{64}$'::text"),
        ),
      ),
    );
    assert.notEqual(
      catalogFingerprintFromRecords(checkRecord("window_ends_at=INTERVAL '1 day'")),
      catalogFingerprintFromRecords(checkRecord("window_ends_at='24:00:00'::interval")),
    );
    for (const [sourceExpression, catalogExpression] of [
      ['length(trim(id))>0', 'length(btrim((id)::text))>0'],
      ['length(recipient_binding_digest)=64', 'length((recipient_binding_digest)::text)=64'],
      ['upper(currency)', 'upper((currency)::text)'],
      ['length(trim(id))>0', 'length(TRIM(BOTH FROM id))>0'],
    ]) {
      assert.equal(
        canonicalJson(canonicalCatalogRecords(checkRecord(sourceExpression))),
        canonicalJson(canonicalCatalogRecords(checkRecord(catalogExpression))),
      );
    }
    assert.equal(
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("window_ends_at=window_started_at+INTERVAL '24 hours'"),
        ),
      ),
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("window_ends_at=window_started_at+'24:00:00'::interval"),
        ),
      ),
    );
    const predicateRecord = (predicate) => [
      ...checkRecord("status='active'"),
      {
        objectClass: 'indexes',
        schema: 'public',
        name: 'probe_predicate_idx',
        signature: {
          table: 'probe',
          unique: true,
          method: 'btree',
          keys: ['status'],
          include: [],
          predicate,
        },
      },
    ];
    assert.equal(
      canonicalJson(
        canonicalCatalogRecords(
          predicateRecord("source is not null and status not in ('completed','cancelled')"),
        ),
      ),
      canonicalJson(
        canonicalCatalogRecords(
          predicateRecord(
            "((source IS NOT NULL) AND (status <> ALL (ARRAY['completed'::text, 'cancelled'::text])))",
          ),
        ),
      ),
    );
    assert.notEqual(
      catalogFingerprintFromRecords(
        checkRecord("('3'::integer / 2) = 1"),
      ),
      catalogFingerprintFromRecords(
        checkRecord("('3'::numeric / 2) = 1"),
      ),
    );
    const defaultRecord = (expression) => [
      {
        objectClass: 'defaults',
        schema: 'public',
        name: 'probe.value',
        signature: { expression, resultType: 'integer' },
      },
    ];
    assert.notEqual(
      catalogFingerprintFromRecords(defaultRecord("'1'::integer")),
      catalogFingerprintFromRecords(defaultRecord("'1'::bigint")),
    );
    assert.equal(
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord("status='active' AND (institution_id IS NULL OR tenant_id IS NOT NULL)"),
        ),
      ),
      canonicalJson(
        canonicalCatalogRecords(
          checkRecord(
            "((status = 'active'::text) AND ((institution_id IS NULL) OR (tenant_id IS NOT NULL)))",
          ),
        ),
      ),
    );
    const functionRecord = (body) => [
      {
        objectClass: 'functions',
        schema: 'public',
        name: 'probe()',
        signature: (() => {
          const definition = {
          language: 'plpgsql',
          returns: 'trigger',
          volatility: 'volatile',
          security: 'invoker',
          parallel: 'unsafe',
          strict: false,
          leakproof: false,
          cost: 100,
          rows: 0,
          body,
          config: [],
          };
          return {
            ...definition,
            definition:
              `CREATE FUNCTION public.probe() RETURNS trigger LANGUAGE plpgsql ` +
              `AS $function$ ${body} $function$;`,
          };
        })(),
      },
    ];
    assert.notEqual(
      catalogFingerprintFromRecords(functionRecord("RAISE EXCEPTION 'A  B';")),
      catalogFingerprintFromRecords(functionRecord("RAISE EXCEPTION 'A B';")),
    );
    assert.notEqual(
      catalogFingerprintFromRecords(functionRecord('RETURN 1::integer;')),
      catalogFingerprintFromRecords(functionRecord('RETURN 1::bigint;')),
    );
    const actualFunctionRecord = functionRecord("RAISE EXCEPTION 'probe';");
    actualFunctionRecord[0].signature.definition =
      `CREATE OR REPLACE FUNCTION public.probe()\n` +
      ` RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n` +
      `RAISE EXCEPTION 'probe';\n$function$\n`;
    assert.equal(
      catalogFingerprintFromRecords(functionRecord("RAISE EXCEPTION 'probe';")),
      catalogFingerprintFromRecords(actualFunctionRecord),
    );
    const triggerRecord = (events, timing = 'BEFORE', suffix = '') => [
      {
        objectClass: 'triggers',
        schema: 'public',
        name: 'probe_trigger',
        signature: {
          table: 'probe',
          timing: timing.toLowerCase(),
          events: events.split(' OR ').map((event) => event.toLowerCase()).sort(),
          level: 'row',
          function: 'probe()',
          enabled: 'O',
          definition:
            `CREATE TRIGGER probe_trigger ${timing} ${events} ON public.probe ` +
            `FOR EACH ROW ${suffix} EXECUTE FUNCTION public.probe();`,
        },
      },
    ];
    assert.equal(
      catalogFingerprintFromRecords(triggerRecord('UPDATE OR DELETE')),
      catalogFingerprintFromRecords(triggerRecord('DELETE OR UPDATE')),
    );
    assert.notEqual(
      catalogFingerprintFromRecords(triggerRecord('UPDATE OR DELETE', 'BEFORE')),
      catalogFingerprintFromRecords(triggerRecord('UPDATE OR DELETE', 'AFTER')),
    );
    assert.notEqual(
      catalogFingerprintFromRecords(triggerRecord('UPDATE OR DELETE', 'BEFORE')),
      catalogFingerprintFromRecords(
        triggerRecord('UPDATE OR DELETE', 'BEFORE', 'WHEN (OLD.id IS NOT NULL)'),
      ),
    );
  });
});

describe('S26 controlled runner guards and mapping', () => {
  test('no-argument plan is side-effect free and never invokes an executor', async () => {
    const calls = [];
    const result = await runSys01ControlledLocalDevRebuild({
      argv: [],
      rootDir: repositoryRoot,
      dependencies: new Proxy(
        {},
        {
          get: (_target, property) => async () => calls.push(property),
        },
      ),
      output: { stdout: () => undefined, stderr: () => undefined },
    });
    assert.equal(result.plan.mode, 'PLAN_ONLY');
    assert.equal(result.plan.originalMutationAllowed, false);
    assert.equal(result.plan.productionAllowed, false);
    assert.equal(result.plan.automaticCutoverAllowed, false);
    assert.deepEqual(calls, []);
  });

  test('execution requires exact one phase, confirmation, SHA and external manifest path', () => {
    assert.throws(() => parseRunnerArguments(['--mode', 'execute', '--phase', 'all']), /runner_exact_phase_required/);
    assert.throws(
      () =>
        parseRunnerArguments([
          '--mode',
          'execute',
          '--phase',
          'backup',
          '--confirmation',
          'wrong',
          '--expected-head',
          '1'.repeat(40),
          '--execution-manifest',
          '/tmp/manifest.json',
        ]),
      /runner_confirmation_invalid/,
    );
    assert.equal(
      parseRunnerArguments([
        '--mode',
        'execute',
        '--phase',
        'backup',
        '--confirmation',
        SYS01_EXECUTION_CONFIRMATION,
        '--expected-head',
        '1'.repeat(40),
        '--execution-manifest',
        '/tmp/manifest.json',
      ]).phase,
      'backup',
    );
  });

  test('database identities reject non-loopback, wrong original and candidate/restore conflicts', () => {
    assert.throws(
      () => assertDatabaseIdentity('original', { ...localIdentities().original, host: 'remote.internal' }),
      /runner_original_identity_mismatch/,
    );
    assert.throws(
      () => assertDatabaseIdentity('original', { ...localIdentities().original, port: 5432 }),
      /runner_original_identity_mismatch/,
    );
    assert.throws(
      () => assertDatabaseIdentity('candidate', { ...localIdentities().candidate, conflict: true }),
      /runner_candidate_identity_conflict/,
    );
    assert.throws(
      () => assertDatabaseIdentity('restoreDrill', { ...localIdentities().restoreDrill, conflict: true }),
      /runner_restoreDrill_identity_conflict/,
    );
    assert.throws(
      () => assertDatabaseIdentity('candidate', { ...localIdentities().candidate, environment: 'production' }),
      /runner_non_local_environment_rejected/,
    );
  });

  test('source inventory contract is exact 56 tables and semantic drift requires re-admission', () => {
    const inventory = sourceInventory();
    assert.equal(SYS01_TABLE_CONTRACT.length, 56);
    assert.equal(validateSourceInventory(inventory).tableCount, 56);
    assert.throws(
      () => validateSourceInventory({ ...inventory, tables: inventory.tables.slice(1) }),
      /source_inventory_semantic_drift/,
    );
    assert.throws(
      () =>
        validateSourceInventory({
          ...inventory,
          rowCounts: { ...inventory.rowCounts, auth_account_institution_bindings: 1 },
        }),
      /source_inventory_re_admission_required/,
    );
  });

  test('membership legacy calibration is multi-row, deterministic and binds recorded_at to updated_at', () => {
    const rows = [
      { id: 'm-2', tenant_id: 't-1', user_id: 'u-2', role: 'consultant', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' },
      { id: 'm-1', tenant_id: 't-1', user_id: 'u-1', role: 'tenant_admin', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    ];
    const first = mapMembershipCalibrationRows(rows);
    const second = mapMembershipCalibrationRows(rows.slice().reverse());
    assert.deepEqual(first, second);
    assert.deepEqual(first.map((entry) => entry.current.id), ['m-1', 'm-2']);
    for (const entry of first) {
      assert.equal(entry.current.current_provenance_recorded_at, entry.current.updated_at);
      assert.equal(entry.transition.recorded_at, entry.current.updated_at);
      assert.match(entry.transition.id, /^mtcl1_[0-9a-f]{64}$/u);
    }
  });

  test('owner reconstruction uses only one persisted customer pair and rejects zero or multiple matches', () => {
    const rows = [{ id: 'a-1', tenant_id: 't-1', customer_id: 'c-1' }];
    assert.equal(
      mapOwnerReconstructedRows(rows, [{ id: 'c-1', tenant_id: 't-1', institution_id: 'i-1' }])[0].institution_id,
      'i-1',
    );
    assert.throws(() => mapOwnerReconstructedRows(rows, []), /owner_mapping_zero_match/);
    assert.throws(
      () =>
        mapOwnerReconstructedRows(rows, [
          { id: 'c-1', tenant_id: 't-1', institution_id: 'i-1' },
          { id: 'c-1', tenant_id: 't-1', institution_id: 'i-2' },
        ]),
      /owner_mapping_multiple_match/,
    );
  });

  test('audit stays NULL/NULL, Binding is no-guess and derived/ephemeral/attestation targets stay empty', () => {
    assert.deepEqual(mapAuditRows([{ event_id: 'e-1', institution_id: 'old' }]), [
      { event_id: 'e-1', institution_id: null, institution_attribution: null },
    ]);
    assert.deepEqual(mapBindingRows([]), []);
    assert.throws(() => mapBindingRows([{ id: 'binding-drift' }]), /binding_mapping_re_admission_required/);
    const empty = Object.fromEntries(
      [
        ...SYS01_TABLE_CONTRACT,
        ...SYS01_TARGET_ONLY_CONTRACT,
      ].map((entry) => [entry.table, 0]),
    );
    assert.equal(assertExcludedTargetsEmpty(empty), true);
    assert.throws(
      () => assertExcludedTargetsEmpty({ ...empty, knowledge_chunks: 1 }),
      /excluded_target_not_empty/,
    );
  });

  test('secret-sensitive equality accepts only opaque digests and never returns secret values', () => {
    const digests = {
      auth_users: '11'.repeat(32),
      his_connections: '22'.repeat(32),
      platform_ai_provider_configs: '33'.repeat(32),
    };
    assert.equal(assertSecretOpaqueEquality(digests, { ...digests }), true);
    assert.throws(
      () => assertSecretOpaqueEquality(digests, { ...digests, auth_users: '44'.repeat(32) }),
      /secret_opaque_equality_mismatch/,
    );
    assert.throws(
      () => assertSecretOpaqueEquality(digests, { ...digests, extra_secret_table: '44'.repeat(32) }),
      /secret_opaque_equality_mismatch/,
    );
    assert.throws(
      () => assertSecretOpaqueEquality({ ...digests, auth_users: 'plaintext' }, digests),
      /secret_opaque_equality_mismatch|secret_opaque_equality_invalid/,
    );
    assert.equal(JSON.stringify(buildBackupCapability()).includes('password'), false);
  });

  test('phase capabilities freeze encrypted backup, marker-only bootstrap, transfer and reversible rollback', () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    assert.deepEqual(buildBackupCapability(), {
      format: 'postgresql-16-custom',
      source: 'original_read_only',
      destination: 'repository_external_private_path',
      encryption: 'aes-256-gcm-stream',
      plaintextArtifactAllowed: false,
      credentialsInArgumentsOrLogsAllowed: false,
      originalMutationAllowed: false,
    });
    const bootstrap = buildBaselineBootstrapCapability(bundle);
    assert.equal(bootstrap.markerRowCount, 1);
    assert.equal(bootstrap.marker.createdAt, SYS01_PARENT_JOURNAL.when);
    assert.equal(bootstrap.claimsHistoricalMigrationsExecuted, false);
    assert.equal(buildTransferCapability().bindingGuessAllowed, false);
    assert.deepEqual(buildRollbackCapability(), {
      automaticCutoverAllowed: false,
      automaticCleanupAllowed: false,
      originalRetained: true,
      candidateDestructionAllowed: false,
      outcomeUnknownAutoRetryAllowed: false,
    });
    assert.equal(buildPlan().automaticCutoverAllowed, false);
  });

  test('restore and transfer unknown outcomes stop without automatic retry', () => {
    assert.deepEqual(classifyPhaseOutcome('restore-drill', { status: 'unknown' }), {
      status: 'OUTCOME_UNKNOWN_RESTORE_DRILL',
      nextState: null,
      autoRetry: false,
    });
    assert.deepEqual(classifyPhaseOutcome('transfer', { status: 'timeout' }), {
      status: 'OUTCOME_UNKNOWN_TRANSFER',
      nextState: null,
      autoRetry: false,
    });
  });

  test('execute mode calls only the exact injected phase and keeps original immutable', async () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    const implementationHead = '1'.repeat(40);
    const inventory = sourceInventory();
    const executionManifest = buildExecutionManifest({
      implementationHead,
      baselineManifestSha256: bundle.validation.manifestSha256,
      sourceCatalogFingerprint: '55'.repeat(32),
      sourceInventory: inventory,
      capturedAt: '2026-08-15T00:00:00.000Z',
    });
    const calls = [];
    const lockEvents = [];
    const result = await runSys01ControlledLocalDevRebuild({
      argv: [
        '--mode',
        'execute',
        '--phase',
        'preflight',
        '--confirmation',
        SYS01_EXECUTION_CONFIRMATION,
        '--expected-head',
        implementationHead,
        '--execution-manifest',
        '/tmp/zmtg-s26-execution-manifest.json',
      ],
      rootDir: repositoryRoot,
      dependencies: {
        gitState: async () => ({ head: implementationHead, clean: true, baseIsAncestor: true }),
        acquireExecutionLock: async () => {
          lockEvents.push('acquire');
          return { test: true };
        },
        releaseExecutionLock: async () => lockEvents.push('release'),
        readExecutionManifest: async () => executionManifest,
        writeExecutionManifest: async () => undefined,
        inspectIdentities: async () => localIdentities(),
        readSourceInventory: async (context) => {
          calls.push(context);
          return {
            status: 'succeeded',
            postconditionVerified: true,
            sourceInventory: inventory,
            sourceCatalogFingerprint: '55'.repeat(32),
            capturedAt: '2026-08-15T00:00:00.000Z',
            completedAt: '2026-08-15T00:00:01.000Z',
            postconditionFingerprint: '77'.repeat(32),
            originalMutationCount: 0,
          };
        },
      },
      output: { stdout: () => undefined, stderr: () => undefined },
    });
    assert.equal(result.outcome.nextState, 'PREFLIGHT_PASSED');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].originalMutationAllowed, false);
    assert.equal(calls[0].phase, 'preflight');
    assert.deepEqual(lockEvents, ['acquire', 'release']);
  });

  test('executor failure retains the phase intent lock and forbids implicit retry', async () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    const implementationHead = '3'.repeat(40);
    const inventory = sourceInventory();
    const executionManifest = buildExecutionManifest({
      implementationHead,
      baselineManifestSha256: bundle.validation.manifestSha256,
      sourceCatalogFingerprint: 'aa'.repeat(32),
      sourceInventory: inventory,
      capturedAt: '2026-08-15T00:00:00.000Z',
    });
    const lockEvents = [];
    await assert.rejects(
      runSys01ControlledLocalDevRebuild({
        argv: [
          '--mode',
          'execute',
          '--phase',
          'preflight',
          '--confirmation',
          SYS01_EXECUTION_CONFIRMATION,
          '--expected-head',
          implementationHead,
          '--execution-manifest',
          '/tmp/zmtg-s26-failed-phase-manifest.json',
        ],
        rootDir: repositoryRoot,
        dependencies: {
          gitState: async () => ({ head: implementationHead, clean: true, baseIsAncestor: true }),
          acquireExecutionLock: async () => {
            lockEvents.push('acquire');
            return { test: true };
          },
          releaseExecutionLock: async () => lockEvents.push('release'),
          readExecutionManifest: async () => executionManifest,
          inspectIdentities: async () => localIdentities(),
          readSourceInventory: async () => {
            throw new Error('synthetic executor failure');
          },
        },
        output: { stdout: () => undefined, stderr: () => undefined },
      }),
      /synthetic executor failure/,
    );
    assert.deepEqual(lockEvents, ['acquire']);
  });

  test('execution manifest is deterministic, aggregate-only and rejects current source drift', () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    const inventory = sourceInventory();
    const manifest = buildExecutionManifest({
      implementationHead: '1'.repeat(40),
      baselineManifestSha256: bundle.validation.manifestSha256,
      sourceCatalogFingerprint: '66'.repeat(32),
      sourceInventory: inventory,
      capturedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(canonicalJson(manifest).includes('password'), false);
    assert.equal(Object.hasOwn(manifest, 'credentials'), false);
    assert.equal(manifest.sourceTableSet.length, 56);
    const drift = { ...inventory, rowCounts: { ...inventory.rowCounts, his_connections: 1 } };
    assert.throws(
      () =>
        buildExecutionManifest({
          implementationHead: '1'.repeat(40),
          baselineManifestSha256: bundle.validation.manifestSha256,
          sourceCatalogFingerprint: '66'.repeat(32),
          sourceInventory: drift,
          capturedAt: '2026-08-15T00:00:00.000Z',
        }),
      /source_inventory_re_admission_required/,
    );
    const receiptManifest = {
      ...manifest,
      phaseReceipts: [{ digest: '77'.repeat(32) }],
    };
    const readinessReceipt = buildBoundCutoverEvidenceReceipt({
      kind: 'pre_cutover_readiness',
      evidenceSha256: '88'.repeat(32),
      activeTarget: 'candidate',
      bundle,
      executionManifest: receiptManifest,
    });
    assert.match(readinessReceipt, /^[0-9a-f]{64}$/u);
    assert.notEqual(
      readinessReceipt,
      buildBoundCutoverEvidenceReceipt({
        kind: 'pre_cutover_application_smoke',
        evidenceSha256: '88'.repeat(32),
        activeTarget: 'candidate',
        bundle,
        executionManifest: receiptManifest,
      }),
    );
    assert.notEqual(
      readinessReceipt,
      buildBoundCutoverEvidenceReceipt({
        kind: 'pre_cutover_readiness',
        evidenceSha256: '99'.repeat(32),
        activeTarget: 'candidate',
        bundle,
        executionManifest: receiptManifest,
      }),
    );
    assert.notEqual(
      readinessReceipt,
      buildBoundCutoverEvidenceReceipt({
        kind: 'pre_cutover_readiness',
        evidenceSha256: '88'.repeat(32),
        activeTarget: 'original',
        bundle,
        executionManifest: receiptManifest,
      }),
    );
  });

  test('preflight creates one repo-external execution manifest and advances the receipt chain', async () => {
    const bundle = loadBaselineBundle(repositoryRoot);
    const implementationHead = '2'.repeat(40);
    const inventory = sourceInventory();
    const writes = [];
    const result = await runSys01ControlledLocalDevRebuild({
      argv: [
        '--mode',
        'execute',
        '--phase',
        'preflight',
        '--confirmation',
        SYS01_EXECUTION_CONFIRMATION,
        '--expected-head',
        implementationHead,
        '--execution-manifest',
        '/tmp/zmtg-s26-new-execution-manifest.json',
      ],
      rootDir: repositoryRoot,
      dependencies: {
        gitState: async () => ({ head: implementationHead, clean: true, baseIsAncestor: true }),
        acquireExecutionLock: async () => ({ test: true }),
        releaseExecutionLock: async () => undefined,
        readExecutionManifest: async () => null,
        writeExecutionManifest: async (...args) => writes.push(args),
        inspectIdentities: async () => localIdentities(),
        readSourceInventory: async () => ({
          status: 'succeeded',
          postconditionVerified: true,
          sourceInventory: inventory,
          sourceCatalogFingerprint: '88'.repeat(32),
          capturedAt: '2026-08-15T00:00:00.000Z',
          completedAt: '2026-08-15T00:00:01.000Z',
          postconditionFingerprint: '99'.repeat(32),
          originalMutationCount: 0,
        }),
      },
      output: { stdout: () => undefined, stderr: () => undefined },
    });
    assert.equal(result.outcome.status, 'succeeded');
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0][3], { create: true });
    assert.equal(writes[0][2].baselineManifestSha256, bundle.validation.manifestSha256);
    assert.equal(writes[0][2].state.current, 'PREFLIGHT_PASSED');
    assert.equal(writes[0][2].phaseReceipts.length, 1);
    assert.equal(writes[0][2].phaseReceipts[0].phase, 'preflight');
  });

  test('all future phase executors are wired while tests can still inject every destructive dependency', () => {
    const source = readFileSync(
      path.join(repositoryRoot, 'scripts/db/sys01-controlled-local-dev-rebuild.mjs'),
      'utf8',
    );
    assert.equal(source.includes('runner_phase_executor_not_configured'), false);
    for (const adapter of [
      'restoreEncryptedBackup(env, rootDir, executionManifest)',
      'createCandidateDatabase(env)',
      'bootstrapCandidateBaseline(env, bundle)',
      'transferCandidateData(env, executionManifest)',
      'inspectCandidateValidation(env, bundle, executionManifest)',
      'inspectRollbackReadiness(env, bundle, executionManifest)',
      'inspectCutoverReadiness(env, bundle, executionManifest)',
      'verifyPostCutover(env, bundle, executionManifest)',
    ]) {
      assert.equal(source.includes(adapter), true);
    }
  });
});
