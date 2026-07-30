import { describe, expect, it } from 'vitest';
import {
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  type ProvisioningCanonicalManifestV1,
} from '../provisioning-canonicalization';
import {
  parseProvisioningManifest,
  toProvisioningExpectedTriplet,
  type ProvisioningContextPolicyV1,
} from '../provisioning-manifest';

const contextPolicy: ProvisioningContextPolicyV1 = Object.freeze({
  timezones: Object.freeze(['Asia/Shanghai', 'UTC']),
  currencies: Object.freeze(['CNY', 'USD']),
});

function createDraft(
  overrides: Record<string, unknown> = {},
): ProvisioningCanonicalManifestV1 & Record<string, unknown> {
  return {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: 'approval-ref-001',
    approvedAt: '2026-07-30T00:00:00.000Z',
    entries: [
      {
        tenantId: 'tenant-b',
        institutionId: 'institution-2',
        scopeStatus: 'active',
        scopeRevision: 1,
        provisioningSource: 'approved_migration_manifest',
        contextVersion: 1,
        contextHeadRevision: 1,
        latestVersion: 1,
        contextSource: 'institution_config',
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
        effectiveFromBusinessDate: '2026-07-30',
        effectiveAt: '2026-07-30T00:00:00.000Z',
      },
      {
        tenantId: 'tenant-a',
        institutionId: 'institution-1',
        scopeStatus: 'suspended',
        scopeRevision: 1,
        provisioningSource: 'approved_migration_manifest',
        contextVersion: 1,
        contextHeadRevision: 1,
        latestVersion: 1,
        contextSource: 'product_default',
        timezone: 'UTC',
        currency: 'USD',
        effectiveFromBusinessDate: '2026-07-30',
        effectiveAt: '2026-07-30T12:30:00.000Z',
      },
    ],
    ...overrides,
  } as ProvisioningCanonicalManifestV1 & Record<string, unknown>;
}

function createManifest(
  draftOverrides: Record<string, unknown> = {},
  manifestOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const draft = createDraft(draftOverrides);
  return {
    ...draft,
    digest: computeProvisioningManifestDigest(draft).external,
    ...manifestOverrides,
  };
}

describe('MIG-01A2 Manifest 低敏契约', () => {
  it('按双键排序、核验 digest 并冻结 Schema 映射', () => {
    const manifest = parseProvisioningManifest(createManifest(), {
      contextPolicy,
    });

    expect(manifest.entries.map((entry) => entry.tenantId)).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
    expect(manifest.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(manifest.databaseDigest).toBe(manifest.digest.slice(7));

    const expected = toProvisioningExpectedTriplet(
      manifest,
      manifest.entries[0],
    );
    expect(expected.scope).toEqual({
      tenantId: 'tenant-a',
      institutionId: 'institution-1',
      status: 'suspended',
      revision: 1,
      provisioningSource: 'approved_migration_manifest',
      provisioningReferenceDigest: manifest.databaseDigest,
      approvedBy: 'approval-ref-001',
      approvedAt: '2026-07-30T00:00:00.000Z',
    });
    expect(expected.version).toEqual({
      tenantId: 'tenant-a',
      institutionId: 'institution-1',
      version: 1,
      timezone: 'UTC',
      currency: 'USD',
      effectiveFromBusinessDate: '2026-07-30',
      effectiveAt: '2026-07-30T12:30:00.000Z',
      source: 'product_default',
      migrationProvenance: null,
      createdBy: 'approval-ref-001',
    });
    expect(expected.head).toEqual({
      tenantId: 'tenant-a',
      institutionId: 'institution-1',
      revision: 1,
      latestVersion: 1,
      updatedBy: 'approval-ref-001',
    });
  });

  it('锁定 c14n-v1 固定测试向量', () => {
    const digest = computeProvisioningManifestDigest(createDraft());

    expect(digest.external).toBe(
      'sha256:a42fda705e6256a3fd36d74f2d243f27fefcb19dc0ad63c3a00970d42d16de1a',
    );
    expect(JSON.parse(digest.canonicalJson)).toEqual([
      'zmtg.mig01-a2.provisioning-manifest',
      'c14n-v1',
      'mig01-a2/v1',
      'approved',
      'approval-ref-001',
      '2026-07-30T00:00:00.000Z',
      2,
      [
        [
          'tenant-a',
          'institution-1',
          'suspended',
          1,
          'approved_migration_manifest',
          1,
          1,
          1,
          'product_default',
          'UTC',
          'USD',
          '2026-07-30',
          '2026-07-30T12:30:00.000Z',
          null,
        ],
        [
          'tenant-b',
          'institution-2',
          'active',
          1,
          'approved_migration_manifest',
          1,
          1,
          1,
          'institution_config',
          'Asia/Shanghai',
          'CNY',
          '2026-07-30',
          '2026-07-30T00:00:00.000Z',
          null,
        ],
      ],
    ]);
    expect(digest.canonicalJson).toContain(',null]');
  });

  it.each([
    ['未知顶层字段', { unexpected: true }, 'manifest_shape_invalid'],
    ['未批准状态', { approvalStatus: 'pending' }, 'manifest_not_approved'],
    ['未知版本', { manifestVersion: 'mig01-a2/v2' }, 'manifest_version_invalid'],
  ])('拒绝%s并整批 fail-closed', (_name, override, code) => {
    const value = createManifest({}, override);
    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow(code);
  });

  it('拒绝未知条目字段、自由文本及 Secret 承载位', () => {
    const draft = createDraft();
    const entries: Array<Record<string, unknown>> = draft.entries.map(
      (entry) => ({ ...entry }),
    );
    entries[0].notes = 'secret=value';
    const value = createManifest({ entries });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_entry_shape_invalid');
  });

  it('拒绝重复 tenantId + institutionId', () => {
    const draft = createDraft();
    const first = structuredClone(draft.entries[0]);
    const value = createManifest({ entries: [first, first] });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_duplicate_scope');
  });

  it('拒绝空 Manifest，不把空输入解释为成功 no-op', () => {
    const value = createManifest({ entries: [] });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_entries_invalid');
  });

  it('拒绝非 NFC、超出 64 字符双键及疑似 PII 引用', () => {
    for (const tenantId of [
      'te\u0301nant',
      `t${'x'.repeat(64)}`,
      'person@example.invalid',
      'sk-proj-placeholder',
      'tenant-\ud800',
      '13800000000',
      '110101199001010011',
    ]) {
      const draft = createDraft();
      const entries: Array<Record<string, unknown>> = draft.entries.map(
        (entry) => ({ ...entry }),
      );
      entries[0] = { ...entries[0], tenantId };
      const value = createManifest({ entries });
      expect(() =>
        parseProvisioningManifest(value, { contextPolicy }),
      ).toThrow('manifest_tenant_id_invalid');
    }
  });

  it('区分注册表有效与业务批准集合', () => {
    const draft = createDraft();
    const entries: Array<Record<string, unknown>> = draft.entries.map(
      (entry) => ({ ...entry }),
    );
    entries[0] = { ...entries[0], timezone: 'Europe/Paris', currency: 'EUR' };
    const value = createManifest({ entries });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_timezone_not_approved');
  });

  it('拒绝不在业务批准集合中的 ISO 4217 币种', () => {
    const draft = createDraft();
    const entries: Array<Record<string, unknown>> = draft.entries.map(
      (entry) => ({ ...entry }),
    );
    entries[0] = { ...entries[0], currency: 'EUR' };
    const value = createManifest({ entries });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_currency_not_approved');
  });

  it('拒绝机构业务日期与 effectiveAt 不一致', () => {
    const draft = createDraft();
    const entries: Array<Record<string, unknown>> = draft.entries.map(
      (entry) => ({ ...entry }),
    );
    entries[0] = {
      ...entries[0],
      effectiveFromBusinessDate: '2026-07-29',
    };
    const value = createManifest({ entries });

    expect(() =>
      parseProvisioningManifest(value, { contextPolicy }),
    ).toThrow('manifest_effective_date_mismatch');
  });

  it('拒绝 digest 不一致及非规范时间格式', () => {
    expect(() =>
      parseProvisioningManifest(
        createManifest({}, { digest: `sha256:${'0'.repeat(64)}` }),
        { contextPolicy },
      ),
    ).toThrow('manifest_digest_mismatch');
    expect(() =>
      parseProvisioningManifest(
        createManifest({ approvedAt: '2026-07-30T00:00:00Z' }),
        { contextPolicy },
      ),
    ).toThrow('manifest_approved_at_invalid');
  });

  it('Schema 映射只接受同一 Parser 颁发的条目对象', () => {
    const manifest = parseProvisioningManifest(createManifest(), {
      contextPolicy,
    });
    const forgedEntry = structuredClone(manifest.entries[0]);

    expect(() =>
      toProvisioningExpectedTriplet(manifest, forgedEntry),
    ).toThrow('manifest_entry_not_parsed');
  });
});
