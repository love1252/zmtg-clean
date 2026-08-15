import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertMigrationAllowed,
  runGuardedMigration,
} from '../../../../scripts/db/guarded-migrate.mjs';

type JournalEntry = Record<string, unknown>;
type TestEnvironment = Record<string, string | undefined>;
type ActualMigrationRow = { id: number; hash: string; created_at: number | null };

const fixtureArtifact = 'CREATE TABLE "fixture" ("id" text PRIMARY KEY);\n';
const fixtureSchemaFingerprint = '0c34851b8a88d394db55a2e5527086f8e97765ee429bb26d7ea3b6a3709b2eeb';

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function gitBlob(value: string | Buffer) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function validJournalEntries(): JournalEntry[] {
  return [
    { idx: 0, version: '7', when: 1_700_000_000_000, tag: '0000_initial', breakpoints: true },
    { idx: 1, version: '7', when: 1_700_000_000_001, tag: '0001_middle', breakpoints: true },
    { idx: 2, version: '7', when: 1_785_738_060_856, tag: '0045_base02_binding_legacy_calibration', breakpoints: true },
  ];
}

function writeJournal(rootDir: string, entries: unknown = validJournalEntries()) {
  writeFileSync(join(rootDir, 'drizzle/meta/_journal.json'), JSON.stringify({ entries }));
}

function createMigrationFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), 'zmtg-migration-guard-'));
  mkdirSync(join(rootDir, 'drizzle/meta'), { recursive: true });
  writeJournal(rootDir);
  writeFileSync(join(rootDir, 'drizzle/0000_initial.sql'), '-- reviewed');
  writeFileSync(join(rootDir, 'drizzle/0001_middle.sql'), '-- reviewed');
  writeFileSync(join(rootDir, 'drizzle/0045_base02_binding_legacy_calibration.sql'), '-- reviewed');
  writeBaselineContract(rootDir);
  return rootDir;
}

function writeBaselineContract(
  rootDir: string,
  {
    parentTag = '0045_base02_binding_legacy_calibration',
    parentWhen = 1_785_738_060_856,
  } = {},
) {
  const artifactPath = 'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql';
  const manifestPath = 'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json';
  const artifact = fixtureArtifact;
  const toolingSources = {
    'scripts/db/guarded-migrate.mjs': 'export const fixtureGuard = true;\n',
    'scripts/db/sys01-controlled-local-dev-rebuild.mjs': 'export const fixtureRunner = true;\n',
  };
  for (const [relativePath, source] of Object.entries(toolingSources)) {
    mkdirSync(join(rootDir, 'scripts/db'), { recursive: true });
    writeFileSync(join(rootDir, relativePath), source);
  }
  const manifest = {
    artifactPath,
    artifactSha256: sha256(artifact),
    canonicalizationVersion: 'zmtg.catalog.logical-objects/v2',
    createdByContractVersion: 'zmtg.sys01.controlled-local-dev-rebuild/v1',
    parentJournalTag: parentTag,
    parentJournalWhen: parentWhen,
    schemaFingerprintSha256: fixtureSchemaFingerprint,
    schemaSource: {
      catalogObjectCounts: {
        checks: 63,
        columns: 853,
        defaults: 227,
        enums: 59,
        foreignKeys: 110,
        functions: 4,
        indexes: 136,
        nullability: 853,
        primaryKeys: 60,
        schemas: 1,
        sequences: 0,
        tables: 60,
        triggers: 7,
        types: 59,
        uniques: 51,
      },
      drizzleKitVersion: '0.31.10',
      drizzleOrmVersion: '0.45.2',
      generationCommand:
        'pnpm exec drizzle-kit export --schema ./src/server/db/schema.ts --dialect postgresql',
      modelSource: 'src/server/db/schema.ts',
      reviewedHandWrittenFinalCatalog: [
        'two_not_valid_foreign_keys',
        'two_historical_enum_orders',
        'four_trigger_functions',
        'seven_enabled_triggers',
      ],
    },
    sourceBaselineCommit: '5d40cfb0e0862e2b11208918c21808571e67c6db',
    toolingBlobs: Object.fromEntries(
      Object.entries(toolingSources).map(([relativePath, source]) => [relativePath, gitBlob(source)]),
    ),
    version: 'zmtg.sys01.local-dev-current-schema-baseline/v1',
  };
  mkdirSync(join(rootDir, 'drizzle/baselines'), { recursive: true });
  writeFileSync(join(rootDir, artifactPath), artifact);
  const manifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(join(rootDir, manifestPath), manifestSource);
  return { markerHash: sha256(manifestSource), manifestSource };
}

function legacyRows(rootDir: string, count = validJournalEntries().length): ActualMigrationRow[] {
  const entries = JSON.parse(
    readFileSync(join(rootDir, 'drizzle/meta/_journal.json'), 'utf8'),
  ).entries as JournalEntry[];
  return entries.slice(0, count).map((entry, index) => ({
    id: index + 1,
    hash: sha256(readFileSync(join(rootDir, `drizzle/${String(entry.tag)}.sql`))),
    created_at: Number(entry.when),
  }));
}

function databaseState(
  journalRows: ActualMigrationRow[],
  schemaFingerprintSha256: string | null = null,
  journalShape: unknown = {
    relationKind: 'r',
    columns: [
      { name: 'id', type: 'integer', nullable: false, defaultKind: 'serial_sequence' },
      { name: 'hash', type: 'text', nullable: false, defaultKind: 'none' },
      { name: 'created_at', type: 'bigint', nullable: true, defaultKind: 'none' },
    ],
    primaryKeyColumns: ['id'],
    nonPrimaryConstraints: [],
    nonConstraintIndexes: [],
    userTriggers: [],
  },
) {
  return vi.fn(async () => ({
    journalRows,
    journalTableExists: true,
    journalShape,
    schemaFingerprintSha256,
  }));
}

function successfulSpawn() {
  const child = new EventEmitter();
  const spawnImpl = vi.fn(() => {
    queueMicrotask(() => child.emit('close', 0));
    return child;
  });
  return spawnImpl;
}

async function runWithDatabaseState(
  options: Record<string, unknown>,
  journalRows = legacyRows(String(options.rootDir)),
  schemaFingerprintSha256: string | null = null,
) {
  const run = runGuardedMigration as unknown as (
    value: Record<string, unknown>,
  ) => Promise<unknown>;
  return run({
    ...options,
    assertBaselineToolingImpl: async () => undefined,
    readDatabaseStateImpl: databaseState(journalRows, schemaFingerprintSha256),
  });
}

function localEnv(overrides: TestEnvironment = {}): TestEnvironment {
  return {
    ZMTG_DB_MIGRATION_TARGET: 'local',
    DATABASE_URL: 'postgres://guard-user:local-password@localhost:5432/zmtg_local',
    ...overrides,
  };
}

function productionEnv(overrides: TestEnvironment = {}): TestEnvironment {
  return {
    ZMTG_DB_MIGRATION_TARGET: 'production',
    DATABASE_URL: 'postgres://guard-user:production-password@db.internal:5432/zmtg_production',
    ZMTG_DB_MIGRATION_CONFIRMATION: 'MIGRATE_PRODUCTION',
    ZMTG_DB_MIGRATION_APPROVAL_REF: 'CHANGE-0001',
    ZMTG_DB_MIGRATION_EXPECTED_HOST: 'db.internal',
    ZMTG_DB_MIGRATION_EXPECTED_DATABASE: 'zmtg_production',
    ZMTG_DB_MIGRATION_EXPECTED_CURRENT: '0000_initial',
    ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,0045_base02_binding_legacy_calibration',
    ZMTG_DB_MIGRATION_EXPECTED_TARGET: '0045_base02_binding_legacy_calibration',
    ...overrides,
  };
}

describe('production migration guard', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = createMigrationFixture();
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('默认拒绝且缺少 DATABASE_URL 时拒绝', () => {
    expect(() => assertMigrationAllowed({}, rootDir)).toThrow('ZMTG_DB_MIGRATION_TARGET');
    expect(() =>
      assertMigrationAllowed({ ZMTG_DB_MIGRATION_TARGET: 'local' }, rootDir),
    ).toThrow('DATABASE_URL');
  });

  it('local 模式只允许 localhost、127.0.0.1 或 ::1', () => {
    expect(() =>
      assertMigrationAllowed(localEnv({ DATABASE_URL: 'postgres://user:pw@remote/demo' }), rootDir),
    ).toThrow('loopback');
    expect(assertMigrationAllowed(localEnv(), rootDir).target).toBe('local');
    expect(
      assertMigrationAllowed(
        localEnv({ DATABASE_URL: 'postgres://user:pw@127.0.0.1/demo_local' }),
        rootDir,
      ).target,
    ).toBe('local');
    expect(
      assertMigrationAllowed(
        localEnv({ DATABASE_URL: 'postgres://user:pw@[::1]/demo_local' }),
        rootDir,
      ).target,
    ).toBe('local');
  });

  it('production 缺人工确认、确认错误或缺 approval ref 时拒绝', () => {
    expect(() =>
      assertMigrationAllowed(productionEnv({ ZMTG_DB_MIGRATION_CONFIRMATION: undefined }), rootDir),
    ).toThrow('ZMTG_DB_MIGRATION_CONFIRMATION');
    expect(() =>
      assertMigrationAllowed(productionEnv({ ZMTG_DB_MIGRATION_CONFIRMATION: 'WRONG' }), rootDir),
    ).toThrow('确认字符串不匹配');
    expect(() =>
      assertMigrationAllowed(productionEnv({ ZMTG_DB_MIGRATION_APPROVAL_REF: undefined }), rootDir),
    ).toThrow('ZMTG_DB_MIGRATION_APPROVAL_REF');
  });

  it('production host/database 与预期不匹配时拒绝', () => {
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_HOST: 'other.internal' }),
        rootDir,
      ),
    ).toThrow('host/database');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_DATABASE: 'other_production' }),
        rootDir,
      ),
    ).toThrow('host/database');
  });

  it('production expected target 必须是 journal 最新 migration', () => {
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_TARGET: '0001_middle' }),
        rootDir,
      ),
    ).toThrow('expected target');
  });

  it('production expected current 必须已存在且早于 target', () => {
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_CURRENT: '9999_unknown' }),
        rootDir,
      ),
    ).toThrow('expected current 不在');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_CURRENT: '0045_base02_binding_legacy_calibration' }),
        rootDir,
      ),
    ).toThrow('必须早于');
  });

  it('production allowlist 必须精确覆盖全部 pending migrations', () => {
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0045_base02_binding_legacy_calibration' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({
          ZMTG_DB_MIGRATION_ALLOWLIST: '0000_initial,0001_middle,0045_base02_binding_legacy_calibration',
        }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,0045_base02_binding_legacy_calibration,0045_base02_binding_legacy_calibration' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,,0045_base02_binding_legacy_calibration' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');

    expect(assertMigrationAllowed(productionEnv(), rootDir).pendingMigrations).toEqual([
      '0001_middle',
      '0045_base02_binding_legacy_calibration',
    ]);
  });

  it('journal 文件缺失时失败关闭', () => {
    rmSync(join(rootDir, 'drizzle/meta/_journal.json'));
    expect(() => assertMigrationAllowed(localEnv(), rootDir)).toThrow('无法读取 migration journal');
  });

  it('journal 引用的 SQL 文件缺失时失败关闭', () => {
    rmSync(join(rootDir, 'drizzle/0001_middle.sql'));
    expect(() => assertMigrationAllowed(localEnv(), rootDir)).toThrow('未知或缺失');
  });

  it.each([
    ['entry 不是 object', [validJournalEntries()[0], null, validJournalEntries()[2]]],
    [
      'idx 不连续',
      validJournalEntries().map((entry, index) => (index === 1 ? { ...entry, idx: 9 } : entry)),
    ],
    [
      'version 为空',
      validJournalEntries().map((entry, index) =>
        index === 1 ? { ...entry, version: '' } : entry,
      ),
    ],
    [
      'when 不是整数',
      validJournalEntries().map((entry, index) =>
        index === 1 ? { ...entry, when: 1_700_000_000_001.5 } : entry,
      ),
    ],
    [
      'when 不严格递增',
      validJournalEntries().map((entry, index) =>
        index === 1 ? { ...entry, when: 1_700_000_000_000 } : entry,
      ),
    ],
    [
      'tag 为空',
      validJournalEntries().map((entry, index) => (index === 1 ? { ...entry, tag: '' } : entry)),
    ],
    [
      'breakpoints 不是 boolean',
      validJournalEntries().map((entry, index) =>
        index === 1 ? { ...entry, breakpoints: 'true' } : entry,
      ),
    ],
    [
      'tag 重复',
      validJournalEntries().map((entry, index) =>
        index === 1 ? { ...entry, tag: '0000_initial' } : entry,
      ),
    ],
  ])('journal malformed entry（%s）不得被静默忽略', (_caseName, entries) => {
    writeJournal(rootDir, entries);
    expect(() => assertMigrationAllowed(localEnv(), rootDir)).toThrow('migration journal 无效');
  });

  it('production 发现 journal 外未知 migration 文件时拒绝', () => {
    writeFileSync(join(rootDir, 'drizzle/0003_unknown.sql'), '-- not reviewed');
    expect(() => assertMigrationAllowed(productionEnv(), rootDir)).toThrow('未知或缺失');
  });

  it('guard 失败日志不泄露密码且不会调用 drizzle-kit', async () => {
    const password = 'migration-guard-secret-password';
    const spawnImpl = vi.fn();
    let message = '';

    try {
      await runGuardedMigration({
        rootDir,
        env: localEnv({ DATABASE_URL: `postgres://user:${password}@remote/demo` }),
        spawnImpl,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(password);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('child error 中的 URL、密码和 secret 不会进入错误或日志', async () => {
    const secret = 'child-process-secret-password';
    const databaseUrl = `postgres://guard-user:${secret}@localhost:5432/zmtg_local`;
    const child = new EventEmitter();
    const spawnImpl = vi.fn(() => child);
    const logger = { info: vi.fn() };
    const promise = runWithDatabaseState({
      rootDir,
      env: localEnv({ DATABASE_URL: databaseUrl }),
      spawnImpl,
      logger,
    });
    await vi.waitFor(() => expect(spawnImpl).toHaveBeenCalledOnce());
    child.emit('error', new Error(`spawn failed: ${databaseUrl}; secret=${secret}`));

    let message = '';
    try {
      await promise;
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    const logged = logger.info.mock.calls.flat().join(' ');
    expect(message).toBe('migration 执行失败');
    expect(`${message} ${logged}`).not.toContain(secret);
    expect(`${message} ${logged}`).not.toContain(databaseUrl);
    expect(spawnImpl).toHaveBeenCalledWith(
      process.execPath,
      [join(rootDir, 'node_modules/drizzle-kit/bin.cjs'), 'migrate'],
      expect.objectContaining({ stdio: ['ignore', 'ignore', 'ignore'] }),
    );
  });

  it('spawn 同步异常中的 URL、密码和 secret 不会外泄', async () => {
    const secret = 'synchronous-spawn-secret-password';
    const databaseUrl = `postgres://guard-user:${secret}@localhost:5432/zmtg_local`;
    const spawnImpl = vi.fn(() => {
      throw new Error(`spawn failed: ${databaseUrl}; secret=${secret}`);
    });

    let message = '';
    try {
      await runWithDatabaseState({
        rootDir,
        env: localEnv({ DATABASE_URL: databaseUrl }),
        spawnImpl,
        logger: { info: vi.fn() },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe('migration 执行失败');
    expect(message).not.toContain(secret);
    expect(message).not.toContain(databaseUrl);
  });

  it('child listener 异常中的 URL、密码和 secret 不会外泄', async () => {
    const secret = 'child-listener-secret-password';
    const databaseUrl = `postgres://guard-user:${secret}@localhost:5432/zmtg_local`;
    const spawnImpl = vi.fn(() => ({
      once: () => {
        throw new Error(`listener failed: ${databaseUrl}; secret=${secret}`);
      },
    }));

    let message = '';
    try {
      await runWithDatabaseState({
        rootDir,
        env: localEnv({ DATABASE_URL: databaseUrl }),
        spawnImpl,
        logger: { info: vi.fn() },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe('migration 执行失败');
    expect(message).not.toContain(secret);
    expect(message).not.toContain(databaseUrl);
  });

  it('检查全部通过后使用当前 Node 直接调用 drizzle-kit 且忽略子进程输出', async () => {
    const child = new EventEmitter();
    const spawnImpl = vi.fn(() => child);
    const logger = { info: vi.fn() };
    const promise = runWithDatabaseState({ rootDir, env: localEnv(), spawnImpl, logger });
    await vi.waitFor(() => expect(spawnImpl).toHaveBeenCalledOnce());
    child.emit('close', 0);
    await promise;

    expect(spawnImpl).toHaveBeenCalledWith(
      process.execPath,
      [join(rootDir, 'node_modules/drizzle-kit/bin.cjs'), 'migrate'],
      expect.objectContaining({
        cwd: rootDir,
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore'],
      }),
    );
    expect(logger.info.mock.calls.flat().join(' ')).not.toContain('local-password');
  });

  it('production actual strict prefix 与 expected current 一致时保留既有成功执行路径', async () => {
    const spawnImpl = successfulSpawn();
    await runWithDatabaseState(
      { rootDir, env: productionEnv(), spawnImpl, logger: { info: vi.fn() } },
      legacyRows(rootDir, 1),
    );
    expect(spawnImpl).toHaveBeenCalledOnce();
  });

  it.each([0, 1, 3])('legacy origin 接受 repository strict prefix（rows=%s）', async (count) => {
    const spawnImpl = successfulSpawn();
    await runWithDatabaseState(
      { rootDir, env: localEnv(), spawnImpl, logger: { info: vi.fn() } },
      legacyRows(rootDir, count),
    );
    expect(spawnImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['hash drift', (rows: ActualMigrationRow[]) => [{ ...rows[0], hash: 'cd'.repeat(32) }, ...rows.slice(1)]],
    ['timestamp drift', (rows: ActualMigrationRow[]) => [{ ...rows[0], created_at: 9 }, ...rows.slice(1)]],
    ['null created_at', (rows: ActualMigrationRow[]) => [{ ...rows[0], created_at: null }, ...rows.slice(1)]],
    ['gap', (rows: ActualMigrationRow[]) => [rows[0], rows[2]]],
    ['id gap', (rows: ActualMigrationRow[]) => [rows[0], { ...rows[1], id: 3 }]],
    ['unknown row', (rows: ActualMigrationRow[]) => [...rows, { id: 99, hash: 'ef'.repeat(32), created_at: 1_800_000_000_000 }]],
  ])('legacy origin 对 %s 失败关闭', async (_name, mutate) => {
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        { rootDir, env: localEnv(), spawnImpl, logger: { info: vi.fn() } },
        mutate(legacyRows(rootDir)),
      ),
    ).rejects.toThrow('migration');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('baseline marker-only origin 在 exact candidate identity 与 schema fingerprint 下通过', async () => {
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = successfulSpawn();
    await runWithDatabaseState(
      {
        rootDir,
        env: localEnv({
          DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
          ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
        }),
        spawnImpl,
        logger: { info: vi.fn() },
      },
      [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }],
      fixtureSchemaFingerprint,
    );
    expect(spawnImpl).toHaveBeenCalledOnce();
  });

  it('baseline origin 默认要求 clean HEAD、source-base ancestor 与 reviewed tooling blobs', () => {
    const guardSource = readFileSync(
      join(process.cwd(), 'scripts/db/guarded-migrate.mjs'),
      'utf8',
    );
    expect(guardSource).toContain("['status', '--porcelain']");
    expect(guardSource).toContain("['merge-base', '--is-ancestor', baselineSourceCommit, 'HEAD']");
    expect(guardSource).toContain("['show', `HEAD:${relativePath}`]");
  });

  it('baseline origin 接受 marker 后的 exact future common tail', async () => {
    const futureEntries = [
      ...validJournalEntries(),
      {
        idx: 3,
        version: '7',
        when: 1_785_738_060_857,
        tag: '0046_future_common_tail',
        breakpoints: true,
      },
    ];
    writeJournal(rootDir, futureEntries);
    writeFileSync(join(rootDir, 'drizzle/0046_future_common_tail.sql'), '-- future reviewed');
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = successfulSpawn();
    await runWithDatabaseState(
      {
        rootDir,
        env: localEnv({
          DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
          ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
        }),
        spawnImpl,
        logger: { info: vi.fn() },
      },
      [
        { id: 1, hash: markerHash, created_at: 1_785_738_060_856 },
        { ...legacyRows(rootDir, 4)[3], id: 2 },
      ],
      null,
    );
    expect(spawnImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['tail hash drift', (row: ActualMigrationRow) => ({ ...row, hash: 'cd'.repeat(32) })],
    ['tail timestamp drift', (row: ActualMigrationRow) => ({ ...row, created_at: row.created_at! + 1 })],
    ['unknown tail', (_row: ActualMigrationRow) => ({ id: 2, hash: 'ef'.repeat(32), created_at: 1_785_738_060_858 })],
  ])('baseline common tail 对 %s 失败关闭', async (_name, mutate) => {
    const futureEntries = [
      ...validJournalEntries(),
      { idx: 3, version: '7', when: 1_785_738_060_857, tag: '0046_future_common_tail', breakpoints: true },
    ];
    writeJournal(rootDir, futureEntries);
    writeFileSync(join(rootDir, 'drizzle/0046_future_common_tail.sql'), '-- future reviewed');
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        [
          { id: 1, hash: markerHash, created_at: 1_785_738_060_856 },
          mutate({ ...legacyRows(rootDir, 4)[3], id: 2 }),
        ],
        null,
      ),
    ).rejects.toThrow('common-tail');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['mixed lineage', (markerHash: string) => [legacyRows(rootDir)[0], { id: 2, hash: markerHash, created_at: 1_785_738_060_856 }]],
    ['double marker', (markerHash: string) => [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }, { id: 2, hash: markerHash, created_at: 1_785_738_060_857 }]],
  ])('baseline origin 拒绝 %s', async (_name, rowsForMarker) => {
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        rowsForMarker(markerHash),
        fixtureSchemaFingerprint,
      ),
    ).rejects.toThrow('migration');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('baseline marker-only schema fingerprint 漂移时拒绝', async () => {
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }],
        'ff'.repeat(32),
      ),
    ).rejects.toThrow('schema fingerprint');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('baseline 模式缺少 marker 时拒绝且 local legacy 模式拒绝 marker', async () => {
    const { markerHash } = writeBaselineContract(rootDir);
    const baselineEnv = localEnv({
      DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
      ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
    });
    const baselineSpawn = vi.fn();
    await expect(
      runWithDatabaseState(
        { rootDir, env: baselineEnv, spawnImpl: baselineSpawn, logger: { info: vi.fn() } },
        [],
        fixtureSchemaFingerprint,
      ),
    ).rejects.toThrow('marker 缺失');
    expect(baselineSpawn).not.toHaveBeenCalled();

    const legacySpawn = vi.fn();
    await expect(
      runWithDatabaseState(
        { rootDir, env: localEnv(), spawnImpl: legacySpawn, logger: { info: vi.fn() } },
        [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }],
      ),
    ).rejects.toThrow('legacy 模式不允许 baseline marker');
    expect(legacySpawn).not.toHaveBeenCalled();
  });

  it.each([
    'postgres://guard-user:local-password@localhost:55434/zmtg_clean_local_dev_candidate',
    'postgres://guard-user:local-password@[::1]:55434/zmtg_clean_local_dev_candidate',
    'postgres://guard-user:local-password@127.0.0.1:55433/zmtg_clean_local_dev_candidate',
    'postgres://guard-user:local-password@127.0.0.1:55434/wrong_candidate',
  ])('baseline origin 仅允许 exact candidate host/database/port（%s）', async (databaseUrl) => {
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: databaseUrl,
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }],
        fixtureSchemaFingerprint,
      ),
    ).rejects.toThrow('exact SYS-01 candidate');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('baseline parent 必须是冻结的 latest-at-base 0045', async () => {
    writeBaselineContract(rootDir, { parentTag: '0001_middle', parentWhen: 1_700_000_000_001 });
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        [],
      ),
    ).rejects.toThrow('baseline manifest');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('tooling blob 漂移与 DB inspector 失败均在 spawn 前失败关闭且不泄露 secret', async () => {
    writeFileSync(join(rootDir, 'scripts/db/guarded-migrate.mjs'), 'export const drift = true;\n');
    const toolingSpawn = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:tooling-secret@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl: toolingSpawn,
          logger: { info: vi.fn() },
        },
        [],
      ),
    ).rejects.toThrow('baseline manifest');
    expect(toolingSpawn).not.toHaveBeenCalled();

    const inspectorSpawn = vi.fn();
    let message = '';
    try {
      await (runGuardedMigration as unknown as (value: Record<string, unknown>) => Promise<unknown>)({
        rootDir,
        env: localEnv({ DATABASE_URL: 'postgres://guard-user:inspector-secret@localhost/zmtg_local' }),
        spawnImpl: inspectorSpawn,
        logger: { info: vi.fn() },
        readDatabaseStateImpl: async () => {
          throw new Error('inspector-secret');
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('inspector-secret');
    expect(inspectorSpawn).not.toHaveBeenCalled();
  });

  it('actual catalog SQL 冻结 rich logical-object signature 两侧契约', () => {
    const guardSource = readFileSync(
      join(process.cwd(), 'scripts/db/guarded-migrate.mjs'),
      'utf8',
    );
    for (const token of [
      "'generatedExpression'",
      "'nullsNotDistinct'",
      "'referencedTable'",
      "'onUpdate'",
      "'predicate'",
      "'volatility'",
      "'security'",
      "'parallel'",
      "'events'",
    ]) {
      expect(guardSource).toContain(token);
    }
    expect(guardSource).toContain('constraint_index.indnullsnotdistinct');
    expect(guardSource).not.toContain('constraint_row.connullsnotdistinct');
  });

  it('journal table 的列、default、nullability、PK 或额外列漂移时失败关闭', async () => {
    const spawnImpl = vi.fn();
    await expect(
      (runGuardedMigration as unknown as (value: Record<string, unknown>) => Promise<unknown>)({
        rootDir,
        env: localEnv(),
        spawnImpl,
        logger: { info: vi.fn() },
        readDatabaseStateImpl: databaseState(legacyRows(rootDir, 1), null, {
          relationKind: 'p',
          columns: [
            { name: 'id', type: 'bigint', nullable: false, defaultKind: 'serial_sequence' },
            { name: 'hash', type: 'text', nullable: false, defaultKind: 'none' },
            { name: 'created_at', type: 'bigint', nullable: true, defaultKind: 'none' },
            { name: 'extra', type: 'text', nullable: true, defaultKind: 'none' },
          ],
          primaryKeyColumns: [],
          nonPrimaryConstraints: [{ type: 'c', name: 'unexpected_check' }],
          nonConstraintIndexes: ['unexpected_index'],
          userTriggers: ['unexpected_trigger'],
        }),
      }),
    ).rejects.toThrow('journal shape 漂移');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('manifest bytes 或 artifact hash 漂移时 baseline origin 失败关闭', async () => {
    writeFileSync(
      join(rootDir, 'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql'),
      'CREATE TABLE "drift" ("id" text);\n',
    );
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        {
          rootDir,
          env: localEnv({
            DATABASE_URL: 'postgres://guard-user:local-password@127.0.0.1:55434/zmtg_clean_local_dev_candidate',
            ZMTG_DB_MIGRATION_ORIGIN: 'baseline',
          }),
          spawnImpl,
          logger: { info: vi.fn() },
        },
        [],
      ),
    ).rejects.toThrow('baseline manifest');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('production 明确拒绝 baseline marker origin', async () => {
    const { markerHash } = writeBaselineContract(rootDir);
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        { rootDir, env: productionEnv(), spawnImpl, logger: { info: vi.fn() } },
        [{ id: 1, hash: markerHash, created_at: 1_785_738_060_856 }],
      ),
    ).rejects.toThrow('production 不允许 baseline marker');
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('production 以 actual strict prefix 校验 expected current，声明值不能代替数据库事实', async () => {
    const spawnImpl = vi.fn();
    await expect(
      runWithDatabaseState(
        { rootDir, env: productionEnv(), spawnImpl, logger: { info: vi.fn() } },
        legacyRows(rootDir, 2),
      ),
    ).rejects.toThrow('actual current');
    expect(spawnImpl).not.toHaveBeenCalled();
  });
});
