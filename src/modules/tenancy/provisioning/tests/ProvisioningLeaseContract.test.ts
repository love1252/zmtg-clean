import { describe, expect, it, vi } from 'vitest';
import {
  parseProvisioningExecutionLease,
  PROVISIONING_EXECUTION_LEASE_VERSION,
  PROVISIONING_EXPECTED_JOURNAL,
  verifyProvisioningExecutionLease,
  type ProvisioningExecutionLeasePayloadV1,
} from '../provisioning-lease';

const manifestDigest = `sha256:${'a'.repeat(64)}` as const;
const entryKeysDigest = `sha256:${'b'.repeat(64)}` as const;

function createLease(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
    taskId: 'V2-MIG01-A2-P1-EXAMPLE',
    branch: 'feat/v2-mig01-a2-p1-example',
    frozenBase: '1'.repeat(40),
    journal: PROVISIONING_EXPECTED_JOURNAL,
    holder: 'holder-ref-001',
    operator: 'operator-ref-001',
    targetEnvironment: 'environment-ref-001',
    scope: {
      manifestDigest,
      entryKeysDigest,
      entryCount: 2,
    },
    startsAt: '2026-07-30T00:00:00.000Z',
    expiresAt: '2026-07-30T02:00:00.000Z',
    renewal: {
      count: 0,
      renewedAt: null,
      renewedBy: null,
    },
    invalidation: {
      invalidatedAt: null,
      reasonCode: null,
    },
    release: {
      releasedAt: null,
      releasedBy: null,
    },
    ...overrides,
  };
}

const expectation = Object.freeze({
  leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
  taskId: 'V2-MIG01-A2-P1-EXAMPLE',
  branch: 'feat/v2-mig01-a2-p1-example',
  frozenBase: '1'.repeat(40),
  journal: PROVISIONING_EXPECTED_JOURNAL,
  holder: 'holder-ref-001',
  operator: 'operator-ref-001',
  targetEnvironment: 'environment-ref-001',
  manifestDigest,
  entryKeysDigest,
  entryCount: 2,
  approverReference: 'approval-ref-001',
});

describe('MIG-01A2 执行 Lease 低敏契约', () => {
  it('结构校验与 Authority 验证同时通过后才返回 verified lease', async () => {
    const payload = parseProvisioningExecutionLease(createLease());
    const authority = { verify: vi.fn().mockResolvedValue(true) };

    const verified = await verifyProvisioningExecutionLease(
      payload,
      authority,
      expectation,
      new Date('2026-07-30T01:00:00.000Z'),
    );

    expect(verified).toStrictEqual(payload);
    expect(authority.verify).toHaveBeenCalledOnce();
  });

  it.each([
    ['缺失字段', { holder: undefined }, 'lease_holder_invalid'],
    ['未知 journal', { journal: '0039_unapproved' }, 'lease_journal_invalid'],
    [
      '正文型环境引用',
      { targetEnvironment: 'postgres://credential@host/db' },
      'lease_environment_invalid',
    ],
  ])('拒绝%s', (_name, override, code) => {
    expect(() =>
      parseProvisioningExecutionLease(createLease(override)),
    ).toThrow(code);
  });

  it('拒绝未知字段与不一致的 renewal', () => {
    expect(() =>
      parseProvisioningExecutionLease(
        createLease({ unexpected: 'not-allowed' }),
      ),
    ).toThrow('lease_shape_invalid');
    expect(() =>
      parseProvisioningExecutionLease(
        createLease({
          renewal: {
            count: 1,
            renewedAt: null,
            renewedBy: null,
          },
        }),
      ),
    ).toThrow('lease_renewal_inconsistent');
  });

  it.each([
    [
      '审批人与执行者相同',
      { operator: 'approval-ref-001' },
      new Date('2026-07-30T01:00:00.000Z'),
    ],
    [
      '尚未生效',
      {},
      new Date('2026-07-29T23:59:59.999Z'),
    ],
    [
      '已经过期',
      {},
      new Date('2026-07-30T02:00:00.000Z'),
    ],
    [
      '已经失效',
      {
        invalidation: {
          invalidatedAt: '2026-07-30T00:30:00.000Z',
          reasonCode: 'operator_cancelled',
        },
      },
      new Date('2026-07-30T01:00:00.000Z'),
    ],
  ])('拒绝%s的 Lease', async (_name, override, now) => {
    const payload = parseProvisioningExecutionLease(
      createLease(override),
    ) as ProvisioningExecutionLeasePayloadV1;
    await expect(
      verifyProvisioningExecutionLease(
        payload,
        { verify: vi.fn().mockResolvedValue(true) },
        expectation,
        now,
      ),
    ).rejects.toThrow('lease_not_authorized');
  });

  it('Authority 拒绝或不可用时 fail-closed', async () => {
    const payload = parseProvisioningExecutionLease(createLease());
    await expect(
      verifyProvisioningExecutionLease(
        payload,
        { verify: vi.fn().mockResolvedValue(false) },
        expectation,
        new Date('2026-07-30T01:00:00.000Z'),
      ),
    ).rejects.toThrow('lease_not_authorized');
    await expect(
      verifyProvisioningExecutionLease(
        payload,
        { verify: vi.fn().mockRejectedValue(new Error('raw secret')) },
        expectation,
        new Date('2026-07-30T01:00:00.000Z'),
      ),
    ).rejects.toThrow('lease_authority_unavailable');
  });

  it.each([
    ['错误分支', { branch: 'feat/another-branch' }],
    ['错误 Base', { frozenBase: '2'.repeat(40) }],
    ['错误 holder', { holder: 'holder-ref-002' }],
    ['错误 operator', { operator: 'operator-ref-002' }],
    ['错误环境', { targetEnvironment: 'environment-ref-002' }],
  ])('拒绝%s，即使 Authority 返回通过', async (_name, override) => {
    const payload = parseProvisioningExecutionLease(
      createLease(override),
    );
    const authority = { verify: vi.fn().mockResolvedValue(true) };

    await expect(
      verifyProvisioningExecutionLease(
        payload,
        authority,
        expectation,
        new Date('2026-07-30T01:00:00.000Z'),
      ),
    ).rejects.toThrow('lease_not_authorized');
    expect(authority.verify).not.toHaveBeenCalled();
  });

  it('验证边界会重新解析原始 payload，错误 version／journal／时间不能绕过', async () => {
    for (const override of [
      { leaseVersion: 'wrong-version' },
      { journal: '9999_wrong' },
      { startsAt: 'not-a-date', expiresAt: 'not-a-date' },
      {
        renewal: {
          count: 1,
          renewedAt: null,
          renewedBy: null,
        },
      },
    ]) {
      const authority = { verify: vi.fn().mockResolvedValue(true) };
      await expect(
        verifyProvisioningExecutionLease(
          createLease(override),
          authority,
          expectation,
          new Date('2026-07-30T01:00:00.000Z'),
        ),
      ).rejects.toBeInstanceOf(Error);
      expect(authority.verify).not.toHaveBeenCalled();
    }
  });

  it('拒绝非法当前时间及低敏引用中的 Secret／Token 标记', async () => {
    const authority = { verify: vi.fn().mockResolvedValue(true) };
    await expect(
      verifyProvisioningExecutionLease(
        createLease(),
        authority,
        expectation,
        new Date(Number.NaN),
      ),
    ).rejects.toThrow('lease_not_authorized');
    expect(authority.verify).not.toHaveBeenCalled();

    for (const override of [
      { holder: 'secret-token' },
      { operator: 'sk-proj-placeholder' },
      { targetEnvironment: 'DATABASE_URL' },
      { holder: '13800000000' },
      { operator: '110101199001010011' },
    ]) {
      expect(() =>
        parseProvisioningExecutionLease(createLease(override)),
      ).toThrow();
    }
  });

  it('拒绝倒置时间窗及窗口外 renewal', () => {
    expect(() =>
      parseProvisioningExecutionLease(
        createLease({
          startsAt: '2026-07-30T02:00:00.000Z',
          expiresAt: '2026-07-30T01:00:00.000Z',
        }),
      ),
    ).toThrow('lease_time_window_invalid');
    expect(() =>
      parseProvisioningExecutionLease(
        createLease({
          renewal: {
            count: 1,
            renewedAt: '2026-07-30T03:00:00.000Z',
            renewedBy: 'holder-ref-001',
          },
        }),
      ),
    ).toThrow('lease_renewal_time_invalid');
  });

  it('拒绝相对当前时间尚未发生的 renewal', async () => {
    const authority = { verify: vi.fn().mockResolvedValue(true) };
    await expect(
      verifyProvisioningExecutionLease(
        createLease({
          renewal: {
            count: 1,
            renewedAt: '2026-07-30T01:30:00.000Z',
            renewedBy: 'holder-ref-001',
          },
        }),
        authority,
        expectation,
        new Date('2026-07-30T01:00:00.000Z'),
      ),
    ).rejects.toThrow('lease_not_authorized');
    expect(authority.verify).not.toHaveBeenCalled();
  });
});
