import { describe, expect, it, vi } from 'vitest';
import {
  computeProvisioningEntryKeysDigest,
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  type ProvisioningCanonicalManifestV1,
} from '../provisioning-canonicalization';
import {
  parseProvisioningManifest,
  toProvisioningExpectedTriplet,
} from '../provisioning-manifest';
import {
  parseProvisioningExecutionLease,
  PROVISIONING_EXECUTION_LEASE_VERSION,
  PROVISIONING_EXPECTED_JOURNAL,
} from '../provisioning-lease';
import {
  dryRunProvisioning,
  executeProvisioning,
  hasConservedProvisioningCounts,
} from '../provisioning-kernel';
import type {
  ProvisioningContextHeadRowV1,
  ProvisioningContextVersionRowV1,
  ProvisioningRepositoryV1,
  ProvisioningScopeRowV1,
  ProvisioningTransactionPortV1,
  ProvisioningTripletSnapshotV1,
} from '../provisioning-ports';

const contextPolicy = {
  timezones: ['Asia/Shanghai'],
  currencies: ['CNY'],
} as const;

function createManifest() {
  const draft: ProvisioningCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: 'approval-ref-001',
    approvedAt: '2026-07-30T00:00:00.000Z',
    entries: [
      {
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
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
        tenantId: 'tenant-b',
        institutionId: 'institution-b',
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
    ],
  };
  return parseProvisioningManifest(
    {
      ...draft,
      digest: computeProvisioningManifestDigest(draft).external,
    },
    { contextPolicy },
  );
}

function pairKey(tenantId: string, institutionId: string): string {
  return JSON.stringify([tenantId, institutionId]);
}

interface FakeState {
  readonly tenants: Set<string>;
  readonly scopes: Map<string, ProvisioningScopeRowV1[]>;
  readonly versions: Map<string, ProvisioningContextVersionRowV1[]>;
  readonly heads: Map<string, ProvisioningContextHeadRowV1[]>;
}

function cloneState(state: FakeState): FakeState {
  return {
    tenants: new Set(state.tenants),
    scopes: new Map(
      [...state.scopes].map(([key, rows]) => [key, structuredClone(rows)]),
    ),
    versions: new Map(
      [...state.versions].map(([key, rows]) => [key, structuredClone(rows)]),
    ),
    heads: new Map(
      [...state.heads].map(([key, rows]) => [key, structuredClone(rows)]),
    ),
  };
}

class FakeTransactionPort implements ProvisioningTransactionPortV1 {
  state: FakeState;
  readonly writes: string[] = [];
  failOn: 'scope' | 'version' | 'head' | null = null;
  noOpOn: 'scope' | 'version' | 'head' | null = null;
  readCalls = 0;
  writeCalls = 0;
  beforeTripletRead:
    | ((state: FakeState, readCount: number) => void)
    | null = null;
  tripletReadCount = 0;

  constructor(tenants: readonly string[]) {
    this.state = {
      tenants: new Set(tenants),
      scopes: new Map(),
      versions: new Map(),
      heads: new Map(),
    };
  }

  private repository(state: FakeState): ProvisioningRepositoryV1 {
    const append = <T>(
      map: Map<string, T[]>,
      key: string,
      row: T,
    ): void => {
      map.set(key, [...(map.get(key) ?? []), structuredClone(row)]);
    };
    return {
      tenantExists: async (tenantId) => state.tenants.has(tenantId),
      readTriplet: async ({ tenantId, institutionId }) => {
        this.tripletReadCount += 1;
        this.beforeTripletRead?.(state, this.tripletReadCount);
        const key = pairKey(tenantId, institutionId);
        return {
          scopes: structuredClone(state.scopes.get(key) ?? []),
          versions: structuredClone(state.versions.get(key) ?? []),
          heads: structuredClone(state.heads.get(key) ?? []),
        } satisfies ProvisioningTripletSnapshotV1;
      },
      insertScope: async (row) => {
        this.writes.push('scope');
        if (this.failOn === 'scope') throw new Error('scope failed');
        if (this.noOpOn === 'scope') return 0;
        append(state.scopes, pairKey(row.tenantId, row.institutionId), row);
        return 1;
      },
      insertContextVersion: async (row) => {
        this.writes.push('version');
        if (this.failOn === 'version') throw new Error('version failed');
        if (this.noOpOn === 'version') return 0;
        append(state.versions, pairKey(row.tenantId, row.institutionId), row);
        return 1;
      },
      insertContextHead: async (row) => {
        this.writes.push('head');
        if (this.failOn === 'head') throw new Error('head failed');
        if (this.noOpOn === 'head') return 0;
        append(state.heads, pairKey(row.tenantId, row.institutionId), row);
        return 1;
      },
    };
  }

  async read<T>(
    work: (repository: ProvisioningRepositoryV1) => Promise<T>,
  ): Promise<T> {
    this.readCalls += 1;
    return work(this.repository(this.state));
  }

  async write<T>(
    work: (repository: ProvisioningRepositoryV1) => Promise<T>,
  ): Promise<T> {
    this.writeCalls += 1;
    const transactionState = cloneState(this.state);
    const result = await work(this.repository(transactionState));
    this.state = transactionState;
    return result;
  }

  seedExpected(
    manifest: ReturnType<typeof createManifest>,
    index: number,
  ): void {
    const expected = toProvisioningExpectedTriplet(
      manifest,
      manifest.entries[index],
    );
    const key = pairKey(
      expected.scope.tenantId,
      expected.scope.institutionId,
    );
    this.state.scopes.set(key, [structuredClone(expected.scope)]);
    this.state.versions.set(key, [structuredClone(expected.version)]);
    this.state.heads.set(key, [structuredClone(expected.head)]);
  }
}

function createLease(manifest: ReturnType<typeof createManifest>) {
  return parseProvisioningExecutionLease({
    leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
    taskId: 'V2-MIG01-A2-P1-EXAMPLE',
    branch: 'feat/v2-mig01-a2-p1-example',
    frozenBase: '1'.repeat(40),
    journal: PROVISIONING_EXPECTED_JOURNAL,
    holder: 'holder-ref-001',
    operator: 'operator-ref-001',
    targetEnvironment: 'environment-ref-001',
    scope: {
      manifestDigest: manifest.digest,
      entryKeysDigest: computeProvisioningEntryKeysDigest(manifest.entries),
      entryCount: manifest.entries.length,
    },
    startsAt: '2026-07-30T00:00:00.000Z',
    expiresAt: '2026-07-30T02:00:00.000Z',
    renewal: { count: 0, renewedAt: null, renewedBy: null },
    invalidation: { invalidatedAt: null, reasonCode: null },
    release: { releasedAt: null, releasedBy: null },
  });
}

const leaseExpectation = Object.freeze({
  leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
  taskId: 'V2-MIG01-A2-P1-EXAMPLE',
  branch: 'feat/v2-mig01-a2-p1-example',
  frozenBase: '1'.repeat(40),
  journal: PROVISIONING_EXPECTED_JOURNAL,
  holder: 'holder-ref-001',
  operator: 'operator-ref-001',
  targetEnvironment: 'environment-ref-001',
});

describe('MIG-01A2 Provisioning 内核', () => {
  it('dry-run 分类 inserted／reused 并守恒，且绝不触发写事务', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    port.seedExpected(manifest, 1);

    const counts = await dryRunProvisioning(manifest, port);

    expect(counts).toEqual({
      input: 2,
      insertedCandidate: 1,
      reusedCandidate: 1,
      conflict: 0,
      unexpected: 0,
    });
    expect(hasConservedProvisioningCounts(counts)).toBe(true);
    expect(port.writeCalls).toBe(0);
    expect(port.writes).toEqual([]);
  });

  it('缺失 tenant、部分三元组和字段漂移均阻断整批', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a']);
    const expected = toProvisioningExpectedTriplet(manifest, manifest.entries[0]);
    port.state.scopes.set(
      pairKey(expected.scope.tenantId, expected.scope.institutionId),
      [{ ...expected.scope, revision: 2 }],
    );

    const counts = await dryRunProvisioning(manifest, port);

    expect(counts.conflict).toBe(2);
    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: { verify: vi.fn().mockResolvedValue(true) },
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('provisioning_batch_blocked');
    expect(port.writes).toEqual([]);
  });

  it('额外 Version 行归为 unexpected，禁止误判一致复用', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    port.seedExpected(manifest, 0);
    const expected = toProvisioningExpectedTriplet(manifest, manifest.entries[0]);
    const key = pairKey(expected.scope.tenantId, expected.scope.institutionId);
    port.state.versions.set(key, [
      expected.version,
      { ...expected.version, version: 2 },
    ]);

    const counts = await dryRunProvisioning(manifest, port);

    expect(counts.unexpected).toBe(1);
    expect(counts.insertedCandidate).toBe(1);
  });

  it.each([
    [
      '部分存在',
      (port: FakeTransactionPort, manifest: ReturnType<typeof createManifest>) => {
        const expected = toProvisioningExpectedTriplet(
          manifest,
          manifest.entries[0],
        );
        port.state.scopes.set(
          pairKey(expected.scope.tenantId, expected.scope.institutionId),
          [expected.scope],
        );
      },
    ],
    [
      '普通字段冲突',
      (port: FakeTransactionPort, manifest: ReturnType<typeof createManifest>) => {
        port.seedExpected(manifest, 0);
        const expected = toProvisioningExpectedTriplet(
          manifest,
          manifest.entries[0],
        );
        const key = pairKey(expected.scope.tenantId, expected.scope.institutionId);
        port.state.versions.set(key, [
          { ...expected.version, currency: 'USD' },
        ]);
      },
    ],
    [
      'revision 冲突',
      (port: FakeTransactionPort, manifest: ReturnType<typeof createManifest>) => {
        port.seedExpected(manifest, 0);
        const expected = toProvisioningExpectedTriplet(
          manifest,
          manifest.entries[0],
        );
        const key = pairKey(expected.scope.tenantId, expected.scope.institutionId);
        port.state.scopes.set(key, [{ ...expected.scope, revision: 2 }]);
      },
    ],
    [
      'digest 冲突',
      (port: FakeTransactionPort, manifest: ReturnType<typeof createManifest>) => {
        port.seedExpected(manifest, 0);
        const expected = toProvisioningExpectedTriplet(
          manifest,
          manifest.entries[0],
        );
        const key = pairKey(expected.scope.tenantId, expected.scope.institutionId);
        port.state.scopes.set(key, [
          {
            ...expected.scope,
            provisioningReferenceDigest: '0'.repeat(64),
          },
        ]);
      },
    ],
  ])('%s 必须分类为 conflict', async (_name, arrange) => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    arrange(port, manifest);

    const counts = await dryRunProvisioning(manifest, port);

    expect(counts.conflict).toBe(1);
    expect(hasConservedProvisioningCounts(counts)).toBe(true);
  });

  it('execute 在单一事务中按 Scope → Version → Head 写入并支持重放', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    const authority = { verify: vi.fn().mockResolvedValue(true) };

    const first = await executeProvisioning({
      manifest,
      transactionPort: port,
      leasePayload: createLease(manifest),
      leaseAuthority: authority,
      leaseExpectation,
      now: new Date('2026-07-30T01:00:00.000Z'),
    });
    expect(first.insertedCandidate).toBe(2);
    expect(port.writes).toEqual([
      'scope',
      'version',
      'head',
      'scope',
      'version',
      'head',
    ]);

    port.writes.length = 0;
    const replay = await executeProvisioning({
      manifest,
      transactionPort: port,
      leasePayload: createLease(manifest),
      leaseAuthority: authority,
      leaseExpectation,
      now: new Date('2026-07-30T01:00:00.000Z'),
    });
    expect(replay.reusedCandidate).toBe(2);
    expect(port.writes).toEqual([]);
  });

  it('任一写入失败时回滚完整批次并输出固定错误码', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    port.failOn = 'version';

    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: { verify: vi.fn().mockResolvedValue(true) },
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('provisioning_transaction_failed');
    expect(port.state.scopes.size).toBe(0);
    expect(port.state.versions.size).toBe(0);
    expect(port.state.heads.size).toBe(0);
  });

  it('提交前重校验发现并发漂移时整批回滚', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    port.beforeTripletRead = (state, readCount) => {
      if (readCount !== 3) return;
      const expected = toProvisioningExpectedTriplet(
        manifest,
        manifest.entries[0],
      );
      const key = pairKey(expected.scope.tenantId, expected.scope.institutionId);
      state.scopes.set(key, [{ ...expected.scope, revision: 2 }]);
    };

    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: { verify: vi.fn().mockResolvedValue(true) },
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('provisioning_commit_recheck_failed');
    expect(port.state.scopes.size).toBe(0);
    expect(port.state.versions.size).toBe(0);
    expect(port.state.heads.size).toBe(0);
  });

  it('Adapter 静默零行写入时按 affected rows fail-closed 并回滚', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    port.noOpOn = 'version';

    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: { verify: vi.fn().mockResolvedValue(true) },
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('provisioning_write_count_invalid');
    expect(port.state.scopes.size).toBe(0);
    expect(port.state.versions.size).toBe(0);
    expect(port.state.heads.size).toBe(0);
  });

  it('Authority 拒绝时在数据库 Port 之前 fail-closed', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);

    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: { verify: vi.fn().mockResolvedValue(false) },
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('lease_not_authorized');
    expect(port.readCalls).toBe(0);
    expect(port.writeCalls).toBe(0);
  });

  it('未由 Parser 颁发的 Manifest 在 Repository／Authority 前拒绝', async () => {
    const manifest = createManifest();
    const forged = structuredClone(manifest) as unknown as typeof manifest;
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    const authority = { verify: vi.fn().mockResolvedValue(true) };

    await expect(dryRunProvisioning(forged, port)).rejects.toThrow(
      'manifest_not_parsed',
    );
    await expect(
      executeProvisioning({
        manifest: forged,
        transactionPort: port,
        leasePayload: createLease(manifest),
        leaseAuthority: authority,
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toThrow('manifest_not_parsed');
    expect(port.readCalls).toBe(0);
    expect(port.writeCalls).toBe(0);
    expect(authority.verify).not.toHaveBeenCalled();
  });

  it('未解析的错误 Lease 在 Authority／Transaction Port 前拒绝', async () => {
    const manifest = createManifest();
    const port = new FakeTransactionPort(['tenant-a', 'tenant-b']);
    const authority = { verify: vi.fn().mockResolvedValue(true) };
    const invalidLease = {
      ...createLease(manifest),
      leaseVersion: 'wrong',
      journal: '9999_wrong',
      startsAt: 'not-a-date',
      expiresAt: 'not-a-date',
    };

    await expect(
      executeProvisioning({
        manifest,
        transactionPort: port,
        leasePayload: invalidLease,
        leaseAuthority: authority,
        leaseExpectation,
        now: new Date('2026-07-30T01:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(port.readCalls).toBe(0);
    expect(port.writeCalls).toBe(0);
    expect(authority.verify).not.toHaveBeenCalled();
  });
});
