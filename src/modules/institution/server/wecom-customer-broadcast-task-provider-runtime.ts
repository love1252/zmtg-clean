import type {
  WeComCustomerBroadcastTaskProviderInput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';

export const weComCustomerBroadcastTaskRuntimeResultKinds = [
  'task_created',
  'rejected',
  'timeout',
  'transport_error',
  'indeterminate',
  'provider_disabled',
] as const;

export type WeComCustomerBroadcastTaskRuntimeResultKind =
  (typeof weComCustomerBroadcastTaskRuntimeResultKinds)[number];

/**
 * 真实 adapter 的结果只允许携带不可逆任务摘要；原始 provider 标识和响应
 * 永远不能穿过该边界。
 */
export type WeComCustomerBroadcastTaskRuntimeOutput =
  | Readonly<{ kind: 'task_created'; taskRefDigest: string }>
  | Readonly<{ kind: 'rejected' | 'timeout' | 'transport_error' | 'indeterminate' }>
  | Readonly<{ kind: 'provider_disabled' }>;

export type WeComCustomerBroadcastTaskOpaqueRecipientResolution =
  | Readonly<{ kind: 'resolved'; opaqueHandle: string }>
  | Readonly<{ kind: 'blocked' }>;

export interface WeComCustomerBroadcastTaskRuntimeRecipientResolver {
  resolve(
    input: WeComCustomerBroadcastTaskProviderInput,
  ): Promise<WeComCustomerBroadcastTaskOpaqueRecipientResolution>;
}

/** tokenProvider 只传递不透明 lease，runtime 不读取或保存任何凭证。 */
export interface WeComCustomerBroadcastTaskRuntimeTokenProvider {
  acquire(): Promise<Readonly<{ kind: 'available'; leaseId: string }> | Readonly<{ kind: 'unavailable' }>>;
}

export type WeComCustomerBroadcastTaskInjectedRequest = Readonly<{
  input: WeComCustomerBroadcastTaskProviderInput;
  opaqueRecipientHandle: string;
  tokenLeaseId: string;
}>;

export interface WeComCustomerBroadcastTaskInjectedExecutor {
  execute(
    input: WeComCustomerBroadcastTaskInjectedRequest,
  ): Promise<WeComCustomerBroadcastTaskRuntimeOutput>;
}

export type WeComCustomerBroadcastTaskRuntimeDependencies = Readonly<{
  /** 仅作为未来 explicit adapter 的依赖标记；此模块不调用它。 */
  fetcher: unknown;
  tokenProvider: WeComCustomerBroadcastTaskRuntimeTokenProvider;
  recipientResolver: WeComCustomerBroadcastTaskRuntimeRecipientResolver;
  executor: WeComCustomerBroadcastTaskInjectedExecutor;
}>;

export interface WeComCustomerBroadcastTaskRuntimeAdapter {
  readonly adapterKind: 'fail_closed' | 'explicitly_injected';
  createTask(
    input: WeComCustomerBroadcastTaskProviderInput,
  ): Promise<WeComCustomerBroadcastTaskRuntimeOutput>;
}

function safeRuntimeOutput(
  output: WeComCustomerBroadcastTaskRuntimeOutput,
): WeComCustomerBroadcastTaskRuntimeOutput {
  if (output.kind !== 'task_created') return output;
  return /^[0-9a-f]{64}$/u.test(output.taskRefDigest)
    ? Object.freeze({ kind: 'task_created' as const, taskRefDigest: output.taskRefDigest })
    : Object.freeze({ kind: 'indeterminate' as const });
}

/** 默认 adapter 永远关闭，不读取环境、凭证，也不执行网络请求。 */
export function createFailClosedWeComCustomerBroadcastTaskRuntimeAdapter():
  WeComCustomerBroadcastTaskRuntimeAdapter {
  return Object.freeze({
    adapterKind: 'fail_closed' as const,
    createTask: async () => Object.freeze({ kind: 'provider_disabled' as const }),
  });
}

/**
 * 真正执行必须由未来独立授权的调用方显式注入 fetcher、tokenProvider、recipient
 * resolver 和 executor。此处不拥有网络、凭证或原始 provider 数据。
 */
export function createExplicitlyInjectedWeComCustomerBroadcastTaskRuntimeAdapter(
  dependencies: WeComCustomerBroadcastTaskRuntimeDependencies,
): WeComCustomerBroadcastTaskRuntimeAdapter {
  return Object.freeze({
    adapterKind: 'explicitly_injected' as const,
    createTask: async (input: WeComCustomerBroadcastTaskProviderInput) => {
      const [token, recipient] = await Promise.all([
        dependencies.tokenProvider.acquire(),
        dependencies.recipientResolver.resolve(input),
      ]);
      if (token.kind !== 'available' || recipient.kind !== 'resolved') {
        return Object.freeze({ kind: 'provider_disabled' as const });
      }
      try {
        return safeRuntimeOutput(await dependencies.executor.execute({
          input,
          opaqueRecipientHandle: recipient.opaqueHandle,
          tokenLeaseId: token.leaseId,
        }));
      } catch {
        return Object.freeze({ kind: 'indeterminate' as const });
      }
    },
  });
}
