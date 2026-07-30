import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeProvisioningManifestDigest,
  PROVISIONING_MANIFEST_VERSION,
  type ProvisioningCanonicalManifestV1,
} from '../provisioning-canonicalization';
import {
  createProvisioningContextPolicyV1,
  getLocalAcceptanceProvisioningContextPolicy,
  LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY,
  PROVISIONING_CONTEXT_POLICY_CURRENCIES,
  PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
  PROVISIONING_CONTEXT_POLICY_TIMEZONES,
  PROVISIONING_CONTEXT_POLICY_VERSION,
  ProvisioningContextPolicyError,
} from '../provisioning-context-policy';
import { parseProvisioningManifest } from '../provisioning-manifest';

function createPolicy(overrides: Record<string, unknown> = {}) {
  return {
    policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
    targetEnvironment: PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
    timezones: [...PROVISIONING_CONTEXT_POLICY_TIMEZONES],
    currencies: [...PROVISIONING_CONTEXT_POLICY_CURRENCIES],
    ...overrides,
  };
}

function createManifest(
  timezone = 'Asia/Shanghai',
  currency = 'CNY',
): Record<string, unknown> {
  const draft: ProvisioningCanonicalManifestV1 = {
    manifestVersion: PROVISIONING_MANIFEST_VERSION,
    approvalStatus: 'approved',
    approvedByReference: 'approval-ref-synthetic',
    approvedAt: '2026-07-30T00:00:00.000Z',
    entries: [
      {
        tenantId: 'tenant-synthetic',
        institutionId: 'institution-synthetic',
        scopeStatus: 'active',
        scopeRevision: 1,
        provisioningSource: 'approved_migration_manifest',
        contextVersion: 1,
        contextHeadRevision: 1,
        latestVersion: 1,
        contextSource: 'institution_config',
        timezone,
        currency,
        effectiveFromBusinessDate: '2026-07-30',
        effectiveAt: '2026-07-30T00:00:00.000Z',
      },
    ],
  };
  return {
    ...draft,
    digest: computeProvisioningManifestDigest(draft).external,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MIG-01A2 本地验收 Context Policy', () => {
  it('冻结精确 Policy version 与目标环境', () => {
    expect(PROVISIONING_CONTEXT_POLICY_VERSION).toBe(
      'mig01-a2-local-acceptance-context-policy/v1',
    );
    expect(PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT).toBe(
      'local_acceptance',
    );
    expect(LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY).toMatchObject({
      policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
      targetEnvironment: PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
    });
  });

  it('只允许 Asia/Shanghai 与 CNY', () => {
    expect(PROVISIONING_CONTEXT_POLICY_TIMEZONES).toEqual([
      'Asia/Shanghai',
    ]);
    expect(PROVISIONING_CONTEXT_POLICY_CURRENCIES).toEqual(['CNY']);
    expect(LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY.timezones).toEqual([
      'Asia/Shanghai',
    ]);
    expect(LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY.currencies).toEqual([
      'CNY',
    ]);
  });

  it('冻结 Policy 对象及两个批准数组', () => {
    expect(
      Object.isFrozen(LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY),
    ).toBe(true);
    expect(
      Object.isFrozen(
        LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY.timezones,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY.currencies,
      ),
    ).toBe(true);
  });

  it('安全 getter 只返回已验证且冻结的 Policy', () => {
    const policy = getLocalAcceptanceProvisioningContextPolicy();

    expect(policy).toBe(LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY);
    expect(Object.isFrozen(policy)).toBe(true);
  });

  it('拒绝重复 timezone', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({
          timezones: ['Asia/Shanghai', 'Asia/Shanghai'],
        }),
      ),
    ).toThrow('provisioning_context_policy_timezone_invalid');
  });

  it('拒绝重复 currency', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ currencies: ['CNY', 'CNY'] }),
      ),
    ).toThrow('provisioning_context_policy_currency_invalid');
  });

  it('拒绝未注册 timezone', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ timezones: ['Invalid/Timezone'] }),
      ),
    ).toThrow('provisioning_context_policy_timezone_invalid');
  });

  it('拒绝未注册 currency', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ currencies: ['ZZZ'] }),
      ),
    ).toThrow('provisioning_context_policy_currency_invalid');
  });

  it.each(['UTC', 'Asia/Tokyo', 'Asia/Hong_Kong'])(
    '拒绝未批准 timezone %s',
    (timezone) => {
      expect(() =>
        createProvisioningContextPolicyV1(
          createPolicy({ timezones: [timezone] }),
        ),
      ).toThrow('provisioning_context_policy_timezone_invalid');
    },
  );

  it.each(['USD', 'JPY', 'HKD'])(
    '拒绝未批准 currency %s',
    (currency) => {
      expect(() =>
        createProvisioningContextPolicyV1(
          createPolicy({ currencies: [currency] }),
        ),
      ).toThrow('provisioning_context_policy_currency_invalid');
    },
  );

  it('拒绝未知目标环境', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ targetEnvironment: 'production' }),
      ),
    ).toThrow('provisioning_context_policy_environment_invalid');
  });

  it('拒绝未知版本、缺失字段及额外字段', () => {
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ policyVersion: 'policy/v2' }),
      ),
    ).toThrow('provisioning_context_policy_invalid');
    expect(() =>
      createProvisioningContextPolicyV1({
        policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
      }),
    ).toThrow('provisioning_context_policy_invalid');
    expect(() =>
      createProvisioningContextPolicyV1(
        createPolicy({ unexpected: true }),
      ),
    ).toThrow('provisioning_context_policy_invalid');
  });

  it('不从系统时区或 process.env 扩大批准集合', () => {
    vi.stubEnv('TZ', 'UTC');
    vi.stubEnv('ZMTG_CONTEXT_TIMEZONE', 'Asia/Tokyo');
    vi.stubEnv('ZMTG_CONTEXT_CURRENCY', 'USD');

    const policy = createProvisioningContextPolicyV1(createPolicy());

    expect(policy.timezones).toEqual(['Asia/Shanghai']);
    expect(policy.currencies).toEqual(['CNY']);
  });

  it('将批准 Policy 传给 Manifest Parser 时接受合成上海／人民币条目', () => {
    expect(() =>
      parseProvisioningManifest(createManifest(), {
        contextPolicy: getLocalAcceptanceProvisioningContextPolicy(),
      }),
    ).not.toThrow();
  });

  it.each([
    ['UTC', 'CNY', 'manifest_timezone_not_approved'],
    ['Asia/Tokyo', 'CNY', 'manifest_timezone_not_approved'],
    ['Asia/Shanghai', 'USD', 'manifest_currency_not_approved'],
    ['Asia/Shanghai', 'JPY', 'manifest_currency_not_approved'],
  ])(
    'Manifest Parser 对未批准组合 %s/%s 保持 fail-closed',
    (timezone, currency, code) => {
      expect(() =>
        parseProvisioningManifest(createManifest(timezone, currency), {
          contextPolicy: getLocalAcceptanceProvisioningContextPolicy(),
        }),
      ).toThrow(code);
    },
  );

  it('无效策略只暴露固定低敏错误码', () => {
    try {
      createProvisioningContextPolicyV1(
        createPolicy({ timezones: ['not-a-timezone'] }),
      );
      throw new Error('expected policy validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ProvisioningContextPolicyError);
      expect(error).toMatchObject({
        code: 'provisioning_context_policy_timezone_invalid',
        message: 'provisioning_context_policy_timezone_invalid',
      });
      expect(String(error)).not.toContain('not-a-timezone');
    }
  });
});
