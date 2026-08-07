import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sql } from 'drizzle-orm';

export const BASE02_B5_TRANSFER_TASK = 'BASE-B5_CROSS_TENANT_TRANSFER';
export const BASE02_B5_AUTHORITY_REF = 'BASE-B5-AUTH-20260806-001';
export const LOCAL_ACCEPTANCE_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:55432/zmtg_clean_local_acceptance';
export const MAX_PRIVATE_FILE_BYTES = 65_536;

const RUNTIME_COMMAND_ID_PATTERN =
  /^mcmd1_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9.:-]{0,95}$/u;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;
const ALLOWED_PRIVATE_FILE_MODES = new Set([0o400, 0o600]);
const O_NOFOLLOW = fsConstants.O_NOFOLLOW;
const execFile = promisify(execFileCallback);

const MANIFEST_KEYS = [
  'accountId',
  'actorId',
  'authorityRef',
  'executionWindowNotAfter',
  'expectedCodeSha',
  'expectedJournalFingerprint',
  'occurredAt',
  'reasonCode',
  'sourceBindingId',
  'sourceExpectedBindingVersion',
  'sourceExpectedMembershipRevision',
  'sourceMembershipId',
  'sourceTenantId',
  'targetBindingExpiresAt',
  'targetBindingId',
  'targetInstitutionId',
  'targetMembershipId',
  'targetTenantId',
  'task',
  'transferCommandId',
  'version',
];

const LEASE_KEYS = [
  'authorityRef',
  'executionAuthorized',
  'expectedCodeSha',
  'manifestSha256',
  'notAfter',
  'notBefore',
  'singleUseNonce',
  'task',
  'version',
];

export class Base02B5TransferRunnerError extends Error {
  constructor(code, exitCode = 3) {
    super(code);
    this.name = 'Base02B5TransferRunnerError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, exitCode = 3) {
  throw new Base02B5TransferRunnerError(code, exitCode);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isCanonicalText(value, maximumLength) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    value.normalize('NFC') === value
  );
}

function isCanonicalInstant(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isPositiveCounter(value) {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value < 2_147_483_647
  );
}

function ensureCount(value, code = 'runner_repository_result_invalid') {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) fail(code, 4);
  return number;
}

function rowList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value[Symbol.iterator] === 'function') {
    return Array.from(value);
  }
  fail('runner_repository_result_invalid', 4);
}

function firstRow(value) {
  const rows = rowList(value);
  if (rows.length !== 1 || !isRecord(rows[0])) {
    fail('runner_repository_result_invalid', 4);
  }
  return rows[0];
}

function safeSerializable(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(safeSerializable);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, safeSerializable(item)]),
    );
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key]);
    }
    return result;
  }
  return value;
}

export function canonicalSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(safeSerializable(value))), 'utf8')
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
      if (index + 1 >= tokens.length) fail('runner_arguments_invalid', 2);
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
    fail('runner_execution_lease_not_allowed_for_dry_run', 2);
  }
  if (mode === 'execute' && executionLeaseFile === null) {
    fail('runner_execution_lease_file_required', 2);
  }

  return Object.freeze({ mode, manifestFile, executionLeaseFile });
}

function assertJsonHasNoDuplicateKeys(source) {
  let index = 0;
  const invalid = () => fail('runner_private_json_invalid', 2);
  const whitespace = () => {
    while (
      source[index] === ' ' ||
      source[index] === '\n' ||
      source[index] === '\r' ||
      source[index] === '\t'
    ) {
      index += 1;
    }
  };
  const parseString = () => {
    if (source[index] !== '"') invalid();
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch {
          invalid();
        }
      }
      if (character === '\\') {
        index += 1;
        const escape = source[index];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/u.test(source.slice(index + 1, index + 5))) {
            invalid();
          }
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(escape)) invalid();
        index += 1;
        continue;
      }
      if (character.charCodeAt(0) <= 0x1f) invalid();
      index += 1;
    }
    invalid();
  };
  const parseNumber = () => {
    const match = source
      .slice(index)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) invalid();
    index += match[0].length;
  };
  const parseLiteral = (literal) => {
    if (source.slice(index, index + literal.length) !== literal) invalid();
    index += literal.length;
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
        if (keys.has(key)) fail('runner_private_json_duplicate_key', 2);
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
    if (character === '-' || (character >= '0' && character <= '9')) {
      parseNumber();
      return;
    }
    if (character === 't') return parseLiteral('true');
    if (character === 'f') return parseLiteral('false');
    if (character === 'n') return parseLiteral('null');
    invalid();
  };

  parseValue();
  whitespace();
  if (index !== source.length) invalid();
}

function fileIdentityMatches(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.nlink === right.nlink &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function validatePrivateFileStat(stat, currentUid) {
  const mode = Number(stat.mode & 0o7777n);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1n ||
    stat.uid !== BigInt(currentUid) ||
    !ALLOWED_PRIVATE_FILE_MODES.has(mode) ||
    stat.size <= 0n ||
    stat.size > BigInt(MAX_PRIVATE_FILE_BYTES)
  ) {
    fail('runner_private_file_unsafe', 2);
  }
}

async function readBounded(fileHandle, expectedSize) {
  const chunks = [];
  let offset = 0;
  while (offset <= MAX_PRIVATE_FILE_BYTES) {
    const remaining = MAX_PRIVATE_FILE_BYTES + 1 - offset;
    const buffer = Buffer.alloc(Math.min(32 * 1024, remaining));
    const { bytesRead } = await fileHandle.read(
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
    fail('runner_private_file_changed', 2);
  }
  return Buffer.concat(chunks, offset);
}

export async function readSecureJsonFile(filePath, dependencies = {}) {
  if (typeof O_NOFOLLOW !== 'number') fail('runner_nofollow_unavailable', 2);
  const currentUid =
    dependencies.currentUid ??
    (typeof process.getuid === 'function' ? process.getuid() : null);
  if (!Number.isSafeInteger(currentUid) || currentUid < 0) {
    fail('runner_identity_unavailable', 2);
  }

  const lstatFile = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  let fileHandle;
  try {
    const before = await lstatFile(filePath, { bigint: true });
    validatePrivateFileStat(before, currentUid);

    fileHandle = await openFile(
      filePath,
      fsConstants.O_RDONLY | O_NOFOLLOW,
    );
    const opened = await fileHandle.stat({ bigint: true });
    validatePrivateFileStat(opened, currentUid);
    if (!fileIdentityMatches(before, opened)) {
      fail('runner_private_file_changed', 2);
    }

    const bytes = await readBounded(fileHandle, Number(opened.size));
    const afterOpen = await fileHandle.stat({ bigint: true });
    const afterPath = await lstatFile(filePath, { bigint: true });
    validatePrivateFileStat(afterOpen, currentUid);
    validatePrivateFileStat(afterPath, currentUid);
    if (
      !fileIdentityMatches(opened, afterOpen) ||
      !fileIdentityMatches(opened, afterPath)
    ) {
      fail('runner_private_file_changed', 2);
    }

    let text;
    try {
      text = new TextDecoder('utf-8', {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
    } catch {
      fail('runner_private_file_encoding_invalid', 2);
    }
    if (text.charCodeAt(0) === 0xfeff) {
      fail('runner_private_file_encoding_invalid', 2);
    }

    assertJsonHasNoDuplicateKeys(text);
    try {
      return JSON.parse(text);
    } catch {
      fail('runner_private_json_invalid', 2);
    }
  } catch (error) {
    if (error instanceof Base02B5TransferRunnerError) throw error;
    fail('runner_private_file_unavailable', 2);
  } finally {
    await fileHandle?.close().catch(() => undefined);
  }
}

export function validateManifest(value) {
  if (!hasExactKeys(value, MANIFEST_KEYS)) {
    fail('runner_manifest_contract_invalid', 2);
  }
  if (
    value.version !== 1 ||
    value.task !== BASE02_B5_TRANSFER_TASK ||
    value.authorityRef !== BASE02_B5_AUTHORITY_REF ||
    !SHA1_PATTERN.test(value.expectedCodeSha) ||
    !RUNTIME_COMMAND_ID_PATTERN.test(value.transferCommandId) ||
    !isCanonicalText(value.accountId, 96) ||
    !isCanonicalText(value.sourceTenantId, 64) ||
    !isCanonicalText(value.sourceMembershipId, 64) ||
    !isPositiveCounter(value.sourceExpectedMembershipRevision) ||
    !isCanonicalText(value.sourceBindingId, 64) ||
    !isPositiveCounter(value.sourceExpectedBindingVersion) ||
    !isCanonicalText(value.targetTenantId, 64) ||
    !isCanonicalText(value.targetInstitutionId, 64) ||
    !isCanonicalText(value.targetMembershipId, 64) ||
    !isCanonicalText(value.targetBindingId, 64) ||
    !isCanonicalText(value.actorId, 96) ||
    !REASON_CODE_PATTERN.test(value.reasonCode) ||
    !isCanonicalInstant(value.occurredAt) ||
    !SHA256_PATTERN.test(value.expectedJournalFingerprint) ||
    !isCanonicalInstant(value.executionWindowNotAfter)
  ) {
    fail('runner_manifest_contract_invalid', 2);
  }
  if (
    value.sourceTenantId === value.targetTenantId ||
    value.executionWindowNotAfter <= value.occurredAt ||
    (
      value.targetBindingExpiresAt !== null &&
      (
        !isCanonicalInstant(value.targetBindingExpiresAt) ||
        value.targetBindingExpiresAt <= value.occurredAt
      )
    )
  ) {
    fail('runner_manifest_contract_invalid', 2);
  }
  return Object.freeze({ ...value });
}

export function validateExecutionLease(value, manifest, manifestSha256, now) {
  if (!hasExactKeys(value, LEASE_KEYS)) {
    fail('runner_execution_lease_contract_invalid', 2);
  }
  if (
    value.version !== 1 ||
    value.task !== BASE02_B5_TRANSFER_TASK ||
    value.authorityRef !== manifest.authorityRef ||
    value.expectedCodeSha !== manifest.expectedCodeSha ||
    value.manifestSha256 !== manifestSha256 ||
    value.executionAuthorized !== true ||
    !SHA256_PATTERN.test(value.manifestSha256) ||
    !isCanonicalInstant(value.notBefore) ||
    !isCanonicalInstant(value.notAfter) ||
    !NONCE_PATTERN.test(value.singleUseNonce) ||
    value.notAfter <= value.notBefore ||
    value.notAfter > manifest.executionWindowNotAfter
  ) {
    fail('runner_execution_lease_contract_invalid', 2);
  }

  const instant = now.toISOString();
  if (instant < value.notBefore || instant > value.notAfter) {
    fail('runner_execution_lease_outside_window', 3);
  }
  return Object.freeze({ ...value });
}

export function isLocalDatabaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    const protocolAllowed =
      url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    const hostname = url.hostname;
    return (
      protocolAllowed &&
      (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname === '::1'
      )
    );
  } catch {
    return false;
  }
}

export function assertSafeShellDatabaseUrl(value) {
  if (value === undefined || value === null || value === '') return;
  if (!isLocalDatabaseUrl(value)) fail('runner_nonlocal_shell_database_url', 2);
}

async function defaultGitState() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
  );
  try {
    const [head, status] = await Promise.all([
      execFile('git', ['rev-parse', 'HEAD'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }),
      execFile('git', ['status', '--porcelain'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }),
    ]);
    return Object.freeze({
      head: head.stdout.trim(),
      clean: status.stdout.length === 0,
    });
  } catch {
    fail('runner_git_state_unavailable', 3);
  }
}

async function openDefaultDatabase() {
  const { createDatabase, createPostgresClient } =
    await import('../../src/server/db/client.ts');
  const client = createPostgresClient(LOCAL_ACCEPTANCE_DATABASE_URL);
  return Object.freeze({
    database: createDatabase(client),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  });
}

async function queryOne(database, statement) {
  return firstRow(await database.execute(statement));
}

async function readJournalFingerprint(database) {
  const exists = await queryOne(database, sql`
    SELECT pg_catalog.to_regclass(
      'drizzle.__drizzle_migrations'
    )::text AS table_name
  `);
  if (exists.table_name === null) return null;

  const migrations = rowList(await database.execute(sql`
    SELECT id, hash, created_at::text AS created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id
  `));
  const columns = rowList(await database.execute(sql`
    SELECT
      table_name,
      column_name,
      data_type,
      is_nullable,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'tenant_members',
        'tenant_membership_transitions',
        'auth_account_institution_bindings',
        'auth_account_institution_binding_transitions',
        'institution_scopes'
      )
    ORDER BY table_name, ordinal_position
  `));
  const constraints = rowList(await database.execute(sql`
    SELECT
      cls.relname AS table_name,
      con.conname AS constraint_name,
      con.contype::text AS constraint_type,
      pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
      con.convalidated AS validated
    FROM pg_catalog.pg_constraint AS con
    JOIN pg_catalog.pg_class AS cls
      ON cls.oid = con.conrelid
    JOIN pg_catalog.pg_namespace AS ns
      ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND cls.relname IN (
        'tenant_members',
        'tenant_membership_transitions',
        'auth_account_institution_bindings',
        'auth_account_institution_binding_transitions',
        'institution_scopes'
      )
    ORDER BY cls.relname, con.conname
  `));

  return canonicalSha256({
    migrations: safeSerializable(migrations),
    columns: safeSerializable(columns),
    constraints: safeSerializable(constraints),
  });
}

async function defaultReadPrestate(database, manifest) {
  return database.transaction(
    async (transaction) => {
      const sourceMembership = await queryOne(transaction, sql`
        SELECT
          count(*)::int AS count,
          coalesce(bool_and(
            lifecycle_status = 'active'
            AND revision IS NOT NULL
            AND revision > 0
            AND current_provenance_source IS NOT NULL
            AND current_provenance_reason_code IS NOT NULL
            AND current_provenance_command_id IS NOT NULL
            AND current_provenance_recorded_at IS NOT NULL
          ), false) AS active_complete,
          coalesce(bool_and(
            revision = ${manifest.sourceExpectedMembershipRevision}
          ), false) AS revision_match,
          coalesce(bool_and(
            user_id = ${manifest.accountId}
          ), false) AS account_match
        FROM tenant_members
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND id = ${manifest.sourceMembershipId}
      `);

      const sourceBinding = await queryOne(transaction, sql`
        SELECT
          count(*)::int AS count,
          coalesce(bool_and(
            status = 'active'
          ), false) AS active_match,
          coalesce(bool_and(
            version = ${manifest.sourceExpectedBindingVersion}
          ), false) AS version_match,
          coalesce(bool_and(
            account_id = ${manifest.accountId}
          ), false) AS account_match
        FROM auth_account_institution_bindings
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND id = ${manifest.sourceBindingId}
      `);

      const targetMembership = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM tenant_members
        WHERE (
          tenant_id = ${manifest.targetTenantId}
          AND user_id = ${manifest.accountId}
        )
        OR id = ${manifest.targetMembershipId}
      `);

      const targetBinding = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_bindings
        WHERE id = ${manifest.targetBindingId}
          OR (
            tenant_id = ${manifest.targetTenantId}
            AND account_id = ${manifest.accountId}
            AND status = 'active'
          )
      `);

      const targetScope = await queryOne(transaction, sql`
        SELECT
          count(*)::int AS count,
          coalesce(bool_and(status = 'active'), false) AS active_match
        FROM institution_scopes
        WHERE tenant_id = ${manifest.targetTenantId}
          AND institution_id = ${manifest.targetInstitutionId}
      `);

      const sourceReplay = await queryOne(transaction, sql`
        SELECT (
          (
            SELECT count(*)::int
            FROM tenant_membership_transitions
            WHERE tenant_id = ${manifest.sourceTenantId}
              AND command_id = ${manifest.transferCommandId}
          )
          +
          (
            SELECT count(*)::int
            FROM auth_account_institution_binding_transitions
            WHERE tenant_id = ${manifest.sourceTenantId}
              AND command_id = ${manifest.transferCommandId}
          )
        )::int AS count
      `);

      const targetReplay = await queryOne(transaction, sql`
        SELECT (
          (
            SELECT count(*)::int
            FROM tenant_membership_transitions
            WHERE tenant_id = ${manifest.targetTenantId}
              AND command_id = ${manifest.transferCommandId}
          )
          +
          (
            SELECT count(*)::int
            FROM auth_account_institution_binding_transitions
            WHERE tenant_id = ${manifest.targetTenantId}
              AND command_id = ${manifest.transferCommandId}
          )
        )::int AS count
      `);

      const concurrentWriter = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM pg_catalog.pg_stat_activity
        WHERE datname = pg_catalog.current_database()
          AND pid <> pg_catalog.pg_backend_pid()
          AND backend_xid IS NOT NULL
      `);

      const preparedTransaction = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM pg_catalog.pg_prepared_xacts
        WHERE database = pg_catalog.current_database()
      `);

      return Object.freeze({
        sourceMembershipCount: ensureCount(sourceMembership.count),
        sourceMembershipActiveComplete:
          sourceMembership.active_complete === true,
        sourceMembershipRevisionMatch:
          sourceMembership.revision_match === true,
        sourceActiveBindingCount: ensureCount(sourceBinding.count),
        sourceBindingVersionMatch: sourceBinding.version_match === true,
        sourceBindingAccountMatch:
          sourceBinding.account_match === true &&
          sourceMembership.account_match === true,
        targetMembershipCount: ensureCount(targetMembership.count),
        targetActiveBindingCount: ensureCount(targetBinding.count),
        targetScopeCount: ensureCount(targetScope.count),
        targetScopeActive: targetScope.active_match === true,
        sameGlobalAccount:
          sourceMembership.account_match === true &&
          sourceBinding.account_match === true,
        sourceCommandReplayCount: ensureCount(sourceReplay.count),
        targetCommandReplayCount: ensureCount(targetReplay.count),
        concurrentWriterCount: ensureCount(concurrentWriter.count),
        preparedTransactionCount: ensureCount(preparedTransaction.count),
        journalFingerprint: await readJournalFingerprint(transaction),
      });
    },
    {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    },
  );
}

async function defaultReadPoststate(database, manifest) {
  return database.transaction(
    async (transaction) => {
      const sourceMembership = await queryOne(transaction, sql`
        SELECT
          count(*) FILTER (
            WHERE lifecycle_status = 'revoked'
          )::int AS revoked_count,
          count(*) FILTER (
            WHERE lifecycle_status = 'active'
          )::int AS active_count
        FROM tenant_members
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND id = ${manifest.sourceMembershipId}
          AND user_id = ${manifest.accountId}
      `);

      const sourceBinding = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_bindings
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND id = ${manifest.sourceBindingId}
          AND account_id = ${manifest.accountId}
          AND status = 'active'
      `);

      const targetMembership = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM tenant_members
        WHERE tenant_id = ${manifest.targetTenantId}
          AND id = ${manifest.targetMembershipId}
          AND user_id = ${manifest.accountId}
          AND lifecycle_status = 'active'
      `);

      const targetBinding = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_bindings
        WHERE tenant_id = ${manifest.targetTenantId}
          AND id = ${manifest.targetBindingId}
          AND account_id = ${manifest.accountId}
          AND institution_id = ${manifest.targetInstitutionId}
          AND status = 'active'
      `);

      const targetScope = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM institution_scopes
        WHERE tenant_id = ${manifest.targetTenantId}
          AND institution_id = ${manifest.targetInstitutionId}
          AND status = 'active'
      `);

      const activeAuthorizationOrphan = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_bindings AS binding
        LEFT JOIN tenant_members AS membership
          ON membership.tenant_id = binding.tenant_id
          AND membership.user_id = binding.account_id
          AND membership.lifecycle_status = 'active'
        WHERE binding.account_id = ${manifest.accountId}
          AND binding.status = 'active'
          AND membership.id IS NULL
      `);

      const activeScopeRelationOrphan = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_bindings AS binding
        LEFT JOIN institution_scopes AS scope
          ON scope.tenant_id = binding.tenant_id
          AND scope.institution_id = binding.institution_id
          AND scope.status = 'active'
        WHERE binding.account_id = ${manifest.accountId}
          AND binding.status = 'active'
          AND scope.tenant_id IS NULL
      `);

      const retainedHistoricalRelationOrphan = await queryOne(
        transaction,
        sql`
          SELECT count(*)::int AS count
          FROM auth_account_institution_bindings AS binding
          LEFT JOIN institution_scopes AS scope
            ON scope.tenant_id = binding.tenant_id
            AND scope.institution_id = binding.institution_id
          WHERE binding.tenant_id = ${manifest.sourceTenantId}
            AND binding.id = ${manifest.sourceBindingId}
            AND binding.account_id = ${manifest.accountId}
            AND binding.status = 'revoked'
            AND scope.tenant_id IS NULL
        `,
      );

      const targetMembershipEvidence = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM tenant_membership_transitions
        WHERE tenant_id = ${manifest.targetTenantId}
          AND membership_id = ${manifest.targetMembershipId}
          AND command_id = ${manifest.transferCommandId}
      `);
      const targetBindingEvidence = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_binding_transitions
        WHERE tenant_id = ${manifest.targetTenantId}
          AND binding_id = ${manifest.targetBindingId}
          AND command_id = ${manifest.transferCommandId}
      `);
      const sourceMembershipEvidence = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM tenant_membership_transitions
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND membership_id = ${manifest.sourceMembershipId}
          AND command_id = ${manifest.transferCommandId}
      `);
      const sourceBindingEvidence = await queryOne(transaction, sql`
        SELECT count(*)::int AS count
        FROM auth_account_institution_binding_transitions
        WHERE tenant_id = ${manifest.sourceTenantId}
          AND binding_id = ${manifest.sourceBindingId}
          AND command_id = ${manifest.transferCommandId}
      `);

      return Object.freeze({
        sourceMembershipRevokedCount:
          ensureCount(sourceMembership.revoked_count),
        sourceMembershipActiveCount:
          ensureCount(sourceMembership.active_count),
        sourceActiveBindingCount: ensureCount(sourceBinding.count),
        targetMembershipActiveCount: ensureCount(targetMembership.count),
        targetActiveBindingCount: ensureCount(targetBinding.count),
        targetScopeActiveCount: ensureCount(targetScope.count),
        activeAuthorizationOrphanCount:
          ensureCount(activeAuthorizationOrphan.count),
        activeScopeRelationOrphanCount:
          ensureCount(activeScopeRelationOrphan.count),
        retainedRevokedHistoricalRelationOrphanCount:
          ensureCount(retainedHistoricalRelationOrphan.count),
        targetMembershipEvidenceCount:
          ensureCount(targetMembershipEvidence.count),
        targetBindingEvidenceCount:
          ensureCount(targetBindingEvidence.count),
        sourceMembershipEvidenceCount:
          ensureCount(sourceMembershipEvidence.count),
        sourceBindingEvidenceCount:
          ensureCount(sourceBindingEvidence.count),
        journalFingerprint: await readJournalFingerprint(transaction),
      });
    },
    {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    },
  );
}

async function defaultExecuteTransfer(database, manifest, now) {
  const [
    { createCrossTenantTransferService },
    { createCrossTenantTransferTransactionPort },
    { createTransactionBoundInstitutionScopeAssertion },
  ] = await Promise.all([
    import(
      '../../src/modules/access-control/application/cross-tenant-transfer-service.ts'
    ),
    import(
      '../../src/modules/access-control/server/cross-tenant-transfer-transaction.ts'
    ),
    import(
      '../../src/modules/tenancy/server/transaction-bound-institution-scope.ts'
    ),
  ]);

  const transactionPort = createCrossTenantTransferTransactionPort(
    database,
    {
      createScopeAssertion: (transaction, isActive) =>
        createTransactionBoundInstitutionScopeAssertion(
          transaction,
          isActive,
        ),
    },
  );
  const service = createCrossTenantTransferService({
    transactionPort,
    createCommandId: () => manifest.transferCommandId,
    now,
  });

  return service.execute(Object.freeze({
    accountId: manifest.accountId,
    sourceTenantId: manifest.sourceTenantId,
    sourceMembershipId: manifest.sourceMembershipId,
    sourceExpectedMembershipRevision:
      manifest.sourceExpectedMembershipRevision,
    sourceBindingId: manifest.sourceBindingId,
    sourceExpectedBindingVersion:
      manifest.sourceExpectedBindingVersion,
    targetTenantId: manifest.targetTenantId,
    targetInstitutionId: manifest.targetInstitutionId,
    targetMembershipId: manifest.targetMembershipId,
    targetBindingId: manifest.targetBindingId,
    actorId: manifest.actorId,
    reasonCode: manifest.reasonCode,
    occurredAt: manifest.occurredAt,
    targetBindingExpiresAt: manifest.targetBindingExpiresAt,
  }));
}

function evaluatePrestate(prestate, manifest) {
  const journalMatch =
    prestate.journalFingerprint === manifest.expectedJournalFingerprint;
  const checks = [
    prestate.sourceMembershipCount === 1,
    prestate.sourceMembershipActiveComplete === true,
    prestate.sourceMembershipRevisionMatch === true,
    prestate.sourceActiveBindingCount === 1,
    prestate.sourceBindingVersionMatch === true,
    prestate.sourceBindingAccountMatch === true,
    prestate.targetMembershipCount === 0,
    prestate.targetActiveBindingCount === 0,
    prestate.targetScopeCount === 1,
    prestate.targetScopeActive === true,
    prestate.sameGlobalAccount === true,
    prestate.sourceCommandReplayCount === 0,
    prestate.targetCommandReplayCount === 0,
    prestate.concurrentWriterCount === 0,
    prestate.preparedTransactionCount === 0,
    journalMatch,
  ];
  return Object.freeze({
    ready: checks.every(Boolean),
    journalMatch,
    conflictCount: checks.filter((value) => !value).length,
  });
}

function evaluatePoststate(poststate, manifest) {
  const journalMatch =
    poststate.journalFingerprint === manifest.expectedJournalFingerprint;
  const sameTransferCommandCorrelation =
    poststate.targetMembershipEvidenceCount === 1 &&
    poststate.targetBindingEvidenceCount === 1 &&
    poststate.sourceMembershipEvidenceCount === 1 &&
    poststate.sourceBindingEvidenceCount === 1;
  const checks = [
    poststate.sourceMembershipRevokedCount === 1,
    poststate.sourceMembershipActiveCount === 0,
    poststate.sourceActiveBindingCount === 0,
    poststate.targetMembershipActiveCount === 1,
    poststate.targetActiveBindingCount === 1,
    poststate.targetScopeActiveCount === 1,
    poststate.activeAuthorizationOrphanCount === 0,
    poststate.activeScopeRelationOrphanCount === 0,
    poststate.retainedRevokedHistoricalRelationOrphanCount === 1,
    sameTransferCommandCorrelation,
    journalMatch,
  ];
  return Object.freeze({
    passed: checks.every(Boolean),
    journalMatch,
    sameTransferCommandCorrelation,
    conflictCount: checks.filter((value) => !value).length,
  });
}

export function classifyOutcomeUnknown(poststate, manifest) {
  const evaluated = evaluatePoststate(poststate, manifest);
  if (evaluated.passed) return 'committed';

  const noEvidence =
    poststate.targetMembershipEvidenceCount === 0 &&
    poststate.targetBindingEvidenceCount === 0 &&
    poststate.sourceMembershipEvidenceCount === 0 &&
    poststate.sourceBindingEvidenceCount === 0;

  if (
    poststate.sourceMembershipActiveCount === 1 &&
    poststate.sourceMembershipRevokedCount === 0 &&
    poststate.sourceActiveBindingCount === 1 &&
    poststate.targetMembershipActiveCount === 0 &&
    poststate.targetActiveBindingCount === 0 &&
    noEvidence &&
    poststate.journalFingerprint === manifest.expectedJournalFingerprint
  ) {
    return 'not_committed';
  }
  return 'indeterminate';
}

function makeDryRunSummary(prestate, evaluated, codeShaMatch) {
  return Object.freeze({
    task: BASE02_B5_TRANSFER_TASK,
    mode: 'dry-run',
    status: evaluated.ready ? 'ready' : 'blocked',
    codeShaMatch,
    prestateMatch: evaluated.ready,
    poststateMatch: null,
    journalMatch: evaluated.journalMatch,
    sourceMembershipCount: prestate.sourceMembershipCount,
    sourceActiveBindingCount: prestate.sourceActiveBindingCount,
    targetMembershipCount: prestate.targetMembershipCount,
    targetActiveBindingCount: prestate.targetActiveBindingCount,
    targetScopeCount: prestate.targetScopeCount,
    sourceCommandReplayCount: prestate.sourceCommandReplayCount,
    targetCommandReplayCount: prestate.targetCommandReplayCount,
    activeAuthorizationOrphanCount: null,
    activeScopeRelationOrphanCount: null,
    retainedHistoricalRelationOrphanCount: null,
    membershipEvidenceCount: null,
    bindingEvidenceCount: null,
    conflict: evaluated.conflictCount,
    unexpected: 0,
    outcomeClassification: null,
  });
}

function makeExecutionSummary({
  status,
  codeShaMatch,
  prestateMatch,
  poststate,
  postEvaluation,
  outcomeClassification,
}) {
  return Object.freeze({
    task: BASE02_B5_TRANSFER_TASK,
    mode: 'execute',
    status,
    codeShaMatch,
    prestateMatch,
    poststateMatch: postEvaluation?.passed ?? false,
    journalMatch: postEvaluation?.journalMatch ?? false,
    sourceMembershipCount: null,
    sourceActiveBindingCount:
      poststate?.sourceActiveBindingCount ?? null,
    targetMembershipCount:
      poststate?.targetMembershipActiveCount ?? null,
    targetActiveBindingCount:
      poststate?.targetActiveBindingCount ?? null,
    targetScopeCount: poststate?.targetScopeActiveCount ?? null,
    sourceCommandReplayCount: null,
    targetCommandReplayCount: null,
    activeAuthorizationOrphanCount:
      poststate?.activeAuthorizationOrphanCount ?? null,
    activeScopeRelationOrphanCount:
      poststate?.activeScopeRelationOrphanCount ?? null,
    retainedHistoricalRelationOrphanCount:
      poststate?.retainedRevokedHistoricalRelationOrphanCount ?? null,
    membershipEvidenceCount: poststate
      ? poststate.targetMembershipEvidenceCount +
        poststate.sourceMembershipEvidenceCount
      : null,
    bindingEvidenceCount: poststate
      ? poststate.targetBindingEvidenceCount +
        poststate.sourceBindingEvidenceCount
      : null,
    conflict: postEvaluation?.conflictCount ?? 1,
    unexpected: 0,
    outcomeClassification,
  });
}

async function withOpenedDatabase(dependencies, work) {
  const opened = await dependencies.openDatabase();
  if (
    !opened ||
    !opened.database ||
    typeof opened.close !== 'function'
  ) {
    fail('runner_database_adapter_invalid', 4);
  }
  try {
    return await work(opened.database);
  } finally {
    await opened.close();
  }
}

function defaultDependencies() {
  return Object.freeze({
    shellDatabaseUrl: process.env.DATABASE_URL,
    now: () => new Date(),
    gitState: defaultGitState,
    readSecureJsonFile,
    openDatabase: openDefaultDatabase,
    readPrestate: defaultReadPrestate,
    readPoststate: defaultReadPoststate,
    executeTransfer: defaultExecuteTransfer,
  });
}

function lowSensitiveErrorCode(error) {
  if (error instanceof Base02B5TransferRunnerError) return error.code;
  return 'runner_unexpected_failure';
}

export async function runBase02B5TransferCli(options = {}) {
  const output = options.output ?? {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  };
  const dependencies = Object.freeze({
    ...defaultDependencies(),
    ...(options.dependencies ?? {}),
  });

  let mode = 'unknown';
  try {
    const args = parseRunnerArguments(
      options.argv ?? process.argv.slice(2),
    );
    mode = args.mode;

    assertSafeShellDatabaseUrl(dependencies.shellDatabaseUrl);

    const rawManifest =
      await dependencies.readSecureJsonFile(args.manifestFile);
    const manifest = validateManifest(rawManifest);
    const manifestSha256 = canonicalSha256(manifest);

    const now = dependencies.now();
    if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
      fail('runner_clock_invalid', 3);
    }
    if (now.toISOString() > manifest.executionWindowNotAfter) {
      fail('runner_manifest_execution_window_expired', 3);
    }

    const gitState = await dependencies.gitState();
    if (
      !gitState ||
      gitState.clean !== true ||
      gitState.head !== manifest.expectedCodeSha
    ) {
      if (gitState?.clean !== true) fail('runner_worktree_not_clean', 3);
      fail('runner_code_sha_mismatch', 3);
    }
    const codeShaMatch = true;

    if (mode === 'dry-run') {
      const prestate = await withOpenedDatabase(
        dependencies,
        (database) =>
          dependencies.readPrestate(database, manifest),
      );
      const evaluated = evaluatePrestate(prestate, manifest);
      output.stdout(
        JSON.stringify(
          makeDryRunSummary(prestate, evaluated, codeShaMatch),
        ),
      );
      return evaluated.ready ? 0 : 3;
    }

    const rawLease = await dependencies.readSecureJsonFile(
      args.executionLeaseFile,
    );
    validateExecutionLease(
      rawLease,
      manifest,
      manifestSha256,
      now,
    );

    const prestate = await withOpenedDatabase(
      dependencies,
      (database) =>
        dependencies.readPrestate(database, manifest),
    );
    const preEvaluation = evaluatePrestate(prestate, manifest);
    if (!preEvaluation.ready) {
      output.stdout(
        JSON.stringify(
          makeExecutionSummary({
            status: 'blocked_prestate',
            codeShaMatch,
            prestateMatch: false,
            poststate: null,
            postEvaluation: null,
            outcomeClassification: null,
          }),
        ),
      );
      return 3;
    }

    const transferResult = await withOpenedDatabase(
      dependencies,
      (database) =>
        dependencies.executeTransfer(
          database,
          manifest,
          dependencies.now,
        ),
    );

    if (
      !transferResult ||
      typeof transferResult.status !== 'string'
    ) {
      fail('runner_transfer_result_invalid', 4);
    }

    if (transferResult.status === 'blocked') {
      output.stdout(
        JSON.stringify(
          makeExecutionSummary({
            status: 'blocked_owner',
            codeShaMatch,
            prestateMatch: true,
            poststate: null,
            postEvaluation: null,
            outcomeClassification: null,
          }),
        ),
      );
      return 4;
    }

    if (
      transferResult.status !== 'applied' &&
      transferResult.status !== 'outcome_unknown'
    ) {
      fail('runner_transfer_result_invalid', 4);
    }

    const poststate = await withOpenedDatabase(
      dependencies,
      (database) =>
        dependencies.readPoststate(database, manifest),
    );
    const postEvaluation = evaluatePoststate(poststate, manifest);

    if (transferResult.status === 'applied') {
      output.stdout(
        JSON.stringify(
          makeExecutionSummary({
            status: postEvaluation.passed
              ? 'applied_verified'
              : 'postcheck_blocked',
            codeShaMatch,
            prestateMatch: true,
            poststate,
            postEvaluation,
            outcomeClassification: null,
          }),
        ),
      );
      return postEvaluation.passed ? 0 : 5;
    }

    const outcomeClassification =
      classifyOutcomeUnknown(poststate, manifest);
    output.stdout(
      JSON.stringify(
        makeExecutionSummary({
          status:
            outcomeClassification === 'committed'
              ? 'applied_verified_after_outcome_unknown'
              : outcomeClassification === 'not_committed'
                ? 'not_committed_after_outcome_unknown'
                : 'outcome_unknown_indeterminate',
          codeShaMatch,
          prestateMatch: true,
          poststate,
          postEvaluation,
          outcomeClassification,
        }),
      ),
    );

    if (outcomeClassification === 'committed') return 0;
    if (outcomeClassification === 'not_committed') return 4;
    return 5;
  } catch (error) {
    const errorCode = lowSensitiveErrorCode(error);
    output.stderr(JSON.stringify({
      task: BASE02_B5_TRANSFER_TASK,
      mode,
      status: 'error',
      errorCode,
    }));
    return error instanceof Base02B5TransferRunnerError
      ? error.exitCode
      : 4;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runBase02B5TransferCli();
}
