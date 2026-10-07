import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertNoProjectEnvironment, assertState, cleanEnvironment, readState } from './daily-usable-environment.mjs';

function sample() {
  const runId = '1'.repeat(32);
  return { contract: 'zmtg.daily-usable.v1', runId, container: `zmtg-daily-usable-${runId}`,
    database: `zmtg_daily_${runId}`, containerId: '2'.repeat(64), port: 55487, appPort: 52717,
    password: '3'.repeat(48), loginPassword: '4'.repeat(32), socketPath: path.join(homedir(), '.colima/default/docker.sock'),
    sessionKey: Buffer.alloc(32, 1).toString('base64url'), guardKey: Buffer.alloc(32, 2).toString('base64url'),
    encryptionKey: Buffer.alloc(32, 3).toString('base64') };
}

test('运行环境剔除继承的业务连接、供应商凭证和 NODE_OPTIONS', () => {
  const result = cleanEnvironment({ PATH: '/bin', HOME: '/tmp', DATABASE_URL: 'must-not-copy', OPENAI_API_KEY: 'must-not-copy', NODE_OPTIONS: '--require untrusted' });
  assert.equal(result.PATH, '/bin');
  assert(!('DATABASE_URL' in result)); assert(!('OPENAI_API_KEY' in result)); assert(!('NODE_OPTIONS' in result));
});

test('环境记录拒绝错误任务、容器、数据库、端口或远程 Docker socket', () => {
  assertState(sample());
  for (const patch of [{ contract: 'other' }, { runId: '../other' }, { container: 'existing' }, { database: 'production' },
    { containerId: 'other' }, { port: 0 }, { appPort: 80 }, { socketPath: '/run/docker.sock' },
    { sessionKey: '' }, { guardKey: 'fake' }, { encryptionKey: 'fake' }]) {
    assert.throws(() => assertState({ ...sample(), ...patch }));
  }
});

test('隔离工作树拒绝加载任何 Next 环境文件', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'daily-env-check-'));
  try {
    await assertNoProjectEnvironment(folder);
    await writeFile(path.join(folder, '.env.production.local'), 'SYNTHETIC=1');
    await assert.rejects(assertNoProjectEnvironment(folder));
  } finally { await rm(folder, { recursive: true }); }
});

test('包含专用测试密钥的环境记录必须限制文件权限', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'daily-state-check-'));
  try {
    const file = path.join(folder, 'environment.json');
    await writeFile(file, JSON.stringify(sample()), { mode: 0o600 });
    assert.equal((await readState(file)).runId, sample().runId);
    const publicFile = path.join(folder, 'public.json');
    await writeFile(publicFile, JSON.stringify(sample()), { mode: 0o644 });
    await assert.rejects(readState(publicFile));
  } finally { await rm(folder, { recursive: true }); }
});
