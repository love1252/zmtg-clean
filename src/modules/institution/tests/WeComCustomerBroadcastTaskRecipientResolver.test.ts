import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  createFailClosedWeComCustomerBroadcastTaskRecipientResolver,
  createTestOnlyWeComCustomerBroadcastTaskRecipientResolver,
  createWeComCustomerBroadcastRecipientBindingRepository,
  createWeComCustomerBroadcastTaskRecipientResolver,
  type WeComCustomerBroadcastRecipientBindingMetadata,
  type WeComCustomerBroadcastRecipientResolutionInput,
} from '@/modules/institution/server/wecom-customer-broadcast-task-recipient-resolver';
import type { TenantDatabase } from '@/server/db/client';

const binding = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  customerId: 'customer-a',
  operationRef: 'operation-ref-a',
  mappingId: 'mapping-a',
  recipientBindingRef: 'binding-ref-a',
  recipientBindingDigest: 'a'.repeat(64),
  recipientBindingVersion: 1,
  opaqueHandleRef: 'opaque-handle-ref-a',
  sourceKind: 'protected_vault_reference',
  status: 'active',
} satisfies WeComCustomerBroadcastRecipientBindingMetadata;

const resolutionInput = {
  tenantId: binding.tenantId,
  institutionId: binding.institutionId,
  customerId: binding.customerId,
  operationRef: binding.operationRef,
  mappingId: binding.mappingId,
  recipientBindingRef: binding.recipientBindingRef,
  recipientBindingDigest: binding.recipientBindingDigest,
  recipientBindingVersion: binding.recipientBindingVersion,
} satisfies WeComCustomerBroadcastRecipientResolutionInput;

describe('WeCom customer broadcast task protected recipient resolver', () => {
  it('默认 resolver 固定 fail-closed', async () => {
    await expect(
      createFailClosedWeComCustomerBroadcastTaskRecipientResolver().resolve(
        resolutionInput,
      ),
    ).resolves.toEqual({
      kind: 'blocked',
      reasonCode: 'resolver_unavailable',
    });
  });

  it('test-only fake 只返回低敏 binding 与 opaque handle', async () => {
    const result = await createTestOnlyWeComCustomerBroadcastTaskRecipientResolver(
      binding,
    ).resolve(resolutionInput);

    expect(result).toEqual({
      kind: 'resolved',
      bindingRef: binding.recipientBindingRef,
      bindingDigest: binding.recipientBindingDigest,
      bindingVersion: binding.recipientBindingVersion,
      opaqueHandle: binding.opaqueHandleRef,
    });
    expect(Object.keys(result)).toEqual([
      'kind',
      'bindingRef',
      'bindingDigest',
      'bindingVersion',
      'opaqueHandle',
    ]);
  });

  it('digest mismatch 与 stale version 固定阻断', async () => {
    const resolver = createTestOnlyWeComCustomerBroadcastTaskRecipientResolver(binding);

    await expect(resolver.resolve({
      ...resolutionInput,
      recipientBindingDigest: 'b'.repeat(64),
    })).resolves.toEqual({
      kind: 'blocked',
      reasonCode: 'binding_digest_mismatch',
    });
    await expect(resolver.resolve({
      ...resolutionInput,
      recipientBindingVersion: 2,
    })).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_stale' });
  });

  it('tenant/institution/customer/operation/mapping scope mismatch 固定阻断', async () => {
    const resolver = createTestOnlyWeComCustomerBroadcastTaskRecipientResolver(binding);

    for (const input of [
      { ...resolutionInput, tenantId: 'tenant-b' },
      { ...resolutionInput, institutionId: 'institution-b' },
      { ...resolutionInput, customerId: 'customer-b' },
      { ...resolutionInput, operationRef: 'operation-ref-b' },
      { ...resolutionInput, mappingId: 'mapping-b' },
    ]) {
      await expect(resolver.resolve(input)).resolves.toEqual({
        kind: 'blocked',
        reasonCode: 'binding_scope_mismatch',
      });
    }
  });

  it('revoked、stale、ambiguous metadata 均 fail-closed', async () => {
    await expect(
      createTestOnlyWeComCustomerBroadcastTaskRecipientResolver({
        ...binding,
        status: 'revoked',
      }).resolve(resolutionInput),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_revoked' });
    await expect(
      createTestOnlyWeComCustomerBroadcastTaskRecipientResolver({
        ...binding,
        status: 'stale',
      }).resolve(resolutionInput),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_stale' });
    await expect(
      createTestOnlyWeComCustomerBroadcastTaskRecipientResolver({
        ...binding,
        status: 'unexpected',
      } as unknown as WeComCustomerBroadcastRecipientBindingMetadata).resolve(
        resolutionInput,
      ),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_stale' });

    const listByOperationScope = vi.fn().mockResolvedValue([binding, binding]);
    await expect(
      createWeComCustomerBroadcastTaskRecipientResolver({
        listByOperationScope,
      }).resolve(resolutionInput),
    ).resolves.toEqual({ kind: 'blocked', reasonCode: 'binding_ambiguous' });
    expect(listByOperationScope).toHaveBeenCalledWith({
      tenantId: resolutionInput.tenantId,
      institutionId: resolutionInput.institutionId,
      customerId: resolutionInput.customerId,
      operationRef: resolutionInput.operationRef,
      mappingId: resolutionInput.mappingId,
      recipientBindingRef: resolutionInput.recipientBindingRef,
    });
  });

  it('metadata repository 按完整 scope + bindingRef 查询并最多读取两行', async () => {
    const limit = vi.fn().mockResolvedValue([{
      ...binding,
      id: 'binding-id-a',
      operationId: 'operation-id-a',
      revokedAt: null,
      createdAt: new Date('2026-07-12T08:00:00.000Z'),
      updatedAt: new Date('2026-07-12T08:00:00.000Z'),
    }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const repository = createWeComCustomerBroadcastRecipientBindingRepository({
      select: vi.fn().mockReturnValue({ from }),
    } as unknown as TenantDatabase);

    await expect(repository.listByOperationScope({
      tenantId: binding.tenantId,
      institutionId: binding.institutionId,
      customerId: binding.customerId,
      operationRef: binding.operationRef,
      mappingId: binding.mappingId,
      recipientBindingRef: binding.recipientBindingRef,
    })).resolves.toEqual([binding]);
    expect(limit).toHaveBeenCalledWith(2);
  });

  it('repository 失败不泄露异常并固定 resolver_unavailable', async () => {
    const resolver = createWeComCustomerBroadcastTaskRecipientResolver({
      listByOperationScope: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });
    await expect(resolver.resolve(resolutionInput)).resolves.toEqual({
      kind: 'blocked',
      reasonCode: 'resolver_unavailable',
    });
  });

  it('resolver 源码不读取环境、网络或受保护原文', () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../server/wecom-customer-broadcast-task-recipient-resolver.ts',
      ),
      'utf8',
    );

    expect(source).not.toMatch(
      /\bfetch\s*\(|process\.env|https?:\/\/|external_userid|\bUserID\b|access_token|rawResponse|rawMsgid|providerUrl|phone|employeeId|recipientValue/iu,
    );
  });
});
