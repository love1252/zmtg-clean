import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import {
  catalogFingerprintFromRecords,
  expectedSchemaFingerprint,
  isExpectedSchemaSource,
} from './sys01-controlled-local-dev-rebuild.mjs';

const productionConfirmation = 'MIGRATE_PRODUCTION';
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const baselineVersion = 'zmtg.sys01.local-dev-current-schema-baseline/v1';
const baselineSourceCommit = '5d40cfb0e0862e2b11208918c21808571e67c6db';
const baselineCanonicalizationVersion = 'zmtg.catalog.logical-objects/v2';
const baselineCreatedByContractVersion = 'zmtg.sys01.controlled-local-dev-rebuild/v1';
const baselineManifestRelativePath =
  'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.json';
const baselineArtifactRelativePath =
  'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql';
const baselineCandidateDatabase = 'zmtg_clean_local_dev_candidate';
const baselineCandidatePort = 55434;
const baselineCandidateHost = '127.0.0.1';
const baselineParentJournalTag = '0045_base02_binding_legacy_calibration';
const baselineParentJournalWhen = 1785738060856;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const sha1Pattern = /^[0-9a-f]{40}$/u;
const baselineManifestKeys = [
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
];
const execFile = promisify(execFileCallback);
const exactJournalShape = {
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
};

export class MigrationGuardError extends Error {}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new MigrationGuardError(`migration guard 拒绝：缺少 ${name}`);
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpected.length &&
    actualKeys.every((key, index) => key === sortedExpected[index])
  );
}

function gitBlobOid(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function parseDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('invalid protocol');
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!host || !database) throw new Error('missing target');
    const port = Number(url.port || '5432');
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid port');
    return { host, port, database };
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
  const migrationEntries = [];
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
    let sqlSource;
    try {
      sqlSource = readFileSync(resolve(rootDir, `drizzle/${entry.tag}.sql`));
    } catch {
      throw new MigrationGuardError('migration guard 拒绝：发现未知或缺失的 migration 文件');
    }
    migrationEntries.push({
      tag: entry.tag,
      when: entry.when,
      hash: createHash('sha256').update(sqlSource).digest('hex'),
    });
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

  return {
    latestMigration: journalTags.at(-1),
    migrationTags: journalTags,
    migrationEntries,
  };
}

function readBaselineContract(rootDir, migrationState) {
  let manifestSource;
  let manifest;
  let artifactSource;
  try {
    manifestSource = readFileSync(resolve(rootDir, baselineManifestRelativePath), 'utf8');
    manifest = JSON.parse(manifestSource);
    artifactSource = readFileSync(resolve(rootDir, baselineArtifactRelativePath));
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：baseline manifest 无效');
  }
  const parentIndex = migrationState.migrationEntries.findIndex(
    (entry) => entry.tag === manifest?.parentJournalTag,
  );
  if (
    !hasExactKeys(manifest, baselineManifestKeys) ||
    `${JSON.stringify(manifest, null, 2)}\n` !== manifestSource ||
    manifest?.version !== baselineVersion ||
    manifest?.sourceBaselineCommit !== baselineSourceCommit ||
    manifest?.canonicalizationVersion !== baselineCanonicalizationVersion ||
    manifest?.createdByContractVersion !== baselineCreatedByContractVersion ||
    manifest?.artifactPath !== baselineArtifactRelativePath ||
    manifest?.parentJournalTag !== baselineParentJournalTag ||
    manifest?.parentJournalWhen !== baselineParentJournalWhen ||
    parentIndex === -1 ||
    manifest?.parentJournalWhen !== migrationState.migrationEntries[parentIndex]?.when ||
    !sha256Pattern.test(manifest?.artifactSha256 ?? '') ||
    !sha256Pattern.test(manifest?.schemaFingerprintSha256 ?? '') ||
    !isExpectedSchemaSource(manifest?.schemaSource) ||
    !hasExactKeys(manifest?.toolingBlobs, [
      'scripts/db/guarded-migrate.mjs',
      'scripts/db/sys01-controlled-local-dev-rebuild.mjs',
    ]) ||
    Object.values(manifest.toolingBlobs).some((value) => !sha1Pattern.test(value)) ||
    Object.entries(manifest.toolingBlobs).some(
      ([relativePath, expectedBlob]) =>
        gitBlobOid(readFileSync(resolve(rootDir, relativePath))) !== expectedBlob,
    ) ||
    createHash('sha256').update(artifactSource).digest('hex') !== manifest.artifactSha256 ||
    expectedSchemaFingerprint(artifactSource.toString('utf8')) !== manifest.schemaFingerprintSha256 ||
    Object.hasOwn(manifest, 'manifestSha256')
  ) {
    throw new MigrationGuardError('migration guard 拒绝：baseline manifest 无效');
  }
  const markerHash = createHash('sha256').update(manifestSource, 'utf8').digest('hex');
  if (markerHash === migrationState.migrationEntries[parentIndex]?.hash) {
    throw new MigrationGuardError('migration guard 拒绝：baseline marker 与 parent migration hash 冲突');
  }
  return {
    manifest,
    markerHash,
    parentIndex,
  };
}

async function assertBaselineToolingAtCleanHead(rootDir, migrationState) {
  const baseline = readBaselineContract(rootDir, migrationState);
  try {
    const status = await execFile('git', ['status', '--porcelain'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    if (status.stdout.trim() !== '') throw new Error('dirty');
    await execFile('git', ['merge-base', '--is-ancestor', baselineSourceCommit, 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    for (const [relativePath, expectedBlob] of Object.entries(baseline.manifest.toolingBlobs)) {
      const headSource = await execFile('git', ['show', `HEAD:${relativePath}`], {
        cwd: rootDir,
        encoding: null,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (gitBlobOid(headSource.stdout) !== expectedBlob) throw new Error('blob drift');
    }
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：baseline tooling 不是 clean HEAD reviewed blobs');
  }
}

function normalizeActualRows(rows) {
  if (!Array.isArray(rows)) {
    throw new MigrationGuardError('migration guard 拒绝：无法验证数据库 migration origin');
  }
  return rows.map((row) => {
    const id = Number(row?.id);
    const createdAt = row?.created_at === null || row?.created_at === undefined
      ? null
      : Number(row.created_at);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof row?.hash !== 'string' ||
      !sha256Pattern.test(row.hash) ||
      !Number.isSafeInteger(createdAt)
    ) {
      throw new MigrationGuardError('migration guard 拒绝：数据库 migration journal 无效');
    }
    return { id, hash: row.hash, createdAt };
  });
}

function assertStrictlyOrderedRows(rows) {
  let previousId = Number.NEGATIVE_INFINITY;
  let previousWhen = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.id <= previousId || row.createdAt <= previousWhen) {
      throw new MigrationGuardError('migration guard 拒绝：数据库 migration journal 非严格有序');
    }
    previousId = row.id;
    previousWhen = row.createdAt;
  }
}

function assertLegacyOrigin(rows, migrationState) {
  if (rows.length > migrationState.migrationEntries.length) {
    throw new MigrationGuardError('migration guard 拒绝：数据库存在未知 migration row');
  }
  for (const [index, row] of rows.entries()) {
    const expected = migrationState.migrationEntries[index];
    if (row.id !== index + 1 || row.hash !== expected.hash || row.createdAt !== expected.when) {
      throw new MigrationGuardError('migration guard 拒绝：legacy migration strict prefix 漂移');
    }
  }
  return {
    origin: 'LEGACY_ORIGIN',
    currentMigration: rows.length === 0 ? null : migrationState.migrationEntries[rows.length - 1].tag,
    pendingMigrations: migrationState.migrationEntries.slice(rows.length).map((entry) => entry.tag),
  };
}

function assertBaselineOrigin(rows, migrationState, baseline, actualState) {
  if (rows.length === 0) {
    throw new MigrationGuardError('migration guard 拒绝：baseline marker 缺失');
  }
  const marker = rows[0];
  if (
    marker.id !== 1 ||
    marker.hash !== baseline.markerHash ||
    marker.createdAt !== baseline.manifest.parentJournalWhen
  ) {
    throw new MigrationGuardError('migration guard 拒绝：baseline marker 漂移或 mixed lineage');
  }
  const tailRows = rows.slice(1);
  const expectedTail = migrationState.migrationEntries.slice(baseline.parentIndex + 1);
  if (tailRows.length > expectedTail.length) {
    throw new MigrationGuardError('migration guard 拒绝：baseline origin 存在未知 common-tail row');
  }
  for (const [index, row] of tailRows.entries()) {
    const expected = expectedTail[index];
    if (row.id !== index + 2 || row.hash !== expected.hash || row.createdAt !== expected.when) {
      throw new MigrationGuardError('migration guard 拒绝：baseline common-tail 漂移或 mixed lineage');
    }
  }
  if (
    tailRows.length === 0 &&
    actualState.schemaFingerprintSha256 !== baseline.manifest.schemaFingerprintSha256
  ) {
    throw new MigrationGuardError('migration guard 拒绝：baseline schema fingerprint 不匹配');
  }
  return {
    origin: 'BASELINE_MARKER_ORIGIN',
    currentMigration: tailRows.length === 0 ? baseline.manifest.parentJournalTag : expectedTail[tailRows.length - 1].tag,
    pendingMigrations: expectedTail.slice(tailRows.length).map((entry) => entry.tag),
  };
}

function assertOriginAwarePreflight({ env, staticState, actualState, rootDir }) {
  if (
    actualState?.journalTableExists === true &&
    JSON.stringify(actualState.journalShape) !== JSON.stringify(exactJournalShape)
  ) {
    throw new MigrationGuardError('migration guard 拒绝：数据库 migration journal shape 漂移');
  }
  const rows = normalizeActualRows(actualState?.journalRows);
  if (rows.length > 0 && actualState?.journalTableExists !== true) {
    throw new MigrationGuardError('migration guard 拒绝：数据库 migration journal shape 无法证明');
  }
  assertStrictlyOrderedRows(rows);
  const baseline = readBaselineContract(rootDir, staticState);
  const baselineLike = rows.some(
    (row) =>
      row.hash === baseline.markerHash ||
      (row.createdAt === baseline.manifest.parentJournalWhen &&
        row.hash !== staticState.migrationEntries[baseline.parentIndex]?.hash),
  );
  if (staticState.target === 'production') {
    if (baselineLike) {
      throw new MigrationGuardError('migration guard 拒绝：production 不允许 baseline marker origin');
    }
    const origin = assertLegacyOrigin(rows, staticState);
    const expectedCurrent = required(env, 'ZMTG_DB_MIGRATION_EXPECTED_CURRENT');
    if (origin.currentMigration !== expectedCurrent) {
      throw new MigrationGuardError('migration guard 拒绝：production actual current 与 expected current 不匹配');
    }
    return origin;
  }
  const requestedOrigin = env.ZMTG_DB_MIGRATION_ORIGIN?.trim() || 'legacy';
  if (requestedOrigin === 'legacy') {
    if (baselineLike) {
      throw new MigrationGuardError('migration guard 拒绝：local legacy 模式不允许 baseline marker');
    }
    return assertLegacyOrigin(rows, staticState);
  }
  if (requestedOrigin !== 'baseline') {
    throw new MigrationGuardError('migration guard 拒绝：migration origin 必须为 legacy 或 baseline');
  }
  if (
    staticState.host !== baselineCandidateHost ||
    staticState.database !== baselineCandidateDatabase ||
    staticState.port !== baselineCandidatePort
  ) {
    throw new MigrationGuardError('migration guard 拒绝：baseline origin 仅允许 exact SYS-01 candidate database');
  }
  return assertBaselineOrigin(rows, staticState, baseline, actualState);
}

export const SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL = String.raw`
  WITH catalog_records AS (
    SELECT 'schemas'::text AS object_class, 'public'::text AS schema_name,
           'public'::text AS object_name, to_jsonb('public'::text) AS signature
    UNION ALL
    SELECT 'tables', 'public', relation_row.relname, to_jsonb('table'::text)
    FROM pg_catalog.pg_class relation_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    WHERE namespace_row.nspname = 'public' AND relation_row.relkind IN ('r', 'p')
    UNION ALL
    SELECT 'columns', 'public', relation_row.relname || '.' || attribute_row.attname,
           jsonb_build_object(
             'type', pg_catalog.format_type(attribute_row.atttypid, attribute_row.atttypmod),
             'identity', attribute_row.attidentity,
             'generated', attribute_row.attgenerated,
             'generatedExpression', CASE
               WHEN attribute_row.attgenerated = '' THEN NULL
               ELSE pg_catalog.pg_get_expr(column_default.adbin, column_default.adrelid, true)
             END
           )
    FROM pg_catalog.pg_attribute attribute_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = attribute_row.attrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef column_default
      ON column_default.adrelid = attribute_row.attrelid
     AND column_default.adnum = attribute_row.attnum
    WHERE namespace_row.nspname = 'public' AND relation_row.relkind IN ('r', 'p')
      AND attribute_row.attnum > 0 AND NOT attribute_row.attisdropped
    UNION ALL
    SELECT 'nullability', 'public', relation_row.relname || '.' || attribute_row.attname,
           to_jsonb(CASE WHEN attribute_row.attnotnull THEN 'not_null' ELSE 'nullable' END)
    FROM pg_catalog.pg_attribute attribute_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = attribute_row.attrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    WHERE namespace_row.nspname = 'public' AND relation_row.relkind IN ('r', 'p')
      AND attribute_row.attnum > 0 AND NOT attribute_row.attisdropped
    UNION ALL
    SELECT 'defaults', 'public', relation_row.relname || '.' || attribute_row.attname,
           jsonb_build_object(
             'expression', pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid, true),
             'resultType', pg_catalog.format_type(attribute_row.atttypid, attribute_row.atttypmod)
           )
    FROM pg_catalog.pg_attribute attribute_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = attribute_row.attrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    JOIN pg_catalog.pg_attrdef default_row
      ON default_row.adrelid = attribute_row.attrelid AND default_row.adnum = attribute_row.attnum
    WHERE namespace_row.nspname = 'public' AND relation_row.relkind IN ('r', 'p')
      AND attribute_row.attnum > 0 AND NOT attribute_row.attisdropped
    UNION ALL
    SELECT 'types', 'public', type_row.typname, to_jsonb('enum'::text)
    FROM pg_catalog.pg_type type_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public' AND type_row.typtype = 'e'
    UNION ALL
    SELECT 'enums', 'public', type_row.typname,
           jsonb_agg(enum_row.enumlabel ORDER BY enum_row.enumsortorder)
    FROM pg_catalog.pg_type type_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
    JOIN pg_catalog.pg_enum enum_row ON enum_row.enumtypid = type_row.oid
    WHERE namespace_row.nspname = 'public'
    GROUP BY type_row.typname
    UNION ALL
    SELECT CASE constraint_row.contype
             WHEN 'p' THEN 'primary_keys'
             WHEN 'f' THEN 'foreign_keys'
             WHEN 'u' THEN 'uniques'
             WHEN 'c' THEN 'checks'
           END,
           'public', relation_row.relname || '.' || constraint_row.conname,
           jsonb_build_object(
             'validated', constraint_row.convalidated,
             'deferrable', constraint_row.condeferrable,
             'deferred', constraint_row.condeferred
           ) ||
           CASE constraint_row.contype
             WHEN 'p' THEN jsonb_build_object(
               'keys', (
                 SELECT jsonb_agg(attribute_key.attname ORDER BY key_row.ordinal)
                 FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
                 JOIN pg_catalog.pg_attribute attribute_key
                   ON attribute_key.attrelid = constraint_row.conrelid
                  AND attribute_key.attnum = key_row.attnum
               )
             )
             WHEN 'u' THEN jsonb_build_object(
               'keys', (
                 SELECT jsonb_agg(attribute_key.attname ORDER BY key_row.ordinal)
                 FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
                 JOIN pg_catalog.pg_attribute attribute_key
                   ON attribute_key.attrelid = constraint_row.conrelid
                  AND attribute_key.attnum = key_row.attnum
               ),
               'nullsNotDistinct', constraint_index.indnullsnotdistinct
             )
             WHEN 'c' THEN jsonb_build_object(
               'expression', pg_catalog.pg_get_expr(
                 constraint_row.conbin,
                 constraint_row.conrelid,
                 true
               )
             )
             WHEN 'f' THEN jsonb_build_object(
               'keys', (
                 SELECT jsonb_agg(attribute_key.attname ORDER BY key_row.ordinal)
                 FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinal)
                 JOIN pg_catalog.pg_attribute attribute_key
                   ON attribute_key.attrelid = constraint_row.conrelid
                  AND attribute_key.attnum = key_row.attnum
               ),
               'referencedSchema', referenced_namespace.nspname,
               'referencedTable', referenced_relation.relname,
               'referencedKeys', (
                 SELECT jsonb_agg(attribute_key.attname ORDER BY key_row.ordinal)
                 FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_row(attnum, ordinal)
                 JOIN pg_catalog.pg_attribute attribute_key
                   ON attribute_key.attrelid = constraint_row.confrelid
                  AND attribute_key.attnum = key_row.attnum
               ),
               'match', CASE constraint_row.confmatchtype WHEN 'f' THEN 'full' WHEN 'p' THEN 'partial' ELSE 'simple' END,
               'onUpdate', CASE constraint_row.confupdtype WHEN 'r' THEN 'restrict' WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null' WHEN 'd' THEN 'set_default' ELSE 'no_action' END,
               'onDelete', CASE constraint_row.confdeltype WHEN 'r' THEN 'restrict' WHEN 'c' THEN 'cascade' WHEN 'n' THEN 'set_null' WHEN 'd' THEN 'set_default' ELSE 'no_action' END
             )
           END
    FROM pg_catalog.pg_constraint constraint_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    LEFT JOIN pg_catalog.pg_class referenced_relation
      ON referenced_relation.oid = constraint_row.confrelid
    LEFT JOIN pg_catalog.pg_namespace referenced_namespace
      ON referenced_namespace.oid = referenced_relation.relnamespace
    LEFT JOIN pg_catalog.pg_index constraint_index
      ON constraint_index.indexrelid = constraint_row.conindid
    WHERE namespace_row.nspname = 'public' AND constraint_row.contype IN ('p', 'f', 'u', 'c')
    UNION ALL
    SELECT 'indexes', 'public', index_relation.relname,
           jsonb_build_object(
             'table', relation_row.relname,
             'unique', index_row.indisunique,
             'nullsNotDistinct', index_row.indnullsnotdistinct,
             'method', access_method.amname,
             'keys', (
               SELECT jsonb_agg(
                 pg_catalog.pg_get_indexdef(index_row.indexrelid, ordinal, true)
                 ORDER BY ordinal
               )
               FROM generate_series(1, index_row.indnkeyatts) AS ordinal
             ),
             'include', COALESCE((
               SELECT jsonb_agg(
                 pg_catalog.pg_get_indexdef(index_row.indexrelid, ordinal, true)
                 ORDER BY ordinal
               )
               FROM generate_series(index_row.indnkeyatts + 1, index_row.indnatts) AS ordinal
             ), '[]'::jsonb),
             'predicate', pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid, true)
           )
    FROM pg_catalog.pg_index index_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = index_row.indrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    JOIN pg_catalog.pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_catalog.pg_am access_method ON access_method.oid = index_relation.relam
    LEFT JOIN pg_catalog.pg_constraint constraint_row ON constraint_row.conindid = index_row.indexrelid
    WHERE namespace_row.nspname = 'public' AND constraint_row.oid IS NULL
    UNION ALL
    SELECT 'sequences', 'public', relation_row.relname,
           jsonb_build_object(
             'dataType', pg_catalog.format_type(sequence_row.seqtypid, NULL),
             'start', sequence_row.seqstart,
             'increment', sequence_row.seqincrement,
             'minimum', sequence_row.seqmin,
             'maximum', sequence_row.seqmax,
             'cache', sequence_row.seqcache,
             'cycle', sequence_row.seqcycle,
             'ownedBy', (
               SELECT owner_namespace.nspname || '.' || owner_relation.relname || '.' || owner_attribute.attname
               FROM pg_catalog.pg_depend dependency_row
               JOIN pg_catalog.pg_class owner_relation ON owner_relation.oid = dependency_row.refobjid
               JOIN pg_catalog.pg_namespace owner_namespace ON owner_namespace.oid = owner_relation.relnamespace
               JOIN pg_catalog.pg_attribute owner_attribute
                 ON owner_attribute.attrelid = dependency_row.refobjid
                AND owner_attribute.attnum = dependency_row.refobjsubid
               WHERE dependency_row.classid = 'pg_catalog.pg_class'::regclass
                 AND dependency_row.objid = relation_row.oid
                 AND dependency_row.objsubid = 0
                 AND dependency_row.deptype IN ('a', 'i')
               ORDER BY owner_namespace.nspname, owner_relation.relname, owner_attribute.attname
               LIMIT 1
             )
           )
    FROM pg_catalog.pg_class relation_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    JOIN pg_catalog.pg_sequence sequence_row ON sequence_row.seqrelid = relation_row.oid
    WHERE namespace_row.nspname = 'public' AND relation_row.relkind = 'S'
    UNION ALL
    SELECT 'functions', 'public', function_row.proname || '(' ||
           pg_catalog.pg_get_function_identity_arguments(function_row.oid) || ')',
           jsonb_build_object(
             'language', language_row.lanname,
             'returns', return_type.typname,
             'volatility', CASE function_row.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' ELSE 'volatile' END,
             'security', CASE WHEN function_row.prosecdef THEN 'definer' ELSE 'invoker' END,
             'parallel', CASE function_row.proparallel WHEN 's' THEN 'safe' WHEN 'r' THEN 'restricted' ELSE 'unsafe' END,
             'strict', function_row.proisstrict,
             'leakproof', function_row.proleakproof,
             'cost', function_row.procost,
             'rows', function_row.prorows,
             'body', function_row.prosrc,
             'config', COALESCE(to_jsonb(function_row.proconfig), '[]'::jsonb),
             'definition', pg_catalog.pg_get_functiondef(function_row.oid)
           )
    FROM pg_catalog.pg_proc function_row
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = function_row.pronamespace
    JOIN pg_catalog.pg_language language_row ON language_row.oid = function_row.prolang
    JOIN pg_catalog.pg_type return_type ON return_type.oid = function_row.prorettype
    WHERE namespace_row.nspname = 'public'
    UNION ALL
    SELECT 'triggers', 'public', trigger_row.tgname,
           jsonb_build_object(
             'table', relation_row.relname,
             'timing', CASE
               WHEN (trigger_row.tgtype & 64) <> 0 THEN 'instead_of'
               WHEN (trigger_row.tgtype & 2) <> 0 THEN 'before'
               ELSE 'after'
             END,
             'events', to_jsonb(array_remove(ARRAY[
               CASE WHEN (trigger_row.tgtype & 8) <> 0 THEN 'delete' END,
               CASE WHEN (trigger_row.tgtype & 4) <> 0 THEN 'insert' END,
               CASE WHEN (trigger_row.tgtype & 32) <> 0 THEN 'truncate' END,
               CASE WHEN (trigger_row.tgtype & 16) <> 0 THEN 'update' END
             ], NULL)),
             'level', CASE WHEN (trigger_row.tgtype & 1) <> 0 THEN 'row' ELSE 'statement' END,
             'function', function_row.proname || '()',
             'enabled', trigger_row.tgenabled,
             'definition', pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
           )
    FROM pg_catalog.pg_trigger trigger_row
    JOIN pg_catalog.pg_class relation_row ON relation_row.oid = trigger_row.tgrelid
    JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
    JOIN pg_catalog.pg_proc function_row ON function_row.oid = trigger_row.tgfoid
    WHERE namespace_row.nspname = 'public' AND NOT trigger_row.tgisinternal
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'objectClass', object_class,
        'schema', schema_name,
        'name', object_name,
        'signature', signature
      )
      ORDER BY object_class, schema_name, object_name, signature::text
    ),
    '[]'::jsonb
  ) AS catalog
  FROM catalog_records;
`;

async function readActualDatabaseState(databaseUrl, { includeCatalog = false } = {}) {
  let sql;
  try {
    const postgres = (await import('postgres')).default;
    sql = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      onnotice: () => undefined,
      connection: { application_name: 'zmtg_guarded_migrate_preflight' },
    });
    return await sql.begin('read only isolation level repeatable read', async (transaction) => {
      const tableState = await transaction`
        SELECT to_regclass('drizzle.__drizzle_migrations')::text AS journal_table,
               relation_row.relkind AS relation_kind
        FROM (SELECT 1) AS singleton
        LEFT JOIN pg_catalog.pg_class relation_row
          ON relation_row.oid = to_regclass('drizzle.__drizzle_migrations')
      `;
      const journalTableExists = Boolean(tableState[0]?.journal_table);
      const journalRows = journalTableExists
        ? await transaction`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`
        : [];
      let journalShape = null;
      if (journalTableExists) {
        const columns = await transaction`
          SELECT column_name AS name,
                 data_type AS type,
                 is_nullable = 'YES' AS nullable,
                 CASE
                   WHEN column_default LIKE 'nextval(%' THEN 'serial_sequence'
                   WHEN column_default IS NULL THEN 'none'
                   ELSE 'other'
                 END AS default_kind
          FROM information_schema.columns
          WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
          ORDER BY ordinal_position
        `;
        const primaryKey = await transaction`
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
        const nonPrimaryConstraints = await transaction`
          SELECT constraint_row.contype AS type, constraint_row.conname AS name
          FROM pg_catalog.pg_constraint constraint_row
          JOIN pg_catalog.pg_class relation_row ON relation_row.oid = constraint_row.conrelid
          JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
          WHERE namespace_row.nspname = 'drizzle'
            AND relation_row.relname = '__drizzle_migrations'
            AND constraint_row.contype <> 'p'
          ORDER BY constraint_row.contype, constraint_row.conname
        `;
        const nonConstraintIndexes = await transaction`
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
        const userTriggers = await transaction`
          SELECT trigger_row.tgname AS name
          FROM pg_catalog.pg_trigger trigger_row
          JOIN pg_catalog.pg_class relation_row ON relation_row.oid = trigger_row.tgrelid
          JOIN pg_catalog.pg_namespace namespace_row ON namespace_row.oid = relation_row.relnamespace
          WHERE namespace_row.nspname = 'drizzle'
            AND relation_row.relname = '__drizzle_migrations'
            AND NOT trigger_row.tgisinternal
          ORDER BY trigger_row.tgname
        `;
        journalShape = {
          relationKind: tableState[0]?.relation_kind ?? null,
          columns: columns.map((row) => ({
            name: row.name,
            type: row.type,
            nullable: row.nullable,
            defaultKind: row.default_kind,
          })),
          primaryKeyColumns: primaryKey[0]?.keys ?? [],
          nonPrimaryConstraints: nonPrimaryConstraints.map((row) => ({
            type: row.type,
            name: row.name,
          })),
          nonConstraintIndexes: nonConstraintIndexes.map((row) => row.name),
          userTriggers: userTriggers.map((row) => row.name),
        };
      }
      let schemaFingerprintSha256 = null;
      if (includeCatalog && journalRows.length > 0) {
        const catalogRows = await transaction.unsafe(SYS01_ACTUAL_CATALOG_FINGERPRINT_SQL);
        schemaFingerprintSha256 = catalogFingerprintFromRecords(catalogRows[0]?.catalog);
      }
      return {
        journalRows: Array.from(journalRows),
        journalTableExists,
        journalShape,
        schemaFingerprintSha256,
      };
    });
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：无法验证数据库 migration origin');
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
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
  readDatabaseStateImpl = readActualDatabaseState,
  assertBaselineToolingImpl = assertBaselineToolingAtCleanHead,
} = {}) {
  const state = assertMigrationAllowed(env, rootDir);
  if (state.target === 'local' && env.ZMTG_DB_MIGRATION_ORIGIN?.trim() === 'baseline') {
    try {
      await assertBaselineToolingImpl(rootDir, state);
    } catch (error) {
      if (error instanceof MigrationGuardError) throw error;
      throw new MigrationGuardError('migration guard 拒绝：baseline tooling 不是 clean HEAD reviewed blobs');
    }
  }
  let actualState;
  try {
    actualState = await readDatabaseStateImpl(env.DATABASE_URL, {
      includeCatalog:
        state.target === 'local' && env.ZMTG_DB_MIGRATION_ORIGIN?.trim() === 'baseline',
    });
  } catch {
    throw new MigrationGuardError('migration guard 拒绝：无法验证数据库 migration origin');
  }
  const origin = assertOriginAwarePreflight({ env, staticState: state, actualState, rootDir });
  logger.info(
    `migration guard 通过：target=${state.target}，migration=${state.latestMigration}，origin=${origin.origin}`,
  );

  const drizzleKitEntry = resolve(rootDir, 'node_modules/drizzle-kit/bin.cjs');
  const exitCode = await new Promise((resolveExit, reject) => {
    let child;
    try {
      child = spawnImpl(process.execPath, [drizzleKitEntry, 'migrate'], {
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
