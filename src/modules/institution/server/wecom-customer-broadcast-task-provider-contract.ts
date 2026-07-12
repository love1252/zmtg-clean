import type {
  WeComCustomerBroadcastTaskCapability,
  WeComCustomerBroadcastTaskProviderInput,
  WeComCustomerBroadcastTaskMockProviderOutput,
  WeComCustomerBroadcastTaskProviderOutput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';

/** Provider adapter 的低敏边界；运行时必须显式注入具体实现。 */
export interface WeComCustomerBroadcastTaskProviderContract {
  readonly capability: WeComCustomerBroadcastTaskCapability;
  createTask(
    input: WeComCustomerBroadcastTaskProviderInput,
  ): Promise<WeComCustomerBroadcastTaskProviderOutput>;
}

export interface WeComCustomerBroadcastTaskMockProviderContract
  extends WeComCustomerBroadcastTaskProviderContract {
  readonly providerKind: 'mock';
  createTask(
    input: WeComCustomerBroadcastTaskProviderInput,
  ): Promise<WeComCustomerBroadcastTaskMockProviderOutput>;
}

export type ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput = Readonly<{
  tenantId: string;
  institutionId: string;
  operationRef: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
  recipientBindingVersion: string;
}>;

export type ProtectedWeComCustomerBroadcastTaskRecipientResolution =
  | Readonly<{
      kind: 'resolved';
      recipientBindingRef: string;
      recipientBindingDigest: string;
      recipientBindingVersion: string;
    }>
  | Readonly<{
      kind: 'blocked';
      reasonCode:
        | 'binding_missing'
        | 'binding_scope_mismatch'
        | 'binding_digest_mismatch'
        | 'binding_stale';
    }>;

/**
 * 受保护解析器只确认 scope 与绑定版本，不把真实接收目标暴露给执行壳。
 */
export interface ProtectedWeComCustomerBroadcastTaskRecipientResolverContract {
  resolve(
    input: ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput,
  ): Promise<ProtectedWeComCustomerBroadcastTaskRecipientResolution>;
}

export interface ProtectedWeComCustomerBroadcastTaskRecipientResolverMockContract
  extends ProtectedWeComCustomerBroadcastTaskRecipientResolverContract {
  readonly resolverKind: 'mock';
}
