import type postgres from 'postgres';
import { describe, expect, it, vi } from 'vitest';
import type { ProvisioningRepositoryV1 } from '../provisioning-ports';
import {
  createProvisioningReadonlyPostgresAdapter,
  PROVISIONING_READONLY_IDLE_TIMEOUT_MS,
  PROVISIONING_READONLY_LOCK_TIMEOUT_MS,
  PROVISIONING_READONLY_STATEMENT_TIMEOUT_MS,
  PROVISIONING_READONLY_TRANSACTION_OPTIONS,
  ProvisioningReadonlyPostgresError,
} from '../server/provisioning-readonly-postgres-adapter';

interface QueryRecord {
  readonly text: string;
  readonly values: readonly unknown[];
}

interface FakeSqlState {
  readonly beginOptions: string[];
  readonly queries: QueryRecord[];
  transactionReadOnly: string;
  transactionIsolation: string;
  statementTimeout: string;
  lockTimeout: string;
  idleTimeout: string;
  tenantRows: Record<string, unknown>[];
  scopeRows: Record<string, unknown>[];
  versionRows: Record<string, unknown>[];
  headRows: Record<string, unknown>[];
  beginError: unknown;
  queryErrorPattern: string | null;
  queryError: unknown;
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

function createFakeSql(
  overrides: Partial<FakeSqlState> = {},
): { readonly sql: postgres.Sql; readonly state: FakeSqlState } {
  const state: FakeSqlState = {
    beginOptions: [],
    queries: [],
    transactionReadOnly: 'on',
    transactionIsolation: 'repeatable read',
    statementTimeout: '5s',
    lockTimeout: '1s',
    idleTimeout: '5s',
    tenantRows: [],
    scopeRows: [],
    versionRows: [],
    headRows: [],
    beginError: null,
    queryErrorPattern: null,
    queryError: null,
    ...overrides,
  };

  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const query = normalizeQuery(strings, values);
    state.queries.push(query);
    if (
      state.queryErrorPattern &&
      query.text.includes(state.queryErrorPattern)
    ) {
      throw state.queryError;
    }
    if (query.text.startsWith('SET LOCAL')) {
      return [];
    }
    if (query.text.includes("current_setting('transaction_read_only')")) {
      return [
        {
          transactionReadOnly: state.transactionReadOnly,
          transactionIsolation: state.transactionIsolation,
          statementTimeout: state.statementTimeout,
          lockTimeout: state.lockTimeout,
          idleTimeout: state.idleTimeout,
        },
      ];
    }
    if (query.text.includes('FROM "public"."tenants"')) {
      return structuredClone(state.tenantRows);
    }
    if (query.text.includes('FROM "public"."institution_scopes"')) {
      return structuredClone(state.scopeRows);
    }
    if (
      query.text.includes(
        'FROM "public"."institution_operating_context_versions"',
      )
    ) {
      return structuredClone(state.versionRows);
    }
    if (
      query.text.includes(
        'FROM "public"."institution_operating_contexts"',
      )
    ) {
      return structuredClone(state.headRows);
    }
    throw new Error('unexpected fake query');
  }) as unknown as postgres.TransactionSql;

  const sql = {
    begin: async (
      options: string,
      work: (transactionSql: postgres.TransactionSql) => Promise<unknown>,
    ) => {
      state.beginOptions.push(options);
      if (state.beginError) {
        throw state.beginError;
      }
      return work(transaction);
    },
  } as unknown as postgres.Sql;

  return { sql, state };
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

async function captureRepository(
  sql: postgres.Sql,
): Promise<ProvisioningRepositoryV1> {
  return createProvisioningReadonlyPostgresAdapter(sql).read(
    async (repository) => repository,
  );
}

describe('MIG-01A2 只读 PostgreSQL Adapter', () => {
  it('在同一 REPEATABLE READ／READ ONLY 事务中设置并核验全部 timeout', async () => {
    const { sql, state } = createFakeSql();
    const adapter = createProvisioningReadonlyPostgresAdapter(sql);

    await expect(adapter.read(async () => 'read-complete')).resolves.toBe(
      'read-complete',
    );

    expect(state.beginOptions).toEqual([
      PROVISIONING_READONLY_TRANSACTION_OPTIONS,
    ]);
    expect(PROVISIONING_READONLY_TRANSACTION_OPTIONS).toContain(
      'read only',
    );
    expect(state.queries.map((query) => query.text)).toEqual(
      expect.arrayContaining([
        "SET LOCAL statement_timeout = '5000ms'",
        "SET LOCAL lock_timeout = '1000ms'",
        "SET LOCAL idle_in_transaction_session_timeout = '5000ms'",
      ]),
    );
    expect(
      state.queries.some((query) =>
        query.text.includes(
          "pg_catalog.current_setting('transaction_read_only')",
        ),
      ),
    ).toBe(true);
    expect(PROVISIONING_READONLY_STATEMENT_TIMEOUT_MS).toBe(5_000);
    expect(PROVISIONING_READONLY_LOCK_TIMEOUT_MS).toBe(1_000);
    expect(PROVISIONING_READONLY_IDLE_TIMEOUT_MS).toBe(5_000);
  });

  it('transaction_read_only 不是 on 时在调用 work 前 fail-closed', async () => {
    const { sql } = createFakeSql({ transactionReadOnly: 'off' });
    const work = vi.fn(async () => 'must-not-run');

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read(work),
    ).rejects.toThrow('provisioning_readonly_transaction_not_read_only');
    expect(work).not.toHaveBeenCalled();
  });

  it('transaction_isolation 不是 repeatable read 时 fail-closed', async () => {
    const { sql } = createFakeSql({
      transactionIsolation: 'read committed',
    });

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read(async () => true),
    ).rejects.toThrow('provisioning_readonly_transaction_unavailable');
  });

  it.each([
    ['statementTimeout', { statementTimeout: '0' }],
    ['lockTimeout', { lockTimeout: '0' }],
    ['idleTimeout', { idleTimeout: '0' }],
  ] as const)('拒绝未生效的 %s', async (_name, override) => {
    const { sql } = createFakeSql(override);

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read(async () => true),
    ).rejects.toThrow('provisioning_readonly_timeout');
  });

  it('tenantExists 只查询 tenants.id 并返回 true', async () => {
    const { sql, state } = createFakeSql({
      tenantRows: [{ id: 'tenant-synthetic' }],
    });

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
        repository.tenantExists('tenant-synthetic'),
      ),
    ).resolves.toBe(true);

    const query = state.queries.find((item) =>
      item.text.includes('FROM "public"."tenants"'),
    );
    expect(query?.text).toMatch(
      /^SELECT id FROM "public"\."tenants" /,
    );
    expect(query?.text).not.toMatch(
      /\b(?:name|status|created_at|updated_at)\b/,
    );
    expect(query?.values).toEqual(['tenant-synthetic']);
  });

  it('tenantExists 在父记录不存在时返回 false', async () => {
    const { sql } = createFakeSql({ tenantRows: [] });

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
        repository.tenantExists('tenant-missing'),
      ),
    ).resolves.toBe(false);
  });

  it('readTriplet 显式映射 Scope、Version、Head 且不返回自动时间列', async () => {
    const { sql } = createFakeSql({
      scopeRows: [scopeRow()],
      versionRows: [versionRow()],
      headRows: [headRow()],
    });

    const snapshot =
      await createProvisioningReadonlyPostgresAdapter(sql).read(
        (repository) =>
          repository.readTriplet({
            tenantId: 'tenant-synthetic',
            institutionId: 'institution-synthetic',
          }),
      );

    expect(snapshot).toEqual({
      scopes: [
        {
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
          status: 'active',
          revision: 1,
          provisioningSource: 'approved_migration_manifest',
          provisioningReferenceDigest: 'a'.repeat(64),
          approvedBy: 'approval-ref-synthetic',
          approvedAt: '2026-07-30T00:00:00.000Z',
        },
      ],
      versions: [
        {
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
        },
      ],
      heads: [
        {
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
          revision: 1,
          latestVersion: 1,
          updatedBy: 'approval-ref-synthetic',
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('createdAt');
    expect(JSON.stringify(snapshot)).not.toContain('updatedAt');
  });

  it('空三元组保持三个空数组', async () => {
    const { sql } = createFakeSql();

    const snapshot =
      await createProvisioningReadonlyPostgresAdapter(sql).read(
        (repository) =>
          repository.readTriplet({
            tenantId: 'tenant-missing',
            institutionId: 'institution-missing',
          }),
      );

    expect(snapshot).toEqual({ scopes: [], versions: [], heads: [] });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('保留多 Scope、多 Version、多 Head，并将 Version 按升序返回', async () => {
    const { sql } = createFakeSql({
      scopeRows: [
        scopeRow(),
        scopeRow({ revision: 2, status: 'suspended' }),
      ],
      versionRows: [versionRow(2), versionRow(1)],
      headRows: [headRow(), headRow({ revision: 2 })],
    });

    const snapshot =
      await createProvisioningReadonlyPostgresAdapter(sql).read(
        (repository) =>
          repository.readTriplet({
            tenantId: 'tenant-synthetic',
            institutionId: 'institution-synthetic',
          }),
      );

    expect(snapshot.scopes).toHaveLength(2);
    expect(snapshot.versions.map((row) => row.version)).toEqual([1, 2]);
    expect(snapshot.heads).toHaveLength(2);
  });

  it('Context Version SQL 固定使用 version ASC 且 business date 显式转 text', async () => {
    const { sql, state } = createFakeSql();

    await createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
      repository.readTriplet({
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
      }),
    );

    const query = state.queries.find((item) =>
      item.text.includes(
        'FROM "public"."institution_operating_context_versions"',
      ),
    );
    expect(query?.text).toContain(
      "pg_catalog.to_char( effective_from_business_date, 'YYYY-MM-DD' ) AS \"effectiveFromBusinessDate\"",
    );
    expect(query?.text).toContain('ORDER BY version ASC');
  });

  it.each([
    [
      '未知 Scope status enum',
      { scopeRows: [scopeRow({ status: 'unknown' })] },
    ],
    [
      '当前 Port 未允许的 Provisioning source',
      {
        scopeRows: [
          scopeRow({ provisioningSource: 'formal_onboarding' }),
        ],
      },
    ],
    [
      '未知 Context source enum',
      { versionRows: [versionRow(1, { source: 'unknown' })] },
    ],
  ])('%s 时 fail-closed', async (_name, override) => {
    const { sql } = createFakeSql(override);

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    ).rejects.toThrow('provisioning_readonly_enum_invalid');
  });

  it.each([
    {
      scopeRows: [
        scopeRow({ approvedAt: '2026-07-30T00:00:00Z' }),
      ],
    },
    {
      versionRows: [
        versionRow(1, { effectiveFromBusinessDate: '2026-02-30' }),
      ],
    },
    {
      versionRows: [
        versionRow(1, {
          effectiveAt: '2026-07-30T01:00:00.000001Z',
        }),
      ],
    },
  ])('非法日期或时间固定返回低敏错误', async (override) => {
    const { sql } = createFakeSql(override);

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
        repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        }),
      ),
    ).rejects.toThrow('provisioning_readonly_time_invalid');
  });

  it('原始数据库异常不会泄漏 SQL、双键或错误正文', async () => {
    const { sql } = createFakeSql({
      queryErrorPattern: 'FROM "public"."institution_scopes"',
      queryError: new Error(
        'raw database detail tenant-synthetic password=unsafe',
      ),
    });

    try {
      await createProvisioningReadonlyPostgresAdapter(sql).read(
        (repository) =>
          repository.readTriplet({
            tenantId: 'tenant-synthetic',
            institutionId: 'institution-synthetic',
          }),
      );
      throw new Error('expected adapter read to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ProvisioningReadonlyPostgresError);
      expect(error).toMatchObject({
        code: 'provisioning_readonly_query_failed',
        message: 'provisioning_readonly_query_failed',
      });
      expect(String(error)).not.toMatch(
        /tenant-synthetic|password|institution_scopes/i,
      );
    }
  });

  it('数据库 timeout 只映射为固定错误码', async () => {
    const timeout = Object.assign(new Error('raw timeout detail'), {
      code: '57014',
    });
    const { sql } = createFakeSql({
      queryErrorPattern: 'FROM "public"."tenants"',
      queryError: timeout,
    });

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read((repository) =>
        repository.tenantExists('tenant-synthetic'),
      ),
    ).rejects.toThrow('provisioning_readonly_timeout');
  });

  it('连接不可用只映射为固定错误码', async () => {
    const connectionError = Object.assign(
      new Error('raw localhost connection detail'),
      { code: 'ECONNREFUSED' },
    );
    const { sql } = createFakeSql({ beginError: connectionError });

    await expect(
      createProvisioningReadonlyPostgresAdapter(sql).read(async () => true),
    ).rejects.toThrow('provisioning_readonly_connection_unavailable');
  });

  it('三个 Repository insert 方法全部永久拒绝', async () => {
    const { sql } = createFakeSql();
    const repository = await captureRepository(sql);

    await expect(repository.insertScope({} as never)).rejects.toThrow(
      'provisioning_readonly_write_forbidden',
    );
    await expect(
      repository.insertContextVersion({} as never),
    ).rejects.toThrow('provisioning_readonly_write_forbidden');
    await expect(repository.insertContextHead({} as never)).rejects.toThrow(
      'provisioning_readonly_write_forbidden',
    );
  });

  it('Transaction Port write 永久拒绝且不调用回调', async () => {
    const { sql, state } = createFakeSql();
    const callback = vi.fn(async () => 'must-not-run');
    const adapter = createProvisioningReadonlyPostgresAdapter(sql);

    await expect(adapter.write(callback)).rejects.toThrow(
      'provisioning_readonly_write_forbidden',
    );
    expect(callback).not.toHaveBeenCalled();
    expect(state.beginOptions).toEqual([]);
    expect(state.queries).toEqual([]);
  });

  it('read 回调结束后逃逸 Repository 的读方法固定拒绝且不再发送 SQL', async () => {
    const { sql, state } = createFakeSql();
    const repository = await captureRepository(sql);
    const queryCountAfterTransaction = state.queries.length;

    await expect(
      repository.tenantExists('tenant-synthetic'),
    ).rejects.toThrow('provisioning_readonly_transaction_unavailable');
    await expect(
      repository.readTriplet({
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
      }),
    ).rejects.toThrow('provisioning_readonly_transaction_unavailable');
    expect(state.queries).toHaveLength(queryCountAfterTransaction);
  });

  it('Repository 不暴露通用 query，SQL 只访问四个白名单表', async () => {
    const { sql, state } = createFakeSql({
      tenantRows: [{ id: 'tenant-synthetic' }],
    });

    await createProvisioningReadonlyPostgresAdapter(sql).read(
      async (repository) => {
        expect(repository).not.toHaveProperty('query');
        expect(repository).not.toHaveProperty('sql');
        await repository.tenantExists('tenant-synthetic');
        await repository.readTriplet({
          tenantId: 'tenant-synthetic',
          institutionId: 'institution-synthetic',
        });
      },
    );

    const relationKeywordCount = state.queries.reduce(
      (count, query) =>
        count +
        Array.from(query.text.matchAll(/\b(?:FROM|JOIN)\b/g)).length,
      0,
    );
    const queriedTables = state.queries.flatMap((query) =>
      Array.from(
        query.text.matchAll(
          /\b(?:FROM|JOIN)\s+"public"\."([a-z_]+)"/g,
        ),
        (match) => match[1],
      ),
    );
    expect(queriedTables).toHaveLength(relationKeywordCount);
    expect(new Set(queriedTables)).toEqual(
      new Set([
        'tenants',
        'institution_scopes',
        'institution_operating_context_versions',
        'institution_operating_contexts',
      ]),
    );
    expect(state.queries.map((query) => query.text).join(' ')).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|CREATE|DROP|TRUNCATE)\b/i,
    );
  });

  it('不读取 process.env，也不自行创建或缓存数据库连接', async () => {
    vi.stubEnv('DATABASE_URL', 'must-not-be-read');
    const { sql, state } = createFakeSql();
    const adapter = createProvisioningReadonlyPostgresAdapter(sql);

    await expect(adapter.read(async () => true)).resolves.toBe(true);
    expect(state.beginOptions).toHaveLength(1);
    expect(Object.keys(adapter).sort()).toEqual(['read', 'write']);
  });
});
