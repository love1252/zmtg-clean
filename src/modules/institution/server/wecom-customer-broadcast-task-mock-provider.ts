import {
  WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
  type WeComCustomerBroadcastTaskMockProviderOutput,
  type WeComCustomerBroadcastTaskProviderInput,
  type WeComCustomerBroadcastTaskProviderResultKind,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import type {
  ProtectedWeComCustomerBroadcastTaskRecipientResolution,
  ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput,
  ProtectedWeComCustomerBroadcastTaskRecipientResolverMockContract,
  WeComCustomerBroadcastTaskMockProviderContract,
} from '@/modules/institution/server/wecom-customer-broadcast-task-provider-contract';

function createMockOutput(
  resultKind: WeComCustomerBroadcastTaskProviderResultKind,
): WeComCustomerBroadcastTaskMockProviderOutput {
  switch (resultKind) {
    case 'accepted':
      return Object.freeze({
        kind: 'accepted',
        acceptanceKind: WE_COM_CUSTOMER_BROADCAST_TASK_ACCEPTANCE_KIND,
        mockResultKind: WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
        requiresEmployeeConfirmation: true,
      });
    case 'rejected':
      return Object.freeze({ kind: 'rejected' });
    case 'timeout':
      return Object.freeze({ kind: 'timeout' });
    case 'transport_error':
      return Object.freeze({ kind: 'transport_error' });
    case 'indeterminate':
      return Object.freeze({ kind: 'indeterminate' });
  }
}

/** 只由测试或显式 service 注入使用的确定性 adapter。 */
export function createWeComCustomerBroadcastTaskMockProvider(
  resultKind: WeComCustomerBroadcastTaskProviderResultKind,
): WeComCustomerBroadcastTaskMockProviderContract {
  return Object.freeze({
    providerKind: 'mock' as const,
    capability: WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
    createTask: async (_input: WeComCustomerBroadcastTaskProviderInput) =>
      createMockOutput(resultKind),
  });
}

export type ProtectedWeComCustomerBroadcastTaskRecipientMockBinding =
  ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput;

/** 仅比较低敏 binding scope、摘要与版本，不展开绑定内容。 */
export function createProtectedWeComCustomerBroadcastTaskRecipientResolverMock(
  binding: ProtectedWeComCustomerBroadcastTaskRecipientMockBinding,
): ProtectedWeComCustomerBroadcastTaskRecipientResolverMockContract {
  const expected = Object.freeze({ ...binding });

  return Object.freeze({
    resolverKind: 'mock' as const,
    resolve: async (
      input: ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput,
    ): Promise<ProtectedWeComCustomerBroadcastTaskRecipientResolution> => {
      if (
        input.tenantId !== expected.tenantId ||
        input.institutionId !== expected.institutionId ||
        input.operationRef !== expected.operationRef
      ) {
        return Object.freeze({
          kind: 'blocked' as const,
          reasonCode: 'binding_scope_mismatch' as const,
        });
      }
      if (input.recipientBindingRef !== expected.recipientBindingRef) {
        return Object.freeze({
          kind: 'blocked' as const,
          reasonCode: 'binding_missing' as const,
        });
      }
      if (input.recipientBindingDigest !== expected.recipientBindingDigest) {
        return Object.freeze({
          kind: 'blocked' as const,
          reasonCode: 'binding_digest_mismatch' as const,
        });
      }
      if (input.recipientBindingVersion !== expected.recipientBindingVersion) {
        return Object.freeze({
          kind: 'blocked' as const,
          reasonCode: 'binding_stale' as const,
        });
      }

      return Object.freeze({
        kind: 'resolved' as const,
        recipientBindingRef: expected.recipientBindingRef,
        recipientBindingDigest: expected.recipientBindingDigest,
        recipientBindingVersion: expected.recipientBindingVersion,
      });
    },
  });
}
