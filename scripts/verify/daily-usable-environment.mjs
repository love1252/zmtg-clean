import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const owner = 'zmtg.daily-usable.v1';
const imageName = 'postgres:16-alpine';

// 只传入运行工具所需的路径信息；不继承当前 shell 中的真实业务配置。
export function cleanEnvironment(source = process.env) {
  return { PATH: source.PATH ?? '/usr/bin:/bin', HOME: source.HOME ?? homedir(),
    TMPDIR: tmpdir(), LANG: 'en_US.UTF-8', TZ: 'Asia/Shanghai', NEXT_TELEMETRY_DISABLED: '1' };
}

export function assertState(state) {
  assert.equal(state?.contract, owner, '任务环境标记不匹配');
  assert.match(state.runId, /^[a-f0-9]{32}$/);
  assert.equal(state.container, `zmtg-daily-usable-${state.runId}`);
  assert.equal(state.database, `zmtg_daily_${state.runId}`);
  assert.match(state.containerId, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(state.port) && state.port > 1024 && state.port <= 65535);
  assert(Number.isSafeInteger(state.appPort) && state.appPort > 1024 && state.appPort <= 65535);
  assert.match(state.password, /^[a-f0-9]{48}$/);
  assert.match(state.loginPassword, /^[a-f0-9]{32}$/);
  for (const key of [state.sessionKey, state.guardKey]) {
    assert(typeof key === 'string' && /^[A-Za-z0-9_-]{43}$/.test(key));
    assert.equal(Buffer.from(key, 'base64url').length, 32);
    assert.equal(Buffer.from(key, 'base64url').toString('base64url'), key);
  }
  assert.equal(typeof state.encryptionKey, 'string');
  assert.equal(Buffer.from(state.encryptionKey, 'base64').length, 32);
  assert.equal(Buffer.from(state.encryptionKey, 'base64').toString('base64'), state.encryptionKey);
  assert(path.isAbsolute(state.socketPath));
  assert.equal(state.socketPath, path.join(homedir(), '.colima/default/docker.sock'));
  return state;
}

export async function readState(file) {
  const stat = await lstat(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), '环境记录必须为普通文件');
  assert(stat.size < 65_536, '环境记录过大');
  assert.equal(stat.uid, process.getuid(), '环境记录必须属于当前用户');
  assert.equal(stat.mode & 0o077, 0, '环境记录不可向其他用户开放');
  return assertState(JSON.parse(await readFile(file, 'utf8')));
}

export function databaseUrl(state) {
  assertState(state);
  return `postgresql://postgres:${state.password}@127.0.0.1:${state.port}/${state.database}`;
}

export async function assertNoProjectEnvironment(project) {
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local',
    '.env.production', '.env.production.local', '.env.test', '.env.test.local']) {
    assert(!existsSync(path.join(project, name)), `隔离工作树不得含有 ${name}`);
  }
}

function docker(socketPath, method, url, body) {
  return new Promise((resolve, reject) => {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ socketPath, method, path: url,
      headers: encoded ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(encoded) } : {} }, res => {
      let value = '';
      res.on('data', chunk => { value += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`隔离容器 API 返回 ${res.statusCode}`)); return;
        }
        try { resolve(value ? JSON.parse(value) : null); } catch { resolve(value); }
      });
    });
    req.setTimeout(30_000, () => req.destroy(new Error('隔离容器 API 超时')));
    req.on('error', reject); req.end(encoded);
  });
}

export async function verifyContainer(state) {
  assertState(state);
  const info = await docker(state.socketPath, 'GET', `/containers/${state.containerId}/json`);
  assert.equal(info.Id, state.containerId);
  assert.equal(info.Name, `/${state.container}`);
  assert.equal(info.Config.Labels['com.zmtg.daily-usable'], state.runId);
  assert.equal(info.Config.Image, imageName);
  const bindings = info.HostConfig.PortBindings['5432/tcp'];
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].HostIp, '127.0.0.1');
  const actual = info.NetworkSettings.Ports['5432/tcp'];
  assert.equal(actual?.length, 1);
  assert.equal(actual[0].HostIp, '127.0.0.1');
  assert.equal(Number(actual[0].HostPort), state.port);
  return info;
}

function taskEnvironment(state) {
  return { ...cleanEnvironment(), DATABASE_URL: databaseUrl(state),
    ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION: '1', ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL: state.sessionKey,
    ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON: '[]', ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION: '1',
    ZMTG_INSTITUTION_GUARD_HMAC_KEY_BASE64URL: state.guardKey, ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON: '[]',
    ZMTG_SECRET_ENCRYPTION_KEY: state.encryptionKey, ZMTG_ENABLE_DEMO_AUTH: 'false' };
}

async function runNode(args, environment, cwd) {
  const signed = path.join(homedir(), '.cache/zmtg-runtime/node');
  const node = existsSync(signed) ? signed : process.execPath;
  await new Promise((resolve, reject) => {
    const child = spawn(node, args, { cwd, env: environment, stdio: 'inherit' });
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', terminate); process.once('SIGTERM', terminate);
    child.on('error', reject);
    child.on('exit', code => {
      process.removeListener('SIGINT', terminate); process.removeListener('SIGTERM', terminate);
      code === 0 ? resolve() : reject(new Error(`隔离子进程失败 (${code})`));
    });
  });
}

async function createEnvironment(appPort) {
  assert(Number.isSafeInteger(appPort) && appPort > 1024 && appPort <= 65535);
  await assertNoProjectEnvironment(root);
  const runId = randomUUID().replaceAll('-', '');
  const state = { contract: owner, runId, container: `zmtg-daily-usable-${runId}`,
    database: `zmtg_daily_${runId}`, socketPath: path.join(homedir(), '.colima/default/docker.sock'),
    password: randomBytes(24).toString('hex'), loginPassword: randomBytes(16).toString('hex'),
    sessionKey: randomBytes(32).toString('base64url'), guardKey: randomBytes(32).toString('base64url'),
    encryptionKey: randomBytes(32).toString('base64'), appPort, createdAt: new Date().toISOString() };
  // 不自动拉镜像；本机缺少 PostgreSQL 16 时明确失败，让操作者先准备测试依赖。
  await docker(state.socketPath, 'GET', `/images/${imageName}/json`);
  const result = await docker(state.socketPath, 'POST', `/containers/create?name=${state.container}`, {
    Image: imageName, Env: [`POSTGRES_PASSWORD=${state.password}`, `POSTGRES_DB=${state.database}`],
    Labels: { 'com.zmtg.daily-usable': runId },
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }] } },
  });
  state.containerId = result.Id;
  try {
    await docker(state.socketPath, 'POST', `/containers/${state.containerId}/start`);
    const info = await docker(state.socketPath, 'GET', `/containers/${state.containerId}/json`);
    state.port = Number(info.NetworkSettings.Ports['5432/tcp'][0].HostPort);
    await verifyContainer(state);
    const folder = await mkdtemp(path.join(tmpdir(), 'zmtg-daily-usable-'));
    await chmod(folder, 0o700);
    const file = path.join(folder, 'environment.json');
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log(`任务隔离容器已创建；环境记录：${file}`);
  } catch (error) {
    // 只清理由本次 create 成功返回的容器 ID；不按名称枚举或删除其他实例。
    await docker(state.socketPath, 'DELETE', `/containers/${state.containerId}?force=true&v=true`).catch(() => {});
    throw error;
  }
}

async function main() {
  const [command, input, projectInput] = process.argv.slice(2);
  if (command === 'create') return createEnvironment(Number(input ?? 52717));
  if (!input || !['setup', 'verify', 'verify-integrated', 'serve', 'build', 'stop'].includes(command)) {
    throw new Error('用法：create [应用端口]；setup|verify|verify-integrated|build|serve|stop <environment.json> [隔离项目目录]');
  }
  const state = await readState(input);
  await verifyContainer(state);
  if (command === 'stop') {
    await docker(state.socketPath, 'DELETE', `/containers/${state.containerId}?force=true&v=true`);
    console.log('本任务隔离容器及其临时卷已清理；未操作其他实例。'); return;
  }
  const project = path.resolve(projectInput ?? root);
  await assertNoProjectEnvironment(project);
  if (command === 'setup' || command === 'verify' || command === 'verify-integrated') {
    return runNode(['--import', 'tsx', path.join(root, 'scripts/verify/daily-usable-fixture.ts'), command, path.resolve(input)],
      taskEnvironment(state), root);
  }
  return runNode([path.join(project, 'scripts/run-next.mjs'),
    ...(command === 'build' ? ['build', '--webpack'] : ['start', '--hostname', '127.0.0.1', '--port', String(state.appPort)])],
    taskEnvironment(state), project);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // 不输出连接 URL、Docker 错误正文或进程环境。
    const safeMessage = typeof error.message === 'string' && /^(用法：|隔离容器 API |隔离子进程失败)/.test(error.message)
      ? error.message : '隔离环境执行失败；未输出连接、会话或密钥。';
    console.error(error instanceof assert.AssertionError ? '隔离环境安全检查失败' : safeMessage);
    process.exitCode = 1;
  });
}
