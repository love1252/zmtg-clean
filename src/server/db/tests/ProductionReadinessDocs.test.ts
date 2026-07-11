import { readFileSync } from 'node:fs';
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

describe('production readiness 文档与脚本契约', () => {
  it('db:migrate 不再裸执行 drizzle-kit migrate', () => {
    expect(packageJson.scripts['db:migrate']).toBe('node scripts/db/guarded-migrate.mjs');
    expect(packageJson.scripts['db:migrate']).not.toBe('drizzle-kit migrate');
  });

  it('db:seed 入口本身调用硬阻断 guard，失败时不会创建数据库客户端', async () => {
    const source = readFileSync(resolve(rootDir, 'src/server/db/seed-demo-data.ts'), 'utf8');
    const guardCall = source.indexOf('assertDemoSeedExecutionAllowed(env);');
    const clientCreation = source.indexOf('createPostgresClient(');

    expect(guardCall).toBeGreaterThan(-1);
    expect(clientCreation).toBeGreaterThan(guardCall);
    expect(source).toContain('dependencies.createPostgresClient(databaseUrl)');
    expect(source).not.toContain('ZMTG_ENABLE_DEMO_SEED !==');

    const { runSeed } = await import('@/server/db/seed-demo-data');
    await expect(runSeed({ NODE_ENV: 'production' })).rejects.toThrow(
      'production/staging 环境始终拒绝',
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

  it('snapshot 策略明确 0034 与 0035 均为已评审手写 SQL 和 journal 记录', () => {
    expect(snapshotStrategy).toContain('0034_v08_04f_ea_customer_mapping_data_foundation');
    expect(snapshotStrategy).toContain('0035_v08_04f_fa_trusted_reachout_safety_foundation');
    expect(snapshotStrategy).toContain('经评审的手写 SQL');
    expect(snapshotStrategy).toContain('已登记到 journal');
    expect(snapshotStrategy).toContain('本任务不新增 `0036`');
  });

  it('secret runbook 只记录变量名并要求 masked existence check', () => {
    expect(secretRunbook).toContain('本文件只列变量名称，不记录任何变量值');
    expect(secretRunbook).toContain('masked existence check');
    expect(secretRunbook).toContain('不得输出原文、部分值、字符数、编码结果、指纹或可关联值');
  });
});
