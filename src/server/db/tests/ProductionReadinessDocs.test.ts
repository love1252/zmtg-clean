import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const operationDocs = [
  'docs/operations/production-migration-runbook.md',
  'docs/operations/wecom-production-secret-runbook.md',
  'docs/operations/drizzle-migration-snapshot-strategy.md',
].map((path) => readFileSync(resolve(rootDir, path), 'utf8'));
const migrationRunbook = operationDocs[0];
const secretRunbook = operationDocs[1];
const snapshotStrategy = operationDocs[2];

type MigrationJournal = {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

describe('production readiness 文档与脚本契约', () => {
  it('db:migrate 不再裸执行 drizzle-kit migrate', () => {
    expect(packageJson.scripts['db:migrate']).toBe('node scripts/db/guarded-migrate.mjs');
    expect(packageJson.scripts['db:migrate']).not.toBe('drizzle-kit migrate');
  });

  it('db:seed 入口固定关闭并在任何数据库客户端创建前失败', async () => {
    const source = readFileSync(resolve(rootDir, 'src/server/db/seed-demo-data.ts'), 'utf8');
    expect(source).toContain('demoSeedDatabaseWriteDisabledMessage');
    expect(source).toContain('void env;');
    expect(source).toContain('void dependencies;');
    expect(source).not.toContain('dependencies.createPostgresClient(');
    expect(source).not.toContain('dependencies.createDatabase(');
    expect(source).not.toContain('ZMTG_ENABLE_DEMO_SEED !==');

    const { runSeed } = await import('@/server/db/seed-demo-data');
    await expect(runSeed({ NODE_ENV: 'production' })).rejects.toThrow(
      'demo seed 数据库写入已关闭',
    );
  });

  it('运维文档不包含连接串或疑似 secret 值', () => {
    const content = operationDocs.join('\n');
    expect(content).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(content).not.toMatch(/ZMTG_(?:SECRET|WECOM_[A-Z_]*SECRET)\s*=\s*\S+/);
    expect(content).not.toMatch(/DATABASE_URL\s*=\s*\S+/);
  });

  it('runbook 保持真实网络与真实发送关闭', () => {
    const content = operationDocs.join('\n');
    expect(content).toContain('ZMTG_WECOM_REAL_NETWORK_ENABLED');
    expect(content).toContain('ZMTG_WECOM_REAL_SEND_ENABLED');
    expect(content).toContain('05B');
  });

  it('production migration runbook 要求 current 到 latest 的全部 pending 精确进入 allowlist', () => {
    expect(migrationRunbook).toContain('ZMTG_DB_MIGRATION_EXPECTED_CURRENT');
    expect(migrationRunbook).toContain('ZMTG_DB_MIGRATION_EXPECTED_TARGET');
    expect(migrationRunbook).toContain('全部 pending migration');
    expect(migrationRunbook).toContain('精确一致');
    expect(migrationRunbook).toContain('禁止执行破坏性 down migration');
    expect(migrationRunbook).toContain('不转发 `drizzle-kit` 的 stdout/stderr');
  });

  it('current journal 动态决定 latest 并与 Migration SQL 精确一致', () => {
    const journal = JSON.parse(
      readFileSync(resolve(rootDir, 'drizzle/meta/_journal.json'), 'utf8'),
    ) as MigrationJournal;
    const journalTags = journal.entries.map((entry) => entry.tag);
    const sqlTags = readdirSync(resolve(rootDir, 'drizzle'))
      .filter((fileName) => fileName.endsWith('.sql'))
      .map((fileName) => fileName.slice(0, -'.sql'.length))
      .sort();

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(journal.entries.length).toBeGreaterThan(0);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(journal.entries.every((entry) => entry.version === journal.version)).toBe(true);
    expect(journal.entries.every((entry) => entry.breakpoints)).toBe(true);
    expect(new Set(journalTags).size).toBe(journalTags.length);
    expect(
      journal.entries.slice(1).every((entry, index) => entry.when > journal.entries[index].when),
    ).toBe(true);
    expect(sqlTags).toEqual([...journalTags].sort());

    const currentTag = journal.entries.at(-1)?.tag;
    expect(currentTag).toMatch(/^\d{4}_[a-z0-9_]+$/);
    expect(snapshotStrategy).toContain(
      '`current journal` 由 `drizzle/meta/_journal.json` 的最后一项 `tag` 唯一决定',
    );
    expect(snapshotStrategy).not.toMatch(/当前 journal 已登记到 `\d{4}`/);
    expect(snapshotStrategy).not.toMatch(/本任务不新增 `\d{4}`/);
  });

  it('snapshot 策略保持 0026 baseline 与 db:generate 禁令', () => {
    const snapshotIndexes = readdirSync(resolve(rootDir, 'drizzle/meta'))
      .map((fileName) => fileName.match(/^(\d{4})(?:_[^/]*)?_snapshot\.json$/)?.[1])
      .filter((index): index is string => index !== undefined)
      .map(Number);

    expect(readdirSync(resolve(rootDir, 'drizzle/meta'))).toContain('0026_snapshot.json');
    expect(Math.max(...snapshotIndexes)).toBe(26);
    expect(snapshotStrategy).toContain('最新 snapshot 当前仍为 `drizzle/meta/0026_snapshot.json`');
    expect(snapshotStrategy).toContain('journal 与 snapshot 可以阶段性不同步');
    expect(snapshotStrategy).toContain('snapshot 不作为生产执行来源');
    expect(snapshotStrategy).toContain('禁止运行 `db:generate`');
    expect(snapshotStrategy).toContain('禁止新增 snapshot-diff Migration');
    expect(snapshotStrategy).toContain('本文不批准、预留或占用下一个 Migration 编号');
  });

  it('secret runbook 只记录变量名并要求 masked existence check', () => {
    expect(secretRunbook).toContain('本文件只列变量名称，不记录任何变量值');
    expect(secretRunbook).toContain('masked existence check');
    expect(secretRunbook).toContain('不得输出原文、部分值、字符数、编码结果、指纹或可关联值');
  });
});
