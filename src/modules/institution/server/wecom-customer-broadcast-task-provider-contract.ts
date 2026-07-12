import type {
  WeComCustomerBroadcastTaskCapability,
  WeComCustomerBroadcastTaskProviderInput,
  WeComCustomerBroadcastTaskProviderOutput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';

/**
 * 仅定义未来 adapter 必须满足的边界；05B-B1 不提供任何实现。
 */
export interface WeComCustomerBroadcastTaskProviderContract {
  readonly capability: WeComCustomerBroadcastTaskCapability;
  createTask(
    input: WeComCustomerBroadcastTaskProviderInput,
  ): Promise<WeComCustomerBroadcastTaskProviderOutput>;
}

export type ProtectedWeComCustomerBroadcastTaskRecipientResolutionInput = Readonly<{
  tenantId: string;
  institutionId: string;
  operationRef: string;
  recipientBindingRef: string;
  recipientBindingDigest: string;
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
