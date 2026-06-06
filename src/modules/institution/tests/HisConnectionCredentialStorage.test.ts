import { describe, expect, it } from 'vitest';
import {
  createInMemoryHisConnectionCredentialProvider,
  createInMemoryHisConnectionCredentialStorage,
  type HisConnectionCredentialProvider,
} from '@/modules/institution/server/his-connection-credential-storage';

function expectNoSensitiveCredentialData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /sk_live|sk_test|token|secret|apiKey|api_key|connectionString|connection_string|password|privateKey|private_key|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i,
  );
}

describe('HIS 连接配置凭证 fake provider 最小边界', () => {
  it('暴露 test-only provider health，不声明真实 secret manager、真实 HIS 或测试连接能力', async () => {
    const provider: HisConnectionCredentialProvider =
      createInMemoryHisConnectionCredentialProvider();

    await expect(provider.health()).resolves.toEqual({
      status: 'available',
      provider: 'in_memory_test_only',
      mode: 'test_only',
      acceptsRealCredentialMaterial: false,
      storesRawCredentialMaterial: false,
      supportsTestConnection: false,
      connectedProvider: false,
      checkedAt: expect.any(String),
    });
  });

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

  it('describeCredentialReference 只返回安全 summary，不输出 credentialRef、scoped key 或 provider 内部路径', async () => {
    const provider = createInMemoryHisConnectionCredentialProvider();

    const stored = await provider.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_describe',
      idempotencyKey: 'idem_describe_001',
    });

    if (stored.status !== 'stored') {
      throw new Error('expected stored result');
    }

    const described = await provider.describeCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      credentialRef: stored.credentialRef,
    });

    expect(described).toEqual({
      status: 'found',
      summary: {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        credentialRefDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        provider: 'in_memory_test_only',
        storedAt: expect.any(String),
        revokedAt: null,
      },
    });
    expectNoSensitiveCredentialData(described);
    expect(JSON.stringify(described)).not.toContain(stored.credentialRef);
    expect(JSON.stringify(described)).not.toMatch(/demo-tenant-001:his_conn_001:idem_describe_001/);
    expect(JSON.stringify(described)).not.toMatch(/path|vault|kms|secretPath|externalSecret/i);
  });

  it('describeCredentialReference 不跨 tenant / connection 暴露 summary，且拒绝敏感引用形态', async () => {
    const provider = createInMemoryHisConnectionCredentialProvider();
    const stored = await provider.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_describe_scope',
      idempotencyKey: 'idem_describe_scope_001',
    });

    if (stored.status !== 'stored') {
      throw new Error('expected stored result');
    }

    await expect(
      provider.describeCredentialReference({
        tenantId: 'demo-tenant-002',
        connectionId: 'his_conn_001',
        credentialRef: stored.credentialRef,
      }),
    ).resolves.toEqual({ status: 'not_found' });
    await expect(
      provider.describeCredentialReference({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_002',
        credentialRef: stored.credentialRef,
      }),
    ).resolves.toEqual({ status: 'not_found' });
    await expect(
      provider.describeCredentialReference({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        credentialRef: 'sk_live_should_not_be_a_reference_secret',
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
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

  it('idempotencyKey 绑定 tenantId + connectionId，不跨租户或跨连接复用 credentialRef', async () => {
    const storage = createInMemoryHisConnectionCredentialStorage();
    const first = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_scope_first',
      idempotencyKey: 'idem_scope_shared',
    });
    const retry = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_scope_retry',
      idempotencyKey: 'idem_scope_shared',
    });
    const otherTenant = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-002',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_demo_scope_other_tenant',
      idempotencyKey: 'idem_scope_shared',
    });
    const otherConnection = await storage.storeSyntheticCredentialReference({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_002',
      placeholder: 'synthetic_placeholder_demo_scope_other_connection',
      idempotencyKey: 'idem_scope_shared',
    });

    expect(first.status).toBe('stored');
    expect(retry.status).toBe('stored');
    expect(otherTenant.status).toBe('stored');
    expect(otherConnection.status).toBe('stored');
    if (
      first.status !== 'stored' ||
      retry.status !== 'stored' ||
      otherTenant.status !== 'stored' ||
      otherConnection.status !== 'stored'
    ) {
      throw new Error('expected stored results');
    }

    expect(retry.credentialRef).toBe(first.credentialRef);
    expect(otherTenant.credentialRef).not.toBe(first.credentialRef);
    expect(otherConnection.credentialRef).not.toBe(first.credentialRef);
    expect(storage.listStoredCredentialMetadataForTests()).toHaveLength(3);
    expect(JSON.stringify(storage.listStoredCredentialMetadataForTests())).not.toMatch(
      /synthetic_placeholder_demo_scope|token|secret|apiKey|api_key|connectionString|connection_string|rawCredential|raw_credential|rawPayload|raw_payload/i,
    );
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
