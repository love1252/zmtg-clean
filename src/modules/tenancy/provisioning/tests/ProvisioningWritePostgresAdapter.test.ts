import type postgres from 'postgres';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeProvisioningEntryKeysDigest,
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  type ProvisioningCanonicalManifestV1,
} from '../provisioning-canonicalization';
import {
  parseProvisioningManifest,
  toProvisioningExpectedTriplet,
} from '../provisioning-manifest';
import {
  parseProvisioningExecutionLease,
  PROVISIONING_EXECUTION_LEASE_VERSION,
  PROVISIONING_EXPECTED_JOURNAL,
} from '../provisioning-lease';
import { executeProvisioning } from '../provisioning-kernel';
import type {
  ProvisioningContextHeadRowV1,
  ProvisioningContextVersionRowV1,
  ProvisioningRepositoryV1,
  ProvisioningScopeRowV1,
} from '../provisioning-ports';
import {
  createProvisioningWritePostgresAdapter,
  PROVISIONING_WRITE_IDLE_TIMEOUT_MS,
  PROVISIONING_WRITE_LOCK_TIMEOUT_MS,
  PROVISIONING_WRITE_STATEMENT_TIMEOUT_MS,
  PROVISIONING_WRITE_TRANSACTION_OPTIONS,
  ProvisioningWritePostgresError,
} from '../server/provisioning-write-postgres-adapter';

afterEach(() => {
  vi.unstubAllEnvs();
});

interface QueryRecord {
  readonly text: string;
  readonly values: readonly unknown[];
}

interface FakeDatabaseRows {
  tenants: Record<string, unknown>[];
  scopes: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  heads: Record<string, unknown>[];
}

interface FakeSqlState {
  readonly beginOptions: string[];
  readonly queries: QueryRecord[];
  rows: FakeDatabaseRows;
  beginCalls: number;
  transactionOutcome: 'none' | 'committed' | 'rolled_back';
  transactionReadOnly: string;
  transactionIsolation: string;
  statementTimeout: string;
  lockTimeout: string;
  idleTimeout: string;
  beginError: unknown;
  commitError: unknown;
  queryErrorPattern: string | null;
  queryError: unknown;
  insertCounts: {
    scope: number;
    version: number;
    head: number;
  };
  malformedInsertCount: boolean;
  concurrentCommitCount: number;
  beforeQuery:
    | ((query: QueryRecord, rows: FakeDatabaseRows) => void)
    | null;
}

function normalizeQuery(
  strings: TemplateStringsArray,
  values: readonly unknown[],
): QueryRecord {
  return {
    text: strings
      .map((part, index) =>
        index < values.length ? `${part}$parameter` : part,
      )
      .join('')
      .replace(/\s+/g, ' ')
      .trim(),
    values,
  };
}

function cloneRows(rows: FakeDatabaseRows): FakeDatabaseRows {
  return structuredClone(rows);
}

function resultRows(
  rows: readonly Record<string, unknown>[],
  count = rows.length,
): unknown {
  const result = structuredClone(rows) as Record<string, unknown>[];
  Object.defineProperty(result, 'count', {
    configurable: true,
    enumerable: false,
    value: count,
  });
  return result;
}

function databaseInstant(value: unknown): unknown {
  return typeof value === 'string'
    ? value.replace(/\.([0-9]{3})Z$/, '.$1000Z')
    : value;
}

function createFakeSql(
  overrides: Partial<FakeSqlState> = {},
): { readonly sql: postgres.Sql; readonly state: FakeSqlState } {
  const state: FakeSqlState = {
    beginOptions: [],
    queries: [],
    rows: {
      tenants: [],
      scopes: [],
      versions: [],
      heads: [],
    },
    beginCalls: 0,
    transactionOutcome: 'none',
    transactionReadOnly: 'off',
    transactionIsolation: 'serializable',
    statementTimeout: '5s',
    lockTimeout: '1s',
    idleTimeout: '5s',
    beginError: null,
    commitError: null,
    queryErrorPattern: null,
    queryError: null,
    insertCounts: { scope: 1, version: 1, head: 1 },
    malformedInsertCount: false,
    concurrentCommitCount: 0,
    beforeQuery: null,
    ...overrides,
  };
  let commitArrivals = 0;
  let releaseCommitBarrier: (() => void) | null = null;
  const commitBarrier = new Promise<void>((resolve) => {
    releaseCommitBarrier = resolve;
  });

  const sql = {
    begin: async (
      options: string,
      work: (transactionSql: postgres.TransactionSql) => Promise<unknown>,
    ) => {
      state.beginCalls += 1;
      const transactionNumber = state.beginCalls;
      state.beginOptions.push(options);
      if (state.beginError) {
        throw state.beginError;
      }
      const staged = cloneRows(state.rows);
      const transaction = (async (
        strings: TemplateStringsArray,
        ...values: readonly unknown[]
      ) => {
        const query = normalizeQuery(strings, values);
        state.queries.push(query);
        state.beforeQuery?.(query, staged);
        if (
          state.queryErrorPattern &&
          query.text.includes(state.queryErrorPattern)
        ) {
          throw state.queryError;
        }
        if (
          query.text.startsWith('SET LOCAL') ||
          query.text.includes('pg_advisory_xact_lock')
        ) {
          return resultRows([]);
        }
        if (query.text.includes("current_setting('transaction_read_only')")) {
          return resultRows([
            {
              transactionReadOnly: state.transactionReadOnly,
              transactionIsolation: state.transactionIsolation,
              statementTimeout: state.statementTimeout,
              lockTimeout: state.lockTimeout,
              idleTimeout: state.idleTimeout,
            },
          ]);
        }
        if (query.text.startsWith('SELECT id')) {
          return resultRows(
            staged.tenants.filter((row) => row.id === values[0]),
          );
        }
        if (query.text.includes('FROM "public"."institution_scopes"')) {
          return resultRows(
            staged.scopes.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        if (
          query.text.includes(
            'FROM "public"."institution_operating_context_versions"',
          )
        ) {
          return resultRows(
            staged.versions.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        if (
          query.text.includes(
            'FROM "public"."institution_operating_contexts"',
          )
        ) {
          return resultRows(
            staged.heads.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        if (
          query.text.startsWith(
            'INSERT INTO "public"."institution_scopes"',
          )
        ) {
          const count = state.insertCounts.scope;
          if (count === 1) {
            staged.scopes.push({
              tenantId: values[0],
              institutionId: values[1],
              status: values[2],
              revision: values[3],
              provisioningSource: values[4],
              provisioningReferenceDigest: values[5],
              approvedBy: values[6],
              approvedAt: databaseInstant(values[7]),
            });
          }
          return state.malformedInsertCount
            ? []
            : resultRows([], count);
        }
        if (
          query.text.startsWith(
            'INSERT INTO "public"."institution_operating_context_versions"',
          )
        ) {
          const count = state.insertCounts.version;
          if (count === 1) {
            staged.versions.push({
              tenantId: values[0],
              institutionId: values[1],
              version: values[2],
              timezone: values[3],
              currency: values[4],
              effectiveFromBusinessDate: values[5],
              effectiveAt: databaseInstant(values[6]),
              source: values[7],
              migrationProvenance: values[8],
              createdBy: values[9],
            });
          }
          return state.malformedInsertCount
            ? []
            : resultRows([], count);
        }
        if (
          query.text.startsWith(
            'INSERT INTO "public"."institution_operating_contexts"',
          )
        ) {
          const count = state.insertCounts.head;
          if (count === 1) {
            staged.heads.push({
              tenantId: values[0],
              institutionId: values[1],
              revision: values[2],
              latestVersion: values[3],
              updatedBy: values[4],
            });
          }
          return state.malformedInsertCount
            ? []
            : resultRows([], count);
        }
        throw new Error('unexpected fake query');
      }) as unknown as postgres.TransactionSql;

      try {
        const result = await work(transaction);
        if (state.concurrentCommitCount > 0) {
          commitArrivals += 1;
          if (commitArrivals === state.concurrentCommitCount) {
            releaseCommitBarrier?.();
          }
          await commitBarrier;
          if (transactionNumber !== 1) {
            throw Object.assign(
              new Error('synthetic concurrent commit conflict'),
              { code: '40001' },
            );
          }
        }
        if (state.commitError) {
          throw state.commitError;
        }
        state.rows = staged;
        state.transactionOutcome = 'committed';
        return result;
      } catch (error) {
        state.transactionOutcome = 'rolled_back';
        throw error;
      }
    },
  } as unknown as postgres.Sql;

  return { sql, state };
}

function scopeRow(
  overrides: Partial<ProvisioningScopeRowV1> = {},
): ProvisioningScopeRowV1 {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    status: 'active',
    revision: 1,
    provisioningSource: 'approved_migration_manifest',
    provisioningReferenceDigest: 'a'.repeat(64),
    approvedBy: 'approval-ref-synthetic',
    approvedAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

function versionRow(
  overrides: Partial<ProvisioningContextVersionRowV1> = {},
): ProvisioningContextVersionRowV1 {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    version: 1,
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    effectiveFromBusinessDate: '2026-07-30',
    effectiveAt: '2026-07-30T01:00:00.000Z',
    source: 'institution_config',
    migrationProvenance: null,
    createdBy: 'approval-ref-synthetic',
    ...overrides,
  };
}

function headRow(
  overrides: Partial<ProvisioningContextHeadRowV1> = {},
): ProvisioningContextHeadRowV1 {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    revision: 1,
    latestVersion: 1,
    updatedBy: 'approval-ref-synthetic',
    ...overrides,
  };
}

function createManifest() {
  const draft: ProvisioningCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: 'approval-ref-synthetic',
    approvedAt: '2026-07-30T00:00:00.000Z',
    entries: [
      {
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
        scopeStatus: 'active',
        scopeRevision: 1,
        provisioningSource: 'approved_migration_manifest',
        contextVersion: 1,
        contextHeadRevision: 1,
        latestVersion: 1,
        contextSource: 'institution_config',
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
        effectiveFromBusinessDate: '2026-07-30',
        effectiveAt: '2026-07-30T01:00:00.000Z',
      },
    ],
  };
  return parseProvisioningManifest(
    {
      ...draft,
      digest: computeProvisioningManifestDigest(draft).external,
    },
    {
      contextPolicy: {
        timezones: ['Asia/Shanghai'],
        currencies: ['CNY'],
      },
    },
  );
}

function createLease(manifest: ReturnType<typeof createManifest>) {
  return parseProvisioningExecutionLease({
    leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
    taskId: 'V2-MIG01-A2-P1-SYNTHETIC',
    branch: 'codex/v2-mig01-a2-p1-synthetic',
    frozenBase: '1'.repeat(40),
    journal: PROVISIONING_EXPECTED_JOURNAL,
    holder: 'holder-ref-synthetic',
    operator: 'operator-ref-synthetic',
    targetEnvironment: 'local-acceptance-synthetic',
    scope: {
      manifestDigest: manifest.digest,
      entryKeysDigest: computeProvisioningEntryKeysDigest(
        manifest.entries,
      ),
      entryCount: manifest.entries.length,
    },
    startsAt: '2026-07-30T00:00:00.000Z',
    expiresAt: '2026-07-30T02:00:00.000Z',
    renewal: { count: 0, renewedAt: null, renewedBy: null },
    invalidation: { invalidatedAt: null, reasonCode: null },
    release: { releasedAt: null, releasedBy: null },
  });
}

const leaseExpectation = Object.freeze({
  leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
  taskId: 'V2-MIG01-A2-P1-SYNTHETIC',
  branch: 'codex/v2-mig01-a2-p1-synthetic',
  frozenBase: '1'.repeat(40),
  journal: PROVISIONING_EXPECTED_JOURNAL,
  holder: 'holder-ref-synthetic',
  operator: 'operator-ref-synthetic',
  targetEnvironment: 'local-acceptance-synthetic',
});

function databaseRowsFromExpected(
  expected: ReturnType<typeof toProvisioningExpectedTriplet>,
): Pick<FakeDatabaseRows, 'scopes' | 'versions' | 'heads'> {
  return {
    scopes: [
      {
        ...expected.scope,
        approvedAt: databaseInstant(expected.scope.approvedAt),
      },
    ],
    versions: [
      {
        ...expected.version,
        effectiveAt: databaseInstant(expected.version.effectiveAt),
      },
    ],
    heads: [{ ...expected.head }],
  };
}

function executeWithAdapter(sql: postgres.Sql) {
  const manifest = createManifest();
  return executeProvisioning({
    manifest,
    transactionPort: createProvisioningWritePostgresAdapter(sql),
    leasePayload: createLease(manifest),
    leaseAuthority: { verify: vi.fn().mockResolvedValue(true) },
    leaseExpectation,
    now: new Date('2026-07-30T01:00:00.000Z'),
  });
}

async function captureRepository(
  sql: postgres.Sql,
): Promise<ProvisioningRepositoryV1> {
  return createProvisioningWritePostgresAdapter(sql).write(
    async (repository) => repository,
  );
}

describe('MIG-01A2 可写 PostgreSQL Adapter', () => {
  it('使用单一 SERIALIZABLE READ WRITE 事务并核验固定 timeout', async () => {
    const { sql, state } = createFakeSql();

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async () => 'complete',
      ),
    ).resolves.toBe('complete');

    expect(state.beginOptions).toEqual([
      PROVISIONING_WRITE_TRANSACTION_OPTIONS,
    ]);
    expect(PROVISIONING_WRITE_TRANSACTION_OPTIONS).toContain(
      'serializable',
    );
    expect(PROVISIONING_WRITE_TRANSACTION_OPTIONS).toContain('read write');
    expect(state.queries.map((query) => query.text)).toEqual(
      expect.arrayContaining([
        "SET LOCAL statement_timeout = '5000ms'",
        "SET LOCAL lock_timeout = '1000ms'",
        "SET LOCAL idle_in_transaction_session_timeout = '5000ms'",
      ]),
    );
    expect(PROVISIONING_WRITE_STATEMENT_TIMEOUT_MS).toBe(5_000);
    expect(PROVISIONING_WRITE_LOCK_TIMEOUT_MS).toBe(1_000);
    expect(PROVISIONING_WRITE_IDLE_TIMEOUT_MS).toBe(5_000);
    expect(state.transactionOutcome).toBe('committed');
  });

  it.each([
    [
      'read-only 事务',
      { transactionReadOnly: 'on' },
      'provisioning_write_transaction_read_only',
    ],
    [
      '非 serializable 隔离级别',
      { transactionIsolation: 'repeatable read' },
      'provisioning_write_transaction_unavailable',
    ],
    [
      'statement timeout 未生效',
      { statementTimeout: '0' },
      'provisioning_write_timeout',
    ],
    [
      'lock timeout 未生效',
      { lockTimeout: '0' },
      'provisioning_write_timeout',
    ],
    [
      'idle timeout 未生效',
      { idleTimeout: '0' },
      'provisioning_write_timeout',
    ],
  ] as const)('%s 时在业务回调前 fail-closed', async (
    _name,
    override,
    code,
  ) => {
    const { sql } = createFakeSql(override);
    const work = vi.fn(async () => true);

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(work),
    ).rejects.toThrow(code);
    expect(work).not.toHaveBeenCalled();
  });

  it('tenant 与完整三元组读取保持精确映射并取得竞争保护', async () => {
    const { sql, state } = createFakeSql({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [
          {
            ...scopeRow(),
            approvedAt: '2026-07-30T00:00:00.000000Z',
          },
        ],
        versions: [
          {
            ...versionRow(),
            effectiveAt: '2026-07-30T01:00:00.000000Z',
          },
        ],
        heads: [{ ...headRow() }],
      },
    });

    const result = await createProvisioningWritePostgresAdapter(sql).write(
      async (repository) => ({
        tenantExists: await repository.tenantExists('tenant-synthetic'),
        snapshot: await repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      }),
    );

    expect(result).toEqual({
      tenantExists: true,
      snapshot: {
        scopes: [scopeRow()],
        versions: [versionRow()],
        heads: [headRow()],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/createdAt|updatedAt/);
    expect(
      state.queries.some((query) =>
        query.text.includes('pg_advisory_xact_lock'),
      ),
    ).toBe(true);
    const advisoryIndex = state.queries.findIndex((query) =>
      query.text.includes('pg_advisory_xact_lock'),
    );
    const firstTripletReadIndex = state.queries.findIndex((query) =>
      query.text.includes('FROM "public"."institution_scopes"'),
    );
    expect(advisoryIndex).toBeGreaterThanOrEqual(0);
    expect(advisoryIndex).toBeLessThan(firstTripletReadIndex);
    expect(state.queries[advisoryIndex].values).toEqual([
      'tenant-synthetic',
      'institution-synthetic',
    ]);
    expect(
      state.queries.find((query) => query.text.startsWith('SELECT id'))
        ?.values,
    ).toEqual(['tenant-synthetic']);
    for (const query of state.queries.filter((item) =>
      item.text.includes('FROM "public"."institution_'),
    )) {
      expect(query.values).toEqual([
        'tenant-synthetic',
        'institution-synthetic',
      ]);
    }
    expect(state.queries.map((query) => query.text).join(' ')).not.toMatch(
      /\bFOR (?:UPDATE|KEY SHARE)\b/i,
    );
  });

  it('部分与重复三元组不被吞掉或去重，Version 仍按升序返回', async () => {
    const { sql } = createFakeSql({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [
          {
            ...scopeRow(),
            approvedAt: '2026-07-30T00:00:00.000000Z',
          },
          {
            ...scopeRow({ revision: 2 }),
            approvedAt: '2026-07-30T00:00:00.000000Z',
          },
        ],
        versions: [
          {
            ...versionRow({ version: 2 }),
            effectiveAt: '2026-07-30T02:00:00.000000Z',
          },
          {
            ...versionRow(),
            effectiveAt: '2026-07-30T01:00:00.000000Z',
          },
        ],
        heads: [],
      },
    });

    const snapshot = await createProvisioningWritePostgresAdapter(
      sql,
    ).write((repository) =>
      repository.readTriplet({
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
      }),
    );

    expect(snapshot.scopes).toHaveLength(2);
    expect(snapshot.versions.map((row) => row.version)).toEqual([1, 2]);
    expect(snapshot.heads).toEqual([]);
  });

  it('只执行三条参数化纯 INSERT 并保留 Scope → Version → Head 顺序', async () => {
    const { sql, state } = createFakeSql();

    const counts = await createProvisioningWritePostgresAdapter(sql).write(
      async (repository) => [
        await repository.insertScope(scopeRow()),
        await repository.insertContextVersion(versionRow()),
        await repository.insertContextHead(headRow()),
      ],
    );

    expect(counts).toEqual([1, 1, 1]);
    const writes = state.queries.filter((query) =>
      query.text.startsWith('INSERT INTO'),
    );
    expect(writes.map((query) => query.text)).toEqual([
      expect.stringContaining('"public"."institution_scopes"'),
      expect.stringContaining(
        '"public"."institution_operating_context_versions"',
      ),
      expect.stringContaining('"public"."institution_operating_contexts"'),
    ]);
    expect(writes.map((query) => query.values.length)).toEqual([8, 10, 5]);
    expect(writes[0].text).toContain(
      '( tenant_id, institution_id, status, revision, provisioning_source, provisioning_reference_digest, approved_by, approved_at )',
    );
    expect(writes[1].text).toContain(
      '( tenant_id, institution_id, version, timezone, currency, effective_from_business_date, effective_at, source, migration_provenance, created_by )',
    );
    expect(writes[2].text).toContain(
      '( tenant_id, institution_id, revision, latest_version, updated_by )',
    );
    expect(writes[0].values).toEqual([
      'tenant-synthetic',
      'institution-synthetic',
      'active',
      1,
      'approved_migration_manifest',
      'a'.repeat(64),
      'approval-ref-synthetic',
      '2026-07-30T00:00:00.000Z',
    ]);
    expect(writes[1].values).toEqual([
      'tenant-synthetic',
      'institution-synthetic',
      1,
      'Asia/Shanghai',
      'CNY',
      '2026-07-30',
      '2026-07-30T01:00:00.000Z',
      'institution_config',
      null,
      'approval-ref-synthetic',
    ]);
    expect(writes[2].values).toEqual([
      'tenant-synthetic',
      'institution-synthetic',
      1,
      1,
      'approval-ref-synthetic',
    ]);
    const allSql = state.queries.map((query) => query.text);
    expect(allSql.join(' ')).not.toMatch(
      /\b(?:UPDATE|DELETE|UPSERT|MERGE|ALTER|CREATE|DROP|TRUNCATE|CALL|COPY|DO|GRANT|REVOKE|SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO|ON CONFLICT|RETURNING)\b/i,
    );
    expect(
      allSql.every((statement) =>
        /^(?:SET LOCAL|SELECT|INSERT INTO)\b/i.test(statement),
      ),
    ).toBe(true);

    const roundTrip = await createProvisioningWritePostgresAdapter(
      sql,
    ).write((repository) =>
      repository.readTriplet({
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
      }),
    );
    expect(roundTrip).toEqual({
      scopes: [scopeRow()],
      versions: [versionRow()],
      heads: [headRow()],
    });
  });

  it('通过真实 Kernel 回调完成全缺三元组并在提交前重检为复用', async () => {
    const { sql, state } = createFakeSql({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: [],
      },
    });

    await expect(executeWithAdapter(sql)).resolves.toEqual({
      input: 1,
      insertedCandidate: 1,
      reusedCandidate: 0,
      conflict: 0,
      unexpected: 0,
    });
    expect(state.transactionOutcome).toBe('committed');
    expect(state.rows.scopes).toHaveLength(1);
    expect(state.rows.versions).toHaveLength(1);
    expect(state.rows.heads).toHaveLength(1);
    expect(
      state.queries
        .filter((query) => query.text.startsWith('INSERT INTO'))
        .map((query) => query.text),
    ).toEqual([
      expect.stringContaining('"public"."institution_scopes"'),
      expect.stringContaining(
        '"public"."institution_operating_context_versions"',
      ),
      expect.stringContaining('"public"."institution_operating_contexts"'),
    ]);
  });

  it('初始全一致三元组经真实 Kernel 只复用且数据库状态不变', async () => {
    const manifest = createManifest();
    const expected = toProvisioningExpectedTriplet(
      manifest,
      manifest.entries[0],
    );
    const initialRows = {
      tenants: [{ id: 'tenant-synthetic' }],
      ...databaseRowsFromExpected(expected),
    };
    const { sql, state } = createFakeSql({ rows: initialRows });
    const before = structuredClone(state.rows);

    await expect(executeWithAdapter(sql)).resolves.toEqual({
      input: 1,
      insertedCandidate: 0,
      reusedCandidate: 1,
      conflict: 0,
      unexpected: 0,
    });
    expect(state.transactionOutcome).toBe('committed');
    expect(
      state.queries.filter((query) => query.text.startsWith('INSERT INTO')),
    ).toEqual([]);
    expect(state.rows).toEqual(before);
  });

  it.each([
    [
      'tenant 缺失',
      () => ({
        tenants: [],
        scopes: [],
        versions: [],
        heads: [],
      }),
    ],
    [
      '仅 Scope',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: databaseRowsFromExpected(expected).scopes,
        versions: [],
        heads: [],
      }),
    ],
    [
      '仅 Version',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: databaseRowsFromExpected(expected).versions,
        heads: [],
      }),
    ],
    [
      '仅 Head',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: databaseRowsFromExpected(expected).heads,
      }),
    ],
    [
      'Scope + Version',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: databaseRowsFromExpected(expected).scopes,
        versions: databaseRowsFromExpected(expected).versions,
        heads: [],
      }),
    ],
    [
      'Scope + Head',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: databaseRowsFromExpected(expected).scopes,
        versions: [],
        heads: databaseRowsFromExpected(expected).heads,
      }),
    ],
    [
      'Version + Head',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => ({
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: databaseRowsFromExpected(expected).versions,
        heads: databaseRowsFromExpected(expected).heads,
      }),
    ],
    [
      '重复 Scope',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: [...rows.scopes, ...structuredClone(rows.scopes)],
          versions: rows.versions,
          heads: rows.heads,
        };
      },
    ],
    [
      '重复 Version',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: rows.scopes,
          versions: [
            ...rows.versions,
            ...structuredClone(rows.versions),
          ],
          heads: rows.heads,
        };
      },
    ],
    [
      '重复 Head',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: rows.scopes,
          versions: rows.versions,
          heads: [...rows.heads, ...structuredClone(rows.heads)],
        };
      },
    ],
    [
      'revision 冲突',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: [{ ...rows.scopes[0], revision: 2 }],
          versions: rows.versions,
          heads: rows.heads,
        };
      },
    ],
    [
      'digest 冲突',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: [
            {
              ...rows.scopes[0],
              provisioningReferenceDigest: 'b'.repeat(64),
            },
          ],
          versions: rows.versions,
          heads: rows.heads,
        };
      },
    ],
    [
      'Context 字段冲突',
      (expected: ReturnType<typeof toProvisioningExpectedTriplet>) => {
        const rows = databaseRowsFromExpected(expected);
        return {
          tenants: [{ id: 'tenant-synthetic' }],
          scopes: rows.scopes,
          versions: [{ ...rows.versions[0], currency: 'USD' }],
          heads: rows.heads,
        };
      },
    ],
  ])('%s 经 Kernel + Write Adapter 阻断且 INSERT 为 0', async (
    _name,
    arrange,
  ) => {
    const manifest = createManifest();
    const expected = toProvisioningExpectedTriplet(
      manifest,
      manifest.entries[0],
    );
    const initialRows = arrange(expected);
    const { sql, state } = createFakeSql({ rows: initialRows });
    const before = structuredClone(state.rows);

    await expect(executeWithAdapter(sql)).rejects.toThrow(
      'provisioning_batch_blocked',
    );
    expect(
      state.queries.filter((query) => query.text.startsWith('INSERT INTO')),
    ).toEqual([]);
    expect(state.rows).toEqual(before);
    expect(state.transactionOutcome).toBe('rolled_back');
  });

  it('提交前重检发现漂移时丢弃完整三元组', async () => {
    let scopeReads = 0;
    const { sql, state } = createFakeSql({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: [],
      },
      beforeQuery: (query, staged) => {
        if (!query.text.includes('FROM "public"."institution_scopes"')) {
          return;
        }
        scopeReads += 1;
        if (scopeReads === 2 && staged.scopes[0]) {
          staged.scopes[0].revision = 2;
        }
      },
    });

    await expect(executeWithAdapter(sql)).rejects.toThrow(
      'provisioning_commit_recheck_failed',
    );
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it('affected rows 由 Adapter 精确返回，由调用方判定异常并触发整批回滚', async () => {
    const { sql, state } = createFakeSql({
      insertCounts: { scope: 1, version: 0, head: 1 },
    });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async (repository) => {
          const scopeRows = await repository.insertScope(scopeRow());
          const versionRows =
            await repository.insertContextVersion(versionRow());
          if (scopeRows !== 1 || versionRows !== 1) {
            throw new Error('synthetic_write_count_invalid');
          }
          return repository.insertContextHead(headRow());
        },
      ),
    ).rejects.toThrow('synthetic_write_count_invalid');

    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it.each([
    [
      'Version timeout',
      'INSERT INTO "public"."institution_operating_context_versions"',
      '57014',
      'provisioning_write_timeout',
    ],
    [
      'Head constraint conflict',
      'INSERT INTO "public"."institution_operating_contexts"',
      '23505',
      'provisioning_write_constraint_conflict',
    ],
    [
      'Head serialization failure',
      'INSERT INTO "public"."institution_operating_contexts"',
      '40001',
      'provisioning_write_concurrency_conflict',
    ],
  ])('%s 会回滚此前全部暂存行', async (
    _name,
    queryErrorPattern,
    databaseCode,
    expectedCode,
  ) => {
    const { sql, state } = createFakeSql({
      queryErrorPattern,
      queryError: Object.assign(new Error('raw database detail'), {
        code: databaseCode,
      }),
    });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async (repository) => {
          await repository.insertScope(scopeRow());
          await repository.insertContextVersion(versionRow());
          await repository.insertContextHead(headRow());
        },
      ),
    ).rejects.toThrow(expectedCode);
    expect(state.beginCalls).toBe(1);
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it.each([
    ['Scope 返回 2', { scope: 2, version: 1, head: 1 }],
    ['Version 返回 2', { scope: 1, version: 2, head: 1 }],
    ['Head 返回 0', { scope: 1, version: 1, head: 0 }],
    ['Head 返回 2', { scope: 1, version: 1, head: 2 }],
  ])('%s 时调用方拒绝并回滚完整批次', async (
    _name,
    insertCounts,
  ) => {
    const { sql, state } = createFakeSql({ insertCounts });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async (repository) => {
          const counts = [
            await repository.insertScope(scopeRow()),
            await repository.insertContextVersion(versionRow()),
            await repository.insertContextHead(headRow()),
          ];
          if (counts.some((count) => count !== 1)) {
            throw new Error('synthetic_write_count_invalid');
          }
        },
      ),
    ).rejects.toThrow('synthetic_write_count_invalid');
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it('数据库未返回合法 count 时固定低敏拒绝并回滚', async () => {
    const { sql, state } = createFakeSql({ malformedInsertCount: true });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write((repository) =>
        repository.insertScope(scopeRow()),
      ),
    ).rejects.toThrow('provisioning_write_affected_rows_invalid');
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
  });

  it('回调错误保持原对象且不会提交已经暂存的 Scope', async () => {
    const { sql, state } = createFakeSql();
    const callbackError = new Error('synthetic_callback_failure');

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async (repository) => {
          await repository.insertScope(scopeRow());
          throw callbackError;
        },
      ),
    ).rejects.toBe(callbackError);
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
  });

  it.each([
    ['40001', 'provisioning_write_concurrency_conflict'],
    ['40P01', 'provisioning_write_concurrency_conflict'],
    ['23505', 'provisioning_write_constraint_conflict'],
    ['23503', 'provisioning_write_constraint_conflict'],
    ['23514', 'provisioning_write_constraint_conflict'],
    ['23P01', 'provisioning_write_constraint_conflict'],
    ['42501', 'provisioning_write_query_failed'],
    ['25P03', 'provisioning_write_timeout'],
    ['25P04', 'provisioning_write_timeout'],
    ['57014', 'provisioning_write_timeout'],
    ['55P03', 'provisioning_write_timeout'],
    ['UNKNOWN', 'provisioning_write_query_failed'],
  ])('SQLSTATE %s 只映射为低敏错误码且不自动重试', async (
    databaseCode,
    expectedCode,
  ) => {
    const rawError = Object.assign(
      new Error('raw database detail with unsafe value'),
      { code: databaseCode },
    );
    const { sql, state } = createFakeSql({
      queryErrorPattern: 'INSERT INTO "public"."institution_scopes"',
      queryError: rawError,
    });

    try {
      await createProvisioningWritePostgresAdapter(sql).write(
        (repository) => repository.insertScope(scopeRow()),
      );
      throw new Error('expected write failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ProvisioningWritePostgresError);
      expect(error).toMatchObject({
        code: expectedCode,
        message: expectedCode,
      });
      expect(String(error)).not.toMatch(
        /unsafe|institution_scopes|tenant-synthetic/i,
      );
    }
    expect(state.beginCalls).toBe(1);
    expect(state.transactionOutcome).toBe('rolled_back');
  });

  it('连接不可用在事务前映射为固定低敏错误', async () => {
    const { sql, state } = createFakeSql({
      beginError: Object.assign(new Error('raw connection detail'), {
        code: 'ECONNREFUSED',
      }),
    });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(async () => true),
    ).rejects.toThrow('provisioning_write_connection_unavailable');
    expect(state.beginCalls).toBe(1);
    expect(state.queries).toEqual([]);
  });

  it('缺失键 advisory lock timeout 时零 INSERT 且不重试', async () => {
    const { sql, state } = createFakeSql({
      queryErrorPattern: 'pg_advisory_xact_lock',
      queryError: Object.assign(new Error('raw lock detail'), {
        code: '55P03',
      }),
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: [],
      },
    });

    await expect(executeWithAdapter(sql)).rejects.toThrow(
      'provisioning_batch_blocked',
    );
    expect(state.beginCalls).toBe(1);
    expect(
      state.queries.filter((query) => query.text.startsWith('INSERT INTO')),
    ).toEqual([]);
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it('两个缺失快照并发时只提交一个三元组，失败方不自动重试', async () => {
    const { sql, state } = createFakeSql({
      concurrentCommitCount: 2,
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: [],
      },
    });

    const outcomes = await Promise.allSettled([
      executeWithAdapter(sql),
      executeWithAdapter(sql),
    ]);

    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = outcomes.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({
      code: 'provisioning_transaction_failed',
      message: 'provisioning_transaction_failed',
    });
    expect(state.beginCalls).toBe(2);
    expect(state.rows.scopes).toHaveLength(1);
    expect(state.rows.versions).toHaveLength(1);
    expect(state.rows.heads).toHaveLength(1);
  });

  it('提交阶段 serialization failure 丢弃全部暂存写入且不重试', async () => {
    const serializationError = Object.assign(
      new Error('raw commit detail'),
      { code: '40001' },
    );
    const { sql, state } = createFakeSql({
      commitError: serializationError,
    });

    await expect(
      createProvisioningWritePostgresAdapter(sql).write(
        async (repository) => {
          await repository.insertScope(scopeRow());
          await repository.insertContextVersion(versionRow());
          await repository.insertContextHead(headRow());
        },
      ),
    ).rejects.toThrow('provisioning_write_concurrency_conflict');
    expect(state.beginCalls).toBe(1);
    expect(state.transactionOutcome).toBe('rolled_back');
    expect(state.rows.scopes).toEqual([]);
    expect(state.rows.versions).toEqual([]);
    expect(state.rows.heads).toEqual([]);
  });

  it('事务结束后的逃逸 Repository 固定拒绝且不再发送 SQL', async () => {
    const { sql, state } = createFakeSql();
    const repository = await captureRepository(sql);
    const queryCount = state.queries.length;

    await expect(
      repository.tenantExists('tenant-synthetic'),
    ).rejects.toThrow('provisioning_write_transaction_unavailable');
    await expect(repository.insertScope(scopeRow())).rejects.toThrow(
      'provisioning_write_transaction_unavailable',
    );
    expect(state.queries).toHaveLength(queryCount);
  });

  it('只访问四张读取表和三张写入表，不暴露通用 SQL 能力', async () => {
    vi.stubEnv('DATABASE_URL', 'must-not-be-read');
    const { sql, state } = createFakeSql({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [],
        versions: [],
        heads: [],
      },
    });
    const adapter = createProvisioningWritePostgresAdapter(sql);

    await adapter.write(async (repository) => {
      expect(repository).not.toHaveProperty('query');
      expect(repository).not.toHaveProperty('sql');
      await repository.tenantExists('tenant-synthetic');
      await repository.readTriplet({
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
      });
      await repository.insertScope(scopeRow());
      await repository.insertContextVersion(versionRow());
      await repository.insertContextHead(headRow());
    });

    const readTables = state.queries.flatMap((query) =>
      Array.from(
        query.text.matchAll(
          /\bFROM\s+"public"\."([a-z_]+)"/g,
        ),
        (match) => match[1],
      ),
    );
    const writeTables = state.queries.flatMap((query) =>
      Array.from(
        query.text.matchAll(
          /\bINSERT INTO\s+"public"\."([a-z_]+)"/g,
        ),
        (match) => match[1],
      ),
    );
    expect(new Set(readTables)).toEqual(
      new Set([
        'tenants',
        'institution_scopes',
        'institution_operating_context_versions',
        'institution_operating_contexts',
      ]),
    );
    expect(new Set(writeTables)).toEqual(
      new Set([
        'institution_scopes',
        'institution_operating_context_versions',
        'institution_operating_contexts',
      ]),
    );
    expect(Object.keys(adapter).sort()).toEqual(['read', 'write']);
  });
});
