import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const S39_TASK =
  'S39_CURRENT_DEMO_ADMIN_FORMALIZATION_AND_INSTITUTION_PROVISIONING_CONTROL_PLANE';
export const S39_MANIFEST_VERSION = 'current-demo-admin-formalization/v1';
export const S39_LEASE_VERSION =
  'current-demo-admin-formalization-execution-lease/v1';
export const S39_TARGET_DATABASE = Object.freeze({
  host: '127.0.0.1',
  port: '55434',
  database: 'zmtg_clean_local_dev_candidate',
});
export const MAX_PRIVATE_FILE_BYTES = 65_536;

function resolveProjectRoot() {
  try {
    const moduleUrl = new URL(import.meta.url);
    if (moduleUrl.protocol === 'file:') {
      return fileURLToPath(new URL('../..', moduleUrl));
    }
  } catch {
    // Vitest 会把 import.meta.url 改写成虚拟模块 URL。
  }
  return process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const ALLOWED_PRIVATE_FILE_MODES = new Set([0o400, 0o600]);
const O_NOFOLLOW = fsConstants.O_NOFOLLOW;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const FORBIDDEN_REFERENCE_PATTERN =
  /(?:^|[._:-])(?:api[_-]?key|database[_-]?url|password|passwd|secret|token)(?:[._:-]|$)/iu;
const execFile = promisify(execFileCallback);

const MANIFEST_KEYS = Object.freeze([
  'accountDisplayName',
  'accountId',
  'approvedAt',
  'assignmentSource',
  'authorityRef',
  'bindingId',
  'currency',
  'effectiveAt',
  'effectiveFromBusinessDate',
  'executionWindowNotAfter',
  'expectedCodeSha',
  'institutionId',
  'institutionName',
  'membershipId',
  'provenanceSource',
  'reasonCode',
  'targetEnvironment',
  'task',
  'tenantId',
  'tenantName',
  'timezone',
  'username',
  'version',
]);
const LEASE_KEYS = Object.freeze([
  'authorityRef',
  'executionAuthorized',
  'expectedCodeSha',
  'manifestSha256',
  'notAfter',
  'notBefore',
  'singleUseNonce',
  'task',
  'version',
]);
const OUTPUT_KEYS = Object.freeze([
  'MODE',
  'TARGET',
  'ACCOUNT_STATE',
  'MEMBERSHIP_STATE',
  'SCOPE_STATE',
  'CONTEXT_STATE',
  'BINDING_STATE',
  'PHASE_A',
  'PHASE_B',
  'PHASE_C',
  'CONFLICT_COUNT',
  'UNEXPECTED_COUNT',
  'DATABASE_WRITE_EXECUTED',
]);
const COMPONENT_STATES = new Set([
  'not_evaluated',
  'missing',
  'candidate',
  'reused',
  'applied',
  'conflict',
  'unexpected',
]);
const PHASE_STATES = new Set([
  'not_run',
  'candidate',
  'reused',
  'applied',
  'conflict',
  'unexpected',
]);

export class CurrentDemoAdminRunnerError extends Error {
  constructor(code, exitCode = 3) {
    super(code);
    this.name = 'CurrentDemoAdminRunnerError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, exitCode = 3) {
  throw new CurrentDemoAdminRunnerError(code, exitCode);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length &&
    actual.every((key, index) => key === keys[index]);
}

function isCanonicalText(value, maximumLength) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    value.normalize('NFC') === value;
}

function isLowSensitiveIdentifier(value, maximumLength = 96) {
  return isCanonicalText(value, maximumLength) &&
    IDENTIFIER_PATTERN.test(value) &&
    !FORBIDDEN_REFERENCE_PATTERN.test(value);
}

function isCanonicalInstant(value) {
  return typeof value === 'string' &&
    INSTANT_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function isBusinessDate(value) {
  if (typeof value !== 'string' || !BUSINESS_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;
}

function businessDateAt(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)), 'utf8')
    .digest('hex');
}

export function parseRunnerArguments(argv) {
  if (!Array.isArray(argv)) fail('runner_arguments_invalid', 2);
  const tokens = argv[0] === '--' ? argv.slice(1) : [...argv];
  let mode = 'dry-run';
  let explicitMode = false;
  let manifestFile = null;
  let executionLeaseFile = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--dry-run' || token === '--execute') {
      if (explicitMode) fail('runner_arguments_invalid', 2);
      explicitMode = true;
      mode = token === '--execute' ? 'execute' : 'dry-run';
      continue;
    }
    if (token === '--manifest-file' || token === '--execution-lease-file') {
      const candidate = tokens[index + 1];
      if (
        typeof candidate !== 'string' ||
        candidate.length === 0 ||
        candidate.length > 4096 ||
        !path.isAbsolute(candidate) ||
        candidate.startsWith('--') ||
        /[\u0000-\u001f\u007f{}"']/u.test(candidate)
      ) {
        fail('runner_arguments_invalid', 2);
      }
      if (token === '--manifest-file') {
        if (manifestFile !== null) fail('runner_arguments_invalid', 2);
        manifestFile = candidate;
      } else {
        if (executionLeaseFile !== null) fail('runner_arguments_invalid', 2);
        executionLeaseFile = candidate;
      }
      index += 1;
      continue;
    }
    fail('runner_arguments_invalid', 2);
  }

  if (manifestFile === null) fail('runner_manifest_file_required', 2);
  if (mode === 'dry-run' && executionLeaseFile !== null) {
    fail('runner_lease_not_allowed_for_dry_run', 2);
  }
  if (mode === 'execute' && executionLeaseFile === null) {
    fail('runner_execution_lease_file_required', 2);
  }
  return Object.freeze({ mode, manifestFile, executionLeaseFile });
}

export function parseAuthorityManifest(value) {
  if (!hasExactKeys(value, MANIFEST_KEYS)) {
    fail('runner_manifest_shape_invalid');
  }
  const frozen = {
    task: S39_TASK,
    version: S39_MANIFEST_VERSION,
    targetEnvironment: 'local_candidate',
    username: 'admin',
    accountId: 'demo-user-admin',
    accountDisplayName: '系统管理员',
    tenantId: 'growth-tenant-chengxing',
    tenantName: '澄星医疗美容',
    institutionId: 'growth-inst-chengxing',
    institutionName: '澄星医疗美容',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    assignmentSource: 'manual_admin',
    provenanceSource: 'access_control_command',
    reasonCode: 'post_rebuild_formal_provisioning',
  };
  for (const [key, expected] of Object.entries(frozen)) {
    if (value[key] !== expected) fail('runner_manifest_identity_invalid');
  }
  if (
    !isLowSensitiveIdentifier(value.authorityRef) ||
    !isLowSensitiveIdentifier(value.membershipId, 64) ||
    !isLowSensitiveIdentifier(value.bindingId, 64) ||
    value.membershipId === value.bindingId ||
    !SHA1_PATTERN.test(value.expectedCodeSha) ||
    !isCanonicalInstant(value.approvedAt) ||
    !isCanonicalInstant(value.effectiveAt) ||
    !isCanonicalInstant(value.executionWindowNotAfter) ||
    value.effectiveAt !== value.approvedAt ||
    !isBusinessDate(value.effectiveFromBusinessDate) ||
    businessDateAt(value.effectiveAt, value.timezone) !==
      value.effectiveFromBusinessDate ||
    value.approvedAt > value.executionWindowNotAfter ||
    value.effectiveAt > value.executionWindowNotAfter
  ) {
    fail('runner_manifest_contract_invalid');
  }
  return Object.freeze({ ...value });
}

export function parseExecutionLease(value) {
  if (!hasExactKeys(value, LEASE_KEYS)) fail('runner_lease_shape_invalid');
  if (
    value.task !== S39_TASK ||
    value.version !== S39_LEASE_VERSION ||
    !isLowSensitiveIdentifier(value.authorityRef) ||
    typeof value.executionAuthorized !== 'boolean' ||
    !SHA1_PATTERN.test(value.expectedCodeSha) ||
    !SHA256_PATTERN.test(value.manifestSha256) ||
    !isCanonicalInstant(value.notBefore) ||
    !isCanonicalInstant(value.notAfter) ||
    value.notBefore > value.notAfter ||
    typeof value.singleUseNonce !== 'string' ||
    !NONCE_PATTERN.test(value.singleUseNonce)
  ) {
    fail('runner_lease_contract_invalid');
  }
  return Object.freeze({ ...value });
}

export function verifyExecutionLease(input) {
  const now = input.now instanceof Date ? input.now : new Date(Number.NaN);
  if (Number.isNaN(now.valueOf())) fail('runner_clock_invalid');
  const instant = now.toISOString();
  if (
    input.manifest.expectedCodeSha !== input.actualHead ||
    input.lease.executionAuthorized !== true ||
    input.lease.authorityRef !== input.manifest.authorityRef ||
    input.lease.expectedCodeSha !== input.actualHead ||
    input.lease.manifestSha256 !== input.manifestSha256 ||
    instant < input.lease.notBefore ||
    instant > input.lease.notAfter ||
    input.lease.notAfter > input.manifest.executionWindowNotAfter ||
    instant < input.manifest.approvedAt ||
    instant > input.manifest.executionWindowNotAfter
  ) {
    fail('runner_execution_authorization_invalid');
  }
}

export function assertCandidateDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length > 4096) {
    fail('runner_database_identity_invalid');
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('runner_database_identity_invalid');
  }
  if (
    (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') ||
    parsed.hostname !== S39_TARGET_DATABASE.host ||
    parsed.port !== S39_TARGET_DATABASE.port ||
    parsed.pathname !== `/${S39_TARGET_DATABASE.database}` ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    fail('runner_database_identity_invalid');
  }
  return databaseUrl;
}

function assertJsonHasNoDuplicateKeys(source) {
  let index = 0;
  const invalid = () => fail('runner_private_json_invalid');
  const whitespace = () => {
    while (/\s/u.test(source[index] ?? '')) index += 1;
  };
  const parseString = () => {
    if (source[index] !== '"') invalid();
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch {
          invalid();
        }
      }
      if (source[index] === '\\') {
        index += 1;
        if (source[index] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/u.test(source.slice(index + 1, index + 5))) {
            invalid();
          }
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(source[index] ?? '')) invalid();
      } else if ((source.charCodeAt(index) ?? 0) <= 0x1f) {
        invalid();
      }
      index += 1;
    }
    invalid();
  };
  const parseValue = () => {
    whitespace();
    const character = source[index];
    if (character === '{') {
      index += 1;
      whitespace();
      const keys = new Set();
      if (source[index] === '}') {
        index += 1;
        return;
      }
      while (index < source.length) {
        const key = parseString();
        if (keys.has(key)) fail('runner_private_json_duplicate_key');
        keys.add(key);
        whitespace();
        if (source[index] !== ':') invalid();
        index += 1;
        parseValue();
        whitespace();
        if (source[index] === '}') {
          index += 1;
          return;
        }
        if (source[index] !== ',') invalid();
        index += 1;
        whitespace();
      }
      invalid();
    }
    if (character === '[') {
      index += 1;
      whitespace();
      if (source[index] === ']') {
        index += 1;
        return;
      }
      while (index < source.length) {
        parseValue();
        whitespace();
        if (source[index] === ']') {
          index += 1;
          return;
        }
        if (source[index] !== ',') invalid();
        index += 1;
      }
      invalid();
    }
    if (character === '"') {
      parseString();
      return;
    }
    const literal = source.slice(index).match(
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u,
    );
    if (!literal) invalid();
    index += literal[0].length;
  };
  parseValue();
  whitespace();
  if (index !== source.length) invalid();
}

export async function readPrivateJsonFile(filePath, dependencies = {}) {
  if (
    typeof filePath !== 'string' ||
    !path.isAbsolute(filePath) ||
    filePath.length > 4096
  ) {
    fail('runner_private_file_invalid');
  }
  const noFollow = Object.hasOwn(dependencies, 'oNoFollow')
    ? dependencies.oNoFollow
    : O_NOFOLLOW;
  if (!Number.isSafeInteger(noFollow) || noFollow < 0) {
    fail('runner_nofollow_unavailable');
  }
  const lstatFile = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const currentUid = dependencies.uid ?? process.getuid?.();
  if (!Number.isSafeInteger(currentUid) || currentUid < 0) {
    fail('runner_private_file_unsafe');
  }

  let handle;
  try {
    const before = await lstatFile(filePath, { bigint: true });
    validatePrivateFileStat(before, currentUid);
    handle = await openFile(filePath, fsConstants.O_RDONLY | noFollow);
    const opened = await handle.stat({ bigint: true });
    if (!privateFileIdentityMatches(before, opened)) {
      fail('runner_private_file_changed');
    }
    validatePrivateFileStat(opened, currentUid);
    const bytes = await readBoundedPrivateFile(handle, Number(opened.size));
    const afterOpened = await handle.stat({ bigint: true });
    const afterPath = await lstatFile(filePath, { bigint: true });
    if (
      !privateFileIdentityMatches(opened, afterOpened) ||
      !privateFileIdentityMatches(opened, afterPath)
    ) {
      fail('runner_private_file_changed');
    }
    validatePrivateFileStat(afterOpened, currentUid);
    validatePrivateFileStat(afterPath, currentUid);
    let source;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      fail('runner_private_file_utf8_invalid');
    }
    assertJsonHasNoDuplicateKeys(source);
    try {
      return JSON.parse(source);
    } catch {
      fail('runner_private_json_invalid');
    }
  } catch (error) {
    if (error instanceof CurrentDemoAdminRunnerError) throw error;
    fail('runner_private_file_unavailable');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function privateFileIdentityMatches(left, right) {
  return left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.nlink === right.nlink &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

function validatePrivateFileStat(value, currentUid) {
  const mode = Number(value.mode & 0o7777n);
  if (
    !value.isFile() ||
    value.isSymbolicLink() ||
    value.nlink !== 1n ||
    value.uid !== BigInt(currentUid) ||
    !ALLOWED_PRIVATE_FILE_MODES.has(mode) ||
    value.size <= 0n ||
    value.size > BigInt(MAX_PRIVATE_FILE_BYTES)
  ) {
    fail('runner_private_file_unsafe');
  }
}

async function readBoundedPrivateFile(handle, expectedSize) {
  const chunks = [];
  let offset = 0;
  while (offset <= MAX_PRIVATE_FILE_BYTES) {
    const remaining = MAX_PRIVATE_FILE_BYTES + 1 - offset;
    const buffer = Buffer.alloc(Math.min(32 * 1024, remaining));
    const { bytesRead } = await handle.read(
      buffer,
      0,
      buffer.length,
      offset,
    );
    if (bytesRead === 0) break;
    chunks.push(buffer.subarray(0, bytesRead));
    offset += bytesRead;
  }
  if (offset !== expectedSize || offset > MAX_PRIVATE_FILE_BYTES) {
    fail('runner_private_file_changed');
  }
  return Buffer.concat(chunks, offset);
}

export async function assertRepositoryCodeIdentity(dependencies = {}) {
  const injectedHead = dependencies.actualHead !== undefined;
  const injectedStatus = dependencies.worktreeStatus !== undefined;
  if (injectedHead !== injectedStatus) {
    fail('runner_repository_identity_dependencies_invalid');
  }
  if (injectedHead && injectedStatus) {
    if (!SHA1_PATTERN.test(dependencies.actualHead)) {
      fail('runner_head_unavailable');
    }
    if (typeof dependencies.worktreeStatus !== 'string') {
      fail('runner_worktree_status_unavailable');
    }
    if (dependencies.worktreeStatus !== '') fail('runner_worktree_not_clean');
    return dependencies.actualHead;
  }
  try {
    const [headResult, statusResult] = await Promise.all([
      execFile('git', ['rev-parse', 'HEAD'], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        maxBuffer: 4096,
      }),
      execFile(
        'git',
        ['status', '--porcelain=v1', '--untracked-files=all'],
        {
          cwd: PROJECT_ROOT,
          encoding: 'utf8',
          maxBuffer: 1_048_576,
        },
      ),
    ]);
    const head = headResult.stdout.trim();
    if (!SHA1_PATTERN.test(head)) fail('runner_head_unavailable');
    if (statusResult.stdout !== '') fail('runner_worktree_not_clean');
    return head;
  } catch (error) {
    if (error instanceof CurrentDemoAdminRunnerError) throw error;
    fail('runner_repository_identity_unavailable');
  }
}

async function defaultExecutor(input) {
  const { runCurrentDemoAdminFormalization } = await import(
    './current-demo-admin-formalization-executor.ts'
  );
  return runCurrentDemoAdminFormalization(input);
}

function safeResult(mode, result) {
  if (
    !isRecord(result) ||
    result.mode !== mode ||
    !COMPONENT_STATES.has(result.accountState) ||
    !COMPONENT_STATES.has(result.membershipState) ||
    !COMPONENT_STATES.has(result.scopeState) ||
    !COMPONENT_STATES.has(result.contextState) ||
    !COMPONENT_STATES.has(result.bindingState) ||
    !PHASE_STATES.has(result.phaseA) ||
    !PHASE_STATES.has(result.phaseB) ||
    !PHASE_STATES.has(result.phaseC) ||
    !Number.isSafeInteger(result.conflictCount) ||
    result.conflictCount < 0 ||
    !Number.isSafeInteger(result.unexpectedCount) ||
    result.unexpectedCount < 0 ||
    typeof result.databaseWriteExecuted !== 'boolean' ||
    (mode === 'dry-run' && result.databaseWriteExecuted)
  ) {
    fail('runner_executor_result_invalid', 4);
  }
  return Object.freeze({
    MODE: mode,
    TARGET: 'chengxing_demo_admin',
    ACCOUNT_STATE: result.accountState,
    MEMBERSHIP_STATE: result.membershipState,
    SCOPE_STATE: result.scopeState,
    CONTEXT_STATE: result.contextState,
    BINDING_STATE: result.bindingState,
    PHASE_A: result.phaseA,
    PHASE_B: result.phaseB,
    PHASE_C: result.phaseC,
    CONFLICT_COUNT: result.conflictCount,
    UNEXPECTED_COUNT: result.unexpectedCount,
    DATABASE_WRITE_EXECUTED: result.databaseWriteExecuted,
  });
}

function safeFailure(mode, databaseWriteExecuted = false) {
  return Object.freeze({
    MODE: mode,
    TARGET: 'chengxing_demo_admin',
    ACCOUNT_STATE: 'unexpected',
    MEMBERSHIP_STATE: 'not_evaluated',
    SCOPE_STATE: 'not_evaluated',
    CONTEXT_STATE: 'not_evaluated',
    BINDING_STATE: 'not_evaluated',
    PHASE_A: 'unexpected',
    PHASE_B: 'not_run',
    PHASE_C: 'not_run',
    CONFLICT_COUNT: 0,
    UNEXPECTED_COUNT: 1,
    DATABASE_WRITE_EXECUTED: databaseWriteExecuted,
  });
}

function emit(output, values) {
  for (const key of OUTPUT_KEYS) {
    output(`${key}=${String(values[key])}`);
  }
}

export async function runCurrentDemoAdminFormalizationCli(options = {}) {
  const lines = options.output ?? ((line) => process.stdout.write(`${line}\n`));
  let mode = 'dry-run';
  let executorInvoked = false;
  try {
    const args = parseRunnerArguments(options.argv ?? process.argv.slice(2));
    mode = args.mode;
    const rawManifest = await readPrivateJsonFile(
      args.manifestFile,
      options.fileDependencies,
    );
    const manifest = parseAuthorityManifest(rawManifest);
    const actualHead = await assertRepositoryCodeIdentity({
      actualHead: options.actualHead,
      worktreeStatus: options.worktreeStatus,
    });
    if (manifest.expectedCodeSha !== actualHead) {
      fail('runner_head_mismatch');
    }
    const databaseUrl = assertCandidateDatabaseUrl(
      options.databaseUrl ?? options.env?.DATABASE_URL ?? process.env.DATABASE_URL,
    );
    const now = options.now ?? new Date();
    let password = null;
    if (mode === 'execute') {
      const rawLease = await readPrivateJsonFile(
        args.executionLeaseFile,
        options.fileDependencies,
      );
      const lease = parseExecutionLease(rawLease);
      verifyExecutionLease({
        lease,
        manifest,
        manifestSha256: canonicalSha256(rawManifest),
        actualHead,
        now,
      });
      password = options.password ??
        options.env?.ZMTG_CURRENT_DEMO_ADMIN_PASSWORD ??
        process.env.ZMTG_CURRENT_DEMO_ADMIN_PASSWORD ?? null;
      if (
        typeof password !== 'string' ||
        password.length === 0 ||
        Buffer.byteLength(password, 'utf8') > 4096
      ) {
        fail('runner_password_unavailable');
      }
    }

    const executor = options.executor ?? defaultExecutor;
    executorInvoked = true;
    const result = await executor({
      mode,
      manifest,
      password,
      databaseUrl,
      now,
    });
    const values = safeResult(mode, result);
    emit(lines, values);
    return values.CONFLICT_COUNT === 0 && values.UNEXPECTED_COUNT === 0 ? 0 : 4;
  } catch (error) {
    emit(lines, safeFailure(mode, mode === 'execute' && executorInvoked));
    return error instanceof CurrentDemoAdminRunnerError
      ? error.exitCode
      : 4;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runCurrentDemoAdminFormalizationCli();
}
