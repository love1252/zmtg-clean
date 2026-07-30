import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import type {
  ProvisioningRepositoryV1,
  ProvisioningTripletSnapshotV1,
} from '../provisioning-ports';
import { createProvisioningReadonlyPostgresAdapter } from '../server/provisioning-readonly-postgres-adapter';
import { createProvisioningWritePostgresAdapter } from '../server/provisioning-write-postgres-adapter';

interface ScriptedRows {
  readonly tenants: readonly Record<string, unknown>[];
  readonly scopes: readonly Record<string, unknown>[];
  readonly versions: readonly Record<string, unknown>[];
  readonly heads: readonly Record<string, unknown>[];
}

interface ScriptedSqlOptions {
  readonly rows?: Partial<ScriptedRows>;
  readonly beginError?: unknown;
  readonly queryErrorPattern?: string | null;
  readonly queryError?: unknown;
}

function normalizeQuery(
  strings: TemplateStringsArray,
  values: readonly unknown[],
): string {
  return strings
    .map((part, index) =>
      index < values.length ? `${part}$parameter` : part,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function resultRows(rows: readonly Record<string, unknown>[]): unknown {
  const result = structuredClone(rows) as Record<string, unknown>[];
  Object.defineProperty(result, 'count', {
    enumerable: false,
    value: rows.length,
  });
  return result;
}

function createScriptedSql(
  options: ScriptedSqlOptions = {},
): postgres.Sql {
  const rows: ScriptedRows = {
    tenants: options.rows?.tenants ?? [],
    scopes: options.rows?.scopes ?? [],
    versions: options.rows?.versions ?? [],
    heads: options.rows?.heads ?? [],
  };
  return {
    begin: async (
      beginOptions: string,
      work: (transactionSql: postgres.TransactionSql) => Promise<unknown>,
    ) => {
      if (options.beginError) {
        throw options.beginError;
      }
      const transaction = (async (
        strings: TemplateStringsArray,
        ...values: readonly unknown[]
      ) => {
        const query = normalizeQuery(strings, values);
        if (
          options.queryErrorPattern &&
          query.includes(options.queryErrorPattern)
        ) {
          throw options.queryError;
        }
        if (
          query.startsWith('SET LOCAL') ||
          query.includes('pg_advisory_xact_lock')
        ) {
          return resultRows([]);
        }
        if (query.includes("current_setting('transaction_read_only')")) {
          const readOnly = beginOptions.includes('read only');
          return resultRows([
            {
              transactionReadOnly: readOnly ? 'on' : 'off',
              transactionIsolation: readOnly
                ? 'repeatable read'
                : 'serializable',
              statementTimeout: '5s',
              lockTimeout: '1s',
              idleTimeout: '5s',
            },
          ]);
        }
        if (query.startsWith('SELECT id')) {
          return resultRows(
            rows.tenants.filter((row) => row.id === values[0]),
          );
        }
        if (query.includes('FROM "public"."institution_scopes"')) {
          return resultRows(
            rows.scopes.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        if (
          query.includes(
            'FROM "public"."institution_operating_context_versions"',
          )
        ) {
          return resultRows(
            rows.versions.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        if (
          query.includes(
            'FROM "public"."institution_operating_contexts"',
          )
        ) {
          return resultRows(
            rows.heads.filter(
              (row) =>
                row.tenantId === values[0] &&
                row.institutionId === values[1],
            ),
          );
        }
        throw new Error('unexpected scripted query');
      }) as unknown as postgres.TransactionSql;
      return work(transaction);
    },
  } as unknown as postgres.Sql;
}

async function readCurrentFacts(
  repository: ProvisioningRepositoryV1,
): Promise<{
  readonly tenantExists: boolean;
  readonly snapshot: ProvisioningTripletSnapshotV1;
}> {
  return {
    tenantExists: await repository.tenantExists('tenant-synthetic'),
    snapshot: await repository.readTriplet({
      tenantId: 'tenant-synthetic',
      institutionId: 'institution-synthetic',
    }),
  };
}

async function runAllReadPaths(
  options: ScriptedSqlOptions,
): Promise<readonly unknown[]> {
  const readonlyResult = await createProvisioningReadonlyPostgresAdapter(
    createScriptedSql(options),
  ).read(readCurrentFacts);
  const writeReadResult = await createProvisioningWritePostgresAdapter(
    createScriptedSql(options),
  ).read(readCurrentFacts);
  const writeTransactionResult =
    await createProvisioningWritePostgresAdapter(
      createScriptedSql(options),
    ).write(readCurrentFacts);
  return [readonlyResult, writeReadResult, writeTransactionResult];
}

function scopeRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    status: 'active',
    revision: 1,
    provisioningSource: 'approved_migration_manifest',
    provisioningReferenceDigest: 'a'.repeat(64),
    approvedBy: 'approval-ref-synthetic',
    approvedAt: '2026-07-30T00:00:00.000000Z',
    ...overrides,
  };
}

function versionRow(
  version = 1,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    version,
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    effectiveFromBusinessDate: '2026-07-30',
    effectiveAt: `2026-07-30T0${version}:00:00.000000Z`,
    source: 'institution_config',
    migrationProvenance: null,
    createdBy: 'approval-ref-synthetic',
    ...overrides,
  };
}

function headRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: 'tenant-synthetic',
    institutionId: 'institution-synthetic',
    revision: 1,
    latestVersion: 1,
    updatedBy: 'approval-ref-synthetic',
    ...overrides,
  };
}

async function rejectedCode(operation: () => Promise<unknown>) {
  try {
    await operation();
    throw new Error('expected operation to fail');
  } catch (error) {
    if (
      error === null ||
      typeof error !== 'object' ||
      typeof Reflect.get(error, 'code') !== 'string'
    ) {
      throw error;
    }
    return Reflect.get(error, 'code') as string;
  }
}

function semanticErrorCategory(code: string): string {
  return code.replace(/^provisioning_(?:readonly|write)_/, '');
}

describe('MIG-01A2 PostgreSQL Adapter 读取语义一致性', () => {
  it('tenant 不存在且三元组全空时三条路径均保持空事实', async () => {
    const results = await runAllReadPaths({});

    expect(results[1]).toStrictEqual(results[0]);
    expect(results[2]).toStrictEqual(results[0]);
    expect(results[0]).toEqual({
      tenantExists: false,
      snapshot: { scopes: [], versions: [], heads: [] },
    });
  });

  it('tenant、三元组、时间和 nullable provenance 三条路径完全一致', async () => {
    const results = await runAllReadPaths({
      rows: {
        tenants: [{ id: 'tenant-synthetic' }],
        scopes: [scopeRow()],
        versions: [versionRow()],
        heads: [headRow()],
      },
    });

    expect(results[1]).toStrictEqual(results[0]);
    expect(results[2]).toStrictEqual(results[0]);
    expect(results[0]).toEqual({
      tenantExists: true,
      snapshot: {
        scopes: [
          {
            ...scopeRow(),
            approvedAt: '2026-07-30T00:00:00.000Z',
          },
        ],
        versions: [
          {
            ...versionRow(),
            effectiveAt: '2026-07-30T01:00:00.000Z',
          },
        ],
        heads: [headRow()],
      },
    });
    expect(JSON.stringify(results)).not.toMatch(/createdAt|updatedAt/);
  });

  it('空、部分和重复行保持一致，Version 都按升序且不去重', async () => {
    const results = await runAllReadPaths({
      rows: {
        tenants: [],
        scopes: [scopeRow(), scopeRow({ revision: 2 })],
        versions: [versionRow(2), versionRow(1)],
        heads: [],
      },
    });

    expect(results[1]).toStrictEqual(results[0]);
    expect(results[2]).toStrictEqual(results[0]);
    const first = results[0] as Awaited<
      ReturnType<typeof readCurrentFacts>
    >;
    expect(first.tenantExists).toBe(false);
    expect(first.snapshot.scopes).toHaveLength(2);
    expect(first.snapshot.versions.map((row) => row.version)).toEqual([
      1, 2,
    ]);
    expect(first.snapshot.heads).toEqual([]);
  });

  it('查询参数只返回目标双键，不会泄漏相邻租户事实', async () => {
    const results = await runAllReadPaths({
      rows: {
        tenants: [
          { id: 'tenant-other' },
          { id: 'tenant-synthetic' },
        ],
        scopes: [
          scopeRow({
            tenantId: 'tenant-other',
            institutionId: 'institution-other',
          }),
          scopeRow(),
        ],
        versions: [
          versionRow(1, {
            tenantId: 'tenant-other',
            institutionId: 'institution-other',
          }),
          versionRow(),
        ],
        heads: [
          headRow({
            tenantId: 'tenant-other',
            institutionId: 'institution-other',
          }),
          headRow(),
        ],
      },
    });

    expect(results[1]).toStrictEqual(results[0]);
    expect(results[2]).toStrictEqual(results[0]);
    const facts = results[0] as Awaited<
      ReturnType<typeof readCurrentFacts>
    >;
    expect(facts.tenantExists).toBe(true);
    expect(facts.snapshot.scopes).toHaveLength(1);
    expect(facts.snapshot.versions).toHaveLength(1);
    expect(facts.snapshot.heads).toHaveLength(1);
    expect(JSON.stringify(facts)).not.toContain('tenant-other');
  });

  it.each([
    [
      '未知 Scope enum',
      { scopes: [scopeRow({ status: 'unknown' })] },
      'enum_invalid',
    ],
    [
      '未知 Context source',
      { versions: [versionRow(1, { source: 'unknown' })] },
      'enum_invalid',
    ],
    [
      '非法 digest shape',
      {
        scopes: [scopeRow({ provisioningReferenceDigest: 'invalid' })],
      },
      'row_shape_invalid',
    ],
    [
      '额外 Scope 字段',
      { scopes: [scopeRow({ unexpected: 'forbidden' })] },
      'row_shape_invalid',
    ],
    [
      '非毫秒对齐时间',
      {
        versions: [
          versionRow(1, {
            effectiveAt: '2026-07-30T01:00:00.000001Z',
          }),
        ],
      },
      'time_invalid',
    ],
  ])('%s 的低敏错误类别一致', async (
    _name,
    rows,
    expectedCategory,
  ) => {
    const readonlyCode = await rejectedCode(() =>
      createProvisioningReadonlyPostgresAdapter(
        createScriptedSql({ rows }),
      ).read((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    );
    const writeCode = await rejectedCode(() =>
      createProvisioningWritePostgresAdapter(
        createScriptedSql({ rows }),
      ).write((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    );

    expect(semanticErrorCategory(readonlyCode)).toBe(expectedCategory);
    expect(semanticErrorCategory(writeCode)).toBe(expectedCategory);
  });

  it('tenant 重复行在两类 Adapter 中均按 row_shape_invalid 拒绝', async () => {
    const rows = {
      tenants: [
        { id: 'tenant-synthetic' },
        { id: 'tenant-synthetic' },
      ],
    };
    const readonlyCode = await rejectedCode(() =>
      createProvisioningReadonlyPostgresAdapter(
        createScriptedSql({ rows }),
      ).read((repository) =>
        repository.tenantExists('tenant-synthetic'),
      ),
    );
    const writeCode = await rejectedCode(() =>
      createProvisioningWritePostgresAdapter(
        createScriptedSql({ rows }),
      ).write((repository) =>
        repository.tenantExists('tenant-synthetic'),
      ),
    );

    expect(semanticErrorCategory(readonlyCode)).toBe(
      'row_shape_invalid',
    );
    expect(semanticErrorCategory(writeCode)).toBe('row_shape_invalid');
  });

  it.each([
    [
      'Scope SELECT timeout',
      'FROM "public"."institution_scopes"',
      '57014',
      'timeout',
    ],
    [
      'Version SELECT timeout',
      'FROM "public"."institution_operating_context_versions"',
      '55P03',
      'timeout',
    ],
    [
      'Head SELECT generic failure',
      'FROM "public"."institution_operating_contexts"',
      'UNKNOWN',
      'query_failed',
    ],
    [
      'Scope SELECT permission failure',
      'FROM "public"."institution_scopes"',
      '42501',
      'query_failed',
    ],
  ])('%s 的低敏类别一致且不泄漏原始正文', async (
    _name,
    queryErrorPattern,
    databaseCode,
    expectedCategory,
  ) => {
    const rawError = Object.assign(
      new Error('raw database detail tenant-synthetic secret-value'),
      { code: databaseCode },
    );
    const options = {
      queryErrorPattern,
      queryError: rawError,
    };
    const readonlyCode = await rejectedCode(() =>
      createProvisioningReadonlyPostgresAdapter(
        createScriptedSql(options),
      ).read((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    );
    const writeCode = await rejectedCode(() =>
      createProvisioningWritePostgresAdapter(
        createScriptedSql(options),
      ).write((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    );

    expect(semanticErrorCategory(readonlyCode)).toBe(expectedCategory);
    expect(semanticErrorCategory(writeCode)).toBe(expectedCategory);
    expect(readonlyCode).not.toMatch(/tenant|secret|institution_scopes/i);
    expect(writeCode).not.toMatch(/tenant|secret|institution_scopes/i);
  });

  it('连接失败在两类事务中均映射为低敏 connection_unavailable', async () => {
    const beginError = Object.assign(new Error('raw connection detail'), {
      code: 'ECONNREFUSED',
    });
    const readonlyCode = await rejectedCode(() =>
      createProvisioningReadonlyPostgresAdapter(
        createScriptedSql({ beginError }),
      ).read(async () => true),
    );
    const writeCode = await rejectedCode(() =>
      createProvisioningWritePostgresAdapter(
        createScriptedSql({ beginError }),
      ).write(async () => true),
    );

    expect(semanticErrorCategory(readonlyCode)).toBe(
      'connection_unavailable',
    );
    expect(semanticErrorCategory(writeCode)).toBe(
      'connection_unavailable',
    );
  });

  it('Write Adapter 的 read 路径与 ReadOnly Adapter 使用相同永久拒写边界', async () => {
    const readonlySql = createScriptedSql();
    const writeSql = createScriptedSql();

    const readonlyError = await rejectedCode(() =>
      createProvisioningReadonlyPostgresAdapter(readonlySql).read(
        (repository) => repository.insertScope({} as never),
      ),
    );
    const writeReadError = await rejectedCode(() =>
      createProvisioningWritePostgresAdapter(writeSql).read(
        (repository) => repository.insertScope({} as never),
      ),
    );

    expect(writeReadError).toBe(readonlyError);
    expect(readonlyError).toBe('provisioning_readonly_write_forbidden');
  });
});
