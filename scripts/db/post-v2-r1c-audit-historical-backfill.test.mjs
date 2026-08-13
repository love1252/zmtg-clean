import {
  chmod,
  link,
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CLASSIFICATION_RULES,
  EXECUTED_MANIFEST_DIGEST,
  EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST,
  EXECUTED_TOOLING_SHA,
  MANIFEST_VERSION,
  S11BackfillError,
  assertEnvironment,
  assertLoopbackDatabaseUrl,
  assertValidatedManifestCodeCompatibility,
  buildLowSensitiveAggregates,
  buildManifest,
  canonicalJson,
  classifySnapshotRows,
  compatibleToolSourceDigest,
  immutableAuditEventDigest,
  parseCli,
  readSecureManifest,
  sha256,
  validateCohortAgainstManifest,
  validateManifest,
  writeSecureManifest,
} from './post-v2-r1c-audit-historical-backfill.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIR, '../..');
const CODE_SHA = 'a'.repeat(40);
const SCHEMA_FINGERPRINT = 'b'.repeat(64);
const tempPaths = [];

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map((value) => rm(value, { recursive: true, force: true })),
  );
});

function baseRow(overrides = {}) {
  return {
    event_id: overrides.event_id ?? 'event-001',
    actor_id: 'actor-001',
    actor_role: 'tenant_admin',
    tenant_id: 'tenant-001',
    institution_id: null,
    institution_attribution: null,
    scope: 'tenant',
    resource: 'customer',
    resource_id: 'customer-001',
    action: 'update',
    result: 'transitioned',
    reason: 'unknown_historical_reason',
    occurred_at: new Date('2026-07-10T00:00:00.000Z'),
    source: 'demo_session',
    mapping_match_count: 0,
    mapping_institution_count: 0,
    mapping_institution_id: null,
    consent_match_count: 0,
    consent_institution_count: 0,
    consent_institution_id: null,
    frequency_match_count: 0,
    frequency_institution_count: 0,
    frequency_institution_id: null,
    dry_run_match_count: 0,
    dry_run_institution_count: 0,
    dry_run_institution_id: null,
    draft_match_count: 0,
    draft_institution_count: 0,
    draft_institution_id: null,
    delivery_match_count: 0,
    delivery_institution_count: 0,
    delivery_institution_id: null,
    ...overrides,
  };
}

function evidenceRow(prefix, ruleId, index) {
  const institutionId = `institution-${index}`;
  const reasonByPrefix = {
    mapping: 'wecom_customer_mapping_confirmed',
    consent: 'wecom_reachout_consent_recorded',
    frequency: 'wecom_reachout_frequency_reserved',
    dry_run: 'wecom_reachout_dry_run_snapshot_ready',
    draft: 'message_draft_created',
    delivery: 'message_delivery_created',
  };
  const resultByPrefix = {
    mapping: 'transitioned',
    consent: 'transitioned',
    frequency: 'transitioned',
    dry_run: 'transitioned',
    draft: 'allowed',
    delivery: 'allowed',
  };
  return {
    row: baseRow({
      event_id: `event-${index}`,
      reason: reasonByPrefix[prefix],
      result: resultByPrefix[prefix],
      [`${prefix}_match_count`]: 1,
      [`${prefix}_institution_count`]: 1,
      [`${prefix}_institution_id`]: institutionId,
    }),
    ruleId,
    institutionId,
  };
}

function loginRow(index = 90) {
  return baseRow({
    event_id: `event-${index}`,
    resource: 'tenant_member',
    resource_id: null,
    action: 'read_own_tenant',
    result: 'allowed',
    reason: 'tenant_login_succeeded',
    source: 'server_session',
  });
}

function manifestFor(rows) {
  return buildManifest({
    rows,
    codeSha: CODE_SHA,
    schemaFingerprint: SCHEMA_FINGERPRINT,
    capturedAt: '2026-08-13T00:00:00.000Z',
  });
}

describe('S11 CLI 与环境门禁', () => {
  it.each([
    'postgresql://local:local@localhost:55432/local_db',
    'postgresql://local:local@127.0.0.1:55432/local_db',
    'postgresql://local:local@[::1]:55432/local_db',
  ])('只接受严格 loopback PostgreSQL：%s', (value) => {
    expect(assertLoopbackDatabaseUrl(value).hostname).toBeTruthy();
  });

  it.each([
    'postgresql://local:local@0.0.0.0:55432/local_db',
    'postgresql://local:local@192.168.1.2:5432/local_db',
    'postgresql://local:local@db.example.com:5432/production',
    'https://127.0.0.1/local_db',
  ])('在创建数据库 client 前拒绝非授权 endpoint：%s', (value) => {
    expect(() => assertLoopbackDatabaseUrl(value)).toThrow(S11BackfillError);
  });

  it('只接受 local_development 环境标记', () => {
    expect(() => assertEnvironment('local_development')).not.toThrow();
    expect(() => assertEnvironment('local_acceptance')).toThrow('non_local_development_environment_refused');
    expect(() => assertEnvironment('staging')).toThrow('non_local_development_environment_refused');
    expect(() => assertEnvironment('production')).toThrow('non_local_development_environment_refused');
  });

  it('CLI 每次只允许一个 mode 与对应的 absolute manifest 参数', () => {
    expect(parseCli(['--dry-run', '--manifest-output', '/private/tmp/s11.json']))
      .toEqual({ mode: 'dry-run', manifestPath: '/private/tmp/s11.json' });
    expect(parseCli(['--execute', '--manifest', '/private/tmp/s11.json']))
      .toEqual({ mode: 'execute', manifestPath: '/private/tmp/s11.json' });
    expect(parseCli(['--postcheck', '--manifest', '/private/tmp/s11.json']).mode)
      .toBe('postcheck');
    expect(parseCli(['--recover', '--manifest', '/private/tmp/s11.json']).mode)
      .toBe('recover');
    expect(() => parseCli(['--dry-run', '--execute', '--manifest', '/tmp/x']))
      .toThrow('exactly_one_mode_required');
    expect(() => parseCli(['--execute', '--manifest', '/tmp/x', '--force']))
      .toThrow('unknown_cli_argument');
  });

  it('只允许同 SHA manifest 或已执行 S11 manifest 的 exact digest 跨 corrective SHA', () => {
    const manifest = manifestFor([loginRow()]);
    expect(assertValidatedManifestCodeCompatibility(manifest, CODE_SHA, 'wrong-tool'))
      .toBe('exact_code_sha');

    const executedManifest = {
      ...manifest,
      codeSha: EXECUTED_TOOLING_SHA,
      manifestDigest: EXECUTED_MANIFEST_DIGEST,
    };
    expect(assertValidatedManifestCodeCompatibility(
      executedManifest,
      'c'.repeat(40),
      EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST,
    ))
      .toBe('executed_s11_manifest');
    expect(() => assertValidatedManifestCodeCompatibility(
      { ...executedManifest, manifestDigest: 'd'.repeat(64) },
      'c'.repeat(40),
      EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST,
    )).toThrow('code_sha_drift');
    expect(() => assertValidatedManifestCodeCompatibility(
      { ...executedManifest, codeSha: 'e'.repeat(40) },
      'c'.repeat(40),
      EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST,
    )).toThrow('code_sha_drift');
    expect(() => assertValidatedManifestCodeCompatibility(
      executedManifest,
      'c'.repeat(40),
      'f'.repeat(64),
    )).toThrow('code_sha_drift');
  });

  it('跨 SHA 例外绑定到当前 runner 的 frozen source digest', async () => {
    const source = await readFile(
      path.join(REPOSITORY_ROOT, 'scripts/db/post-v2-r1c-audit-historical-backfill.mjs'),
      'utf8',
    );
    expect(compatibleToolSourceDigest(source))
      .toBe(EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST);
    expect(compatibleToolSourceDigest(source.replace(
      'const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;',
      'const MAX_MANIFEST_BYTES = 7 * 1024 * 1024;',
    ))).not.toBe(EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST);
    expect(() => compatibleToolSourceDigest(source.replace(
      'export const EXECUTED_MANIFEST_COMPATIBLE_TOOL_SOURCE_DIGEST =',
      'export const REMOVED_TOOL_SOURCE_DIGEST =',
    ))).toThrow('invalid_tool_source_identity_marker');
  });
});

describe('S11 deterministic classification manifest', () => {
  const evidence = [
    evidenceRow('mapping', 'R-VERIFIED-MAPPING-OPERATION', 1),
    evidenceRow('consent', 'R-VERIFIED-CONSENT-OPERATION', 2),
    evidenceRow('frequency', 'R-VERIFIED-FREQUENCY-OPERATION', 3),
    evidenceRow('dry_run', 'R-VERIFIED-DRY-RUN-OPERATION', 4),
    evidenceRow('draft', 'R-VERIFIED-DRAFT-CREATION', 5),
    evidenceRow('delivery', 'R-VERIFIED-DELIVERY-TIMELINE', 6),
  ];

  it.each(evidence)('$ruleId 只接受 unique same-operation pair', ({ row, ruleId, institutionId }) => {
    const result = classifySnapshotRows([row]);
    expect(result.overlapCount).toBe(0);
    expect(result.entries[0]).toMatchObject({
      ruleId,
      targetClass: 'VERIFIED',
      targetInstitutionId: institutionId,
      targetAttribution: 'verified',
      dmlRequired: true,
    });
  });

  it('Auth login 的 exact semantic tuple 才能进入 NOT_APPLICABLE', () => {
    expect(classifySnapshotRows([loginRow()]).entries[0]).toMatchObject({
      ruleId: 'R-NOT-APPLICABLE-AUTH-LOGIN',
      targetClass: 'NOT_APPLICABLE',
      targetInstitutionId: null,
      targetAttribution: 'not_applicable',
      dmlRequired: true,
    });
    expect(classifySnapshotRows([loginRow(91), baseRow({
      event_id: 'event-92',
      resource: 'tenant_member',
      action: 'read_own_tenant',
      result: 'allowed',
      reason: 'tenant_login_succeeded',
      source: 'demo_session',
    })]).classCounts).toEqual({
      VERIFIED: 0,
      NOT_APPLICABLE: 1,
      ATTEMPTED_DENIAL: 0,
      UNCLASSIFIABLE: 1,
    });
  });

  it('safety-switch、current-object-only、attempted shape 与 legacy enum 均不伪分类', () => {
    const rows = [
      baseRow({
        event_id: 'safety-1',
        resource: 'safety_switch',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'safety_switch_read',
      }),
      baseRow({ event_id: 'current-only', resource_id: 'current-customer' }),
      baseRow({
        event_id: 'partial-pair',
        institution_id: 'attempted-institution',
        result: 'denied',
        source: 'formal_session',
      }),
      baseRow({ event_id: 'legacy-enum', institution_attribution: 'legacy_unattributed' }),
    ];
    const result = classifySnapshotRows(rows);
    expect(result.classCounts.UNCLASSIFIABLE).toBe(4);
    expect(result.entries.every((entry) => !entry.dmlRequired)).toBe(true);
    expect(result.classCounts.ATTEMPTED_DENIAL).toBe(0);
  });

  it('canonical attributed rows 只保留，malformed attributed shape fail-closed', () => {
    const result = classifySnapshotRows([
      baseRow({
        event_id: 'existing-verified',
        institution_id: 'institution-1',
        institution_attribution: 'verified',
      }),
      baseRow({
        event_id: 'existing-na',
        institution_attribution: 'not_applicable',
      }),
      baseRow({
        event_id: 'malformed-verified',
        institution_attribution: 'verified',
      }),
      baseRow({
        event_id: 'malformed-na',
        institution_id: 'institution-1',
        institution_attribution: 'not_applicable',
      }),
    ]);
    expect(result.classCounts).toEqual({
      VERIFIED: 1,
      NOT_APPLICABLE: 1,
      ATTEMPTED_DENIAL: 0,
      UNCLASSIFIABLE: 2,
    });
    expect(result.entries.every((entry) => !entry.dmlRequired)).toBe(true);
  });

  it('同一 row 命中多个 final rule 时拒绝生成 manifest', () => {
    const overlap = baseRow({
      event_id: 'overlap',
      mapping_match_count: 1,
      mapping_institution_count: 1,
      mapping_institution_id: 'institution-1',
      consent_match_count: 1,
      consent_institution_count: 1,
      consent_institution_id: 'institution-1',
    });
    expect(classifySnapshotRows([overlap]).overlapCount).toBe(1);
    expect(() => manifestFor([overlap])).toThrow('classification_rule_overlap');
  });

  it('完整 manifest 锁定 rule counts、exact cohort、updates 与 checksum', () => {
    const rows = [...evidence.map((value) => value.row), loginRow(), baseRow({ event_id: 'unknown' })];
    const manifest = manifestFor(rows);
    expect(manifest.version).toBe(MANIFEST_VERSION);
    expect(manifest.rules).toHaveLength(CLASSIFICATION_RULES.length);
    expect(manifest.preCounts.total).toBe(8);
    expect(manifest.expectedUpdateCount).toBe(7);
    expect(manifest.classCounts).toEqual({
      VERIFIED: 6,
      NOT_APPLICABLE: 1,
      ATTEMPTED_DENIAL: 0,
      UNCLASSIFIABLE: 1,
    });
    expect(manifest.ruleOverlapCount).toBe(0);
    expect(manifest.unsafeGuessedAttributionCount).toBe(0);
    expect(() => validateManifest(manifest)).not.toThrow();
    expect(manifest.manifestDigest).toHaveLength(64);
  });

  it('manifest 任意字段被篡改都会 fail-closed', () => {
    const manifest = manifestFor([loginRow()]);
    const tampered = structuredClone(manifest);
    tampered.expectedUpdateCount = 0;
    expect(() => validateManifest(tampered)).toThrow('manifest_digest_mismatch');
  });

  it('immutable digest 排除 attribution 两列但覆盖所有业务 identity 字段', () => {
    const original = baseRow();
    const attributed = baseRow({
      institution_id: 'institution-1',
      institution_attribution: 'verified',
    });
    const changedReason = baseRow({ reason: 'different_reason' });
    expect(immutableAuditEventDigest(attributed)).toBe(immutableAuditEventDigest(original));
    expect(immutableAuditEventDigest(changedReason)).not.toBe(immutableAuditEventDigest(original));
  });

  it('低敏 aggregate 不包含 tenant ID，只保留分布、白名单维度和时间范围', () => {
    const aggregate = buildLowSensitiveAggregates([
      baseRow({ event_id: 'a', tenant_id: 'private-tenant-a' }),
      baseRow({ event_id: 'b', tenant_id: 'private-tenant-a' }),
      baseRow({ event_id: 'c', tenant_id: 'private-tenant-b' }),
    ]);
    expect(aggregate.tenantCount).toBe(2);
    expect(aggregate.tenantRowCounts).toEqual([2, 1]);
    expect(JSON.stringify(aggregate)).not.toContain('private-tenant');
  });
});

describe('S11 exact cohort、幂等与 recovery state model', () => {
  it('同一 manifest 只接受全部 prestate 或全部 final state，拒绝 partial commit', () => {
    const first = evidenceRow('mapping', 'R-VERIFIED-MAPPING-OPERATION', 1).row;
    const second = evidenceRow('consent', 'R-VERIFIED-CONSENT-OPERATION', 2).row;
    const manifest = manifestFor([first, second]);
    expect(validateCohortAgainstManifest([first, second], manifest)).toMatchObject({
      beforeTargetCount: 2,
      finalTargetCount: 0,
    });
    const finalRows = [first, second].map((row) => {
      const target = manifest.rows.find((entry) => entry.eventId === row.event_id);
      return {
        ...row,
        institution_id: target.targetInstitutionId,
        institution_attribution: target.targetAttribution,
      };
    });
    expect(validateCohortAgainstManifest(finalRows, manifest)).toMatchObject({
      beforeTargetCount: 0,
      finalTargetCount: 2,
    });
    expect(() => validateCohortAgainstManifest([finalRows[0], second], manifest))
      .toThrow('partial_backfill_state_refused');
  });

  it('immutable drift、unknown attribution drift 与 cohort deletion 都会拒绝', () => {
    const row = evidenceRow('mapping', 'R-VERIFIED-MAPPING-OPERATION', 1).row;
    const manifest = manifestFor([row]);
    expect(() => validateCohortAgainstManifest([{ ...row, reason: 'changed' }], manifest))
      .toThrow('immutable_historical_row_drift');
    expect(() => validateCohortAgainstManifest([{ ...row, institution_attribution: 'legacy_unattributed' }], manifest))
      .toThrow('attribution_state_drift');
    expect(() => validateCohortAgainstManifest([], manifest)).toThrow('historical_cohort_drift');
  });

  it('final state 与 recovery restored state 不重新依赖可变业务 evidence', () => {
    const row = evidenceRow('mapping', 'R-VERIFIED-MAPPING-OPERATION', 1).row;
    const manifest = manifestFor([row]);
    const target = manifest.rows[0];
    const changedEvidence = {
      ...row,
      mapping_match_count: 0,
      mapping_institution_count: 0,
      mapping_institution_id: null,
    };
    const finalState = {
      ...changedEvidence,
      institution_id: target.targetInstitutionId,
      institution_attribution: target.targetAttribution,
    };
    expect(validateCohortAgainstManifest([finalState], manifest)).toMatchObject({
      beforeTargetCount: 0,
      finalTargetCount: 1,
    });
    expect(() => validateCohortAgainstManifest([changedEvidence], manifest))
      .toThrow('classification_evidence_drift');
    expect(validateCohortAgainstManifest([changedEvidence], manifest, {
      revalidateBeforeEvidence: false,
    })).toMatchObject({
      beforeTargetCount: 1,
      finalTargetCount: 0,
    });
  });
});

describe('S11 repo 外 recovery manifest 安全', () => {
  async function secureTempDirectory() {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'zmtg-s11-test-'));
    tempPaths.push(directory);
    await chmod(directory, 0o700);
    return directory;
  }

  it('只以 0600、single-link regular file 写入并可验证读取', async () => {
    const directory = await secureTempDirectory();
    const filePath = path.join(directory, 'manifest.json');
    const manifest = manifestFor([loginRow()]);
    await writeSecureManifest(filePath, manifest, REPOSITORY_ROOT);
    const info = await lstat(filePath);
    expect(info.isFile()).toBe(true);
    expect(info.nlink).toBe(1);
    expect(info.mode & 0o777).toBe(0o600);
    expect(await readSecureManifest(filePath, REPOSITORY_ROOT)).toEqual(manifest);
  });

  it('拒绝 repo 内路径、过宽权限、symlink 与 hardlink', async () => {
    const directory = await secureTempDirectory();
    const manifest = manifestFor([loginRow()]);
    await expect(writeSecureManifest(
      path.join(REPOSITORY_ROOT, 's11-private-manifest.json'),
      manifest,
      REPOSITORY_ROOT,
    )).rejects.toThrow('manifest_must_be_outside_repository');

    const filePath = path.join(directory, 'manifest.json');
    await writeFile(filePath, `${JSON.stringify(manifest)}\n`, { mode: 0o644 });
    await expect(readSecureManifest(filePath, REPOSITORY_ROOT))
      .rejects.toThrow('unsafe_manifest_permissions_or_size');
    await chmod(filePath, 0o600);

    const symlinkPath = path.join(directory, 'manifest-link.json');
    await symlink(filePath, symlinkPath);
    await expect(readSecureManifest(symlinkPath, REPOSITORY_ROOT))
      .rejects.toThrow('unsafe_manifest_file');

    const hardlinkPath = path.join(directory, 'manifest-hardlink.json');
    await link(filePath, hardlinkPath);
    await expect(readSecureManifest(filePath, REPOSITORY_ROOT))
      .rejects.toThrow('unsafe_manifest_file');
  });

  it('拒绝仓库外父目录 symlink 将 manifest 实际落入仓库', async () => {
    const outsideDirectory = await secureTempDirectory();
    const repositoryDirectory = await mkdtemp(path.join(REPOSITORY_ROOT, '.s11-private-test-'));
    tempPaths.push(repositoryDirectory);
    await chmod(repositoryDirectory, 0o700);
    const linkedParent = path.join(outsideDirectory, 'linked-parent');
    await symlink(repositoryDirectory, linkedParent, 'dir');
    await expect(writeSecureManifest(
      path.join(linkedParent, 'manifest.json'),
      manifestFor([loginRow()]),
      REPOSITORY_ROOT,
    )).rejects.toThrow('manifest_must_be_outside_repository');
  });

  it('拒绝覆盖既有 manifest，防止替换已冻结 cohort', async () => {
    const directory = await secureTempDirectory();
    const filePath = path.join(directory, 'manifest.json');
    const manifest = manifestFor([loginRow()]);
    await writeSecureManifest(filePath, manifest, REPOSITORY_ROOT);
    await expect(writeSecureManifest(filePath, manifest, REPOSITORY_ROOT))
      .rejects.toThrow('manifest_already_exists');
    expect(JSON.parse(await readFile(filePath, 'utf8')).manifestDigest)
      .toBe(manifest.manifestDigest);
  });
});

describe('S11 SQL 与输出静态安全契约', () => {
  it('只允许 UPDATE attribution 两列，并锁定 exact id/current-state/RETURNING', async () => {
    const source = await readFile(
      path.join(TEST_DIR, 'post-v2-r1c-audit-historical-backfill.mjs'),
      'utf8',
    );
    const updates = [...source.matchAll(/`UPDATE audit_events[\s\S]*?RETURNING event_id`/gu)]
      .map((match) => match[0]);
    expect(updates).toHaveLength(4);
    for (const statement of updates) {
      const setClause = statement.match(/SET([\s\S]*?)WHERE/u)?.[1] ?? '';
      expect(setClause).toMatch(/institution_id/u);
      expect(setClause).toMatch(/institution_attribution/u);
      expect(setClause).not.toMatch(/actor_id|tenant_id|scope|resource|action|result|reason|occurred_at|source/u);
      expect(statement).toContain('event_id = ANY');
      expect(statement).toContain('RETURNING event_id');
    }
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|DELETE\s+FROM|CREATE\s+(?:TABLE|TEMP)|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/iu);
    expect(source).not.toMatch(/SET\s+institution_attribution\s*=\s*'legacy_unattributed'/u);
  });

  it('dry-run/execute/postcheck 复用同一 SNAPSHOT_SELECT，client 在 finally 关闭且错误输出低敏', async () => {
    const source = await readFile(
      path.join(TEST_DIR, 'post-v2-r1c-audit-historical-backfill.mjs'),
      'utf8',
    );
    expect(source).toContain('const SNAPSHOT_SELECT');
    expect(source).toContain('fetchAllSnapshotRows');
    expect(source).toContain('fetchCohortRows');
    expect(source).toMatch(/finally\s*\{\s*await client\.end/u);
    expect(source).toContain("error instanceof S11BackfillError ? error.code : 'unexpected_failure'");
    expect(source).not.toMatch(/console\.(?:log|error)/u);
  });

  it('canonical JSON 与 SHA-256 对 key order deterministic', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(sha256(canonicalJson({ b: 2, a: 1 }))).toBe(
      sha256(canonicalJson({ a: 1, b: 2 })),
    );
  });
});
