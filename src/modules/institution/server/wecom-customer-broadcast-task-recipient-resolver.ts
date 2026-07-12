import { and, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerBroadcastRecipientBindings } from '@/server/db/schema';

export const weComCustomerBroadcastRecipientBindingSourceKinds = [
  'protected_vault_reference',
  'protected_resolver_reference',
] as const;

export const weComCustomerBroadcastRecipientBindingStatuses = [
  'active',
  'revoked',
  'stale',
] as const;

export type WeComCustomerBroadcastRecipientBindingMetadata = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
  operationRef: string;
  mappingId: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
  recipientBindingVersion: number;
  opaqueHandleRef: string;
  sourceKind: (typeof weComCustomerBroadcastRecipientBindingSourceKinds)[number];
  status: (typeof weComCustomerBroadcastRecipientBindingStatuses)[number];
}>;

export type WeComCustomerBroadcastRecipientResolutionInput = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
  operationRef: string;
  mappingId: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
  recipientBindingVersion: number;
}>;

export type WeComCustomerBroadcastRecipientResolution =
  | Readonly<{
      kind: 'resolved';
      bindingRef: string;
      bindingDigest: string;
      bindingVersion: number;
      opaqueHandle: string;
    }>
  | Readonly<{
      kind: 'blocked';
      reasonCode:
        | 'resolver_unavailable'
        | 'binding_missing'
        | 'binding_ambiguous'
        | 'binding_scope_mismatch'
        | 'binding_digest_mismatch'
        | 'binding_stale'
        | 'binding_revoked';
    }>;

export interface WeComCustomerBroadcastRecipientBindingRepository {
  listByOperationScope(input: Readonly<{
    tenantId: string;
    institutionId: string;
    customerId: string;
    operationRef: string;
    mappingId: string;
    recipientBindingRef: string;
  }>): Promise<readonly WeComCustomerBroadcastRecipientBindingMetadata[]>;
}

export function createWeComCustomerBroadcastRecipientBindingRepository(
  database: TenantDatabase,
): WeComCustomerBroadcastRecipientBindingRepository {
  return {
    async listByOperationScope(input) {
      const rows = await database
        .select()
        .from(weComCustomerBroadcastRecipientBindings)
        .where(and(
          eq(weComCustomerBroadcastRecipientBindings.tenantId, input.tenantId),
          eq(
            weComCustomerBroadcastRecipientBindings.institutionId,
            input.institutionId,
          ),
          eq(
            weComCustomerBroadcastRecipientBindings.operationRef,
            input.operationRef,
          ),
          eq(
            weComCustomerBroadcastRecipientBindings.customerId,
            input.customerId,
          ),
          eq(
            weComCustomerBroadcastRecipientBindings.mappingId,
            input.mappingId,
          ),
          eq(
            weComCustomerBroadcastRecipientBindings.recipientBindingRef,
            input.recipientBindingRef,
          ),
        ))
        .limit(2);
      return rows.map((row) => ({
        tenantId: row.tenantId,
        institutionId: row.institutionId,
        customerId: row.customerId,
        operationRef: row.operationRef,
        mappingId: row.mappingId,
        recipientBindingRef: row.recipientBindingRef,
        recipientBindingDigest: row.recipientBindingDigest,
        recipientBindingVersion: row.recipientBindingVersion,
        opaqueHandleRef: row.opaqueHandleRef,
        sourceKind: row.sourceKind,
        status: row.status,
      }));
    },
  };
}

export interface WeComCustomerBroadcastTaskRecipientResolver {
  resolve(
    input: WeComCustomerBroadcastRecipientResolutionInput,
  ): Promise<WeComCustomerBroadcastRecipientResolution>;
}

const blocked = (
  reasonCode: Extract<WeComCustomerBroadcastRecipientResolution, { kind: 'blocked' }>['reasonCode'],
): WeComCustomerBroadcastRecipientResolution => ({ kind: 'blocked', reasonCode });

/** 缺少明确注入的低敏 metadata repository 时固定失败关闭。 */
export function createFailClosedWeComCustomerBroadcastTaskRecipientResolver():
  WeComCustomerBroadcastTaskRecipientResolver {
  return Object.freeze({
    resolve: async () => blocked('resolver_unavailable'),
  });
}

/**
 * 解析过程只校验低敏 scope、reference、digest 与 version；输出 opaque handle，
 * 不展开或记录受保护目标值。
 */
export function createWeComCustomerBroadcastTaskRecipientResolver(
  repository: WeComCustomerBroadcastRecipientBindingRepository,
): WeComCustomerBroadcastTaskRecipientResolver {
  return Object.freeze({
    resolve: async (input: WeComCustomerBroadcastRecipientResolutionInput) => {
      let bindings: readonly WeComCustomerBroadcastRecipientBindingMetadata[];
      try {
        bindings = await repository.listByOperationScope({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          operationRef: input.operationRef,
          mappingId: input.mappingId,
          recipientBindingRef: input.recipientBindingRef,
        });
      } catch {
        return blocked('resolver_unavailable');
      }

      if (bindings.length === 0) return blocked('binding_missing');
      if (bindings.length !== 1) return blocked('binding_ambiguous');
      const binding = bindings[0];
      if (
        !binding ||
        binding.tenantId !== input.tenantId ||
        binding.institutionId !== input.institutionId ||
        binding.customerId !== input.customerId ||
        binding.operationRef !== input.operationRef ||
        binding.mappingId !== input.mappingId
      ) {
        return blocked('binding_scope_mismatch');
      }
      if (binding.status === 'revoked') return blocked('binding_revoked');
      if (binding.status !== 'active') return blocked('binding_stale');
      if (
        binding.recipientBindingRef.trim().length === 0 ||
        input.recipientBindingRef.trim().length === 0 ||
        binding.recipientBindingRef !== input.recipientBindingRef
      ) {
        return blocked('binding_missing');
      }
      if (
        !/^[0-9a-f]{64}$/u.test(binding.recipientBindingDigest) ||
        !/^[0-9a-f]{64}$/u.test(input.recipientBindingDigest) ||
        binding.recipientBindingDigest !== input.recipientBindingDigest
      ) {
        return blocked('binding_digest_mismatch');
      }
      if (
        !Number.isInteger(binding.recipientBindingVersion) ||
        binding.recipientBindingVersion <= 0 ||
        !Number.isInteger(input.recipientBindingVersion) ||
        input.recipientBindingVersion <= 0 ||
        binding.recipientBindingVersion !== input.recipientBindingVersion
      ) {
        return blocked('binding_stale');
      }
      if (binding.opaqueHandleRef.trim().length === 0) {
        return blocked('resolver_unavailable');
      }

      return Object.freeze({
        kind: 'resolved' as const,
        bindingRef: binding.recipientBindingRef,
        bindingDigest: binding.recipientBindingDigest,
        bindingVersion: binding.recipientBindingVersion,
        opaqueHandle: binding.opaqueHandleRef,
      });
    },
  });
}

/** 仅供纯本地测试显式注入单条低敏 metadata。 */
export function createTestOnlyWeComCustomerBroadcastTaskRecipientResolver(
  binding: WeComCustomerBroadcastRecipientBindingMetadata,
): WeComCustomerBroadcastTaskRecipientResolver {
  const frozenBinding = Object.freeze({ ...binding });
  return createWeComCustomerBroadcastTaskRecipientResolver({
    listByOperationScope: async () => [frozenBinding],
  });
}
