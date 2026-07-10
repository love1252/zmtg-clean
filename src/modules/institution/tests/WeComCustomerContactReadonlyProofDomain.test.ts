import { describe, expect, it, vi } from 'vitest';
import {
  evaluateWeComCustomerContactReadonlyProof,
  maskWeComCustomerContactReadonlyProofConfig,
  summarizeWeComCustomerContactReadonlyProofConfig,
  weComCustomerContactReadonlyProofEnvKeys,
  weComCustomerContactReadonlyProofStatuses,
  type WeComCustomerContactReadonlyProofClient,
  type WeComCustomerContactReadonlyProofConfig,
} from '@/modules/institution/domain/wecom-customer-contact-readonly-proof';
import { readWeComCustomerContactReadonlyProofConfig } from '@/modules/institution/server/wecom-customer-contact-readonly-proof-runtime';

const baseConfig: WeComCustomerContactReadonlyProofConfig = {
  corpId: 'corp-local-proof-001',
  customerContactSecret: 'secret-local-proof-001',
  testEmployeeUserId: 'employee-local-proof-001',
  capabilityEnabled: true,
  permissionConfirmed: true,
  credentialPlaceholderReady: true,
  singleEmployeeSelected: true,
  networkEnabled: true,
  customerReadEnabled: true,
  realSendEnabled: false,
};

function clientWith(outcome: Awaited<ReturnType<WeComCustomerContactReadonlyProofClient['readSingleExternalContactOnce']>>) {
  return {
    readSingleExternalContactOnce: vi.fn().mockResolvedValue(outcome),
  } satisfies WeComCustomerContactReadonlyProofClient;
}

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(baseConfig.corpId);
  expect(text).not.toContain(baseConfig.customerContactSecret);
  expect(text).not.toContain(baseConfig.testEmployeeUserId);
  expect(text).not.toContain('external-user-local-proof-001');
  expect(text).not.toContain('access_token');
  expect(text).not.toContain('errmsg');
}

describe('wecom customer contact readonly proof domain', () => {
  it('公开完整低敏状态集合', () => {
    expect(weComCustomerContactReadonlyProofStatuses).toEqual(expect.arrayContaining([
      'blocked_missing_config',
      'blocked_static_precheck_not_ready',
      'blocked_real_network_disabled',
      'blocked_customer_read_disabled',
      'blocked_real_send_must_remain_disabled',
      'blocked_missing_confirmation',
      'blocked_no_external_contact',
      'blocked_external_contact_scope_not_single',
      'readonly_proof_completed',
      'readonly_proof_auth_failed',
      'readonly_proof_permission_failed',
      'readonly_proof_network_error',
      'readonly_proof_failed',
    ]));
  });

  it('只返回 masked configured 配置状态', () => {
    const masked = maskWeComCustomerContactReadonlyProofConfig(baseConfig);

    expect(masked).toEqual({
      corpId: { configured: true, maskedValue: '***configured***' },
      customerContactSecret: { configured: true, maskedValue: '***configured***' },
      testEmployeeUserId: { configured: true, maskedValue: '***configured***' },
    });
    expectNoSensitiveOutput(masked);
  });

  it('runtime 只读取十个白名单配置键', () => {
    const accessedKeys: string[] = [];
    const envValues: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ZMTG_WECOM_CORP_ID: baseConfig.corpId ?? undefined,
      ZMTG_WECOM_CUSTOMER_CONTACT_SECRET: baseConfig.customerContactSecret ?? undefined,
      ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID: baseConfig.testEmployeeUserId ?? undefined,
      ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED: 'true',
      ZMTG_WECOM_REAL_NETWORK_ENABLED: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED: 'true',
      ZMTG_WECOM_REAL_SEND_ENABLED: 'false',
      ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EXTERNAL_USER_ID: 'must-not-be-read',
    };
    const env = new Proxy(envValues, {
      get(target, property, receiver) {
        if (typeof property === 'string') accessedKeys.push(property);
        return Reflect.get(target, property, receiver);
      },
    });

    expect(readWeComCustomerContactReadonlyProofConfig(env)).toEqual(baseConfig);
    expect(accessedKeys).toEqual(weComCustomerContactReadonlyProofEnvKeys);
  });

  it('GET 摘要满足所有执行门禁时仍只表示未请求', () => {
    const summary = summarizeWeComCustomerContactReadonlyProofConfig(baseConfig);

    expect(summary).toMatchObject({
      configured: true,
      staticPrecheckReady: true,
      networkEnabled: true,
      customerReadEnabled: true,
      realSendEnabled: false,
      readonlyProofStatus: 'readonly_proof_not_requested',
      reason: 'readonly_proof_not_requested',
      proofAuthorized: false,
    });
    expect(summary.contact).toBeUndefined();
    expectNoSensitiveOutput(summary);
  });

  it.each([
    ['capability', { capabilityEnabled: false }, 'blocked_static_precheck_not_ready'],
    ['permission', { permissionConfirmed: false }, 'blocked_static_precheck_not_ready'],
    ['placeholder', { credentialPlaceholderReady: false }, 'blocked_static_precheck_not_ready'],
    ['single employee', { singleEmployeeSelected: false }, 'blocked_static_precheck_not_ready'],
    ['CorpID', { corpId: null }, 'blocked_missing_config'],
    ['Secret', { customerContactSecret: null }, 'blocked_missing_config'],
    ['UserID', { testEmployeeUserId: null }, 'blocked_missing_config'],
    ['network', { networkEnabled: false }, 'blocked_real_network_disabled'],
    ['customer read', { customerReadEnabled: false }, 'blocked_customer_read_disabled'],
    ['real send', { realSendEnabled: true }, 'blocked_real_send_must_remain_disabled'],
  ] as const)('%s 门禁失败时阻断且不调用 client', async (_name, override, expectedStatus) => {
    const client = clientWith({ ok: true, addedAt: null });

    const summary = await evaluateWeComCustomerContactReadonlyProof({
      config: { ...baseConfig, ...override },
      confirmed: true,
      client,
    });

    expect(summary.readonlyProofStatus).toBe(expectedStatus);
    expect(client.readSingleExternalContactOnce).not.toHaveBeenCalled();
    expectNoSensitiveOutput(summary);
  });

  it('confirmation 缺失时阻断且不调用 client', async () => {
    const client = clientWith({ ok: true, addedAt: null });

    const summary = await evaluateWeComCustomerContactReadonlyProof({
      config: baseConfig,
      confirmed: false,
      client,
    });

    expect(summary.readonlyProofStatus).toBe('blocked_missing_confirmation');
    expect(client.readSingleExternalContactOnce).not.toHaveBeenCalled();
  });

  it.each([
    ['no_external_contact', 'blocked_no_external_contact'],
    ['external_contact_scope_not_single', 'blocked_external_contact_scope_not_single'],
    ['auth_failed', 'readonly_proof_auth_failed'],
    ['permission_failed', 'readonly_proof_permission_failed'],
    ['network_error', 'readonly_proof_network_error'],
    ['failed', 'readonly_proof_failed'],
  ] as const)('%s client 结果映射为 %s', async (reason, expectedStatus) => {
    const client = clientWith({
      ok: false,
      reason,
      diagnostic: reason === 'auth_failed'
        ? { stage: 'gettoken', wecomErrcode: 40001 }
        : undefined,
    });

    const summary = await evaluateWeComCustomerContactReadonlyProof({
      config: baseConfig,
      confirmed: true,
      client,
    });

    expect(summary.readonlyProofStatus).toBe(expectedStatus);
    if (reason === 'auth_failed') {
      expect(summary.diagnostic).toEqual({ stage: 'gettoken', wecomErrcode: 40001 });
    }
    expectNoSensitiveOutput(summary);
  });

  it('成功时只形成固定低敏白名单结果且 proofAuthorized=false', async () => {
    const client = clientWith({ ok: true, addedAt: '2026-07-10T08:30:00.000Z' });

    const summary = await evaluateWeComCustomerContactReadonlyProof({
      config: baseConfig,
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      readonlyProofStatus: 'readonly_proof_completed',
      proofAuthorized: false,
      contact: {
        proofContactId: 'live-contact-proof-01',
        proofEmployeeId: 'live-employee-proof-01',
        customerType: 'external_contact',
        addedAt: '2026-07-10T08:30:00.000Z',
        relationshipStatus: 'visible',
        deletionStatus: 'active',
        mode: 'real_readonly_proof',
        fieldWhitelistApplied: true,
        singleReadExecuted: true,
        proofAuthorized: false,
      },
    });
    expect(Object.keys(summary.contact ?? {}).sort()).toEqual([
      'addedAt',
      'customerType',
      'deletionStatus',
      'fieldWhitelistApplied',
      'mode',
      'proofAuthorized',
      'proofContactId',
      'proofEmployeeId',
      'relationshipStatus',
      'singleReadExecuted',
    ].sort());
    expect(client.readSingleExternalContactOnce).toHaveBeenCalledWith({
      corpId: baseConfig.corpId,
      customerContactSecret: baseConfig.customerContactSecret,
      testEmployeeUserId: baseConfig.testEmployeeUserId,
    });
    expectNoSensitiveOutput(summary);
  });

  it('client 意外抛错时只返回低敏网络错误', async () => {
    const client: WeComCustomerContactReadonlyProofClient = {
      readSingleExternalContactOnce: vi.fn().mockRejectedValue(
        new Error(`${baseConfig.customerContactSecret}:${baseConfig.testEmployeeUserId}`),
      ),
    };

    const summary = await evaluateWeComCustomerContactReadonlyProof({
      config: baseConfig,
      confirmed: true,
      client,
    });

    expect(summary.readonlyProofStatus).toBe('readonly_proof_network_error');
    expect(summary.diagnostic).toBeUndefined();
    expectNoSensitiveOutput(summary);
  });
});
