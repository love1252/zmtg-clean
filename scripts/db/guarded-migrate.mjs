import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const productionConfirmation = 'MIGRATE_PRODUCTION';
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

export class MigrationGuardError extends Error {}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new MigrationGuardError(`migration guard 拒绝：缺少 ${name}`);
  return value;
}

function parseDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('invalid protocol');
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!host || !database) throw new Error('missing target');
    return { host, database };
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：DATABASE_URL 无效');
  }
}

function readMigrationState(rootDir) {
  const journalPath = resolve(rootDir, 'drizzle/meta/_journal.json');
  let journal;
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：无法读取 migration journal');
  }

  if (!journal || typeof journal !== 'object' || !Array.isArray(journal.entries)) {
    throw new MigrationGuardError('migration guard 拒绝：migration journal 无效');
  }

  const journalTags = [];
  let previousWhen = Number.NEGATIVE_INFINITY;
  for (const [index, entry] of journal.entries.entries()) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      !Number.isInteger(entry.idx) ||
      entry.idx !== index ||
      typeof entry.version !== 'string' ||
      entry.version.trim().length === 0 ||
      !Number.isFinite(entry.when) ||
      !Number.isInteger(entry.when) ||
      entry.when <= previousWhen ||
      typeof entry.tag !== 'string' ||
      entry.tag.trim().length === 0 ||
      typeof entry.breakpoints !== 'boolean'
    ) {
      throw new MigrationGuardError('migration guard 拒绝：migration journal 无效');
    }
    previousWhen = entry.when;
    journalTags.push(entry.tag);
  }
  if (journalTags.length === 0 || new Set(journalTags).size !== journalTags.length) {
    throw new MigrationGuardError('migration guard 拒绝：migration journal 无效');
  }

  let sqlTags;
  try {
    sqlTags = readdirSync(resolve(rootDir, 'drizzle'))
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.slice(0, -4));
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：无法读取 migration 文件');
  }
  const journalSet = new Set(journalTags);
  const sqlSet = new Set(sqlTags);
  const unknownSql = sqlTags.filter((tag) => !journalSet.has(tag));
  const missingSql = journalTags.filter((tag) => !sqlSet.has(tag));
  if (unknownSql.length > 0 || missingSql.length > 0) {
    throw new MigrationGuardError('migration guard 拒绝：发现未知或缺失的 migration 文件');
  }

  return { latestMigration: journalTags.at(-1), migrationTags: journalTags };
}

export function assertMigrationAllowed(env, rootDir) {
  const target = required(env, 'ZMTG_DB_MIGRATION_TARGET');
  const rawUrl = required(env, 'DATABASE_URL');
  const databaseTarget = parseDatabaseUrl(rawUrl);
  const migrationState = readMigrationState(rootDir);

  if (target === 'local') {
    if (!localHosts.has(databaseTarget.host)) {
      throw new MigrationGuardError('migration guard 拒绝：local 模式仅允许 loopback 数据库');
    }
    return { target, ...databaseTarget, ...migrationState, pendingMigrations: [] };
  }

  if (target !== 'production') {
    throw new MigrationGuardError('migration guard 拒绝：target 必须为 local 或 production');
  }

  if (required(env, 'ZMTG_DB_MIGRATION_CONFIRMATION') !== productionConfirmation) {
    throw new MigrationGuardError('migration guard 拒绝：production 人工确认字符串不匹配');
  }
  required(env, 'ZMTG_DB_MIGRATION_APPROVAL_REF');

  const expectedHost = required(env, 'ZMTG_DB_MIGRATION_EXPECTED_HOST').toLowerCase();
  const expectedDatabase = required(env, 'ZMTG_DB_MIGRATION_EXPECTED_DATABASE');
  if (databaseTarget.host !== expectedHost || databaseTarget.database !== expectedDatabase) {
    throw new MigrationGuardError('migration guard 拒绝：production host/database 与预期不匹配');
  }

  const expectedMigration = required(env, 'ZMTG_DB_MIGRATION_EXPECTED_TARGET');
  if (expectedMigration !== migrationState.latestMigration) {
    throw new MigrationGuardError('migration guard 拒绝：expected target 不是 journal 最新 migration');
  }

  const expectedCurrent = required(env, 'ZMTG_DB_MIGRATION_EXPECTED_CURRENT');
  const currentIndex = migrationState.migrationTags.indexOf(expectedCurrent);
  const targetIndex = migrationState.migrationTags.indexOf(expectedMigration);
  if (currentIndex === -1) {
    throw new MigrationGuardError('migration guard 拒绝：expected current 不在 migration journal');
  }
  if (currentIndex >= targetIndex) {
    throw new MigrationGuardError('migration guard 拒绝：expected current 必须早于 expected target');
  }

  const pendingMigrations = migrationState.migrationTags.slice(currentIndex + 1, targetIndex + 1);
  if (pendingMigrations.length === 0) {
    throw new MigrationGuardError('migration guard 拒绝：没有可执行的 pending migration');
  }

  const allowlistEntries = required(env, 'ZMTG_DB_MIGRATION_ALLOWLIST')
    .split(',')
    .map((value) => value.trim());
  const allowlist = new Set(allowlistEntries);
  if (
    allowlistEntries.some((migration) => migration.length === 0) ||
    allowlist.size !== allowlistEntries.length ||
    allowlist.size !== pendingMigrations.length ||
    pendingMigrations.some((migration) => !allowlist.has(migration))
  ) {
    throw new MigrationGuardError(
      'migration guard 拒绝：allowlist 必须精确覆盖全部 pending migrations',
    );
  }

  return { target, ...databaseTarget, ...migrationState, pendingMigrations };
}

export async function runGuardedMigration({
  env = process.env,
  rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  spawnImpl = spawn,
  logger = console,
} = {}) {
  const state = assertMigrationAllowed(env, rootDir);
  logger.info(`migration guard 通过：target=${state.target}，migration=${state.latestMigration}`);

  const executable = resolve(rootDir, 'node_modules/.bin/drizzle-kit');
  const exitCode = await new Promise((resolveExit, reject) => {
    let child;
    try {
      child = spawnImpl(executable, ['migrate'], {
        cwd: rootDir,
        env,
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      reject(new MigrationGuardError('migration 执行失败'));
      return;
    }
    try {
      child.once('error', () => reject(new MigrationGuardError('migration 执行失败')));
      child.once('close', resolveExit);
    } catch {
      reject(new MigrationGuardError('migration 执行失败'));
    }
  });
  if (exitCode !== 0) throw new MigrationGuardError('migration 执行失败');
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  runGuardedMigration().catch((error) => {
    console.error(
      error instanceof MigrationGuardError ? error.message : 'migration guard 执行失败',
    );
    process.exitCode = 1;
  });
}
