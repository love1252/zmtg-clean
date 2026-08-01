import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertMigrationAllowed,
  runGuardedMigration,
} from '../../../../scripts/db/guarded-migrate.mjs';

type JournalEntry = Record<string, unknown>;
type TestEnvironment = Record<string, string | undefined>;

function validJournalEntries(): JournalEntry[] {
  return [
    { idx: 0, version: '7', when: 1_700_000_000_000, tag: '0000_initial', breakpoints: true },
    { idx: 1, version: '7', when: 1_700_000_000_001, tag: '0001_middle', breakpoints: true },
    { idx: 2, version: '7', when: 1_700_000_000_002, tag: '0002_target', breakpoints: true },
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
  writeFileSync(join(rootDir, 'drizzle/0002_target.sql'), '-- reviewed');
  return rootDir;
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
    ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,0002_target',
    ZMTG_DB_MIGRATION_EXPECTED_TARGET: '0002_target',
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
        productionEnv({ ZMTG_DB_MIGRATION_EXPECTED_CURRENT: '0002_target' }),
        rootDir,
      ),
    ).toThrow('必须早于');
  });

  it('production allowlist 必须精确覆盖全部 pending migrations', () => {
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0002_target' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({
          ZMTG_DB_MIGRATION_ALLOWLIST: '0000_initial,0001_middle,0002_target',
        }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,0002_target,0002_target' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');
    expect(() =>
      assertMigrationAllowed(
        productionEnv({ ZMTG_DB_MIGRATION_ALLOWLIST: '0001_middle,,0002_target' }),
        rootDir,
      ),
    ).toThrow('精确覆盖');

    expect(assertMigrationAllowed(productionEnv(), rootDir).pendingMigrations).toEqual([
      '0001_middle',
      '0002_target',
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
    const promise = runGuardedMigration({
      rootDir,
      env: localEnv({ DATABASE_URL: databaseUrl }),
      spawnImpl,
      logger,
    });
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
      await runGuardedMigration({
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
      await runGuardedMigration({
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
    const promise = runGuardedMigration({ rootDir, env: localEnv(), spawnImpl, logger });
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
});
