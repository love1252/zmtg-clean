import { describe, expect, it } from 'vitest';
import { createInMemoryHisConnectionCredentialStorage } from '@/modules/institution/server/his-connection-credential-storage';

function expectNoSensitiveCredentialData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /sk_live|sk_test|token|secret|apiKey|api_key|connectionString|connection_string|password|privateKey|private_key|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i,
  );
}

describe('HIS 连接配置凭证 fake storage 最小边界', () => {
  it('只接受合成 placeholder，返回安全 credentialRef，不保存或输出明文', async () => {
    const storage = createInMemoryHisConnectionCredentialStorage();

    const result = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_his_reference',
      idempotencyKey: 'idem_demo_001',
    });

    expect(result).toMatchObject({
      status: 'stored',
      credentialRef: expect.stringMatching(/^cred_ref_[a-zA-Z0-9_-]{12,}$/),
      provider: 'in_memory_test_only',
      storedAt: expect.any(String),
    });
    expect(storage.listStoredCredentialMetadataForTests()).toEqual([
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        credentialRefDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        provider: 'in_memory_test_only',
        storedAt: expect.any(String),
        revokedAt: null,
      },
    ]);
    expectNoSensitiveCredentialData(result);
    expectNoSensitiveCredentialData(storage.listStoredCredentialMetadataForTests());
    expect(JSON.stringify(storage.listStoredCredentialMetadataForTests())).not.toContain(
      'synthetic_placeholder_demo_his_reference',
    );
  });

  it('同一 idempotencyKey 重试返回同一安全引用，且不生成明文副本', async () => {
    const storage = createInMemoryHisConnectionCredentialStorage();

    const first = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_retry',
      idempotencyKey: 'idem_retry_001',
    });
    const second = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_retry',
      idempotencyKey: 'idem_retry_001',
    });

    expect(first.status).toBe('stored');
    expect(second.status).toBe('stored');
    if (first.status !== 'stored' || second.status !== 'stored') {
      throw new Error('expected stored result');
    }
    expect(second.credentialRef).toBe(first.credentialRef);
    expect(storage.listStoredCredentialMetadataForTests()).toHaveLength(1);
    expectNoSensitiveCredentialData([first, second, storage.listStoredCredentialMetadataForTests()]);
  });

  it('拒绝 raw credential、token、secret、API key、连接串或外部路径形态输入', async () => {
    const storage = createInMemoryHisConnectionCredentialStorage();

    const result = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'sk_test_should_not_be_saved_secret',
      idempotencyKey: 'idem_forbidden_001',
    });

    expect(result).toEqual({ status: 'validation_failed' });
    expect(storage.listStoredCredentialMetadataForTests()).toEqual([]);
  });

  it('revoke 只标记安全引用失效，不输出明文、完整路径或 raw payload', async () => {
    const storage = createInMemoryHisConnectionCredentialStorage();
    const stored = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_revoke',
      idempotencyKey: 'idem_revoke_001',
    });

    if (stored.status !== 'stored') {
      throw new Error('expected stored result');
    }

    const revoked = await storage.revokeCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      credentialRef: stored.credentialRef,
    });

    expect(revoked).toEqual({
      status: 'revoked',
      revokedAt: expect.any(String),
    });
    expect(storage.listStoredCredentialMetadataForTests()).toEqual([
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        credentialRefDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        provider: 'in_memory_test_only',
        storedAt: expect.any(String),
        revokedAt: expect.any(String),
      },
    ]);
    expectNoSensitiveCredentialData([revoked, storage.listStoredCredentialMetadataForTests()]);
  });
});
