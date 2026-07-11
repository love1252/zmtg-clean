const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const allowedDatabaseMarker = /(?:^|[-_])(demo|local|dev|test)(?:$|[-_])/i;
const forbiddenDatabaseMarker = /(?:production|staging|prod|stage)/i;
const forbiddenEnvironment = new Set([
  'production',
  'preview',
  'stage',
  'staging',
  'test',
  'test-server',
]);

export const demoSeedConfirmation = 'SEED_LOCAL_DEMO';

export class DemoSeedGuardError extends Error {}

function reject(reason: string): never {
  throw new DemoSeedGuardError(`demo seed guard 拒绝：${reason}`);
}

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env) {
  const environmentNames = [env.NODE_ENV, env.ZMTG_ENV, env.DEPLOYMENT_ENV, env.VERCEL_ENV]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());
  if (environmentNames.some((value) => forbiddenEnvironment.has(value))) {
    reject('production/staging 环境禁止执行');
  }

  if (env.ZMTG_DEMO_SEED_TARGET !== 'local') {
    reject('ZMTG_DEMO_SEED_TARGET 必须明确为 local');
  }
  if (env.ZMTG_DEMO_SEED_CONFIRMATION !== demoSeedConfirmation) {
    reject('缺少 local/demo 人工确认');
  }

  const rawUrl = env.DATABASE_URL?.trim();
  if (!rawUrl) reject('缺少 DATABASE_URL');

  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('invalid protocol');
  } catch {
    reject('DATABASE_URL 无效');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    reject('DATABASE_URL 无效');
  }
  if (!localHosts.has(host)) reject('仅允许 loopback 数据库');
  if (!database || forbiddenDatabaseMarker.test(database) || !allowedDatabaseMarker.test(database)) {
    reject('数据库名必须明确标识为 local/demo/dev/test，且不得标识为 production/staging');
  }

  return { target: 'local' as const, host, database, databaseUrl: rawUrl };
}
