import { execFile as execFileCallback, spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants, createReadStream, createWriteStream, readFileSync, realpathSync } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const O_NOFOLLOW = fsConstants.O_NOFOLLOW;
const MAX_EXECUTION_MANIFEST_BYTES = 2 * 1024 * 1024;
const SYS01_ADAPTER_PROCESS_TIMEOUT_MS = 30 * 60 * 1_000;
const ALLOWED_PRIVATE_FILE_MODES = new Set([0o400, 0o600]);
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SYS01_APPLICATION_SMOKE_HOST = '127.0.0.1';
const SYS01_APPLICATION_SMOKE_PORT = 5011;
const SYS01_APPLICATION_SMOKE_PATH = '/api/version';
const SYS01_APPLICATION_STOP_TIMEOUT_MS = 5_000;
const SYS01_EVIDENCE_CONTRACT_VERSION = 'zmtg.sys01.rebuild-evidence/v1';

export const SYS01_REBUILD_TASK =
  'SEVEN_STREAM_SYSTEM_SYS_01_CANDIDATE_BASELINE_AND_CONTROLLED_REBUILD_TOOL';
export const SYS01_REBUILD_CONTRACT_VERSION = 'zmtg.sys01.controlled-local-dev-rebuild/v1';
export const SYS01_SOURCE_BASELINE_COMMIT =
  '5d40cfb0e0862e2b11208918c21808571e67c6db';
export const SYS01_BASELINE_VERSION = 'zmtg.sys01.local-dev-current-schema-baseline/v1';
export const SYS01_BASELINE_ARTIFACT_PATH =
  'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql';
export const SYS01_BASELINE_MANIFEST_PATH =
  'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json';
export const SYS01_PARENT_JOURNAL = Object.freeze({
  tag: '0045_base02_binding_legacy_calibration',
  when: 1785738060856,
});
export const SYS01_EXECUTION_CONFIRMATION = 'S26_SYS01_LOCAL_DEV_EXACT_PHASE';

export const SYS01_PREREQUISITE_ADAPTERS = Object.freeze([
  'backup',
  'restore',
  'candidate-create',
  'baseline-bootstrap',
  'transfer',
  'validate',
]);

export const SYS01_IDENTITIES = Object.freeze({
  original: Object.freeze({
    host: '127.0.0.1',
    port: 55433,
    database: 'zmtg_clean_local_dev',
    container: 'zmtg-local-dev-pg',
    volume: 'zmtg-local-dev-pg-data',
    postgresVersion: '16.14',
    mutable: false,
  }),
  candidate: Object.freeze({
    host: '127.0.0.1',
    port: 55434,
    database: 'zmtg_clean_local_dev_candidate',
    container: 'zmtg-local-dev-candidate-pg',
    volume: 'zmtg-local-dev-candidate-pg-data',
    image: 'postgres:16.14-alpine',
    postgresVersion: '16.14',
  }),
  restoreDrill: Object.freeze({
    host: '127.0.0.1',
    port: 55435,
    database: 'zmtg_clean_local_dev_restore_drill',
    container: 'zmtg-local-dev-restore-drill-pg',
    volume: 'zmtg-local-dev-restore-drill-pg-data',
    image: 'postgres:16.14-alpine',
    postgresVersion: '16.14',
  }),
});

export const SYS01_PHASES = Object.freeze([
  'plan',
  'preflight',
  'backup',
  'restore-drill',
  'candidate-create',
  'baseline-bootstrap',
  'transfer',
  'validate',
  'rollback-readiness',
  'cutover-readiness',
  'post-cutover-verify',
]);

export const SYS01_PHASE_TRANSITIONS = Object.freeze({
  preflight: Object.freeze({ from: 'INITIAL', to: 'PREFLIGHT_PASSED' }),
  backup: Object.freeze({ from: 'PREFLIGHT_PASSED', to: 'BACKUP_VERIFIED' }),
  'restore-drill': Object.freeze({ from: 'BACKUP_VERIFIED', to: 'RESTORE_DRILL_VERIFIED' }),
  'candidate-create': Object.freeze({
    from: 'RESTORE_DRILL_VERIFIED',
    to: 'CANDIDATE_EMPTY_VERIFIED',
  }),
  'baseline-bootstrap': Object.freeze({
    from: 'CANDIDATE_EMPTY_VERIFIED',
    to: 'BASELINE_VERIFIED',
  }),
  transfer: Object.freeze({ from: 'BASELINE_VERIFIED', to: 'TRANSFER_COMPLETED' }),
  validate: Object.freeze({ from: 'TRANSFER_COMPLETED', to: 'VALIDATED' }),
  'rollback-readiness': Object.freeze({ from: 'VALIDATED', to: 'ROLLBACK_READY' }),
  'cutover-readiness': Object.freeze({ from: 'ROLLBACK_READY', to: 'CUTOVER_READY' }),
  'post-cutover-verify': Object.freeze({
    from: 'CUTOVER_READY',
    to: 'POST_CUTOVER_VERIFIED',
  }),
});

const exactCopyTables = [
  'ai_call_usage_records',
  'auth_account_institution_bindings',
  'customer_channel_contact_consents',
  'customer_channel_frequency_states',
  'customers',
  'follow_up_customer_timeline_events',
  'follow_up_message_drafts',
  'follow_up_message_templates',
  'follow_up_path_enrollments',
  'follow_up_path_stages',
  'his_connection_credential_compensation_operations',
  'homepage_brand_assets',
  'homepage_brand_audit_logs',
  'homepage_brand_config_versions',
  'homepage_brand_configs',
  'institution_channel_dry_run_snapshots',
  'knowledge_document_files',
  'knowledge_documents',
  'knowledge_qa_audit_logs',
  'knowledge_quota_usage_records',
  'knowledge_sources',
  'platform_ai_credit_metering_rules',
  'platform_ai_model_config_snapshots',
  'platform_knowledge_institution_visibility',
  'tenant_authorization_snapshots',
  'tenant_commercial_records',
  'tenant_contacts',
  'tenant_plan_assignments',
  'tenant_plan_change_records',
  'tenant_plan_versions',
  'tenant_plans',
  'tenant_quota_snapshots',
  'tenants',
  'wecom_customer_broadcast_recipient_bindings',
  'wecom_customer_mapping_states',
  'wecom_real_send_proof_controls',
  'wecom_real_send_proof_operations',
];

const specialMappingTables = [
  'drizzle.__drizzle_migrations',
  'appointments',
  'audit_events',
  'follow_up_tasks',
  'tenant_members',
  'treatment_summaries',
];

const derivedTables = [
  'knowledge_chunk_embeddings',
  'knowledge_chunks',
  'knowledge_document_file_parse_chunk_embeddings',
  'knowledge_document_file_parse_chunks',
  'knowledge_document_file_parses',
];

const ephemeralTables = [
  'his_connection_credential_compensation_jobs',
  'knowledge_index_jobs',
  'knowledge_indexing_jobs',
  'wecom_customer_broadcast_task_provider_attempts',
];

const secretSensitiveTables = [
  'auth_users',
  'his_connections',
  'platform_ai_provider_configs',
];

const doNotCopyTables = ['wecom_real_send_production_attestations'];

function freezeTableContract(classification, names, action) {
  return names.map((table) => Object.freeze({ table, classification, action }));
}

export const SYS01_TABLE_CONTRACT = Object.freeze([
  ...freezeTableContract('MUST_PRESERVE', exactCopyTables, 'exact_copy'),
  ...freezeTableContract('REQUIRES_SPECIAL_MAPPING', specialMappingTables, 'special_mapping'),
  ...freezeTableContract('DERIVED', derivedTables, 'target_empty'),
  ...freezeTableContract('EPHEMERAL', ephemeralTables, 'target_empty_no_retry'),
  ...freezeTableContract('SECRET_SENSITIVE', secretSensitiveTables, 'opaque_copy_or_empty_guard'),
  ...freezeTableContract('DO_NOT_COPY', doNotCopyTables, 'target_empty'),
].sort((left, right) => left.table.localeCompare(right.table)));

export const SYS01_TARGET_ONLY_CONTRACT = Object.freeze([
  Object.freeze({ table: 'institution_scopes', action: 'target_empty_no_guess' }),
  Object.freeze({ table: 'institution_operating_context_versions', action: 'target_empty_no_guess' }),
  Object.freeze({ table: 'institution_operating_contexts', action: 'target_empty_no_guess' }),
  Object.freeze({ table: 'tenant_membership_transitions', action: 'membership_calibration_only' }),
  Object.freeze({ table: 'auth_account_institution_binding_transitions', action: 'target_empty_no_guess' }),
]);

const MANIFEST_KEYS = Object.freeze([
  'artifactPath',
  'artifactSha256',
  'canonicalizationVersion',
  'createdByContractVersion',
  'parentJournalTag',
  'parentJournalWhen',
  'schemaFingerprintSha256',
  'schemaSource',
  'sourceBaselineCommit',
  'toolingBlobs',
  'version',
]);

const EXECUTION_MANIFEST_KEYS = Object.freeze([
  'baselineManifestSha256',
  'capturedAt',
  'implementationHead',
  'lowSensitiveAggregateFingerprint',
  'mappingContractSha256',
  'perTableRowCounts',
  'phaseReceipts',
  'secretOpaqueEqualityPolicy',
  'sourceBaselineCommit',
  'sourceCatalogFingerprint',
  'sourceTableSet',
  'state',
  'task',
  'version',
]);

const EXPECTED_SCHEMA_SOURCE = Object.freeze({
  catalogObjectCounts: Object.freeze({
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
  }),
  drizzleKitVersion: '0.31.10',
  drizzleOrmVersion: '0.45.2',
  generationCommand:
    'pnpm exec drizzle-kit export --schema ./src/server/db/schema.ts --dialect postgresql',
  modelSource: 'src/server/db/schema.ts',
  reviewedHandWrittenFinalCatalog: Object.freeze([
    'two_not_valid_foreign_keys',
    'two_historical_enum_orders',
    'four_trigger_functions',
    'seven_enabled_triggers',
  ]),
});

export function isExpectedSchemaSource(value) {
  return canonicalJson(value) === canonicalJson(EXPECTED_SCHEMA_SOURCE);
}

const mappingContractSha256 = () =>
  sha256Bytes(
    Buffer.from(
      canonicalJson({ source: SYS01_TABLE_CONTRACT, targetOnly: SYS01_TARGET_ONLY_CONTRACT }),
      'utf8',
    ),
  );

export class Sys01RebuildError extends Error {
  constructor(code, exitCode = 3) {
    super(code);
    this.name = 'Sys01RebuildError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

function fail(code, exitCode = 3) {
  throw new Sys01RebuildError(code, exitCode);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { $binaryHex: value.toString('hex') };
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function gitBlobOid(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function normalizeSql(value) {
  let result = '';
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let pendingSpace = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
        pendingSpace = true;
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        pendingSpace = true;
        index += 1;
      }
      continue;
    }
    if (!single && !double && character === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!single && !double && character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (!double && character === "'") {
      if (pendingSpace && result.length > 0 && !result.endsWith(' ')) result += ' ';
      pendingSpace = false;
      result += character;
      if (single && next === "'") {
        result += next;
        index += 1;
      } else {
        single = !single;
      }
      continue;
    }
    if (!single && character === '"') {
      if (pendingSpace && result.length > 0 && !result.endsWith(' ')) result += ' ';
      pendingSpace = false;
      result += character;
      if (double && next === '"') {
        result += next;
        index += 1;
      } else {
        double = !double;
      }
      continue;
    }
    if (!single && !double && /\s/u.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && result.length > 0 && !result.endsWith(' ')) result += ' ';
    pendingSpace = false;
    result += character;
  }
  return result.trim();
}

function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarTag !== null) {
      if (source.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (!single && !double && character === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!single && !double && character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (!double && character === "'" && source[index - 1] !== '\\') {
      if (single && next === "'") {
        index += 1;
      } else {
        single = !single;
      }
      continue;
    }
    if (!single && character === '"' && source[index - 1] !== '\\') {
      if (double && next === '"') {
        index += 1;
      } else {
        double = !double;
      }
      continue;
    }
    if (!single && !double && character === '$') {
      const match = source.slice(index).match(/^\$[A-Za-z0-9_]*\$/u);
      if (match) {
        dollarTag = match[0];
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (!single && !double && character === ';') {
      const statement = source.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  if (single || double || blockComment || dollarTag !== null) fail('baseline_sql_parse_failed');
  const remainder = source.slice(start).trim();
  if (remainder) statements.push(remainder);
  return statements;
}

function splitTopLevelCommas(source) {
  const result = [];
  let depth = 0;
  let single = false;
  let double = false;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (!double && character === "'") {
      if (single && next === "'") index += 1;
      else single = !single;
      continue;
    }
    if (!single && character === '"') {
      if (double && next === '"') index += 1;
      else double = !double;
      continue;
    }
    if (single || double) continue;
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      result.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(source.slice(start).trim());
  return result.filter(Boolean);
}

function normalizedIdentifier(value) {
  return value.replaceAll('"', '').replace(/^public\./u, '');
}

function postgresIdentifier(value) {
  const normalized = normalizedIdentifier(value);
  const bytes = Buffer.from(normalized, 'utf8');
  if (bytes.length <= 63) return normalized;
  let end = 63;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return bytes.subarray(0, end).toString('utf8');
}

function constraintClass(definition) {
  const normalized = definition.toUpperCase();
  if (normalized.includes('PRIMARY KEY')) return 'primary_keys';
  if (normalized.includes('FOREIGN KEY')) return 'foreign_keys';
  if (normalized.includes('UNIQUE')) return 'uniques';
  if (normalized.includes('CHECK')) return 'checks';
  return null;
}

function normalizeCatalogExpression(
  value,
  {
    stripQualifiers = false,
    normalizeCatalogCoercions = false,
    knownColumnTypes = null,
    defaultResultType = null,
  } = {},
) {
  const literals = [];
  let normalized = normalizeSql(value).replace(/'(?:''|[^'])*'/gu, (literal) => {
    const token = `__ZMTG_SQL_LITERAL_${literals.length}__`;
    literals.push(literal);
    return token;
  });
  normalized = normalized
    .replaceAll('"', '')
    .replace(/\bpublic\./giu, '')
    .replace(/\s*([(),=<>+])\s*/gu, '$1')
    .replace(/\s*(!~|~)\s*/gu, '$1')
    .replace(/\s+/gu, ' ')
    .replace(/;$/u, '')
    .trim();
  if (stripQualifiers) normalized = normalized.replace(/\b[a-z_][a-z0-9_]*\./giu, '');
  if (normalizeCatalogCoercions) {
    normalized = normalized.replace(
      /\b(and|or|not|in|is|null|between|interval|any|all|like|trim|btrim|true|false)\b/giu,
      (keyword) => keyword.toUpperCase(),
    );
  }
  normalized = normalized.replace(/__ZMTG_SQL_LITERAL_(\d+)__/gu, (_match, index) => literals[Number(index)]);
  if (normalizeCatalogCoercions) {
    const castType = '(?:character varying|varchar|text|integer|bigint|boolean|timestamp with time zone|timestamptz|jsonb|[a-z_][a-z0-9_]*)';
    const normalizeCoercionType = (type) => String(type)
      .toLowerCase()
      .replace(/^public\./u, '')
      .replace(/^varchar(?=\(|$)/u, 'character varying')
      .replace(/^timestamptz$/u, 'timestamp with time zone')
      .replace(/\([^)]*\)$/u, '');
    const isEquivalentCoercion = (cast, target) => {
      const normalizedCast = normalizeCoercionType(cast);
      const normalizedTarget = normalizeCoercionType(target);
      if (normalizedCast === normalizedTarget) return true;
      const strings = new Set(['text', 'character varying']);
      return strings.has(normalizedCast) && strings.has(normalizedTarget);
    };
    const stripLiteralCast = (literal, cast, target) =>
      isEquivalentCoercion(cast, target) ? literal : `${literal}::${cast}`;
    normalized = normalized
      .replace(
        new RegExp(`(\\(?)([a-z_][a-z0-9_]*)(\\)?)::(${castType})`, 'giu'),
        (match, open, column, close, cast) => {
          const target = knownColumnTypes?.get(column);
          return target && isEquivalentCoercion(cast, target)
            ? `${open}${column}${close}`
            : match;
        },
      )
      .replace(
        new RegExp(`\\b([a-z_][a-z0-9_]*)\\s*(NOT LIKE|LIKE|!~|~|=|<>|<=|>=|<|>)\\s*('(?:''|[^'])*')::(${castType})`, 'giu'),
        (match, column, operator, literal, cast) => {
          const target = knownColumnTypes?.get(column);
          return target && isEquivalentCoercion(cast, target)
            ? `${column}${operator}${literal}`
            : match;
        },
      )
      .replace(
        new RegExp(`('(?:''|[^'])*')::(${castType})\\s*(NOT LIKE|LIKE|!~|~|=|<>|<=|>=|<|>)\\s*([a-z_][a-z0-9_]*)\\b`, 'giu'),
        (match, literal, cast, operator, column) => {
          const target = knownColumnTypes?.get(column);
          return target && isEquivalentCoercion(cast, target)
            ? `${literal}${operator}${column}`
            : match;
        },
      )
      .replace(
        /\b([a-z_][a-z0-9_]*)=ANY\(ARRAY\[([^\]]*)\](?:::([a-z_][a-z0-9_ ]*)\[\])?\)/giu,
        (match, left, entries, arrayCast) => {
          const target = knownColumnTypes?.get(left);
          if (!target || (arrayCast && !isEquivalentCoercion(arrayCast, target))) return match;
          const normalizedEntries = splitTopLevelCommas(entries).map((entry) =>
            entry.replace(
              new RegExp(`^('(?:''|[^'])*')::(${castType})$`, 'iu'),
              (_entry, literal, cast) => stripLiteralCast(literal, cast, target),
            ));
          if (normalizedEntries.some((entry) => /::/u.test(entry))) return match;
          return `${left} IN(${normalizedEntries.join(',')})`;
        },
      )
      .replace(
        /\b([a-z_][a-z0-9_]*)<>ALL\(ARRAY\[([^\]]*)\](?:::([a-z_][a-z0-9_ ]*)\[\])?\)/giu,
        (match, left, entries, arrayCast) => {
          const target = knownColumnTypes?.get(left);
          if (!target || (arrayCast && !isEquivalentCoercion(arrayCast, target))) return match;
          const normalizedEntries = splitTopLevelCommas(entries).map((entry) =>
            entry.replace(
              new RegExp(`^('(?:''|[^'])*')::(${castType})$`, 'iu'),
              (_entry, literal, cast) => stripLiteralCast(literal, cast, target),
            ));
          if (normalizedEntries.some((entry) => /::/u.test(entry))) return match;
          return `${left} NOT IN(${normalizedEntries.join(',')})`;
        },
      )
      .replace(
        /\b([a-z_][a-z0-9_]*)\s+BETWEEN\s+([^\s()]+)\s+AND\s+([^\s()]+)/giu,
        (_match, operand, lower, upper) => `${operand}>=${lower} AND ${operand}<=${upper}`,
      )
      .replace(/\bINTERVAL\s+'(\d+)\s+(hour|hours|minute|minutes|second|seconds)'/giu,
        (_match, count, unit) => {
          const multiplier = unit.toLowerCase().startsWith('hour')
            ? 3_600
            : unit.toLowerCase().startsWith('minute')
              ? 60
              : 1;
          return `INTERVAL_SECONDS(${Number(count) * multiplier})`;
        })
      .replace(/'(\d{1,3}):(\d{2}):(\d{2})'::interval/giu,
        (_match, hours, minutes, seconds) =>
          `INTERVAL_SECONDS(${Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)})`)
      .replace(/\bTRIM\(BOTH FROM ([^()]*)\)/giu, 'BTRIM($1)')
      .replace(/\bTRIM\(([^()]*)\)/giu, 'BTRIM($1)')
      .replace(/\bBTRIM\(/giu, 'BTRIM(')
      .replace(/\(\(([a-z_][a-z0-9_]*)\)\)/giu, '($1)')
      .replace(
        /(?<![A-Za-z0-9_])\(([a-z_][a-z0-9_]*)\)(?=\s*(?:NOT LIKE|LIKE|!~|~|=|<>|<=|>=|<|>))/giu,
        '$1',
      )
      .replace(/\s+/gu, ' ')
      .trim();
    if (defaultResultType) {
      normalized = normalized.replace(
        new RegExp(`^('(?:''|[^'])*')::(${castType})$`, 'iu'),
        (match, literal, cast) =>
          isEquivalentCoercion(cast, defaultResultType) ? literal : match,
      );
    }
  }
  if (normalizeCatalogCoercions) {
    normalized = canonicalizeBooleanExpression(
      normalized
        .replace(/\)(AND|OR)\(/gu, ') $1 (')
        .replace(/\b(AND|OR)\b/gu, ' $1 ')
        .replace(/\s+/gu, ' ')
        .trim(),
    );
  }
  return normalized;
}

function splitOuterParentheses(value) {
  let depth = 0;
  let single = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === "'") {
      if (single && next === "'") index += 1;
      else single = !single;
      continue;
    }
    if (single) continue;
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth === 0 && index < value.length - 1) return false;
  }
  return depth === 0 && !single;
}

function splitTopLevelBoolean(value, operator) {
  const parts = [];
  let depth = 0;
  let single = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === "'") {
      if (single && next === "'") index += 1;
      else single = !single;
      continue;
    }
    if (single) continue;
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (
      depth === 0 &&
      value.slice(index, index + operator.length).toUpperCase() === operator &&
      !/[A-Za-z0-9_]/u.test(value[index - 1] ?? '') &&
      !/[A-Za-z0-9_]/u.test(value[index + operator.length] ?? '')
    ) {
      parts.push(value.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  if (parts.length === 0) return [value.trim()];
  parts.push(value.slice(start).trim());
  return parts;
}

function canonicalizeBooleanExpression(value) {
  const parse = (source) => {
    let expression = source.trim();
    while (
      expression.startsWith('(') &&
      expression.endsWith(')') &&
      splitOuterParentheses(expression)
    ) {
      expression = expression.slice(1, -1).trim();
    }
    const orParts = splitTopLevelBoolean(expression, 'OR');
    if (orParts.length > 1) return { operator: 'OR', children: orParts.map(parse) };
    const andParts = splitTopLevelBoolean(expression, 'AND');
    if (andParts.length > 1) return { operator: 'AND', children: andParts.map(parse) };
    return {
      operator: null,
      value: expression.replace(
        /(=|<>|<=|>=|<|>)\(([^()]+)\+INTERVAL_SECONDS\((\d+)\)\)/gu,
        '$1$2+INTERVAL_SECONDS($3)',
      ).replace(
        /(=|<>|<=|>=|<|>)\(([^()]+\+[^()]*)\)/gu,
        '$1$2',
      ),
    };
  };
  const serialize = (node, parentPrecedence = 0) => {
    if (node.operator === null) return node.value;
    const precedence = node.operator === 'OR' ? 1 : 2;
    const children = node.children.flatMap((child) =>
      child.operator === node.operator ? child.children : [child],
    );
    const serialized = children
      .map((child) => serialize(child, precedence))
      .join(` ${node.operator} `);
    return precedence < parentPrecedence ? `(${serialized})` : serialized;
  };
  return serialize(parse(value));
}

function normalizeColumnType(definition) {
  const type = definition.match(
    /^(.+?)(?=\s+(?:DEFAULT|NOT NULL|PRIMARY KEY|UNIQUE|CHECK|REFERENCES|GENERATED|COLLATE)\b|$)/iu,
  )?.[1];
  if (!type) fail('baseline_column_type_parse_failed');
  return normalizedIdentifier(type)
    .replace(/^varchar(?=\(|$)/iu, 'character varying')
    .replace(/^timestamptz$/iu, 'timestamp with time zone')
    .replace(/\s*,\s*/gu, ',')
    .toLowerCase();
}

function identifierList(source) {
  return splitTopLevelCommas(source).map((entry) => normalizeCatalogExpression(entry));
}

function constraintSignature(definition, kind) {
  const normalized = definition.toUpperCase();
  const shared = {
    validated: !normalized.includes('NOT VALID'),
    deferrable: /(?:^|\s)DEFERRABLE(?:\s|$)/u.test(normalized),
    deferred: normalized.includes('INITIALLY DEFERRED'),
  };
  if (kind === 'checks') {
    const checkStart = normalized.indexOf('CHECK');
    const open = definition.indexOf('(', checkStart);
    const close = definition.lastIndexOf(')');
    if (open === -1 || close <= open) fail('baseline_constraint_parse_failed');
    return { ...shared, expression: normalizeCatalogExpression(definition.slice(open + 1, close), { stripQualifiers: true }) };
  }
  if (kind === 'primary_keys' || kind === 'uniques') {
    const keys = definition.match(/(?:PRIMARY KEY|UNIQUE(?:\s+NULLS\s+NOT\s+DISTINCT)?)\s*\(([^)]*)\)/iu)?.[1];
    if (keys === undefined) fail('baseline_constraint_parse_failed');
    return {
      ...shared,
      keys: identifierList(keys),
      ...(kind === 'uniques'
        ? { nullsNotDistinct: normalized.includes('NULLS NOT DISTINCT') }
        : {}),
    };
  }
  const foreign = definition.match(
    /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(.+?)\s*\(([^)]*)\)/iu,
  );
  if (!foreign) fail('baseline_constraint_parse_failed');
  const match = normalized.match(/\bMATCH\s+(FULL|PARTIAL|SIMPLE)\b/u)?.[1]?.toLowerCase() ?? 'simple';
  const onUpdate = normalized.match(/\bON UPDATE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)\b/u)?.[1]?.toLowerCase().replaceAll(' ', '_') ?? 'no_action';
  const onDelete = normalized.match(/\bON DELETE\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)\b/u)?.[1]?.toLowerCase().replaceAll(' ', '_') ?? 'no_action';
  const referencedParts = foreign[2].replaceAll('"', '').split('.');
  return {
    ...shared,
    keys: identifierList(foreign[1]),
    referencedSchema: referencedParts.length > 1 ? referencedParts.at(-2) : 'public',
    referencedTable: postgresIdentifier(foreign[2]),
    referencedKeys: identifierList(foreign[3]),
    match,
    onUpdate,
    onDelete,
  };
}

function indexSignature(unique, definition) {
  const match = definition.match(
    /^(.+?)\s+USING\s+([A-Za-z0-9_]+)\s*\(([^()]*)\)([\s\S]*?)\s*;?$/iu,
  );
  if (!match) fail('baseline_index_parse_failed');
  const include = match[4].match(/\bINCLUDE\s*\(([^)]*)\)/iu)?.[1];
  const predicate = match[4].match(/\bWHERE\s+([\s\S]*?);?$/iu)?.[1];
  return {
    table: postgresIdentifier(match[1]),
    unique,
    nullsNotDistinct: /\bNULLS\s+NOT\s+DISTINCT\b/iu.test(definition),
    method: match[2].toLowerCase(),
    keys: identifierList(match[3]).map((key) => normalizeCatalogExpression(key, { stripQualifiers: true })),
    include: include ? identifierList(include) : [],
    predicate: predicate ? normalizeCatalogExpression(predicate, { stripQualifiers: true }) : null,
  };
}

function normalizedFunctionDefinition(statement) {
  const normalized = normalizeSql(statement);
  const body = statement.match(/AS\s+\$function\$\s*([\s\S]*?)\s*\$function\$/iu)?.[1];
  if (body === undefined) fail('baseline_function_parse_failed');
  const identity = normalized.match(
    /^CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+(.+?)\(([^)]*)\)/iu,
  );
  if (!identity) fail('baseline_function_parse_failed');
  const searchPath = normalized.match(
    /\bSET search_path\s*(?:=|TO)\s*(.+?)\s+AS\s+\$function\$/iu,
  )?.[1];
  return {
    identity: `${normalizedIdentifier(identity[1])}(${normalizeCatalogExpression(identity[2])})`,
    language: normalized.match(/\bLANGUAGE\s+([A-Za-z0-9_]+)/iu)?.[1]?.toLowerCase(),
    returns: normalizedIdentifier(normalized.match(/\bRETURNS\s+([^\s]+)/iu)?.[1] ?? '').toLowerCase(),
    volatility: /\bIMMUTABLE\b/iu.test(normalized)
      ? 'immutable'
      : /\bSTABLE\b/iu.test(normalized)
        ? 'stable'
        : 'volatile',
    security: /\bSECURITY\s+DEFINER\b/iu.test(normalized) ? 'definer' : 'invoker',
    parallel: normalized.match(/\bPARALLEL\s+(SAFE|RESTRICTED|UNSAFE)\b/iu)?.[1]?.toLowerCase() ?? 'unsafe',
    strict: /\bSTRICT\b|\bRETURNS\s+NULL\s+ON\s+NULL\s+INPUT\b/iu.test(normalized),
    leakproof: /\bLEAKPROOF\b/iu.test(normalized),
    cost: Number(normalized.match(/\bCOST\s+([0-9]+(?:\.[0-9]+)?)/iu)?.[1] ?? 100),
    rows: Number(normalized.match(/\bROWS\s+([0-9]+(?:\.[0-9]+)?)/iu)?.[1] ?? 0),
    body: normalizeCatalogExpression(body),
    config: searchPath
      ? [`search_path=${identifierList(searchPath).map((entry) => entry.replace(/^'|'$/gu, '')).join(',')}`]
      : [],
  };
}

function functionSignature(statement) {
  const definition = normalizedFunctionDefinition(statement);
  const { identity: _identity, ...signature } = definition;
  return { ...signature, definition: statement };
}

function triggerSignature(normalized) {
  const match = normalized.match(
    /^CREATE TRIGGER "?([^"\s]+)"?\s+(BEFORE|AFTER|INSTEAD OF)\s+(.+?)\s+ON\s+(.+?)\s+FOR EACH\s+(ROW|STATEMENT)\s+EXECUTE FUNCTION\s+(.+?)\(\);?$/iu,
  );
  if (!match) fail('baseline_trigger_parse_failed');
  return {
    table: normalizedIdentifier(match[4]),
    timing: match[2].toLowerCase().replaceAll(' ', '_'),
    events: match[3].split(/\s+OR\s+/iu).map((event) => event.toLowerCase()).sort(),
    level: match[5].toLowerCase(),
    function: `${normalizedIdentifier(match[6])}()`,
    enabled: 'O',
    definition: normalizeTriggerDefinition(normalized),
  };
}

function normalizeTriggerDefinition(definition) {
  const normalized = normalizeCatalogExpression(definition, { stripQualifiers: true });
  const match = normalized.match(
    /^(CREATE TRIGGER\s+[^\s]+\s+(?:BEFORE|AFTER|INSTEAD OF)\s+)(.+?)(\s+ON\s+[\s\S]+)$/iu,
  );
  if (!match) fail('baseline_trigger_parse_failed');
  const events = match[2]
    .split(/\s+OR\s+/iu)
    .map((event) => event.trim().toUpperCase())
    .sort();
  return `${match[1]}${events.join(' OR ')}${match[3]}`;
}

export function buildExpectedCatalogModel(sqlSource) {
  const records = [{ objectClass: 'schemas', schema: 'public', name: 'public', signature: 'public' }];
  for (const statement of splitSqlStatements(sqlSource)) {
    const normalized = normalizeSql(statement);
    let match = normalized.match(/^CREATE TYPE (.+?) AS ENUM\((.*)\);?$/iu);
    if (match) {
      const name = postgresIdentifier(match[1]);
      const labels = [...match[2].matchAll(/'((?:''|[^'])*)'/gu)].map((entry) =>
        entry[1].replaceAll("''", "'"),
      );
      records.push({ objectClass: 'types', schema: 'public', name, signature: 'enum' });
      records.push({ objectClass: 'enums', schema: 'public', name, signature: labels });
      continue;
    }
    match = normalized.match(/^CREATE TABLE (.+?) \((.*)\);?$/iu);
    if (match) {
      const table = postgresIdentifier(match[1]);
      records.push({ objectClass: 'tables', schema: 'public', name: table, signature: 'table' });
      for (const item of splitTopLevelCommas(match[2])) {
        const column = item.match(/^"([^"]+)"\s+(.+)$/u);
        if (column && !/^CONSTRAINT\s/iu.test(item)) {
          const definition = normalizeSql(column[2]);
          const identity = definition.match(/\bGENERATED\s+(ALWAYS|BY DEFAULT)\s+AS\s+IDENTITY\b/iu)?.[1];
          const generatedExpression = definition.match(/\bGENERATED\s+ALWAYS\s+AS\s*\((.*)\)\s+STORED\b/iu)?.[1];
          const columnName = postgresIdentifier(column[1]);
          records.push({
            objectClass: 'columns',
            schema: 'public',
            name: `${table}.${columnName}`,
            signature: {
              type: normalizeColumnType(definition),
              identity: identity === 'ALWAYS' ? 'a' : identity === 'BY DEFAULT' ? 'd' : '',
              generated: generatedExpression === undefined ? '' : 's',
              generatedExpression:
                generatedExpression === undefined
                  ? null
                  : normalizeCatalogExpression(generatedExpression, { stripQualifiers: true }),
            },
          });
          if (/\bPRIMARY KEY\b/iu.test(definition)) {
            records.push({ objectClass: 'primary_keys', schema: 'public', name: `${table}.${postgresIdentifier(`${table}_pkey`)}`, signature: { validated: true, deferrable: false, deferred: false, keys: [columnName] } });
          }
          records.push({ objectClass: 'nullability', schema: 'public', name: `${table}.${columnName}`, signature: /\bNOT NULL\b/iu.test(definition) ? 'not_null' : 'nullable' });
          const defaultMatch = definition.match(/\bDEFAULT\s+(.+?)(?:\s+NOT NULL)?$/iu);
          if (defaultMatch) records.push({
            objectClass: 'defaults',
            schema: 'public',
            name: `${table}.${columnName}`,
            signature: {
              expression: normalizeCatalogExpression(defaultMatch[1]),
              resultType: normalizeColumnType(definition),
            },
          });
          continue;
        }
        const kind = constraintClass(item);
        if (kind) {
          const nameMatch = item.match(/^CONSTRAINT\s+"?([^"\s]+)"?/iu);
          records.push({ objectClass: kind, schema: 'public', name: `${table}.${postgresIdentifier(nameMatch?.[1] ?? sha256Bytes(item).slice(0, 16))}`, signature: constraintSignature(item, kind) });
        }
      }
      continue;
    }
    match = normalized.match(/^ALTER TABLE (.+?) ADD CONSTRAINT "?([^"\s]+)"? (.*);?$/iu);
    if (match) {
      const kind = constraintClass(match[3]);
      if (kind) records.push({ objectClass: kind, schema: 'public', name: `${postgresIdentifier(match[1])}.${postgresIdentifier(match[2])}`, signature: constraintSignature(match[3], kind) });
      continue;
    }
    match = normalized.match(/^CREATE (UNIQUE )?INDEX "?([^"\s]+)"? ON (.*);?$/iu);
    if (match) {
      records.push({ objectClass: 'indexes', schema: 'public', name: postgresIdentifier(match[2]), signature: indexSignature(Boolean(match[1]), match[3]) });
      continue;
    }
    match = normalized.match(/^CREATE FUNCTION (.+?)\(([^)]*)\)/iu);
    if (match) {
      records.push({
        objectClass: 'functions',
        schema: 'public',
        name: `${normalizedIdentifier(match[1])}(${normalizeCatalogExpression(match[2])})`,
        signature: functionSignature(statement),
      });
      continue;
    }
    match = normalized.match(/^CREATE TRIGGER "?([^"\s]+)"?/iu);
    if (match) {
      records.push({ objectClass: 'triggers', schema: 'public', name: postgresIdentifier(match[1]), signature: triggerSignature(normalized) });
    }
  }
  records.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return records;
}

function normalizeCatalogRecord(record, columnTypes) {
  const normalized = canonicalize(record);
  if (!isRecord(normalized)) return normalized;
  if (normalized.objectClass === 'defaults') {
    normalized.signature.expression = normalizeCatalogExpression(
      normalized.signature.expression,
      {
      normalizeCatalogCoercions: true,
        defaultResultType: normalized.signature.resultType,
      },
    );
    normalized.signature.resultType = normalizeColumnType(normalized.signature.resultType);
  }
  if (!isRecord(normalized.signature)) return normalized;
  if (normalized.objectClass === 'columns') {
    normalized.signature.type = normalizeColumnType(String(normalized.signature.type));
  }
  if (normalized.objectClass === 'checks') {
    const table = normalized.name.split('.')[0];
    normalized.signature.expression = normalizeCatalogExpression(
      normalized.signature.expression,
      {
        stripQualifiers: true,
        normalizeCatalogCoercions: true,
        knownColumnTypes: columnTypes.get(table) ?? new Map(),
      },
    );
  }
  if (normalized.objectClass === 'indexes') {
    normalized.signature.keys = normalized.signature.keys.map((key) =>
      normalizeCatalogExpression(key, { stripQualifiers: true }),
    );
    normalized.signature.include = normalized.signature.include.map((key) =>
      normalizeCatalogExpression(key, { stripQualifiers: true }),
    );
    normalized.signature.predicate = normalized.signature.predicate === null
      ? null
      : normalizeCatalogExpression(normalized.signature.predicate, {
        stripQualifiers: true,
        normalizeCatalogCoercions: true,
        knownColumnTypes: columnTypes.get(normalized.signature.table) ?? new Map(),
      });
  }
  if (normalized.objectClass === 'functions') {
    normalized.signature.body = normalizeCatalogExpression(normalized.signature.body);
    normalized.signature.config = normalized.signature.config.map((entry) =>
      String(entry).replace(/\s+/gu, ''),
    );
    if (typeof normalized.signature.definition === 'string') {
      normalized.signature.definition = normalizedFunctionDefinition(
        normalized.signature.definition,
      );
    } else if (!isRecord(normalized.signature.definition)) {
      fail('baseline_function_parse_failed');
    }
  }
  if (normalized.objectClass === 'triggers') {
    normalized.signature.definition = normalizeTriggerDefinition(
      normalized.signature.definition,
    );
  }
  return normalized;
}

export function canonicalCatalogRecords(records) {
  if (!Array.isArray(records)) fail('catalog_records_invalid');
  const columnTypes = new Map();
  for (const record of records) {
    if (record?.objectClass !== 'columns' || !isRecord(record.signature)) continue;
    const separator = record.name.indexOf('.');
    if (separator <= 0) continue;
    const table = record.name.slice(0, separator);
    const column = record.name.slice(separator + 1);
    const tableTypes = columnTypes.get(table) ?? new Map();
    tableTypes.set(column, record.signature.type);
    columnTypes.set(table, tableTypes);
  }
  return records
    .map((record) => normalizeCatalogRecord(record, columnTypes))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

export function catalogFingerprintFromRecords(records) {
  return sha256Bytes(Buffer.from(canonicalJson(canonicalCatalogRecords(records)), 'utf8'));
}

export function expectedSchemaFingerprint(sqlSource) {
  return catalogFingerprintFromRecords(buildExpectedCatalogModel(sqlSource));
}

function assertToolingBlobs(rootDir, toolingBlobs) {
  if (!isRecord(toolingBlobs) || Object.keys(toolingBlobs).length !== 2) fail('baseline_manifest_tooling_invalid');
  for (const requiredPath of [
    'scripts/db/sys01-controlled-local-dev-rebuild.mjs',
    'scripts/db/guarded-migrate.mjs',
  ]) {
    const expected = toolingBlobs[requiredPath];
    if (!SHA1_PATTERN.test(expected ?? '')) fail('baseline_manifest_tooling_invalid');
    const actual = gitBlobOid(readFileSync(path.resolve(rootDir, requiredPath)));
    if (actual !== expected) fail('baseline_tool_blob_drift');
  }
}

export function validateBaselineManifest(manifest, manifestSource, sqlSource, rootDir) {
  if (!exactKeys(manifest, MANIFEST_KEYS)) fail('baseline_manifest_invalid');
  if (`${JSON.stringify(manifest, null, 2)}\n` !== manifestSource) fail('baseline_manifest_not_canonical');
  if (
    manifest.version !== SYS01_BASELINE_VERSION ||
    manifest.sourceBaselineCommit !== SYS01_SOURCE_BASELINE_COMMIT ||
    manifest.parentJournalTag !== SYS01_PARENT_JOURNAL.tag ||
    manifest.parentJournalWhen !== SYS01_PARENT_JOURNAL.when ||
    manifest.artifactPath !== SYS01_BASELINE_ARTIFACT_PATH ||
    manifest.canonicalizationVersion !== 'zmtg.catalog.logical-objects/v2' ||
    manifest.createdByContractVersion !== SYS01_REBUILD_CONTRACT_VERSION ||
    !isExpectedSchemaSource(manifest.schemaSource) ||
    !SHA256_PATTERN.test(manifest.artifactSha256 ?? '') ||
    !SHA256_PATTERN.test(manifest.schemaFingerprintSha256 ?? '') ||
    Object.hasOwn(manifest, 'manifestSha256')
  ) fail('baseline_manifest_invalid');
  if (sha256Bytes(Buffer.from(sqlSource, 'utf8')) !== manifest.artifactSha256) fail('baseline_artifact_hash_drift');
  if (expectedSchemaFingerprint(sqlSource) !== manifest.schemaFingerprintSha256) fail('baseline_schema_fingerprint_drift');
  assertToolingBlobs(rootDir, manifest.toolingBlobs);
  return Object.freeze({
    artifactSha256: manifest.artifactSha256,
    schemaFingerprintSha256: manifest.schemaFingerprintSha256,
    manifestSha256: sha256Bytes(Buffer.from(manifestSource, 'utf8')),
    marker: Object.freeze({
      hash: sha256Bytes(Buffer.from(manifestSource, 'utf8')),
      createdAt: SYS01_PARENT_JOURNAL.when,
    }),
  });
}

export function loadBaselineBundle(rootDir) {
  const artifactPath = path.resolve(rootDir, SYS01_BASELINE_ARTIFACT_PATH);
  const manifestPath = path.resolve(rootDir, SYS01_BASELINE_MANIFEST_PATH);
  const sqlSource = readFileSync(artifactPath, 'utf8');
  const manifestSource = readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestSource);
  } catch {
    fail('baseline_manifest_invalid');
  }
  const validation = validateBaselineManifest(manifest, manifestSource, sqlSource, rootDir);
  return Object.freeze({ manifest, manifestSource, sqlSource, validation });
}

export function buildPlan() {
  return Object.freeze({
    task: SYS01_REBUILD_TASK,
    mode: 'PLAN_ONLY',
    originalMutationAllowed: false,
    productionAllowed: false,
    automaticCutoverAllowed: false,
    automaticCleanupAllowed: false,
    phases: [...SYS01_PHASES],
    identities: SYS01_IDENTITIES,
  });
}

export function parseRunnerArguments(argv) {
  if (!Array.isArray(argv)) fail('runner_arguments_invalid', 2);
  const tokens = argv[0] === '--' ? argv.slice(1) : [...argv];
  if (tokens.length === 0) return Object.freeze({ mode: 'plan', phase: 'plan', confirmation: null, expectedHead: null, executionManifest: null });
  let mode = null;
  let phase = null;
  let confirmation = null;
  let expectedHead = null;
  let executionManifest = null;
  const seen = new Set();
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!['--mode', '--phase', '--confirmation', '--expected-head', '--execution-manifest'].includes(key) || value === undefined || seen.has(key)) fail('runner_arguments_invalid', 2);
    seen.add(key);
    if (key === '--mode') mode = value;
    if (key === '--phase') phase = value;
    if (key === '--confirmation') confirmation = value;
    if (key === '--expected-head') expectedHead = value;
    if (key === '--execution-manifest') executionManifest = value;
  }
  if (mode === 'plan') {
    if (phase !== 'plan' || seen.size !== 2) fail('runner_plan_arguments_invalid', 2);
    return Object.freeze({ mode, phase, confirmation: null, expectedHead: null, executionManifest: null });
  }
  if (mode !== 'execute' || !SYS01_PHASES.includes(phase) || phase === 'plan' || phase === 'all') fail('runner_exact_phase_required', 2);
  if (confirmation !== SYS01_EXECUTION_CONFIRMATION) fail('runner_confirmation_invalid', 2);
  if (!SHA1_PATTERN.test(expectedHead ?? '')) fail('runner_expected_head_invalid', 2);
  if (!executionManifest || !path.isAbsolute(executionManifest)) fail('runner_execution_manifest_invalid', 2);
  return Object.freeze({ mode, phase, confirmation, expectedHead, executionManifest });
}

export function assertDatabaseIdentity(role, observed) {
  const expected = SYS01_IDENTITIES[role];
  if (!expected || !isRecord(observed)) fail('runner_database_identity_invalid');
  for (const key of ['host', 'port', 'database', 'container', 'volume']) {
    if (observed[key] !== expected[key]) fail(`runner_${role}_identity_mismatch`);
  }
  if (observed.postgresVersion !== expected.postgresVersion) fail(`runner_${role}_postgres_version_mismatch`);
  if (expected.image && observed.image !== expected.image) fail(`runner_${role}_image_mismatch`);
  if (observed.environment === 'production' || observed.environment === 'staging') fail('runner_non_local_environment_rejected');
  if (!['127.0.0.1', 'localhost', '::1'].includes(observed.host)) fail('runner_non_loopback_rejected');
  if ((role === 'candidate' || role === 'restoreDrill') && observed.conflict === true) fail(`runner_${role}_identity_conflict`);
  return true;
}

function assertPhaseIdentityState(phase, identities) {
  if (identities.original.exists !== true) fail('runner_original_missing');
  const candidateMustExist = [
    'baseline-bootstrap',
    'transfer',
    'validate',
    'rollback-readiness',
    'cutover-readiness',
    'post-cutover-verify',
  ].includes(phase);
  if (candidateMustExist && identities.candidate.exists !== true) fail('runner_candidate_missing');
  if (!candidateMustExist && identities.candidate.exists === true) fail('runner_candidate_identity_conflict');
  if (['preflight', 'backup', 'restore-drill'].includes(phase) && identities.restoreDrill.exists === true) {
    fail('runner_restoreDrill_identity_conflict');
  }
  if (['candidate-create', 'baseline-bootstrap', 'transfer', 'validate'].includes(phase) && identities.restoreDrill.exists !== true) {
    fail('runner_restoreDrill_missing');
  }
  return true;
}

export function validateSourceInventory(inventory) {
  if (!isRecord(inventory) || !isRecord(inventory.rowCounts) || !Array.isArray(inventory.tables)) fail('source_inventory_invalid');
  const expectedTables = SYS01_TABLE_CONTRACT.map((entry) => entry.table).sort();
  const actualTables = [...inventory.tables].sort();
  const actualRowCountKeys = Object.keys(inventory.rowCounts).sort();
  if (
    canonicalJson(actualTables) !== canonicalJson(expectedTables) ||
    canonicalJson(actualRowCountKeys) !== canonicalJson(expectedTables)
  ) fail('source_inventory_semantic_drift');
  for (const table of expectedTables) {
    const count = inventory.rowCounts[table];
    if (!Number.isSafeInteger(count) || count < 0) fail('source_inventory_invalid');
  }
  if (inventory.rowCounts.auth_account_institution_bindings !== 0 || inventory.rowCounts.his_connections !== 0 || inventory.rowCounts.platform_ai_provider_configs !== 0) fail('source_inventory_re_admission_required');
  return Object.freeze({
    tableCount: actualTables.length,
    rowCountFingerprint: sha256Bytes(Buffer.from(canonicalJson(inventory.rowCounts), 'utf8')),
  });
}

function deterministicId(prefix, namespace, tenantId, membershipId) {
  const digest = sha256Bytes(Buffer.from(`${namespace}\0${tenantId}\0${membershipId}`, 'utf8'));
  return `${prefix}${digest}`;
}

export function mapMembershipCalibrationRows(rows) {
  if (!Array.isArray(rows)) fail('membership_mapping_invalid');
  const seen = new Set();
  return rows
    .map((row) => {
      if (!isRecord(row) || !row.id || !row.tenant_id || !row.user_id || !row.role || !row.created_at || !row.updated_at) fail('membership_mapping_invalid');
      const key = `${row.tenant_id}\0${row.id}`;
      if (seen.has(key)) fail('membership_mapping_duplicate');
      seen.add(key);
      const commandId = deterministicId('mcal1_', 'zmtg:membership-calibration-command:v1', row.tenant_id, row.id);
      const transitionId = deterministicId('mtcl1_', 'zmtg:membership-calibration-transition:v1', row.tenant_id, row.id);
      return {
        current: {
          ...row,
          revision: 1,
          lifecycle_status: 'active',
          current_provenance_source: 'legacy_calibration',
          current_provenance_actor_id: null,
          current_provenance_reason_code: 'legacy_unknown',
          current_provenance_command_id: commandId,
          current_provenance_occurred_at: null,
          current_provenance_recorded_at: row.updated_at,
          revoked_at: null,
          deleted_at: null,
        },
        transition: {
          id: transitionId,
          tenant_id: row.tenant_id,
          membership_id: row.id,
          command_id: commandId,
          transition_type: 'legacy_calibration',
          source: 'legacy_calibration',
          actor_id: null,
          reason_code: 'legacy_unknown',
          from_revision: null,
          to_revision: 1,
          from_lifecycle_status: null,
          to_lifecycle_status: 'active',
          from_role: null,
          to_role: row.role,
          occurred_at: null,
          recorded_at: row.updated_at,
        },
      };
    })
    .sort((left, right) => `${left.current.tenant_id}\0${left.current.id}`.localeCompare(`${right.current.tenant_id}\0${right.current.id}`));
}

export function mapOwnerReconstructedRows(rows, customers) {
  if (!Array.isArray(rows) || !Array.isArray(customers)) fail('owner_mapping_invalid');
  const pairs = new Map();
  for (const customer of customers) {
    const key = `${customer.tenant_id}\0${customer.id}`;
    const values = pairs.get(key) ?? [];
    values.push(customer.institution_id);
    pairs.set(key, values);
  }
  return rows.map((row) => {
    const values = pairs.get(`${row.tenant_id}\0${row.customer_id}`) ?? [];
    if (values.length !== 1 || !values[0]) fail(values.length === 0 ? 'owner_mapping_zero_match' : 'owner_mapping_multiple_match');
    return { ...row, institution_id: values[0] };
  });
}

export function mapAuditRows(rows) {
  if (!Array.isArray(rows)) fail('audit_mapping_invalid');
  return rows.map((row) => ({ ...row, institution_id: null, institution_attribution: null }));
}

export function mapBindingRows(rows) {
  if (!Array.isArray(rows)) fail('binding_mapping_invalid');
  if (rows.length !== 0) fail('binding_mapping_re_admission_required');
  return [];
}

export function assertSecretOpaqueEquality(sourceDigests, targetDigests) {
  if (!isRecord(sourceDigests) || !isRecord(targetDigests)) fail('secret_opaque_equality_invalid');
  const allowed = new Set(secretSensitiveTables);
  if (
    Object.keys(sourceDigests).length !== secretSensitiveTables.length ||
    Object.keys(targetDigests).length !== secretSensitiveTables.length ||
    secretSensitiveTables.some(
      (table) => !Object.hasOwn(sourceDigests, table) || !Object.hasOwn(targetDigests, table),
    ) ||
    Object.keys(sourceDigests).some((table) => !allowed.has(table)) ||
    Object.keys(targetDigests).some((table) => !allowed.has(table)) ||
    canonicalJson(sourceDigests) !== canonicalJson(targetDigests)
  ) fail('secret_opaque_equality_mismatch');
  for (const digest of Object.values(sourceDigests)) {
    if (!SHA256_PATTERN.test(digest)) fail('secret_opaque_equality_invalid');
  }
  return true;
}

export function assertExcludedTargetsEmpty(rowCounts) {
  if (!isRecord(rowCounts)) fail('excluded_target_inventory_invalid');
  const emptyTables = [
    ...derivedTables,
    ...ephemeralTables,
    ...doNotCopyTables,
    'institution_scopes',
    'institution_operating_context_versions',
    'institution_operating_contexts',
    'auth_account_institution_binding_transitions',
  ];
  for (const table of emptyTables) {
    if (rowCounts[table] !== 0) fail('excluded_target_not_empty');
  }
  return true;
}

export function buildBackupCapability() {
  return Object.freeze({
    format: 'postgresql-16-custom',
    source: 'original_read_only',
    destination: 'repository_external_private_path',
    encryption: 'aes-256-gcm-stream',
    plaintextArtifactAllowed: false,
    credentialsInArgumentsOrLogsAllowed: false,
    originalMutationAllowed: false,
  });
}

export function buildBaselineBootstrapCapability(bundle) {
  if (!isRecord(bundle?.validation)) fail('baseline_bundle_invalid');
  return Object.freeze({
    target: 'candidate_only',
    requiresEmptyCandidate: true,
    artifactSha256: bundle.validation.artifactSha256,
    expectedSchemaFingerprintSha256: bundle.validation.schemaFingerprintSha256,
    marker: bundle.validation.marker,
    claimsHistoricalMigrationsExecuted: false,
    markerRowCount: 1,
    sequence: Object.freeze([
      'verify_manifest_and_artifact',
      'apply_schema_only_baseline',
      'verify_canonical_catalog_fingerprint',
      'establish_drizzle_journal_shape',
      'insert_exact_baseline_marker',
      'verify_marker_only_origin',
    ]),
  });
}

export function buildTransferCapability() {
  return Object.freeze({
    sourceContract: SYS01_TABLE_CONTRACT,
    targetOnlyContract: SYS01_TARGET_ONLY_CONTRACT,
    ownerReconstructionSource: 'customers_persisted_tenant_institution_pair_only',
    membershipCalibration: 'deterministic_multi_row_legacy_calibration',
    auditAttribution: 'null_null_preserved',
    bindingGuessAllowed: false,
    secretProof: 'in_process_opaque_sha256_equality_only',
    originalMutationAllowed: false,
  });
}

export function buildRollbackCapability() {
  return Object.freeze({
    automaticCutoverAllowed: false,
    automaticCleanupAllowed: false,
    originalRetained: true,
    candidateDestructionAllowed: false,
    outcomeUnknownAutoRetryAllowed: false,
  });
}

export function assertPhaseTransition(state, phase) {
  const transition = SYS01_PHASE_TRANSITIONS[phase];
  if (!transition || !isRecord(state) || state.outcomeUnknown === true || state.current !== transition.from) fail('runner_phase_transition_invalid');
  return transition;
}

export function classifyPhaseOutcome(phase, result) {
  if (result?.status === 'succeeded' && result.postconditionVerified === true) return Object.freeze({ status: 'succeeded', nextState: SYS01_PHASE_TRANSITIONS[phase].to, autoRetry: false });
  if (result?.status === 'not_started' && result.preconditionFailed === true) return Object.freeze({ status: 'not_started', nextState: null, autoRetry: false });
  return Object.freeze({ status: `OUTCOME_UNKNOWN_${phase.toUpperCase().replaceAll('-', '_')}`, nextState: null, autoRetry: false });
}

function validatePhaseResult(phase, result, executionManifest, bundle) {
  if (!isRecord(result) || typeof result.status !== 'string') fail('runner_phase_result_invalid');
  if (result.status !== 'succeeded' || result.postconditionVerified !== true) return result;
  if (result.originalMutationCount !== 0) fail('runner_original_mutation_detected');
  if (phase === 'preflight') {
    validateSourceInventory(result.sourceInventory);
    if (!SHA256_PATTERN.test(result.sourceCatalogFingerprint ?? '')) fail('runner_phase_result_invalid');
  }
  if (phase === 'backup') {
    if (
      !SHA256_PATTERN.test(result.ciphertextSha256 ?? '') ||
      !Number.isSafeInteger(result.ciphertextBytes) ||
      result.ciphertextBytes <= 0 ||
      result.pgDumpVersion !== '16.14' ||
      result.plaintextResidual !== false
    ) fail('runner_backup_postcondition_invalid');
  }
  if (phase === 'restore-drill') {
    const frozenBackupSha256 = executionManifest.phaseReceipts
      .filter((receipt) => receipt.phase === 'backup' && receipt.status === 'succeeded')
      .at(-1)?.evidence?.ciphertextSha256;
    if (
      result.backupCiphertextSha256 !== frozenBackupSha256 ||
      result.archiveTableSetVerified !== true ||
      result.restoreIdentityVerified !== true ||
      result.restoredOpaqueEqualityVerified !== true ||
      !SHA256_PATTERN.test(result.restoredCatalogFingerprint ?? '') ||
      !SHA256_PATTERN.test(result.restoredAggregateFingerprint ?? '') ||
      result.restoredCatalogFingerprint !== executionManifest.sourceCatalogFingerprint ||
      result.restoredAggregateFingerprint !== executionManifest.lowSensitiveAggregateFingerprint
    ) fail('runner_restore_postcondition_invalid');
  }
  if (phase === 'candidate-create') {
    if (result.candidateIdentityVerified !== true || result.candidateEmpty !== true) {
      fail('runner_candidate_postcondition_invalid');
    }
  }
  if (phase === 'baseline-bootstrap') {
    if (
      result.actualSchemaFingerprintSha256 !== bundle.validation.schemaFingerprintSha256 ||
      result.markerHash !== bundle.validation.marker.hash ||
      result.markerCreatedAt !== bundle.validation.marker.createdAt ||
      result.markerRowCount !== 1 ||
      result.markerShapeVerified !== true
    ) fail('runner_baseline_postcondition_invalid');
  }
  if (phase === 'transfer') {
    if (
      result.specialMappingsVerified !== true ||
      result.secretOpaqueEqualityVerified !== true ||
      result.excludedTargetsEmpty !== true ||
      result.mappedRowsVerified !== true ||
      result.originalUnchanged !== true ||
      result.originalBeforeFingerprint !== result.originalAfterFingerprint ||
      result.sourceAggregateFingerprint !== executionManifest.lowSensitiveAggregateFingerprint ||
      !SHA256_PATTERN.test(result.targetAggregateFingerprint ?? '')
    ) fail('runner_transfer_postcondition_invalid');
  }
  if (phase === 'validate') {
    if (
      result.actualSchemaFingerprintSha256 !== bundle.validation.schemaFingerprintSha256 ||
      result.constraintsVerified !== true ||
      result.primaryKeysVerified !== true ||
      result.foreignKeysVerified !== true ||
      result.rowCountsVerified !== true ||
      result.businessAggregatesVerified !== true ||
      result.mappedRowsVerified !== true ||
      result.markerVerified !== true ||
      result.nullShapeVerified !== true ||
      !SHA256_PATTERN.test(result.nullShapeFingerprint ?? '') ||
      !SHA256_PATTERN.test(result.targetAggregateFingerprint ?? '') ||
      result.originalUnchanged !== true
    ) fail('runner_validate_postcondition_invalid');
  }
  if (phase === 'cutover-readiness') {
    if (
      result.automaticCutoverPerformed !== false ||
      result.rollbackPrecheckVerified !== true ||
      result.sourceQuiescenceVerified !== true ||
      result.mappedRowsVerified !== true ||
      result.readinessEvidenceVerified !== true ||
      !SHA256_PATTERN.test(result.readinessReceiptSha256 ?? '') ||
      !SHA256_PATTERN.test(result.applicationSmokeReceiptSha256 ?? '')
    ) {
      fail('runner_cutover_readiness_invalid');
    }
  }
  if (phase === 'post-cutover-verify') {
    if (
      !SHA256_PATTERN.test(result.externalCutoverReceiptSha256 ?? '') ||
      !SHA256_PATTERN.test(result.postCutoverReadinessReceiptSha256 ?? '') ||
      !SHA256_PATTERN.test(result.postCutoverApplicationSmokeReceiptSha256 ?? '') ||
      result.postCutoverEvidenceVerified !== true ||
      result.activeTarget !== 'candidate' ||
      result.originalRetained !== true
    ) fail('runner_post_cutover_verification_invalid');
  }
  if (phase === 'rollback-readiness') {
    if (
      result.originalRetained !== true ||
      result.reversible !== true ||
      result.validationVerified !== true
    ) {
      fail('runner_rollback_readiness_invalid');
    }
  }
  return result;
}

async function defaultGitState(rootDir) {
  const [{ stdout: head }, { stdout: status }] = await Promise.all([
    execFile('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }),
    execFile('git', ['status', '--porcelain=v1'], { cwd: rootDir, encoding: 'utf8' }),
  ]);
  let baseIsAncestor = true;
  try {
    await execFile('git', ['merge-base', '--is-ancestor', SYS01_SOURCE_BASELINE_COMMIT, head.trim()], { cwd: rootDir });
  } catch {
    baseIsAncestor = false;
  }
  return { head: head.trim(), clean: status.trim().length === 0, baseIsAncestor };
}

export function assertRepositoryIdentity(gitState, expectedHead) {
  if (!isRecord(gitState) || gitState.clean !== true || gitState.baseIsAncestor !== true || gitState.head !== expectedHead) fail('runner_repository_identity_invalid');
  return true;
}

async function readSecureExecutionManifest(filePath, repositoryRoot) {
  await assertPrivateExternalParent(filePath, repositoryRoot);
  let handle;
  try {
    const before = await lstat(filePath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.uid !== process.getuid?.() || !ALLOWED_PRIVATE_FILE_MODES.has(before.mode & 0o777) || before.size < 2 || before.size > MAX_EXECUTION_MANIFEST_BYTES) fail('runner_execution_manifest_invalid', 2);
    handle = await open(filePath, fsConstants.O_RDONLY | O_NOFOLLOW);
    const source = await handle.readFile({ encoding: 'utf8' });
    const after = await handle.stat();
    if (after.ino !== before.ino || after.dev !== before.dev || after.size !== before.size) fail('runner_execution_manifest_invalid', 2);
    return JSON.parse(source);
  } catch (error) {
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_execution_manifest_invalid', 2);
  } finally {
    await handle?.close();
  }
}

async function readSecureExecutionManifestOptional(filePath, repositoryRoot) {
  try {
    await lstat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('runner_execution_manifest_invalid', 2);
  }
  return readSecureExecutionManifest(filePath, repositoryRoot);
}

async function assertPrivateExternalParent(filePath, repositoryRoot) {
  let repositoryReal;
  let parentReal;
  try {
    repositoryReal = await realpath(repositoryRoot);
    parentReal = await realpath(path.dirname(filePath));
    const parentStat = await lstat(parentReal);
    if (
      !parentStat.isDirectory() ||
      (parentStat.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && parentStat.uid !== process.getuid())
    ) fail('runner_execution_manifest_invalid', 2);
  } catch (error) {
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_execution_manifest_invalid', 2);
  }
  const resolvedTarget = path.join(parentReal, path.basename(filePath));
  if (resolvedTarget === repositoryReal || resolvedTarget.startsWith(`${repositoryReal}${path.sep}`)) {
    fail('runner_execution_manifest_must_be_repo_external', 2);
  }
  return { parentReal, resolvedTarget };
}

async function syncDirectory(directoryPath) {
  let handle;
  try {
    handle = await open(directoryPath, fsConstants.O_RDONLY);
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

async function acquireExecutionLock(filePath, repositoryRoot, phase, expectedHead) {
  const lockPath = `${filePath}.lock`;
  const { parentReal } = await assertPrivateExternalParent(lockPath, repositoryRoot);
  let handle;
  try {
    handle = await open(
      lockPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(
      `${JSON.stringify(canonicalize({ expectedHead, phase, task: SYS01_REBUILD_TASK }))}\n`,
      { encoding: 'utf8' },
    );
    await handle.sync();
    await syncDirectory(parentReal);
    const stat = await handle.stat();
    return { handle, lockPath, inode: stat.ino, device: stat.dev, parentReal };
  } catch (error) {
    await handle?.close();
    if (error?.code === 'EEXIST') fail('runner_execution_phase_locked', 2);
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_execution_lock_failed', 2);
  }
}

async function releaseExecutionLock(lock) {
  const stat = await lock.handle.stat().catch(() => null);
  const pathStat = await lstat(lock.lockPath).catch(() => null);
  if (
    !stat ||
    !pathStat ||
    stat.ino !== lock.inode ||
    stat.dev !== lock.device ||
    pathStat.ino !== lock.inode ||
    pathStat.dev !== lock.device ||
    pathStat.isSymbolicLink() ||
    pathStat.nlink !== 1
  ) fail('runner_execution_lock_changed', 2);
  await lock.handle.close();
  await unlink(lock.lockPath);
  await syncDirectory(lock.parentReal);
}

async function writeSecureExecutionManifest(filePath, repositoryRoot, value, { create = false } = {}) {
  const { parentReal: targetRealParent } = await assertPrivateExternalParent(
    filePath,
    repositoryRoot,
  );
  const source = `${JSON.stringify(canonicalize(value), null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_EXECUTION_MANIFEST_BYTES) fail('runner_execution_manifest_invalid', 2);
  if (create) {
    let handle;
    try {
      handle = await open(filePath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW, 0o600);
      await handle.writeFile(source, { encoding: 'utf8' });
      await handle.sync();
      await syncDirectory(targetRealParent);
      return;
    } catch (error) {
      if (error instanceof Sys01RebuildError) throw error;
      fail('runner_execution_manifest_create_failed', 2);
    } finally {
      await handle?.close();
    }
  }
  const before = await lstat(filePath).catch(() => null);
  if (!before?.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !ALLOWED_PRIVATE_FILE_MODES.has(before.mode & 0o777)) {
    fail('runner_execution_manifest_invalid', 2);
  }
  const temporaryPath = path.join(
    targetRealParent,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW, 0o600);
    await handle.writeFile(source, { encoding: 'utf8' });
    await handle.sync();
    await handle.close();
    handle = null;
    const current = await lstat(filePath);
    if (current.ino !== before.ino || current.dev !== before.dev || current.nlink !== 1) fail('runner_execution_manifest_changed', 2);
    await rename(temporaryPath, filePath);
    await syncDirectory(targetRealParent);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_execution_manifest_write_failed', 2);
  } finally {
    await handle?.close();
  }
}

function validateExecutionManifest(value, bundle, expectedHead) {
  if (
    !exactKeys(value, EXECUTION_MANIFEST_KEYS) ||
    value.version !== 1 ||
    value.task !== SYS01_REBUILD_TASK ||
    value.implementationHead !== expectedHead ||
    value.sourceBaselineCommit !== SYS01_SOURCE_BASELINE_COMMIT ||
    value.baselineManifestSha256 !== bundle.validation.manifestSha256 ||
    value.mappingContractSha256 !== mappingContractSha256() ||
    !SHA256_PATTERN.test(value.sourceCatalogFingerprint ?? '') ||
    !SHA256_PATTERN.test(value.lowSensitiveAggregateFingerprint ?? '') ||
    value.secretOpaqueEqualityPolicy !== 'in_process_only_no_values_in_manifest_or_logs' ||
    !Array.isArray(value.phaseReceipts) ||
    typeof value.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(value.capturedAt)) ||
    !isRecord(value.state) ||
    !exactKeys(value.state, ['current', 'outcomeUnknown']) ||
    typeof value.state.current !== 'string' ||
    typeof value.state.outcomeUnknown !== 'boolean'
  ) fail('runner_execution_manifest_invalid', 2);
  const inventory = validateSourceInventory({
    tables: value.sourceTableSet,
    rowCounts: value.perTableRowCounts,
  });
  if (inventory.rowCountFingerprint !== value.lowSensitiveAggregateFingerprint) {
    fail('runner_execution_manifest_invalid', 2);
  }
  let previousDigest = null;
  let derivedState = 'INITIAL';
  let outcomeUnknown = false;
  for (const receipt of value.phaseReceipts) {
    if (outcomeUnknown) fail('runner_execution_manifest_state_invalid', 2);
    if (
      !isRecord(receipt) ||
      !exactKeys(receipt, [
        'completedAt',
        'digest',
        'evidence',
        'evidenceSha256',
        'from',
        'phase',
        'previousReceiptSha256',
        'status',
        'to',
      ]) ||
      receipt.previousReceiptSha256 !== previousDigest ||
      !SHA256_PATTERN.test(receipt.evidenceSha256 ?? '') ||
      !SHA256_PATTERN.test(receipt.digest ?? '') ||
      typeof receipt.completedAt !== 'string' ||
      new Date(receipt.completedAt).toISOString() !== receipt.completedAt
    ) fail('runner_execution_manifest_receipt_invalid', 2);
    const { digest, ...baseReceipt } = receipt;
    const transition = SYS01_PHASE_TRANSITIONS[receipt.phase];
    const expectedUnknown = `OUTCOME_UNKNOWN_${String(receipt.phase).toUpperCase().replaceAll('-', '_')}`;
    const succeeded = receipt.status === 'succeeded';
    const retryablePrecondition = receipt.status === 'not_started';
    const unknown = receipt.status === expectedUnknown;
    if (
      digest !== sha256Bytes(Buffer.from(canonicalJson(baseReceipt), 'utf8')) ||
      receipt.evidenceSha256 !== safeResultFingerprint(receipt.evidence) ||
      canonicalJson(receipt.evidence) !==
        canonicalJson(publicPhaseEvidence(receipt.phase, receipt.evidence)) ||
      !transition ||
      receipt.from !== derivedState ||
      receipt.from !== transition.from ||
      (!succeeded && !retryablePrecondition && !unknown) ||
      receipt.to !== (succeeded ? transition.to : null)
    ) fail('runner_execution_manifest_receipt_invalid', 2);
    if (succeeded) derivedState = transition.to;
    outcomeUnknown = unknown;
    previousDigest = receipt.digest;
  }
  if (value.state.current !== derivedState || value.state.outcomeUnknown !== outcomeUnknown) {
    fail('runner_execution_manifest_state_invalid', 2);
  }
  return value;
}

function publicPhaseEvidence(phase, result) {
  const fields = {
    preflight: ['sourceCatalogFingerprint', 'rowCountFingerprint'],
    backup: ['ciphertextSha256', 'ciphertextBytes', 'pgDumpVersion', 'plaintextResidual'],
    'restore-drill': [
      'backupCiphertextSha256',
      'archiveTableSetVerified',
      'restoreIdentityVerified',
      'restoredOpaqueEqualityVerified',
    ],
    'candidate-create': ['candidateIdentityVerified', 'candidateEmpty'],
    'baseline-bootstrap': [
      'actualSchemaFingerprintSha256',
      'markerHash',
      'markerCreatedAt',
      'markerRowCount',
      'markerShapeVerified',
    ],
    transfer: [
      'specialMappingsVerified',
      'secretOpaqueEqualityVerified',
      'excludedTargetsEmpty',
      'mappedRowsVerified',
      'originalUnchanged',
      'sourceAggregateFingerprint',
      'targetAggregateFingerprint',
    ],
    validate: [
      'actualSchemaFingerprintSha256',
      'constraintsVerified',
      'primaryKeysVerified',
      'foreignKeysVerified',
      'rowCountsVerified',
      'businessAggregatesVerified',
      'mappedRowsVerified',
      'markerVerified',
      'nullShapeFingerprint',
      'nullShapeVerified',
      'targetAggregateFingerprint',
      'originalUnchanged',
    ],
    'rollback-readiness': [
      'originalRetained',
      'candidateRetained',
      'reversible',
      'validationVerified',
    ],
    'cutover-readiness': [
      'automaticCutoverPerformed',
      'rollbackPrecheckVerified',
      'activeTargetBeforeCutover',
      'sourceQuiescenceVerified',
      'mappedRowsVerified',
      'readinessReceiptSha256',
      'applicationSmokeReceiptSha256',
      'readinessEvidenceVerified',
    ],
    'post-cutover-verify': [
      'externalCutoverReceiptSha256',
      'postCutoverReadinessReceiptSha256',
      'postCutoverApplicationSmokeReceiptSha256',
      'postCutoverEvidenceVerified',
      'activeTarget',
      'originalRetained',
      'candidateSchemaFingerprintSha256',
    ],
  }[phase] ?? [];
  return Object.fromEntries(
    fields.filter((field) => Object.hasOwn(result ?? {}, field)).map((field) => [field, result[field]]),
  );
}

export function buildExecutionManifest({ implementationHead, baselineManifestSha256, sourceCatalogFingerprint, sourceInventory, capturedAt }) {
  const inventory = validateSourceInventory(sourceInventory);
  if (
    !SHA1_PATTERN.test(implementationHead ?? '') ||
    !SHA256_PATTERN.test(baselineManifestSha256 ?? '') ||
    !SHA256_PATTERN.test(sourceCatalogFingerprint ?? '') ||
    typeof capturedAt !== 'string' ||
    new Date(capturedAt).toISOString() !== capturedAt
  ) fail('runner_execution_manifest_invalid', 2);
  return canonicalize({
    version: 1,
    task: SYS01_REBUILD_TASK,
    implementationHead,
    sourceBaselineCommit: SYS01_SOURCE_BASELINE_COMMIT,
    baselineManifestSha256,
    mappingContractSha256: mappingContractSha256(),
    sourceCatalogFingerprint,
    sourceTableSet: sourceInventory.tables.slice().sort(),
    perTableRowCounts: sourceInventory.rowCounts,
    phaseReceipts: [],
    lowSensitiveAggregateFingerprint: inventory.rowCountFingerprint,
    secretOpaqueEqualityPolicy: 'in_process_only_no_values_in_manifest_or_logs',
    capturedAt,
    state: { current: 'INITIAL', outcomeUnknown: false },
  });
}

function appendPhaseReceipt(executionManifest, phase, transition, outcome, result) {
  if (!SHA256_PATTERN.test(result?.postconditionFingerprint ?? '')) {
    fail('runner_phase_evidence_invalid');
  }
  if (typeof result?.completedAt !== 'string' || new Date(result.completedAt).toISOString() !== result.completedAt) {
    fail('runner_phase_evidence_invalid');
  }
  const baseReceipt = {
    phase,
    status: outcome.status,
    from: transition.from,
    to: outcome.nextState,
    completedAt: result.completedAt,
    evidence: publicPhaseEvidence(phase, result),
    evidenceSha256: safeResultFingerprint(publicPhaseEvidence(phase, result)),
    previousReceiptSha256: executionManifest.phaseReceipts.at(-1)?.digest ?? null,
  };
  const receipt = {
    ...baseReceipt,
    digest: sha256Bytes(Buffer.from(canonicalJson(baseReceipt), 'utf8')),
  };
  return canonicalize({
    ...executionManifest,
    phaseReceipts: [...executionManifest.phaseReceipts, receipt],
    state: {
      current: outcome.nextState ?? executionManifest.state.current,
      outcomeUnknown: outcome.status.startsWith('OUTCOME_UNKNOWN_'),
    },
  });
}

const phaseDependency = Object.freeze({
  preflight: 'readSourceInventory',
  backup: 'createEncryptedBackup',
  'restore-drill': 'restoreDrill',
  'candidate-create': 'createCandidate',
  'baseline-bootstrap': 'bootstrapCandidate',
  transfer: 'transferCandidate',
  validate: 'validateCandidate',
  'cutover-readiness': 'inspectCutoverReadiness',
  'post-cutover-verify': 'verifyPostCutover',
  'rollback-readiness': 'inspectRollbackReadiness',
});

function requiredExecutionEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) fail(`runner_missing_${name}`, 2);
  return value;
}

function parseLocalDatabaseUrl(rawUrl, expected) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail('runner_database_url_invalid', 2);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('runner_database_url_invalid', 2);
  const host = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  const port = Number(url.port || '5432');
  const database = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (host !== expected.host || port !== expected.port || database !== expected.database) {
    fail('runner_database_url_identity_mismatch', 2);
  }
  return { host, port, database };
}

async function execOpaque(command, arguments_, options = {}) {
  try {
    return await execFile(command, arguments_, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5 * 60 * 1_000,
      killSignal: 'SIGTERM',
      ...options,
    });
  } catch {
    fail('runner_phase_executor_failed');
  }
}

function waitForSpawnExit(
  child,
  errorCode,
  {
    timeoutMs = SYS01_ADAPTER_PROCESS_TIMEOUT_MS,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  return new Promise((resolveResult, rejectResult) => {
    let settled = false;
    let timer = null;
    const settle = (error = null) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeoutImpl(timer);
      if (error) rejectResult(error);
      else resolveResult();
    };
    timer = setTimeoutImpl(() => {
      child.kill?.('SIGTERM');
      settle(new Error(errorCode));
    }, timeoutMs);
    timer?.unref?.();
    child.once('error', () => settle(new Error(errorCode)));
    child.once('close', (code) => settle(code === 0 ? null : new Error(errorCode)));
  });
}

async function inspectContainer(expected) {
  let inspected;
  try {
    const { stdout } = await execFile('docker', ['inspect', expected.container], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
      killSignal: 'SIGTERM',
    });
    inspected = JSON.parse(stdout)[0];
  } catch {
    let volumeExists = false;
    try {
      await execFile('docker', ['volume', 'inspect', expected.volume], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 30_000,
        killSignal: 'SIGTERM',
      });
      volumeExists = true;
    } catch {
      volumeExists = false;
    }
    return {
      ...expected,
      environment: 'local-development',
      exists: false,
      conflict: volumeExists,
    };
  }
  const mounts = Array.isArray(inspected?.Mounts) ? inspected.Mounts : [];
  const volume = mounts.find((mount) => mount.Destination === '/var/lib/postgresql/data')?.Name;
  const portBinding = inspected?.NetworkSettings?.Ports?.['5432/tcp']?.[0];
  const image = inspected?.Config?.Image;
  const configuredDatabase = (inspected?.Config?.Env ?? [])
    .find((entry) => entry.startsWith('POSTGRES_DB='))
    ?.slice('POSTGRES_DB='.length);
  let postgresVersion = null;
  try {
    const { stdout } = await execFile('docker', ['exec', expected.container, 'postgres', '--version'], {
      encoding: 'utf8',
      timeout: 30_000,
      killSignal: 'SIGTERM',
    });
    postgresVersion = stdout.match(/(\d+\.\d+)/u)?.[1] ?? null;
  } catch {
    postgresVersion = null;
  }
  const observed = {
    ...expected,
    port: Number(portBinding?.HostPort),
    host: portBinding?.HostIp === '127.0.0.1' ? '127.0.0.1' : portBinding?.HostIp,
    database: configuredDatabase,
    volume,
    image,
    postgresVersion,
    environment: 'local-development',
    exists: true,
  };
  observed.conflict =
    observed.port !== expected.port ||
    observed.host !== expected.host ||
    observed.database !== expected.database ||
    observed.volume !== expected.volume ||
    (expected.image !== undefined && observed.image !== expected.image) ||
    observed.postgresVersion !== expected.postgresVersion;
  return observed;
}

async function inspectExactIdentities(env) {
  parseLocalDatabaseUrl(requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'), SYS01_IDENTITIES.original);
  parseLocalDatabaseUrl(requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'), SYS01_IDENTITIES.candidate);
  parseLocalDatabaseUrl(requiredExecutionEnv(env, 'ZMTG_SYS01_RESTORE_DRILL_DATABASE_URL'), SYS01_IDENTITIES.restoreDrill);
  const [original, candidate, restoreDrill] = await Promise.all([
    inspectContainer(SYS01_IDENTITIES.original),
    inspectContainer(SYS01_IDENTITIES.candidate),
    inspectContainer(SYS01_IDENTITIES.restoreDrill),
  ]);
  return { original, candidate, restoreDrill };
}

function quoteQualifiedTable(table) {
  const parts = table.split('.');
  if (parts.some((part) => !/^[a-z_][a-z0-9_]*$/u.test(part))) fail('source_inventory_invalid');
  return parts.map((part) => `"${part}"`).join('.');
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) fail('runner_catalog_identifier_invalid');
  return `"${identifier}"`;
}

function expectedCandidateRowCounts(sourceRowCounts) {
  const result = {};
  for (const contract of SYS01_TABLE_CONTRACT) {
    if (contract.table === 'drizzle.__drizzle_migrations') continue;
    result[contract.table] = ['MUST_PRESERVE', 'REQUIRES_SPECIAL_MAPPING', 'SECRET_SENSITIVE'].includes(
      contract.classification,
    )
      ? sourceRowCounts[contract.table]
      : 0;
  }
  for (const contract of SYS01_TARGET_ONLY_CONTRACT) {
    result[contract.table] =
      contract.table === 'tenant_membership_transitions' ? sourceRowCounts.tenant_members : 0;
  }
  return result;
}

async function readDatabaseInventory(databaseUrl, { includeRows = false, includeOpaque = false } = {}) {
  let sql;
  try {
    const postgres = (await import('postgres')).default;
    const { SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL } = await import('./guarded-migrate.mjs');
    sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => undefined });
    return await sql.begin('read only isolation level repeatable read', async (transaction) => {
      const publicTables = await transaction`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      const tables = [
        ...publicTables.map((row) => row.table_name),
        'drizzle.__drizzle_migrations',
      ].sort();
      const rowCounts = {};
      const rowsByTable = {};
      for (const table of SYS01_TABLE_CONTRACT.map((entry) => entry.table)) {
        if (includeRows || includeOpaque) {
          const rows = Array.from(
            await transaction.unsafe(`SELECT * FROM ${quoteQualifiedTable(table)}`),
          );
          rowCounts[table] = rows.length;
          if (includeRows) rowsByTable[table] = rows;
          if (includeOpaque && !includeRows) rowsByTable[table] = rows;
        } else {
          const rows = await transaction.unsafe(
            `SELECT count(*)::bigint AS count FROM ${quoteQualifiedTable(table)}`,
          );
          rowCounts[table] = Number(rows[0].count);
        }
      }
      const catalogRows = await transaction.unsafe(SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL);
      const sourceCatalogFingerprint = catalogFingerprintFromRecords(catalogRows[0]?.catalog);
      return {
        sourceInventory: { tables, rowCounts },
        sourceCatalogFingerprint,
        ...(includeRows ? { rowsByTable } : {}),
        ...(includeOpaque
          ? {
            opaqueDatabaseFingerprint: safeResultFingerprint(
              Object.fromEntries(
                Object.entries(rowsByTable).map(([table, rows]) => [table, opaqueRowsDigest(rows)]),
              ),
            ),
          }
          : {}),
        originalFingerprint: sha256Bytes(
          Buffer.from(canonicalJson({ sourceCatalogFingerprint, rowCounts }), 'utf8'),
        ),
      };
    });
  } catch (error) {
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_source_inventory_failed');
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
}

function safeResultFingerprint(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

function opaqueRowsDigest(rows) {
  return sha256Bytes(
    Buffer.from(
      canonicalJson(rows.map((row) => canonicalJson(row)).sort()),
      'utf8',
    ),
  );
}

function buildExactPostgresContainerSteps(identity) {
  return Object.freeze([
    Object.freeze({ command: 'docker', args: ['volume', 'create', identity.volume] }),
    Object.freeze({
      command: 'docker',
      args: [
        'run',
        '--pull',
        'never',
        '--detach',
        '--name',
        identity.container,
        '--env',
        'POSTGRES_PASSWORD',
        '--env',
        `POSTGRES_DB=${identity.database}`,
        '--publish',
        `${identity.host}:${identity.port}:5432`,
        '--volume',
        `${identity.volume}:/var/lib/postgresql/data`,
        identity.image,
      ],
    }),
  ]);
}

async function createExactPostgresContainer(identity, env, { execOpaqueImpl = execOpaque } = {}) {
  const password = requiredExecutionEnv(env, 'ZMTG_SYS01_POSTGRES_PASSWORD');
  const [volumeStep, containerStep] = buildExactPostgresContainerSteps(identity);
  await execOpaqueImpl(volumeStep.command, volumeStep.args, { env });
  await execOpaqueImpl(containerStep.command, containerStep.args, {
    env: { ...env, POSTGRES_PASSWORD: password },
  });
}

async function fileSha256(filePath) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest('hex');
}

async function assertRepoExternalPath(filePath, repositoryRoot, { mustExist = false, privateFile = false } = {}) {
  let repositoryReal;
  let parentReal;
  try {
    repositoryReal = await realpath(repositoryRoot);
    parentReal = await realpath(path.dirname(filePath));
  } catch {
    fail('runner_backup_path_or_key_invalid');
  }
  const resolved = path.join(parentReal, path.basename(filePath));
  if (resolved === repositoryReal || resolved.startsWith(`${repositoryReal}${path.sep}`)) {
    fail('runner_backup_path_or_key_invalid');
  }
  if (mustExist) {
    const stat = await lstat(filePath).catch(() => null);
    if (
      !stat?.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      (privateFile && !ALLOWED_PRIVATE_FILE_MODES.has(stat.mode & 0o777))
    ) fail('runner_backup_path_or_key_invalid');
    const fileReal = await realpath(filePath).catch(() => null);
    if (fileReal !== resolved) fail('runner_backup_path_or_key_invalid');
  }
  const parentStat = await lstat(parentReal).catch(() => null);
  if (
    !parentStat?.isDirectory() ||
    (parentStat.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && parentStat.uid !== process.getuid())
  ) fail('runner_backup_path_or_key_invalid');
  return resolved;
}

function decodeSys01BackupKey(source) {
  const key = source.length === 32
    ? Buffer.from(source)
    : /^[0-9a-f]{64}$/iu.test(source.toString('utf8').trim())
      ? Buffer.from(source.toString('utf8').trim(), 'hex')
      : null;
  source.fill(0);
  if (!key || key.length !== 32) fail('runner_backup_path_or_key_invalid');
  return key;
}

async function readSys01BackupKey(env, repositoryRoot, { openImpl = open } = {}) {
  const keyPath = path.resolve(requiredExecutionEnv(env, 'ZMTG_SYS01_BACKUP_KEY_PATH'));
  await assertRepoExternalPath(keyPath, repositoryRoot, { mustExist: true, privateFile: true });
  let handle;
  try {
    handle = await openImpl(keyPath, fsConstants.O_RDONLY | O_NOFOLLOW);
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      ![32, 64, 65, 66].includes(stat.size) ||
      !ALLOWED_PRIVATE_FILE_MODES.has(stat.mode & 0o777)
    ) fail('runner_backup_path_or_key_invalid');
    return decodeSys01BackupKey(await handle.readFile());
  } catch (error) {
    if (error instanceof Sys01RebuildError) throw error;
    fail('runner_backup_path_or_key_invalid');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function preflightSys01BackupKeySourceV1({
  env = process.env,
  repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
} = {}) {
  const key = await readSys01BackupKey(env, repositoryRoot);
  key.fill(0);
  return Object.freeze({
    available: true,
    formatValid: true,
    permissionValid: true,
    repositoryExternal: true,
    regularFile: true,
    symlink: false,
    valueReadOrLogged: false,
  });
}

export function buildSys01PrerequisiteAdapterStepsV1(adapter, { postgresUser = 'postgres' } = {}) {
  if (!SYS01_PREREQUISITE_ADAPTERS.includes(adapter)) {
    fail('runner_prerequisite_adapter_invalid', 2);
  }
  const common = { adapter, originalMutationAllowed: false, automaticRetryAllowed: false };
  if (adapter === 'backup') {
    return Object.freeze([
      Object.freeze({ ...common, kind: 'execFile', command: 'docker', args: ['exec', SYS01_IDENTITIES.original.container, 'pg_dump', '--version'] }),
      Object.freeze({ ...common, kind: 'spawn', command: 'docker', args: ['exec', SYS01_IDENTITIES.original.container, 'pg_dump', '-U', postgresUser, '-d', SYS01_IDENTITIES.original.database, '--format=custom', '--no-owner', '--no-privileges'], output: 'aes-256-gcm-encrypted-repository-external-file' }),
      Object.freeze({ ...common, kind: 'filesystem', operation: 'commit-encrypted-artifact', flags: ['O_CREAT', 'O_EXCL', 'O_NOFOLLOW'], mode: 0o600 }),
    ]);
  }
  if (adapter === 'restore') {
    return Object.freeze([
      Object.freeze({ ...common, kind: 'filesystem', operation: 'read-encrypted-artifact', flags: ['O_RDONLY', 'O_NOFOLLOW'] }),
      Object.freeze({ ...common, kind: 'spawn', command: 'docker', args: ['run', '--rm', '--interactive', SYS01_IDENTITIES.restoreDrill.image, 'pg_restore', '--list'] }),
      Object.freeze({ ...common, kind: 'spawn', command: 'docker', args: ['exec', '-i', SYS01_IDENTITIES.restoreDrill.container, 'pg_restore', '-U', postgresUser, '-d', SYS01_IDENTITIES.restoreDrill.database, '--exit-on-error', '--no-owner', '--no-privileges'] }),
      Object.freeze({ ...common, kind: 'database', operation: 'verify-restore-opaque-equality' }),
    ]);
  }
  if (adapter === 'candidate-create') {
    const [volumeStep, containerStep] = buildExactPostgresContainerSteps(SYS01_IDENTITIES.candidate);
    return Object.freeze([
      Object.freeze({ ...common, kind: 'execFile', ...volumeStep }),
      Object.freeze({ ...common, kind: 'execFile', ...containerStep, secretEnvironmentKeys: ['POSTGRES_PASSWORD'] }),
      Object.freeze({ ...common, kind: 'database', operation: 'verify-candidate-empty-and-exact-identity' }),
    ]);
  }
  if (adapter === 'baseline-bootstrap') {
    return Object.freeze([
      Object.freeze({ ...common, kind: 'database', operation: 'assert-candidate-empty' }),
      Object.freeze({ ...common, kind: 'database', operation: 'apply-manifest-bound-baseline-in-one-transaction' }),
      Object.freeze({ ...common, kind: 'database', operation: 'verify-schema-fingerprint-and-marker-only-origin' }),
    ]);
  }
  if (adapter === 'transfer') {
    return Object.freeze([
      Object.freeze({ ...common, kind: 'database', operation: 'read-original-single-repeatable-read-snapshot' }),
      Object.freeze({ ...common, kind: 'database', operation: 'copy-mapped-rows-to-exact-candidate' }),
      Object.freeze({ ...common, kind: 'database', operation: 'verify-count-digest-secret-equality-and-original-unchanged' }),
    ]);
  }
  return Object.freeze([
    Object.freeze({ ...common, kind: 'database', operation: 'inspect-candidate-catalog-count-mapping-null-and-marker' }),
    Object.freeze({ ...common, kind: 'database', operation: 'verify-original-unchanged' }),
  ]);
}

async function createEncryptedBackup(env, repositoryRoot, runtime = {}) {
  const backupPath = path.resolve(requiredExecutionEnv(env, 'ZMTG_SYS01_ENCRYPTED_BACKUP_PATH'));
  await (runtime.assertRepoExternalPath ?? assertRepoExternalPath)(backupPath, repositoryRoot);
  const key = await (runtime.readBackupKey ?? readSys01BackupKey)(env, repositoryRoot);
  const user = requiredExecutionEnv(env, 'ZMTG_SYS01_POSTGRES_USER');
  const adapterSteps = buildSys01PrerequisiteAdapterStepsV1('backup', { postgresUser: user });
  const version = await (runtime.execOpaque ?? execOpaque)(adapterSteps[0].command, adapterSteps[0].args);
  if (!version.stdout.includes('16.14')) fail('runner_backup_tool_version_mismatch');
  const iv = (runtime.randomBytes ?? randomBytes)(12);
  let headerHandle;
  try {
    headerHandle = await (runtime.open ?? open)(backupPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | O_NOFOLLOW, 0o600);
    await headerHandle.write(Buffer.concat([Buffer.from('ZMTGS26BKP1\0', 'ascii'), iv]));
    const child = (runtime.spawn ?? spawn)(
      adapterSteps[1].command,
      adapterSteps[1].args,
      { env, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const cipher = (runtime.createCipheriv ?? createCipheriv)('aes-256-gcm', key, iv);
    const childResult = (runtime.waitForSpawnExit ?? waitForSpawnExit)(
      child,
      'runner_backup_process_failed',
      { timeoutMs: runtime.processTimeoutMs },
    );
    await Promise.all([
      (runtime.pipeline ?? pipeline)(
        child.stdout,
        cipher,
        (runtime.createWriteStream ?? createWriteStream)(backupPath, { fd: headerHandle.fd, autoClose: false }),
      ),
      childResult,
    ]);
    await headerHandle.write(cipher.getAuthTag());
    await headerHandle.sync();
    await headerHandle.close();
    headerHandle = null;
    const stat = await (runtime.lstat ?? lstat)(backupPath);
    const evidence = {
      ciphertextSha256: await (runtime.fileSha256 ?? fileSha256)(backupPath),
      ciphertextBytes: stat.size,
      pgDumpVersion: '16.14',
      plaintextResidual: false,
      originalMutationCount: 0,
    };
    return {
      status: 'succeeded',
      postconditionVerified: true,
      ...evidence,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: safeResultFingerprint(evidence),
    };
  } catch {
    await headerHandle?.close();
    return {
      status: 'unknown',
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('backup_unknown', 'utf8')),
    };
  } finally {
    key?.fill(0);
  }
}

async function waitForPostgresContainer(container, user, database, env) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await execFile(
        'docker',
        ['exec', container, 'pg_isready', '-U', user, '-d', database],
        { encoding: 'utf8', env },
      );
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
  }
  fail('runner_postgres_readiness_timeout');
}

async function restoreEncryptedBackup(env, repositoryRoot, executionManifest, runtime = {}) {
  const backupPath = path.resolve(requiredExecutionEnv(env, 'ZMTG_SYS01_ENCRYPTED_BACKUP_PATH'));
  await (runtime.assertRepoExternalPath ?? assertRepoExternalPath)(backupPath, repositoryRoot, { mustExist: true, privateFile: true });
  const key = await (runtime.readBackupKey ?? readSys01BackupKey)(env, repositoryRoot);
  const user = requiredExecutionEnv(env, 'ZMTG_SYS01_POSTGRES_USER');
  const adapterSteps = buildSys01PrerequisiteAdapterStepsV1('restore', { postgresUser: user });
  let mutationStarted = false;
  try {
    const stat = await (runtime.lstat ?? lstat)(backupPath);
    if (!stat.isFile() || stat.size <= 40) fail('runner_backup_artifact_invalid');
    const backupReceipt = executionManifest?.phaseReceipts
      ?.filter((receipt) => receipt.phase === 'backup' && receipt.status === 'succeeded')
      .at(-1);
    const frozenCiphertextSha256 = backupReceipt?.evidence?.ciphertextSha256;
    if (
      !SHA256_PATTERN.test(frozenCiphertextSha256 ?? '') ||
      (await (runtime.fileSha256 ?? fileSha256)(backupPath)) !== frozenCiphertextSha256
    ) fail('runner_backup_artifact_drift');
    const header = Buffer.alloc(24);
    const tag = Buffer.alloc(16);
    const handle = await (runtime.open ?? open)(backupPath, fsConstants.O_RDONLY | O_NOFOLLOW);
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, stat.size - tag.length);
    await handle.close();
    if (!header.subarray(0, 12).equals(Buffer.from('ZMTGS26BKP1\0', 'ascii'))) {
      fail('runner_backup_artifact_invalid');
    }
    const pipeDecryptedArchive = async (destination) => {
      let archiveHandle;
      try {
        archiveHandle = await (runtime.open ?? open)(backupPath, fsConstants.O_RDONLY | O_NOFOLLOW);
        const decipher = (runtime.createDecipheriv ?? createDecipheriv)('aes-256-gcm', key, header.subarray(12, 24));
        decipher.setAuthTag(tag);
        await (runtime.pipeline ?? pipeline)(
          (runtime.createReadStream ?? createReadStream)(backupPath, {
            fd: archiveHandle.fd,
            autoClose: false,
            start: 24,
            end: stat.size - 17,
          }),
          decipher,
          destination,
        );
      } finally {
        await archiveHandle?.close();
      }
    };
    const archiveCheck = (runtime.spawn ?? spawn)(
      adapterSteps[1].command,
      adapterSteps[1].args,
      { env, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    const archiveListChunks = [];
    let archiveListBytes = 0;
    archiveCheck.stdout.on('data', (chunk) => {
      archiveListBytes += chunk.length;
      if (archiveListBytes > 2 * 1024 * 1024) archiveCheck.kill();
      else archiveListChunks.push(chunk);
    });
    const archiveCheckResult = (runtime.waitForSpawnExit ?? waitForSpawnExit)(
      archiveCheck,
      'runner_restore_archive_check_failed',
      { timeoutMs: runtime.processTimeoutMs },
    );
    await Promise.all([pipeDecryptedArchive(archiveCheck.stdin), archiveCheckResult]);
    const archiveTables = [...Buffer.concat(archiveListChunks).toString('utf8').matchAll(
      /^\d+;\s+\d+\s+\d+\s+TABLE\s+(\S+)\s+(\S+)\s+\S+$/gmu,
    )].map((match) => `${match[1]}.${match[2]}`).sort();
    const expectedArchiveTables = SYS01_TABLE_CONTRACT.map((entry) =>
      entry.table.includes('.') ? entry.table : `public.${entry.table}`,
    ).sort();
    if (canonicalJson(archiveTables) !== canonicalJson(expectedArchiveTables)) {
      fail('runner_backup_archive_table_set_mismatch');
    }
    mutationStarted = true;
    await (runtime.createExactPostgresContainer ?? createExactPostgresContainer)(SYS01_IDENTITIES.restoreDrill, env);
    await (runtime.waitForPostgresContainer ?? waitForPostgresContainer)(
      SYS01_IDENTITIES.restoreDrill.container,
      user,
      SYS01_IDENTITIES.restoreDrill.database,
      env,
    );
    const restoreIdentity = await (runtime.inspectContainer ?? inspectContainer)(
      SYS01_IDENTITIES.restoreDrill,
    );
    assertDatabaseIdentity('restoreDrill', restoreIdentity);
    if (restoreIdentity.exists !== true) fail('runner_restoreDrill_missing');
    const child = (runtime.spawn ?? spawn)(
      adapterSteps[2].command,
      adapterSteps[2].args,
      { env, stdio: ['pipe', 'ignore', 'ignore'] },
    );
    const childResult = (runtime.waitForSpawnExit ?? waitForSpawnExit)(
      child,
      'runner_restore_process_failed',
      { timeoutMs: runtime.processTimeoutMs },
    );
    await Promise.all([pipeDecryptedArchive(child.stdin), childResult]);
    const restored = await (runtime.readDatabaseInventory ?? readDatabaseInventory)(
      requiredExecutionEnv(env, 'ZMTG_SYS01_RESTORE_DRILL_DATABASE_URL'),
      { includeOpaque: true },
    );
    const original = await (runtime.readDatabaseInventory ?? readDatabaseInventory)(
      requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
      { includeOpaque: true },
    );
    const evidence = {
      backupCiphertextSha256: frozenCiphertextSha256,
      archiveTableSetVerified: true,
      restoreIdentityVerified: true,
      restoredOpaqueEqualityVerified:
        restored.opaqueDatabaseFingerprint === original.opaqueDatabaseFingerprint,
      restoredCatalogFingerprint: restored.sourceCatalogFingerprint,
      restoredAggregateFingerprint: validateSourceInventory(restored.sourceInventory).rowCountFingerprint,
      originalMutationCount: 0,
    };
    const valid =
      evidence.restoredOpaqueEqualityVerified &&
      evidence.restoredCatalogFingerprint === executionManifest.sourceCatalogFingerprint &&
      evidence.restoredAggregateFingerprint === executionManifest.lowSensitiveAggregateFingerprint;
    return {
      status: valid ? 'succeeded' : 'unknown',
      postconditionVerified: valid,
      ...evidence,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: safeResultFingerprint(evidence),
    };
  } catch {
    return {
      status: mutationStarted ? 'unknown' : 'not_started',
      preconditionFailed: !mutationStarted,
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('restore_unknown', 'utf8')),
    };
  } finally {
    key?.fill(0);
  }
}

async function inspectCandidateEmptyDatabase(env) {
  let sql;
  try {
    const postgres = (await import('postgres')).default;
    sql = postgres(requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'), {
      max: 1,
      prepare: false,
      onnotice: () => undefined,
    });
    const rows = await sql`
      SELECT count(*)::integer AS count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `;
    return rows[0]?.count === 0;
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function createCandidateDatabase(env, runtime = {}) {
  let mutationStarted = false;
  try {
    mutationStarted = true;
    await (runtime.createExactPostgresContainer ?? createExactPostgresContainer)(
      SYS01_IDENTITIES.candidate,
      env,
      { execOpaqueImpl: runtime.execOpaque ?? execOpaque },
    );
    await (runtime.waitForPostgresContainer ?? waitForPostgresContainer)(
      SYS01_IDENTITIES.candidate.container,
      requiredExecutionEnv(env, 'ZMTG_SYS01_POSTGRES_USER'),
      SYS01_IDENTITIES.candidate.database,
      env,
    );
    const candidateIdentity = await (runtime.inspectContainer ?? inspectContainer)(
      SYS01_IDENTITIES.candidate,
    );
    assertDatabaseIdentity('candidate', candidateIdentity);
    if (candidateIdentity.exists !== true) fail('runner_candidate_missing');
    const candidateEmpty = await (runtime.inspectCandidateEmpty ?? inspectCandidateEmptyDatabase)(env);
    if (!candidateEmpty) fail('runner_candidate_not_empty');
    const evidence = {
      candidateIdentityVerified: true,
      candidateEmpty: true,
      originalMutationCount: 0,
    };
    return {
      status: 'succeeded',
      postconditionVerified: true,
      ...evidence,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: safeResultFingerprint(evidence),
    };
  } catch {
    return {
      status: mutationStarted ? 'unknown' : 'not_started',
      preconditionFailed: !mutationStarted,
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('candidate_create_unknown', 'utf8')),
    };
  }
}

function baselineBootstrapResult(evidence, bundle, now) {
  const valid =
    evidence.actualSchemaFingerprintSha256 === bundle.validation.schemaFingerprintSha256 &&
    evidence.markerId === 1 &&
    evidence.markerHash === bundle.validation.marker.hash &&
    evidence.markerCreatedAt === bundle.validation.marker.createdAt &&
    evidence.markerRowCount === 1 &&
    evidence.markerShapeVerified === true &&
    evidence.originalMutationCount === 0;
  return {
    status: valid ? 'succeeded' : 'unknown',
    postconditionVerified: valid,
    ...evidence,
    completedAt: now(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

async function bootstrapCandidateBaseline(env, bundle, runtime = {}) {
  let transactionStarted = false;
  let sql;
  try {
    if (typeof runtime.bootstrapDatabase === 'function') {
      transactionStarted = true;
      const evidence = await runtime.bootstrapDatabase({
        bundle,
        candidateIdentity: SYS01_IDENTITIES.candidate,
        originalMutationAllowed: false,
      });
      return baselineBootstrapResult(
        evidence,
        bundle,
        runtime.now ?? (() => new Date().toISOString()),
      );
    }
    const postgres = (await import('postgres')).default;
    const { SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL } = await import('./guarded-migrate.mjs');
    sql = postgres(requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'), {
      max: 1,
      prepare: false,
      onnotice: () => undefined,
    });
    await sql.begin(async (transaction) => {
      transactionStarted = true;
      const existing = await transaction`
        SELECT count(*)::integer AS count
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      `;
      if (existing[0]?.count !== 0) fail('runner_candidate_not_empty');
      await transaction.unsafe(bundle.sqlSource);
      await transaction.unsafe(`
        CREATE SCHEMA drizzle;
        CREATE TABLE drizzle.__drizzle_migrations (
          id serial PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        );
      `);
      await transaction`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${bundle.validation.marker.hash}, ${bundle.validation.marker.createdAt})
      `;
    });
    const catalogRows = await sql.unsafe(SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL);
    const actualSchemaFingerprintSha256 = catalogFingerprintFromRecords(
      catalogRows[0]?.catalog,
    );
    const markerRows = await sql`
      SELECT id, hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY id ASC
    `;
    const markerColumns = await sql`
      SELECT column_name AS name, data_type AS type, is_nullable,
             CASE
               WHEN column_default LIKE 'nextval(%' THEN 'serial_sequence'
               WHEN column_default IS NULL THEN 'none'
               ELSE 'other'
             END AS default_kind
      FROM information_schema.columns
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ORDER BY ordinal_position
    `;
    const markerPrimaryKey = await sql`
      SELECT array_agg(attribute_row.attname ORDER BY key_row.ordinal) AS keys
      FROM pg_catalog.pg_constraint constraint_row
      JOIN pg_catalog.pg_class relation_row ON relation_row.oid = constraint_row.conrelid
      JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
      JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal) ON true
      JOIN pg_catalog.pg_attribute attribute_row
        ON attribute_row.attrelid = constraint_row.conrelid
       AND attribute_row.attnum = key_row.attnum
      WHERE namespace_row.nspname = 'drizzle'
        AND relation_row.relname = '__drizzle_migrations'
        AND constraint_row.contype = 'p'
    `;
    const markerRelation = await sql`
      SELECT relation_row.relkind AS relation_kind
      FROM pg_catalog.pg_class relation_row
      JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
      WHERE namespace_row.nspname = 'drizzle'
        AND relation_row.relname = '__drizzle_migrations'
    `;
    const markerNonPrimaryConstraints = await sql`
      SELECT constraint_row.contype AS type, constraint_row.conname AS name
      FROM pg_catalog.pg_constraint constraint_row
      JOIN pg_catalog.pg_class relation_row ON relation_row.oid = constraint_row.conrelid
      JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
      WHERE namespace_row.nspname = 'drizzle'
        AND relation_row.relname = '__drizzle_migrations'
        AND constraint_row.contype <> 'p'
      ORDER BY constraint_row.contype, constraint_row.conname
    `;
    const markerNonConstraintIndexes = await sql`
      SELECT index_relation.relname AS name
      FROM pg_catalog.pg_index index_row
      JOIN pg_catalog.pg_class relation_row ON relation_row.oid = index_row.indrelid
      JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
      JOIN pg_catalog.pg_class index_relation ON index_relation.oid = index_row.indexrelid
      LEFT JOIN pg_catalog.pg_constraint constraint_row ON constraint_row.conindid = index_row.indexrelid
      WHERE namespace_row.nspname = 'drizzle'
        AND relation_row.relname = '__drizzle_migrations'
        AND constraint_row.oid IS NULL
      ORDER BY index_relation.relname
    `;
    const markerUserTriggers = await sql`
      SELECT trigger_row.tgname AS name
      FROM pg_catalog.pg_trigger trigger_row
      JOIN pg_catalog.pg_class relation_row ON relation_row.oid = trigger_row.tgrelid
      JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
      WHERE namespace_row.nspname = 'drizzle'
        AND relation_row.relname = '__drizzle_migrations'
        AND NOT trigger_row.tgisinternal
      ORDER BY trigger_row.tgname
    `;
    const markerShapeVerified = canonicalJson({
      relationKind: markerRelation[0]?.relation_kind ?? null,
      columns: markerColumns.map((row) => ({
        name: row.name,
        type: row.type,
        nullable: row.is_nullable === 'YES',
        defaultKind: row.default_kind,
      })),
      primaryKeyColumns: markerPrimaryKey[0]?.keys ?? [],
      nonPrimaryConstraints: markerNonPrimaryConstraints.map((row) => ({
        type: row.type,
        name: row.name,
      })),
      nonConstraintIndexes: markerNonConstraintIndexes.map((row) => row.name),
      userTriggers: markerUserTriggers.map((row) => row.name),
    }) === canonicalJson({
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
    });
    const marker = markerRows[0];
    const evidence = {
      actualSchemaFingerprintSha256,
      markerId: marker?.id,
      markerHash: marker?.hash,
      markerCreatedAt: Number(marker?.created_at),
      markerRowCount: markerRows.length,
      markerShapeVerified,
      originalMutationCount: 0,
    };
    return baselineBootstrapResult(
      evidence,
      bundle,
      runtime.now ?? (() => new Date().toISOString()),
    );
  } catch {
    return {
      status: transactionStarted ? 'unknown' : 'not_started',
      preconditionFailed: !transactionStarted,
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('baseline_bootstrap_unknown', 'utf8')),
    };
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
}

function topologicalTableOrder(tables, foreignKeys) {
  const included = new Set(tables);
  const dependencies = new Map(tables.map((table) => [table, new Set()]));
  for (const row of foreignKeys) {
    if (included.has(row.child_table) && included.has(row.parent_table) && row.child_table !== row.parent_table) {
      dependencies.get(row.child_table).add(row.parent_table);
    }
  }
  const ordered = [];
  while (dependencies.size > 0) {
    const ready = [...dependencies.entries()]
      .filter(([, values]) => [...values].every((value) => !dependencies.has(value)))
      .map(([table]) => table)
      .sort();
    if (ready.length === 0) fail('runner_transfer_fk_cycle');
    for (const table of ready) {
      ordered.push(table);
      dependencies.delete(table);
    }
  }
  return ordered;
}

function buildExpectedTargetRows(sourceRows) {
  const customers = sourceRows.customers ?? [];
  const mappedMemberships = mapMembershipCalibrationRows(sourceRows.tenant_members ?? []);
  const rowsByTarget = {};
  for (const contract of SYS01_TABLE_CONTRACT) {
    if (contract.classification === 'MUST_PRESERVE' || contract.classification === 'SECRET_SENSITIVE') {
      rowsByTarget[contract.table] = sourceRows[contract.table] ?? [];
    }
  }
  rowsByTarget.appointments = mapOwnerReconstructedRows(sourceRows.appointments ?? [], customers);
  rowsByTarget.treatment_summaries = mapOwnerReconstructedRows(
    sourceRows.treatment_summaries ?? [],
    customers,
  );
  rowsByTarget.follow_up_tasks = mapOwnerReconstructedRows(
    sourceRows.follow_up_tasks ?? [],
    customers,
  );
  rowsByTarget.audit_events = mapAuditRows(sourceRows.audit_events ?? []);
  rowsByTarget.tenant_members = mappedMemberships.map((entry) => entry.current);
  rowsByTarget.tenant_membership_transitions = mappedMemberships.map(
    (entry) => entry.transition,
  );
  mapBindingRows(sourceRows.auth_account_institution_bindings ?? []);
  return rowsByTarget;
}

function projectedRowsDigest(rows, expectedRows) {
  const keys = [...new Set(expectedRows.flatMap((row) => Object.keys(row)))].sort();
  return opaqueRowsDigest(
    rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))),
  );
}

function transferAdapterResult(evidence, executionManifest, now) {
  const valid =
    evidence.specialMappingsVerified === true &&
    evidence.secretOpaqueEqualityVerified === true &&
    evidence.excludedTargetsEmpty === true &&
    evidence.mappedRowsVerified === true &&
    evidence.originalUnchanged === true &&
    evidence.originalBeforeFingerprint === evidence.originalAfterFingerprint &&
    evidence.sourceAggregateFingerprint === executionManifest.lowSensitiveAggregateFingerprint &&
    SHA256_PATTERN.test(evidence.targetAggregateFingerprint ?? '') &&
    evidence.originalMutationCount === 0;
  return {
    status: valid ? 'succeeded' : 'unknown',
    postconditionVerified: valid,
    ...evidence,
    completedAt: now(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

async function transferCandidateData(env, executionManifest, runtime = {}) {
  let target;
  let mutationStarted = false;
  try {
    if (typeof runtime.transferDatabase === 'function') {
      mutationStarted = true;
      const evidence = await runtime.transferDatabase({
        executionManifest,
        originalIdentity: SYS01_IDENTITIES.original,
        candidateIdentity: SYS01_IDENTITIES.candidate,
        originalMutationAllowed: false,
      });
      return transferAdapterResult(
        evidence,
        executionManifest,
        runtime.now ?? (() => new Date().toISOString()),
      );
    }
    const postgres = (await import('postgres')).default;
    target = postgres(requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'), {
      max: 1,
      prepare: false,
      onnotice: () => undefined,
    });
    const before = await readDatabaseInventory(
      requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
      { includeRows: true, includeOpaque: true },
    );
    if (
      validateSourceInventory(before.sourceInventory).rowCountFingerprint !==
        executionManifest.lowSensitiveAggregateFingerprint ||
      before.sourceCatalogFingerprint !== executionManifest.sourceCatalogFingerprint
    ) fail('source_inventory_re_admission_required');
    const sourceRows = before.rowsByTable;
    const rowsByTarget = buildExpectedTargetRows(sourceRows);
    const secretSourceDigests = Object.fromEntries(
      secretSensitiveTables.map((table) => [
        table,
        opaqueRowsDigest(sourceRows[table] ?? []),
      ]),
    );
    mutationStarted = true;
    await target.begin(async (transaction) => {
      for (const table of [
        ...SYS01_TABLE_CONTRACT.filter((entry) => entry.table !== 'drizzle.__drizzle_migrations').map((entry) => entry.table),
        ...SYS01_TARGET_ONLY_CONTRACT.map((entry) => entry.table),
      ]) {
        const existing = await transaction.unsafe(
          `SELECT count(*)::bigint AS count FROM ${quoteQualifiedTable(table)}`,
        );
        if (Number(existing[0]?.count) !== 0) fail('runner_candidate_not_empty');
      }
      const foreignKeys = await transaction`
        SELECT child.relname AS child_table, parent.relname AS parent_table
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_class child ON child.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_class parent ON parent.oid = constraint_row.confrelid
        JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = child.relnamespace
        WHERE namespace_row.nspname = 'public' AND constraint_row.contype = 'f'
      `;
      const targetTables = Object.keys(rowsByTarget);
      const order = topologicalTableOrder(targetTables, foreignKeys);
      for (const table of order) {
        const rows = rowsByTarget[table];
        if (rows.length === 0) continue;
        const columnRows = await transaction`
          SELECT column_name, is_nullable, column_default, is_identity, is_generated
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${table}
          ORDER BY ordinal_position
        `;
        const targetColumns = columnRows.map((row) => row.column_name);
        const sourceKeys = new Set(rows.flatMap((row) => Object.keys(row)));
        const unknownKeys = [...sourceKeys].filter((key) => !targetColumns.includes(key));
        if (unknownKeys.length > 0) fail('runner_transfer_column_drift');
        const omittedRequired = columnRows.filter(
          (column) =>
            !sourceKeys.has(column.column_name) &&
            column.is_nullable === 'NO' &&
            column.column_default === null &&
            column.is_identity === 'NO' &&
            column.is_generated === 'NEVER',
        );
        if (omittedRequired.length > 0) fail('runner_transfer_required_column_missing');
        const columns = targetColumns.filter((column) => sourceKeys.has(column));
        await transaction`
          INSERT INTO ${transaction(table)} ${transaction(rows, columns)}
        `;
      }
    });
    const targetCounts = {};
    for (const table of [
      ...SYS01_TABLE_CONTRACT.filter((entry) => entry.table !== 'drizzle.__drizzle_migrations').map((entry) => entry.table),
      ...SYS01_TARGET_ONLY_CONTRACT.map((entry) => entry.table),
    ]) {
      const rows = await target.unsafe(
        `SELECT count(*)::bigint AS count FROM ${quoteQualifiedTable(table)}`,
      );
      targetCounts[table] = Number(rows[0].count);
    }
    assertExcludedTargetsEmpty(targetCounts);
    const expectedCounts = expectedCandidateRowCounts(executionManifest.perTableRowCounts);
    if (canonicalJson(targetCounts) !== canonicalJson(expectedCounts)) {
      fail('runner_transfer_target_count_mismatch');
    }
    const secretTargetDigests = {};
    for (const table of secretSensitiveTables) {
      const rows = await target.unsafe(`SELECT * FROM ${quoteQualifiedTable(table)}`);
      secretTargetDigests[table] = opaqueRowsDigest(Array.from(rows));
    }
    assertSecretOpaqueEquality(secretSourceDigests, secretTargetDigests);
    let mappedRowsVerified = true;
    for (const [table, expectedRows] of Object.entries(rowsByTarget)) {
      const actualRows = Array.from(
        await target.unsafe(`SELECT * FROM ${quoteQualifiedTable(table)}`),
      );
      if (projectedRowsDigest(actualRows, expectedRows) !== opaqueRowsDigest(expectedRows)) {
        mappedRowsVerified = false;
      }
    }
    const after = await readDatabaseInventory(
      requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
      { includeOpaque: true },
    );
    const originalUnchanged =
      before.originalFingerprint === after.originalFingerprint &&
      before.opaqueDatabaseFingerprint === after.opaqueDatabaseFingerprint;
    const evidence = {
      specialMappingsVerified: true,
      secretOpaqueEqualityVerified: true,
      excludedTargetsEmpty: true,
      mappedRowsVerified,
      originalUnchanged,
      originalBeforeFingerprint: before.originalFingerprint,
      originalAfterFingerprint: after.originalFingerprint,
      sourceAggregateFingerprint: validateSourceInventory(before.sourceInventory).rowCountFingerprint,
      targetAggregateFingerprint: sha256Bytes(Buffer.from(canonicalJson(targetCounts), 'utf8')),
      originalMutationCount: 0,
    };
    return transferAdapterResult(
      evidence,
      executionManifest,
      runtime.now ?? (() => new Date().toISOString()),
    );
  } catch {
    return {
      status: mutationStarted ? 'unknown' : 'not_started',
      preconditionFailed: !mutationStarted,
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('transfer_unknown', 'utf8')),
    };
  } finally {
    await target?.end({ timeout: 1 }).catch(() => undefined);
  }
}

function validationAdapterResult(evidence, bundle, now) {
  const valid =
    evidence.actualSchemaFingerprintSha256 === bundle.validation.schemaFingerprintSha256 &&
    evidence.constraintsVerified === true &&
    evidence.primaryKeysVerified === true &&
    evidence.foreignKeysVerified === true &&
    evidence.rowCountsVerified === true &&
    evidence.businessAggregatesVerified === true &&
    evidence.mappedRowsVerified === true &&
    evidence.nullShapeVerified === true &&
    evidence.markerVerified === true &&
    evidence.originalUnchanged === true &&
    evidence.originalMutationCount === 0;
  return {
    status: valid ? 'succeeded' : 'not_started',
    preconditionFailed: !valid,
    postconditionVerified: valid,
    ...evidence,
    completedAt: now(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

async function inspectCandidateValidation(env, bundle, executionManifest, runtime = {}) {
  let sql;
  try {
    if (typeof runtime.validateDatabase === 'function') {
      const evidence = await runtime.validateDatabase({
        bundle,
        executionManifest,
        originalIdentity: SYS01_IDENTITIES.original,
        candidateIdentity: SYS01_IDENTITIES.candidate,
        originalMutationAllowed: false,
      });
      return validationAdapterResult(
        evidence,
        bundle,
        runtime.now ?? (() => new Date().toISOString()),
      );
    }
    const postgres = (await import('postgres')).default;
    const { SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL } = await import('./guarded-migrate.mjs');
    const originalBefore = await readDatabaseInventory(
      requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
      { includeRows: true, includeOpaque: true },
    );
    const expectedRowsByTarget = buildExpectedTargetRows(originalBefore.rowsByTable);
    sql = postgres(requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'), {
      max: 1,
      prepare: false,
      onnotice: () => undefined,
    });
    return await sql.begin('read only isolation level repeatable read', async (transaction) => {
      const catalog = await transaction.unsafe(SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL);
      const invalidConstraints = await transaction`
        SELECT constraint_row.conname AS name
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = constraint_row.connamespace
        WHERE namespace_row.nspname = 'public'
          AND NOT constraint_row.convalidated
        ORDER BY constraint_row.conname
      `;
      const targetCounts = {};
      const nullVectors = {};
      const targetRowsByTable = {};
      for (const table of [
        ...SYS01_TABLE_CONTRACT.filter((entry) => entry.table !== 'drizzle.__drizzle_migrations').map((entry) => entry.table),
        ...SYS01_TARGET_ONLY_CONTRACT.map((entry) => entry.table),
      ]) {
        const countRows = await transaction.unsafe(
          `SELECT count(*)::bigint AS count FROM ${quoteQualifiedTable(table)}`,
        );
        targetCounts[table] = Number(countRows[0]?.count);
        targetRowsByTable[table] = Array.from(
          await transaction.unsafe(`SELECT * FROM ${quoteQualifiedTable(table)}`),
        );
        const columns = await transaction`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${table}
          ORDER BY ordinal_position
        `;
        const projections = columns.map(
          (row) => `count(*) FILTER (WHERE ${quoteIdentifier(row.column_name)} IS NULL)::bigint AS ${quoteIdentifier(row.column_name)}`,
        );
        const nullRows = projections.length === 0
          ? [{}]
          : await transaction.unsafe(
            `SELECT ${projections.join(', ')} FROM ${quoteQualifiedTable(table)}`,
          );
        nullVectors[table] = Object.fromEntries(
          Object.entries(nullRows[0] ?? {}).map(([column, count]) => [column, Number(count)]),
        );
      }
      const primaryKeys = await transaction`
        SELECT relation_row.relname AS table_name,
               array_agg(attribute_row.attname ORDER BY key_row.ordinal) AS keys
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_class relation_row ON relation_row.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
        JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal) ON true
        JOIN pg_catalog.pg_attribute attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
        WHERE namespace_row.nspname = 'public' AND constraint_row.contype = 'p'
        GROUP BY relation_row.relname
        ORDER BY relation_row.relname
      `;
      let primaryKeysVerified = true;
      for (const row of primaryKeys) {
        const keys = row.keys.map(quoteIdentifier).join(', ');
        const distinctRows = await transaction.unsafe(
          `SELECT count(*)::bigint AS count FROM (SELECT ${keys} FROM ${quoteQualifiedTable(row.table_name)} GROUP BY ${keys}) AS distinct_keys`,
        );
        if (Number(distinctRows[0]?.count) !== targetCounts[row.table_name]) primaryKeysVerified = false;
      }
      const foreignKeys = await transaction`
        SELECT child_relation.relname AS child_table,
               parent_relation.relname AS parent_table,
               array_agg(child_attribute.attname ORDER BY child_key.ordinal) AS child_keys,
               array_agg(parent_attribute.attname ORDER BY child_key.ordinal) AS parent_keys
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_class child_relation ON child_relation.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_class parent_relation ON parent_relation.oid = constraint_row.confrelid
        JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = child_relation.relnamespace
        JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS child_key(attnum, ordinal) ON true
        JOIN unnest(constraint_row.confkey) WITH ORDINALITY AS parent_key(attnum, ordinal)
          ON parent_key.ordinal = child_key.ordinal
        JOIN pg_catalog.pg_attribute child_attribute
          ON child_attribute.attrelid = constraint_row.conrelid
         AND child_attribute.attnum = child_key.attnum
        JOIN pg_catalog.pg_attribute parent_attribute
          ON parent_attribute.attrelid = constraint_row.confrelid
         AND parent_attribute.attnum = parent_key.attnum
        WHERE namespace_row.nspname = 'public' AND constraint_row.contype = 'f'
        GROUP BY child_relation.relname, parent_relation.relname, constraint_row.oid
        ORDER BY child_relation.relname, parent_relation.relname, constraint_row.oid
      `;
      let foreignKeysVerified = true;
      for (const row of foreignKeys) {
        const joins = row.child_keys.map(
          (key, index) => `child.${quoteIdentifier(key)} = parent.${quoteIdentifier(row.parent_keys[index])}`,
        );
        const present = row.child_keys.map((key) => `child.${quoteIdentifier(key)} IS NOT NULL`);
        const firstParentKey = quoteIdentifier(row.parent_keys[0]);
        const orphanRows = await transaction.unsafe(
          `SELECT count(*)::bigint AS count FROM ${quoteQualifiedTable(row.child_table)} AS child LEFT JOIN ${quoteQualifiedTable(row.parent_table)} AS parent ON ${joins.join(' AND ')} WHERE ${present.join(' AND ')} AND parent.${firstParentKey} IS NULL`,
        );
        if (Number(orphanRows[0]?.count) !== 0) foreignKeysVerified = false;
      }
      const markerRows = await transaction`
        SELECT id, hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY id ASC
      `;
      const expectedCounts = expectedCandidateRowCounts(
        executionManifest?.perTableRowCounts ?? {},
      );
      const rowCountsVerified =
        Object.keys(expectedCounts).length > 0 && canonicalJson(targetCounts) === canonicalJson(expectedCounts);
      assertExcludedTargetsEmpty(targetCounts);
      let mappedRowsVerified = true;
      let nullShapeVerified = true;
      for (const [table, expectedRows] of Object.entries(expectedRowsByTarget)) {
        const actualRows = targetRowsByTable[table] ?? [];
        if (projectedRowsDigest(actualRows, expectedRows) !== opaqueRowsDigest(expectedRows)) {
          mappedRowsVerified = false;
        }
        const keys = [...new Set(expectedRows.flatMap((row) => Object.keys(row)))].sort();
        const expectedNulls = Object.fromEntries(
          keys.map((key) => [key, expectedRows.filter((row) => row[key] === null).length]),
        );
        const actualNulls = Object.fromEntries(
          keys.map((key) => [key, actualRows.filter((row) => row[key] === null).length]),
        );
        if (canonicalJson(expectedNulls) !== canonicalJson(actualNulls)) nullShapeVerified = false;
      }
      const businessTables = [
        'tenants',
        'tenant_members',
        'customers',
        'appointments',
        'treatment_summaries',
        'follow_up_tasks',
        'audit_events',
        'ai_call_usage_records',
      ];
      const businessAggregatesVerified =
        mappedRowsVerified &&
        businessTables.every((table) => targetCounts[table] === expectedCounts[table]);
      const evidence = {
        actualSchemaFingerprintSha256: catalogFingerprintFromRecords(catalog[0]?.catalog),
        constraintsVerified:
          canonicalJson(invalidConstraints.map((row) => row.name)) ===
          canonicalJson([
            'auth_account_institution_bindings_scope_fk',
            'tenant_members_user_id_auth_users_id_fk',
          ]),
        primaryKeysVerified,
        foreignKeysVerified,
        rowCountsVerified,
        businessAggregatesVerified,
        mappedRowsVerified,
        markerVerified:
          markerRows.length === 1 &&
          markerRows[0]?.id === 1 &&
          markerRows[0]?.hash === bundle.validation.marker.hash &&
          Number(markerRows[0]?.created_at) === bundle.validation.marker.createdAt,
        nullShapeFingerprint: safeResultFingerprint(nullVectors),
        nullShapeVerified,
        targetAggregateFingerprint: safeResultFingerprint(targetCounts),
        originalUnchanged: false,
        originalMutationCount: 0,
      };
      const originalAfter = await readDatabaseInventory(
        requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
        { includeOpaque: true },
      );
      evidence.originalUnchanged =
        originalBefore.originalFingerprint === originalAfter.originalFingerprint &&
        originalBefore.opaqueDatabaseFingerprint === originalAfter.opaqueDatabaseFingerprint;
      return validationAdapterResult(
        evidence,
        bundle,
        runtime.now ?? (() => new Date().toISOString()),
      );
    });
  } catch {
    return {
      status: 'not_started',
      preconditionFailed: true,
      postconditionVerified: false,
      completedAt: (runtime.now ?? (() => new Date().toISOString()))(),
      postconditionFingerprint: sha256Bytes(Buffer.from('validate_failed', 'utf8')),
    };
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function inspectRollbackReadiness(env, bundle, executionManifest) {
  const identities = await inspectExactIdentities(env);
  const validation = await inspectCandidateValidation(env, bundle, executionManifest);
  const ready =
    identities.original.exists === true &&
    identities.original.conflict !== true &&
    identities.candidate.exists === true &&
    identities.candidate.conflict !== true &&
    validation.status === 'succeeded' &&
    validation.postconditionVerified === true;
  const evidence = {
    originalRetained: identities.original.exists === true,
    candidateRetained: identities.candidate.exists === true,
    validationVerified: validation.postconditionVerified === true,
    reversible: ready,
    automaticCleanupPerformed: false,
    originalMutationCount: 0,
  };
  return {
    status: ready ? 'succeeded' : 'not_started',
    preconditionFailed: !ready,
    postconditionVerified: ready,
    ...evidence,
    completedAt: new Date().toISOString(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

export function buildBoundCutoverEvidenceReceipt({
  kind,
  evidenceSha256,
  activeTarget,
  bundle,
  executionManifest,
}) {
  if (
    ![
      'pre_cutover_readiness',
      'pre_cutover_application_smoke',
      'post_cutover_readiness',
      'post_cutover_application_smoke',
    ].includes(kind) ||
    !['original', 'candidate'].includes(activeTarget) ||
    !SHA256_PATTERN.test(evidenceSha256 ?? '') ||
    !SHA1_PATTERN.test(executionManifest?.implementationHead ?? '') ||
    !SHA256_PATTERN.test(executionManifest?.baselineManifestSha256 ?? '') ||
    executionManifest.baselineManifestSha256 !== bundle?.validation?.manifestSha256 ||
    !SHA256_PATTERN.test(executionManifest.phaseReceipts?.at(-1)?.digest ?? '')
  ) {
    fail('runner_cutover_evidence_receipt_invalid', 2);
  }
  return safeResultFingerprint({
    task: SYS01_REBUILD_TASK,
    kind,
    evidenceSha256,
    activeTarget,
    activeEndpoint:
      activeTarget === 'original'
        ? `${SYS01_IDENTITIES.original.host}:${SYS01_IDENTITIES.original.port}/${SYS01_IDENTITIES.original.database}`
        : `${SYS01_IDENTITIES.candidate.host}:${SYS01_IDENTITIES.candidate.port}/${SYS01_IDENTITIES.candidate.database}`,
    candidateEndpoint: `${SYS01_IDENTITIES.candidate.host}:${SYS01_IDENTITIES.candidate.port}/${SYS01_IDENTITIES.candidate.database}`,
    implementationHead: executionManifest.implementationHead,
    baselineManifestSha256: executionManifest.baselineManifestSha256,
    previousPhaseReceiptSha256: executionManifest.phaseReceipts.at(-1).digest,
  });
}

function expectedIssuerState(kind) {
  if (kind === 'pre_cutover_readiness' || kind === 'pre_cutover_application_smoke') {
    return 'ROLLBACK_READY';
  }
  if (kind === 'post_cutover_readiness' || kind === 'post_cutover_application_smoke') {
    return 'CUTOVER_READY';
  }
  fail('runner_cutover_evidence_issuer_kind_invalid', 2);
}

function buildIssuerContext({ kind, activeTarget, bundle, executionManifest }) {
  const prerequisiteState = expectedIssuerState(kind);
  const previousPhaseReceiptSha256 = executionManifest?.phaseReceipts?.at(-1)?.digest;
  if (
    activeTarget !== 'candidate' ||
    executionManifest?.state?.current !== prerequisiteState ||
    !SHA1_PATTERN.test(executionManifest?.implementationHead ?? '') ||
    !SHA256_PATTERN.test(executionManifest?.baselineManifestSha256 ?? '') ||
    executionManifest.baselineManifestSha256 !== bundle?.validation?.manifestSha256 ||
    !SHA256_PATTERN.test(previousPhaseReceiptSha256 ?? '')
  ) {
    fail('runner_cutover_evidence_issuer_context_invalid', 2);
  }
  return Object.freeze({
    contractVersion: SYS01_EVIDENCE_CONTRACT_VERSION,
    kind,
    activeTarget,
    activeEndpoint: `${SYS01_IDENTITIES.candidate.host}:${SYS01_IDENTITIES.candidate.port}/${SYS01_IDENTITIES.candidate.database}`,
    implementationHead: executionManifest.implementationHead,
    baselineManifestSha256: executionManifest.baselineManifestSha256,
    previousPhaseReceiptSha256,
    rebuildState: executionManifest.state.current,
    prerequisiteState,
  });
}

export async function issueSys01DeterministicReadinessEvidenceV1({
  kind,
  activeTarget = 'candidate',
  bundle,
  executionManifest,
  probe,
}) {
  if (!['pre_cutover_readiness', 'post_cutover_readiness'].includes(kind) || typeof probe !== 'function') {
    fail('runner_readiness_evidence_issuer_invalid', 2);
  }
  const context = buildIssuerContext({ kind, activeTarget, bundle, executionManifest });
  let observation;
  try {
    observation = await probe();
    assertDatabaseIdentity('candidate', observation?.identity);
  } catch {
    fail('runner_readiness_evidence_probe_failed');
  }
  const validation = observation.validation;
  const evidence = Object.freeze({
    ...context,
    databaseIdentityVerified:
      observation.identity?.exists === true && observation.identity?.conflict !== true,
    expectedSchemaFingerprintSha256: bundle.validation.schemaFingerprintSha256,
    actualSchemaFingerprintSha256: validation?.actualSchemaFingerprintSha256 ?? null,
    markerOriginVerified: validation?.markerVerified === true,
    constraintsVerified: validation?.constraintsVerified === true,
    primaryKeysVerified: validation?.primaryKeysVerified === true,
    foreignKeysVerified: validation?.foreignKeysVerified === true,
    rowCountsVerified: validation?.rowCountsVerified === true,
    mappedRowsVerified: validation?.mappedRowsVerified === true,
    nullShapeVerified: validation?.nullShapeVerified === true,
    postconditionVerified: validation?.postconditionVerified === true,
    originalMutationCount: 0,
  });
  const verified =
    evidence.databaseIdentityVerified &&
    evidence.actualSchemaFingerprintSha256 === evidence.expectedSchemaFingerprintSha256 &&
    evidence.markerOriginVerified &&
    evidence.constraintsVerified &&
    evidence.primaryKeysVerified &&
    evidence.foreignKeysVerified &&
    evidence.rowCountsVerified &&
    evidence.mappedRowsVerified &&
    evidence.nullShapeVerified &&
    evidence.postconditionVerified;
  const evidenceSha256 = safeResultFingerprint(evidence);
  return Object.freeze({
    kind,
    verified,
    evidenceSha256,
    receiptSha256: verified
      ? buildBoundCutoverEvidenceReceipt({
        kind,
        evidenceSha256,
        activeTarget,
        bundle,
        executionManifest,
      })
      : null,
    validation,
  });
}

export async function probeSys01CandidateBoundApplicationV1({
  env = process.env,
  implementationHead,
  spawnImpl = spawn,
  fetchImpl = globalThis.fetch,
  waitImpl = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
  attempts = 60,
  stopTimeoutMs = SYS01_APPLICATION_STOP_TIMEOUT_MS,
} = {}) {
  if (
    !SHA1_PATTERN.test(implementationHead ?? '') ||
    typeof fetchImpl !== 'function' ||
    !Number.isSafeInteger(stopTimeoutMs) ||
    stopTimeoutMs < 1
  ) {
    fail('runner_application_smoke_probe_invalid', 2);
  }
  parseLocalDatabaseUrl(
    requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'),
    SYS01_IDENTITIES.candidate,
  );
  const url = `http://${SYS01_APPLICATION_SMOKE_HOST}:${SYS01_APPLICATION_SMOKE_PORT}${SYS01_APPLICATION_SMOKE_PATH}`;
  let portOccupied = false;
  try {
    await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(250),
    });
    portOccupied = true;
  } catch {
    portOccupied = false;
  }
  if (portOccupied) fail('runner_application_smoke_port_conflict');
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const nextCli = path.join(repositoryRoot, 'node_modules/next/dist/bin/next');
  const childEnvironment = Object.fromEntries(
    ['HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'TZ']
      .filter((key) => typeof env[key] === 'string' && env[key].length > 0)
      .map((key) => [key, env[key]]),
  );
  const child = spawnImpl(
    process.execPath,
    [nextCli, 'start', '--hostname', SYS01_APPLICATION_SMOKE_HOST, '--port', String(SYS01_APPLICATION_SMOKE_PORT)],
    {
      cwd: repositoryRoot,
      env: {
        ...childEnvironment,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        DATABASE_URL: requiredExecutionEnv(env, 'ZMTG_SYS01_CANDIDATE_DATABASE_URL'),
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    },
  );
  let childFailed = false;
  let childExitObserved = false;
  let childErrorObserved = false;
  child?.once?.('error', () => {
    childFailed = true;
    childErrorObserved = true;
  });
  child?.once?.('close', () => {
    childFailed = true;
    childExitObserved = true;
  });
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (childFailed) break;
      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(1_000),
        });
        const version = await response.json();
        if (
          response.status === 200 &&
          version?.commit === implementationHead &&
          version?.source === 'build'
        ) {
          return Object.freeze({
            status: 200,
            route: SYS01_APPLICATION_SMOKE_PATH,
            host: SYS01_APPLICATION_SMOKE_HOST,
            port: SYS01_APPLICATION_SMOKE_PORT,
            versionCommit: version.commit,
            versionSource: version.source,
            databaseTarget: 'candidate',
            processDatabaseIdentityBound: true,
          });
        }
      } catch {
        // The single controlled process gets a bounded startup poll; no phase retry occurs.
      }
      await waitImpl(500);
    }
    fail('runner_application_smoke_probe_failed');
  } finally {
    await new Promise((resolveStop, rejectStop) => {
      if (!child || typeof child.kill !== 'function' || typeof child.once !== 'function') {
        rejectStop(new Error('runner_application_smoke_cleanup_failed'));
        return;
      }
      if (childExitObserved) {
        resolveStop();
        return;
      }
      let settled = false;
      let forced = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        forced = true;
        child.kill('SIGKILL');
      }, stopTimeoutMs);
      timeout.unref?.();
      const settle = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) rejectStop(error);
        else resolveStop();
      };
      child.once('close', () => {
        settle(
          forced || childErrorObserved
            ? new Error('runner_application_smoke_cleanup_failed')
            : null,
        );
      });
      child.once('error', () => {
        childErrorObserved = true;
      });
      child.kill('SIGTERM');
    });
  }
}

export async function issueSys01DeterministicApplicationSmokeEvidenceV1({
  kind,
  activeTarget = 'candidate',
  bundle,
  executionManifest,
  probe,
}) {
  if (!['pre_cutover_application_smoke', 'post_cutover_application_smoke'].includes(kind) || typeof probe !== 'function') {
    fail('runner_application_smoke_evidence_issuer_invalid', 2);
  }
  const context = buildIssuerContext({ kind, activeTarget, bundle, executionManifest });
  let observation;
  try {
    observation = await probe();
  } catch {
    fail('runner_application_smoke_evidence_probe_failed');
  }
  const evidence = Object.freeze({
    ...context,
    route: observation?.route ?? null,
    host: observation?.host ?? null,
    port: observation?.port ?? null,
    httpStatus: observation?.status ?? null,
    versionCommit: observation?.versionCommit ?? null,
    versionSource: observation?.versionSource ?? null,
    databaseTarget: observation?.databaseTarget ?? null,
    processDatabaseIdentityBound: observation?.processDatabaseIdentityBound === true,
    originalMutationCount: 0,
  });
  const verified =
    evidence.route === SYS01_APPLICATION_SMOKE_PATH &&
    evidence.host === SYS01_APPLICATION_SMOKE_HOST &&
    evidence.port === SYS01_APPLICATION_SMOKE_PORT &&
    evidence.httpStatus === 200 &&
    evidence.versionCommit === executionManifest.implementationHead &&
    evidence.versionSource === 'build' &&
    evidence.databaseTarget === 'candidate' &&
    evidence.processDatabaseIdentityBound;
  const evidenceSha256 = safeResultFingerprint(evidence);
  return Object.freeze({
    kind,
    verified,
    evidenceSha256,
    receiptSha256: verified
      ? buildBoundCutoverEvidenceReceipt({
        kind,
        evidenceSha256,
        activeTarget,
        bundle,
        executionManifest,
      })
      : null,
  });
}

async function inspectCutoverReadiness(env, bundle, executionManifest) {
  const identities = await inspectExactIdentities(env);
  const sourceQuiescenceVerified =
    env.ZMTG_SYS01_SOURCE_QUIESCED_CONFIRMATION?.trim() === 'S26_SYS01_SOURCE_QUIESCED';
  const activeUrl = env.ZMTG_SYS01_ACTIVE_DATABASE_URL?.trim();
  let activeStillOriginal = false;
  try {
    if (activeUrl) {
      parseLocalDatabaseUrl(activeUrl, SYS01_IDENTITIES.original);
      activeStillOriginal = true;
    }
  } catch {
    activeStillOriginal = false;
  }
  let readinessIssue = null;
  let applicationSmokeIssue = null;
  if (
    sourceQuiescenceVerified &&
    activeStillOriginal &&
    identities.original.exists === true &&
    identities.candidate.exists === true &&
    identities.original.conflict !== true &&
    identities.candidate.conflict !== true
  ) {
    readinessIssue = await issueSys01DeterministicReadinessEvidenceV1({
      kind: 'pre_cutover_readiness',
      bundle,
      executionManifest,
      probe: async () => ({
        identity: identities.candidate,
        validation: await inspectCandidateValidation(env, bundle, executionManifest),
      }),
    });
    if (readinessIssue.verified) {
      applicationSmokeIssue = await issueSys01DeterministicApplicationSmokeEvidenceV1({
        kind: 'pre_cutover_application_smoke',
        bundle,
        executionManifest,
        probe: async () => probeSys01CandidateBoundApplicationV1({
          env,
          implementationHead: executionManifest.implementationHead,
        }),
      });
    }
  }
  const readinessEvidenceVerified =
    readinessIssue?.verified === true && applicationSmokeIssue?.verified === true;
  const validation = readinessIssue?.validation ?? null;
  const ready =
    identities.original.exists === true &&
    identities.candidate.exists === true &&
    identities.original.conflict !== true &&
    identities.candidate.conflict !== true &&
    activeStillOriginal &&
    sourceQuiescenceVerified &&
    readinessEvidenceVerified &&
    validation?.status === 'succeeded' &&
    validation?.postconditionVerified === true;
  const evidence = {
    automaticCutoverPerformed: false,
    rollbackPrecheckVerified: ready,
    activeTargetBeforeCutover: activeStillOriginal ? 'original' : 'unknown',
    sourceQuiescenceVerified,
    mappedRowsVerified: validation?.mappedRowsVerified === true,
    readinessEvidenceSha256: readinessIssue?.evidenceSha256 ?? null,
    applicationSmokeEvidenceSha256: applicationSmokeIssue?.evidenceSha256 ?? null,
    readinessReceiptSha256: readinessIssue?.receiptSha256 ?? null,
    applicationSmokeReceiptSha256: applicationSmokeIssue?.receiptSha256 ?? null,
    readinessEvidenceVerified,
    selectedMechanism: 'explicit_local_env_endpoint_and_database_switch',
    originalMutationCount: 0,
  };
  return {
    status: ready ? 'succeeded' : 'not_started',
    preconditionFailed: !ready,
    postconditionVerified: ready,
    ...evidence,
    completedAt: new Date().toISOString(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

async function verifyPostCutover(env, bundle, executionManifest) {
  const receipt = requiredExecutionEnv(env, 'ZMTG_SYS01_EXTERNAL_CUTOVER_RECEIPT_SHA256');
  const expectedReceipt = safeResultFingerprint({
    task: SYS01_REBUILD_TASK,
    previousEndpoint: `${SYS01_IDENTITIES.original.host}:${SYS01_IDENTITIES.original.port}/${SYS01_IDENTITIES.original.database}`,
    activeEndpoint: `${SYS01_IDENTITIES.candidate.host}:${SYS01_IDENTITIES.candidate.port}/${SYS01_IDENTITIES.candidate.database}`,
    cutoverReadinessReceiptSha256: executionManifest.phaseReceipts.at(-1)?.digest ?? null,
  });
  if (receipt !== expectedReceipt) fail('runner_external_cutover_receipt_invalid', 2);
  parseLocalDatabaseUrl(
    requiredExecutionEnv(env, 'ZMTG_SYS01_ACTIVE_DATABASE_URL'),
    SYS01_IDENTITIES.candidate,
  );
  const identities = await inspectExactIdentities(env);
  const readinessIssue = await issueSys01DeterministicReadinessEvidenceV1({
    kind: 'post_cutover_readiness',
    bundle,
    executionManifest,
    probe: async () => ({
      identity: identities.candidate,
      validation: await inspectCandidateValidation(env, bundle, executionManifest),
    }),
  });
  if (!readinessIssue.verified) {
    return {
      status: 'not_started',
      preconditionFailed: true,
      postconditionVerified: false,
      completedAt: new Date().toISOString(),
      postconditionFingerprint: sha256Bytes(Buffer.from('post_cutover_validation_failed', 'utf8')),
    };
  }
  const applicationSmokeIssue = await issueSys01DeterministicApplicationSmokeEvidenceV1({
    kind: 'post_cutover_application_smoke',
    bundle,
    executionManifest,
    probe: async () => probeSys01CandidateBoundApplicationV1({
      env,
      implementationHead: executionManifest.implementationHead,
    }),
  });
  const postCutoverEvidenceVerified = applicationSmokeIssue.verified;
  if (!postCutoverEvidenceVerified) fail('runner_post_cutover_evidence_invalid', 2);
  const validation = readinessIssue.validation;
  const evidence = {
    externalCutoverReceiptSha256: receipt,
    postCutoverReadinessEvidenceSha256: readinessIssue.evidenceSha256,
    postCutoverApplicationSmokeEvidenceSha256: applicationSmokeIssue.evidenceSha256,
    postCutoverReadinessReceiptSha256: readinessIssue.receiptSha256,
    postCutoverApplicationSmokeReceiptSha256: applicationSmokeIssue.receiptSha256,
    postCutoverEvidenceVerified,
    activeTarget: 'candidate',
    originalRetained: identities.original.exists === true && identities.original.conflict !== true,
    candidateSchemaFingerprintSha256: validation.actualSchemaFingerprintSha256,
    originalMutationCount: 0,
  };
  const valid = evidence.originalRetained;
  return {
    status: valid ? 'succeeded' : 'not_started',
    preconditionFailed: !valid,
    postconditionVerified: valid,
    ...evidence,
    completedAt: new Date().toISOString(),
    postconditionFingerprint: safeResultFingerprint(evidence),
  };
}

export async function runSys01PrerequisiteAdapterV1({
  adapter,
  env = process.env,
  repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  bundle = null,
  executionManifest = null,
  runtime = {},
} = {}) {
  if (!SYS01_PREREQUISITE_ADAPTERS.includes(adapter)) {
    fail('runner_prerequisite_adapter_invalid', 2);
  }
  if (adapter === 'backup') {
    return createEncryptedBackup(env, repositoryRoot, runtime);
  }
  if (adapter === 'restore') {
    return restoreEncryptedBackup(env, repositoryRoot, executionManifest, runtime);
  }
  if (adapter === 'candidate-create') {
    return createCandidateDatabase(env, runtime);
  }
  if (!bundle && adapter !== 'transfer') fail('runner_prerequisite_bundle_required', 2);
  if (adapter === 'baseline-bootstrap') {
    return bootstrapCandidateBaseline(env, bundle, runtime);
  }
  if (adapter === 'transfer') {
    if (!executionManifest) fail('runner_prerequisite_manifest_required', 2);
    return transferCandidateData(env, executionManifest, runtime);
  }
  if (!executionManifest) fail('runner_prerequisite_manifest_required', 2);
  return inspectCandidateValidation(env, bundle, executionManifest, runtime);
}

function defaultDependencies(env, rootDir) {
  return {
    gitState: defaultGitState,
    acquireExecutionLock,
    releaseExecutionLock,
    readExecutionManifest: readSecureExecutionManifestOptional,
    writeExecutionManifest: writeSecureExecutionManifest,
    inspectIdentities: async () => inspectExactIdentities(env),
    readSourceInventory: async () => {
      await preflightSys01BackupKeySourceV1({ env, repositoryRoot: rootDir });
      const inventory = await readDatabaseInventory(
        requiredExecutionEnv(env, 'ZMTG_SYS01_ORIGINAL_DATABASE_URL'),
      );
      const evidence = {
        sourceCatalogFingerprint: inventory.sourceCatalogFingerprint,
        rowCountFingerprint: validateSourceInventory(inventory.sourceInventory).rowCountFingerprint,
        originalMutationCount: 0,
      };
      return {
        status: 'succeeded',
        postconditionVerified: true,
        ...inventory,
        originalMutationCount: 0,
        capturedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        postconditionFingerprint: safeResultFingerprint(evidence),
      };
    },
    createEncryptedBackup: async () => runSys01PrerequisiteAdapterV1({
      adapter: 'backup',
      env,
      repositoryRoot: rootDir,
    }),
    restoreDrill: async ({ executionManifest }) =>
      runSys01PrerequisiteAdapterV1({
        adapter: 'restore',
        env,
        repositoryRoot: rootDir,
        executionManifest,
      }),
    createCandidate: async () => runSys01PrerequisiteAdapterV1({
      adapter: 'candidate-create',
      env,
      repositoryRoot: rootDir,
    }),
    bootstrapCandidate: async ({ bundle }) => runSys01PrerequisiteAdapterV1({
      adapter: 'baseline-bootstrap',
      env,
      repositoryRoot: rootDir,
      bundle,
    }),
    transferCandidate: async ({ executionManifest }) => runSys01PrerequisiteAdapterV1({
      adapter: 'transfer',
      env,
      repositoryRoot: rootDir,
      executionManifest,
    }),
    validateCandidate: async ({ bundle, executionManifest }) =>
      runSys01PrerequisiteAdapterV1({
        adapter: 'validate',
        env,
        repositoryRoot: rootDir,
        bundle,
        executionManifest,
      }),
    inspectCutoverReadiness: async ({ bundle, executionManifest }) =>
      inspectCutoverReadiness(env, bundle, executionManifest),
    verifyPostCutover: async ({ bundle, executionManifest }) =>
      verifyPostCutover(env, bundle, executionManifest),
    inspectRollbackReadiness: async ({ bundle, executionManifest }) =>
      inspectRollbackReadiness(env, bundle, executionManifest),
  };
}

export async function runSys01ControlledLocalDevRebuild({
  argv = process.argv.slice(2),
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  env = process.env,
  dependencies = {},
  output = { stdout: (line) => console.log(line), stderr: (line) => console.error(line) },
} = {}) {
  const args = parseRunnerArguments(argv);
  const bundle = loadBaselineBundle(rootDir);
  if (args.mode === 'plan') {
    const plan = { ...buildPlan(), artifactSha256: bundle.validation.artifactSha256, schemaFingerprintSha256: bundle.validation.schemaFingerprintSha256, markerCreatedAt: bundle.validation.marker.createdAt };
    output.stdout(canonicalJson(plan));
    return Object.freeze({ exitCode: 0, plan });
  }
  const deps = { ...defaultDependencies(env, rootDir), ...dependencies };
  const gitState = await deps.gitState(rootDir);
  assertRepositoryIdentity(gitState, args.expectedHead);
  const executionLock = await deps.acquireExecutionLock(
    args.executionManifest,
    rootDir,
    args.phase,
    args.expectedHead,
  );
  let executorInvoked = false;
  let manifestPersisted = false;
  try {
    const manifestValue = await deps.readExecutionManifest(args.executionManifest, rootDir);
    if (args.phase !== 'preflight' && manifestValue === null) {
      fail('runner_execution_manifest_invalid', 2);
    }
    let executionManifest = manifestValue === null
      ? null
      : validateExecutionManifest(manifestValue, bundle, args.expectedHead);
    const identities = await deps.inspectIdentities({ phase: args.phase, expected: SYS01_IDENTITIES });
    for (const role of ['original', 'candidate', 'restoreDrill']) assertDatabaseIdentity(role, identities[role]);
    assertPhaseIdentityState(args.phase, identities);
    const transition = assertPhaseTransition(
      executionManifest?.state ?? { current: 'INITIAL', outcomeUnknown: false },
      args.phase,
    );
    const method = phaseDependency[args.phase];
    executorInvoked = true;
    const result = await deps[method]({
      phase: args.phase,
      bundle,
      executionManifest,
      identities: SYS01_IDENTITIES,
      originalMutationAllowed: false,
      capability:
        args.phase === 'backup'
          ? buildBackupCapability()
          : args.phase === 'baseline-bootstrap'
            ? buildBaselineBootstrapCapability(bundle)
            : args.phase === 'transfer'
              ? buildTransferCapability()
              : args.phase === 'rollback-readiness'
                ? buildRollbackCapability()
                : null,
    });
    validatePhaseResult(args.phase, result, executionManifest, bundle);
    if (args.phase === 'preflight') {
      const freshInventory = validateSourceInventory(result.sourceInventory);
      if (!SHA256_PATTERN.test(result.sourceCatalogFingerprint ?? '')) {
        fail('source_inventory_invalid');
      }
      if (executionManifest === null) {
        executionManifest = buildExecutionManifest({
          implementationHead: args.expectedHead,
          baselineManifestSha256: bundle.validation.manifestSha256,
          sourceCatalogFingerprint: result.sourceCatalogFingerprint,
          sourceInventory: result.sourceInventory,
          capturedAt: result.capturedAt,
        });
      } else if (
        result.sourceCatalogFingerprint !== executionManifest.sourceCatalogFingerprint ||
        freshInventory.rowCountFingerprint !== executionManifest.lowSensitiveAggregateFingerprint ||
        canonicalJson(result.sourceInventory.tables.slice().sort()) !== canonicalJson(executionManifest.sourceTableSet) ||
        canonicalJson(result.sourceInventory.rowCounts) !== canonicalJson(executionManifest.perTableRowCounts)
      ) {
        fail('source_inventory_re_admission_required');
      }
    }
    if (executionManifest === null) fail('runner_execution_manifest_invalid', 2);
    const outcome = classifyPhaseOutcome(args.phase, result);
    const updatedManifest = appendPhaseReceipt(
      executionManifest,
      args.phase,
      transition,
      outcome,
      result,
    );
    await deps.writeExecutionManifest(
      args.executionManifest,
      rootDir,
      updatedManifest,
      { create: manifestValue === null },
    );
    manifestPersisted = true;
    output.stdout(canonicalJson({ task: SYS01_REBUILD_TASK, phase: args.phase, outcome }));
    if (outcome.status !== 'succeeded') fail(outcome.status, 4);
    return Object.freeze({ exitCode: 0, phase: args.phase, transition, outcome });
  } catch (error) {
    if (!executorInvoked) await deps.releaseExecutionLock(executionLock);
    throw error;
  } finally {
    if (manifestPersisted) await deps.releaseExecutionLock(executionLock);
  }
}

const currentFile = realpathSync(fileURLToPath(import.meta.url));
let isDirectRun = false;
if (process.argv[1]) {
  try {
    isDirectRun = currentFile === realpathSync(path.resolve(process.argv[1]));
  } catch {
    isDirectRun = false;
  }
}
if (isDirectRun) {
  runSys01ControlledLocalDevRebuild().catch((error) => {
    console.error(error instanceof Sys01RebuildError ? error.code : 'sys01_rebuild_failed');
    process.exitCode = error instanceof Sys01RebuildError ? error.exitCode : 3;
  });
}
