import { describe, expect, it } from 'vitest';
import {
  createHisConnectionCredentialCompensationSummary,
  createHisConnectionCredentialProviderFailure,
  hisConnectionCredentialCompensationStates,
  hisConnectionCredentialProviderFailureCategories,
  isHisConnectionCredentialProviderFailure,
  mapHisConnectionCredentialProviderFailureToServiceStatus,
  mapUnknownHisConnectionCredentialProviderFailure,
} from '@/modules/institution/server/his-connection-credential-provider-failure';

const expectedFailureCategories = [
  'provider_unavailable',
  'timeout',
  'retry_exhausted',
  'circuit_open',
  'validation_failed',
  'tenant_connection_mismatch',
  'idempotency_conflict',
  'invalid_state',
  'provider_write_failed',
  'provider_revoke_failed',
  'provider_describe_failed',
  'provider_health_failed',
  'repository_after_provider_failed',
  'audit_after_provider_failed',
] as const;

const forbiddenSensitivePattern =
  /cred_ref_|credentialRef|credential_ref|idempotencyKey|idem_|synthetic_placeholder|providerPath|secretPath|\/vault|kms|sk_live|sk_test|token|secret|apiKey|api_key|connectionString|connection_string|password|privateKey|private_key|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function expectNoSensitiveFailureData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenSensitivePattern);
}

describe('HIS 连接配置凭证 provider failure / compensation domain 最小边界', () => {
  it('provider failure category 是白名单枚举', () => {
    expect(hisConnectionCredentialProviderFailureCategories).toEqual(expectedFailureCategories);
  });

  it('provider failure payload 只保留安全分类和安全摘要，不包含原始错误或凭证材料', () => {
    const failure = createHisConnectionCredentialProviderFailure({
      category: 'provider_unavailable',
      operation: 'store',
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      provider: 'in_memory_test_only',
      retryCount: 2,
      unsafeMessage:
        'credentialRef=cred_ref_demo_secret idempotencyKey=idem_demo sk_live token DATABASE_URL=postgres://demo stack /vault/his/path',
    });

    expect(failure).toEqual({
      kind: 'his_connection_credential_provider_failure',
      category: 'provider_unavailable',
      operation: 'store',
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      provider: 'in_memory_test_only',
      retryable: true,
      failClosed: true,
      retryCount: 2,
    });
    expect(isHisConnectionCredentialProviderFailure(failure)).toBe(true);
    expectNoSensitiveFailureData(failure);
  });

  it('unknown thrown error 映射为 safe provider failure，不暴露 stack / SQL / DATABASE_URL', () => {
    const failure = mapUnknownHisConnectionCredentialProviderFailure(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost select * from stack'),
      {
        operation: 'store',
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
      },
    );

    expect(failure).toMatchObject({
      kind: 'his_connection_credential_provider_failure',
      category: 'provider_write_failed',
      operation: 'store',
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      retryable: false,
      failClosed: true,
    });
    expectNoSensitiveFailureData(failure);
  });

  it('compensation state 是白名单枚举，summary 绑定 tenantId + connectionId 且不暴露内部 key', () => {
    expect(hisConnectionCredentialCompensationStates).toEqual([
      'compensation_pending',
      'compensation_running',
      'compensation_succeeded',
      'compensation_failed',
      'manual_review_required',
    ]);

    const summary = createHisConnectionCredentialCompensationSummary({
      state: 'manual_review_required',
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operation: 'revoke',
      failureCategory: 'provider_revoke_failed',
      provider: 'in_memory_test_only',
      retryCount: 3,
      manualReviewNote:
        'credentialRef=cred_ref_demo_secret providerPath=/vault/his/secret secret stack',
    });

    expect(summary).toEqual({
      kind: 'his_connection_credential_compensation_summary',
      state: 'manual_review_required',
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      operation: 'revoke',
      failureCategory: 'provider_revoke_failed',
      provider: 'in_memory_test_only',
      retryCount: 3,
    });
    expectNoSensitiveFailureData(summary);
  });

  it('provider failure 到 service result 的映射只使用现有稳定 code', () => {
    const cases = [
      ['provider_unavailable', 'service_unavailable'],
      ['timeout', 'service_unavailable'],
      ['retry_exhausted', 'service_unavailable'],
      ['circuit_open', 'service_unavailable'],
      ['validation_failed', 'validation_failed'],
      ['tenant_connection_mismatch', 'service_unavailable'],
      ['idempotency_conflict', 'service_unavailable'],
      ['invalid_state', 'invalid_state_transition'],
      ['provider_write_failed', 'service_unavailable'],
      ['provider_revoke_failed', 'service_unavailable'],
      ['provider_describe_failed', 'service_unavailable'],
      ['provider_health_failed', 'service_unavailable'],
      ['repository_after_provider_failed', 'service_unavailable'],
      ['audit_after_provider_failed', 'service_unavailable'],
    ] as const;

    for (const [category, expectedStatus] of cases) {
      const failure = createHisConnectionCredentialProviderFailure({
        category,
        operation: 'store',
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
      });

      expect(mapHisConnectionCredentialProviderFailureToServiceStatus(failure)).toBe(
        expectedStatus,
      );
      expectNoSensitiveFailureData(failure);
    }
  });
});
