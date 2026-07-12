import {
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
  WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
  type WeComCustomerBroadcastTaskMockProviderOutput,
  type WeComCustomerBroadcastTaskProviderInput,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import {
  evaluateWeComRealSendProofPermission,
  type WeComRealSendProofFailureCode,
  type WeComRealSendProofStatus,
} from '@/modules/institution/domain/wecom-real-send-proof';
import type { WeComRealSendProofRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import type { WeComCustomerBroadcastTaskMockProviderContract } from '@/modules/institution/server/wecom-customer-broadcast-task-provider-contract';
import {
  issueRealSendProofOperation,
  type WeComRealSendProofEnvironment,
} from '@/modules/institution/server/wecom-real-send-proof-service';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';

export type WeComBroadcastTaskShellReasonCode =
  | WeComRealSendProofFailureCode
  | 'confirmation_available'
  | 'confirmation_issued'
  | 'confirmation_already_issued'
  | 'proof_environment_unavailable'
  | 'provider_disabled';

export type WeComBroadcastTaskPreflight = Readonly<{
  status: 'ready' | 'blocked';
  proofKind: typeof WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND;
  directSend: false;
  requiresEmployeeConfirmation: true;
  reasonCode: WeComBroadcastTaskShellReasonCode;
  operationStatus?: WeComRealSendProofStatus;
}>;

export type WeComRealSendProofPreflightEvaluator = (input: Readonly<{
  context: AccessContext;
  draftId: string;
  repository: WeComRealSendProofRepository;
  environment: WeComRealSendProofEnvironment;
  occurredAt: string;
}>) => Promise<
  | Readonly<{ kind: 'ready'; operationStatus?: WeComRealSendProofStatus }>
  | Readonly<{
      kind: 'blocked';
      reason: WeComRealSendProofFailureCode;
      operationStatus?: WeComRealSendProofStatus;
    }>
>;

type ProofDependencies = Readonly<{
  proofRepository?: WeComRealSendProofRepository;
  proofEnvironment?: WeComRealSendProofEnvironment;
}>;

type IssueRealSendProofOperation = typeof issueRealSendProofOperation;

type MockBroadcastTaskClassificationBase = Readonly<{
  mockOnly: true;
  operationTransition: 'none';
  completedCountDelta: 0;
  automaticRetryAllowed: false;
}>;

export type WeComBroadcastTaskMockExecutionOutcome =
  | (MockBroadcastTaskClassificationBase & Readonly<{
      kind: typeof WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND;
      providerResultKind: 'accepted';
      acceptanceKind: 'task_created';
      requiresEmployeeConfirmation: true;
    }>)
  | (MockBroadcastTaskClassificationBase & Readonly<{
      kind: 'mock_rejected';
      providerResultKind: 'rejected';
    }>)
  | (MockBroadcastTaskClassificationBase & Readonly<{
      kind: 'mock_unknown_outcome';
      providerResultKind: 'timeout' | 'transport_error' | 'indeterminate';
    }>);

function preflight(input: {
  status: 'ready' | 'blocked';
  reasonCode: WeComBroadcastTaskShellReasonCode;
  operationStatus?: WeComRealSendProofStatus;
}): WeComBroadcastTaskPreflight {
  return {
    status: input.status,
    proofKind: WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY.capabilityKind,
    directSend: WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY.directSend,
    requiresEmployeeConfirmation:
      WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY.requiresEmployeeConfirmation,
    reasonCode: input.reasonCode,
    ...(input.operationStatus ? { operationStatus: input.operationStatus } : {}),
  };
}

function executionPermissionFailure(context: AccessContext): WeComRealSendProofFailureCode | null {
  const proofPermission = evaluateWeComRealSendProofPermission(context);
  if (!proofPermission.allowed) return proofPermission.reason;

  const access = canAccessResource({
    context,
    resource: 'real_channel',
    action: 'execute_once',
    targetTenantId: context.tenantId,
  });
  return access.allowed ? null : 'execute_once_permission_required';
}

/**
 * 只读 preflight 壳。05B-B1 没有可信 proof environment source 时默认关闭，
 * 且绝不通过签发 confirmation token 来“探测” readiness。
 */
export async function evaluateBroadcastTaskPreflight(input: Readonly<{
  context: AccessContext;
  draftId: string;
  occurredAt: string;
  proofPreflightEvaluator?: WeComRealSendProofPreflightEvaluator;
}> & ProofDependencies): Promise<WeComBroadcastTaskPreflight> {
  const permissionFailure = executionPermissionFailure(input.context);
  if (permissionFailure) {
    return preflight({ status: 'blocked', reasonCode: permissionFailure });
  }
  if (
    !input.proofPreflightEvaluator ||
    !input.proofRepository ||
    !input.proofEnvironment
  ) {
    return preflight({ status: 'blocked', reasonCode: 'proof_environment_unavailable' });
  }

  const evaluation = await input.proofPreflightEvaluator({
    context: input.context,
    draftId: input.draftId,
    repository: input.proofRepository,
    environment: input.proofEnvironment,
    occurredAt: input.occurredAt,
  });
  return evaluation.kind === 'ready'
    ? preflight({
        status: 'ready',
        reasonCode: 'confirmation_available',
        ...(evaluation.operationStatus
          ? { operationStatus: evaluation.operationStatus }
          : {}),
      })
    : preflight({
        status: 'blocked',
        reasonCode: evaluation.reason,
        ...(evaluation.operationStatus
          ? { operationStatus: evaluation.operationStatus }
          : {}),
      });
}

/**
 * 委托 0036 proof foundation 签发一次性 confirmation。缺少明确注入的
 * repository/environment 时 fail-closed，不读取环境变量或数据库身份。
 */
export async function issueBroadcastTaskConfirmation(input: Readonly<{
  context: AccessContext;
  draftId: string;
  occurredAt: string;
  createId: () => string;
  issueProofOperation?: IssueRealSendProofOperation;
}> & ProofDependencies): Promise<
  | Readonly<{
      kind: 'issued';
      operationRef: string;
      confirmationToken: string;
      expiresAt: string;
      idempotent: false;
    }>
  | Readonly<{
      kind: 'existing';
      operationRef: string;
      operationStatus: WeComRealSendProofStatus;
      idempotent: true;
    }>
  | Readonly<{ kind: 'blocked'; reasonCode: WeComBroadcastTaskShellReasonCode }>
> {
  const permissionFailure = executionPermissionFailure(input.context);
  if (permissionFailure) return { kind: 'blocked', reasonCode: permissionFailure };
  if (!input.proofRepository || !input.proofEnvironment) {
    return { kind: 'blocked', reasonCode: 'proof_environment_unavailable' };
  }

  const result = await (input.issueProofOperation ?? issueRealSendProofOperation)({
    context: input.context,
    draftId: input.draftId,
    repository: input.proofRepository,
    environment: input.proofEnvironment,
    occurredAt: input.occurredAt,
    createId: input.createId,
  });
  if (result.kind === 'failed') return { kind: 'blocked', reasonCode: result.reason };
  if (result.kind === 'existing') {
    return {
      kind: 'existing',
      operationRef: result.operationRef,
      operationStatus: result.status as WeComRealSendProofStatus,
      idempotent: true,
    };
  }
  return result;
}

/**
 * 05B-B1 没有 provider implementation。该纯函数故意不接收 confirmation token，
 * 因而不能消费 token、进入 attempted 或调用 provider。
 */
export function rejectBroadcastTaskExecutionBecauseProviderDisabled(input: Readonly<{
  operationRef: string;
}>) {
  return {
    kind: 'blocked' as const,
    operationRef: input.operationRef,
    reasonCode: 'provider_disabled' as const,
  };
}

const MOCK_CLASSIFICATION_BASE = Object.freeze({
  mockOnly: true as const,
  operationTransition: 'none' as const,
  completedCountDelta: 0 as const,
  automaticRetryAllowed: false as const,
});

/**
 * 只把显式注入的 mock output 分类为不可持久化的测试结果。
 * task_created_mock 不代表真实任务创建、客户送达或 proof success。
 */
export function evaluateMockBroadcastTaskProviderOutcome(
  output: WeComCustomerBroadcastTaskMockProviderOutput,
): WeComBroadcastTaskMockExecutionOutcome {
  switch (output.kind) {
    case 'accepted':
      return Object.freeze({
        ...MOCK_CLASSIFICATION_BASE,
        kind: WE_COM_CUSTOMER_BROADCAST_TASK_MOCK_RESULT_KIND,
        providerResultKind: output.kind,
        acceptanceKind: output.acceptanceKind,
        requiresEmployeeConfirmation: output.requiresEmployeeConfirmation,
      });
    case 'rejected':
      return Object.freeze({
        ...MOCK_CLASSIFICATION_BASE,
        kind: 'mock_rejected' as const,
        providerResultKind: output.kind,
      });
    case 'timeout':
    case 'transport_error':
    case 'indeterminate':
      return Object.freeze({
        ...MOCK_CLASSIFICATION_BASE,
        kind: 'mock_unknown_outcome' as const,
        providerResultKind: output.kind,
      });
  }
}

/**
 * 05B-B2 test/service-only 注入点。入参刻意不包含 confirmation token、
 * proof repository、environment 或 finalizer，因此不能进入 attempted、
 * succeeded 或 completedCount 写链路。运行时 API 不得调用此函数。
 */
export async function executeMockBroadcastTaskForTestOnly(input: Readonly<{
  mockProvider: WeComCustomerBroadcastTaskMockProviderContract;
  providerInput: WeComCustomerBroadcastTaskProviderInput;
}>): Promise<WeComBroadcastTaskMockExecutionOutcome> {
  const output = await input.mockProvider.createTask(input.providerInput);
  return evaluateMockBroadcastTaskProviderOutcome(output);
}
