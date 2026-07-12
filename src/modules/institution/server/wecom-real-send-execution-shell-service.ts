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
import type {
  WeComCustomerBroadcastTaskOutcomeRepository,
  WeComCustomerBroadcastTaskOutcomeScope,
} from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-repository';
import {
  persistWeComCustomerBroadcastTaskOutcomeAction,
} from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-service';
import type {
  WeComCustomerBroadcastTaskRuntimeAdapter,
  WeComCustomerBroadcastTaskRuntimeOutput,
} from '@/modules/institution/server/wecom-customer-broadcast-task-provider-runtime';
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

type FunctionalExecutionBase = Readonly<{
  completedCountDelta: 0;
  automaticRetryAllowed: false;
}>;

export type WeComBroadcastTaskFunctionalExecutionOutcome =
  | (FunctionalExecutionBase & Readonly<{
      kind: 'task_created';
      sendResultStatus: 'awaiting_member_confirmation';
    }>)
  | (FunctionalExecutionBase & Readonly<{
      kind: 'task_create_failed';
    }>)
  | (FunctionalExecutionBase & Readonly<{
      kind: 'manual_review_required';
      providerResultKind: 'timeout' | 'transport_error' | 'indeterminate' | 'provider_disabled';
    }>)
  | (FunctionalExecutionBase & Readonly<{
      kind: 'blocked';
      reasonCode: 'provider_disabled' | 'outcome_unavailable';
    }>);

const FUNCTIONAL_EXECUTION_BASE = Object.freeze({
  completedCountDelta: 0 as const,
  automaticRetryAllowed: false as const,
});

function outcomeUnavailable(): WeComBroadcastTaskFunctionalExecutionOutcome {
  return Object.freeze({
    ...FUNCTIONAL_EXECUTION_BASE,
    kind: 'blocked' as const,
    reasonCode: 'outcome_unavailable' as const,
  });
}

async function persistFunctionalOutcome(input: Readonly<{
  repository: WeComCustomerBroadcastTaskOutcomeRepository;
  scope: WeComCustomerBroadcastTaskOutcomeScope;
  action:
    | { action: 'record_task_create_attempted'; occurredAt: string }
    | { action: 'record_task_created'; occurredAt: string; taskRefDigest: string }
    | { action: 'record_awaiting_member_confirmation'; occurredAt: string }
    | { action: 'record_task_create_failed'; occurredAt: string }
    | {
        action: 'record_task_create_unknown';
        occurredAt: string;
        providerResultCategory: 'timeout' | 'transport_error' | 'indeterminate';
      };
}>) {
  return persistWeComCustomerBroadcastTaskOutcomeAction(input);
}

/**
 * 受控任务创建执行服务只在显式注入 adapter 时可运行。它只推进 0037 outcome
 * sidecar 到 task_created / awaiting_member_confirmation 或人工复核；不触发
 * proof 成功终态和 completedCount。
 */
export async function executeInjectedBroadcastTaskForControlledWorkflow(input: Readonly<{
  runtimeAdapter: WeComCustomerBroadcastTaskRuntimeAdapter;
  outcomeRepository: WeComCustomerBroadcastTaskOutcomeRepository;
  outcomeScope: WeComCustomerBroadcastTaskOutcomeScope;
  providerInput: WeComCustomerBroadcastTaskProviderInput;
  occurredAt: string;
}>): Promise<WeComBroadcastTaskFunctionalExecutionOutcome> {
  if (input.runtimeAdapter.adapterKind !== 'explicitly_injected') {
    return Object.freeze({
      ...FUNCTIONAL_EXECUTION_BASE,
      kind: 'blocked' as const,
      reasonCode: 'provider_disabled' as const,
    });
  }

  const started = await persistFunctionalOutcome({
    repository: input.outcomeRepository,
    scope: input.outcomeScope,
    action: { action: 'record_task_create_attempted', occurredAt: input.occurredAt },
  });
  if (started.kind !== 'recorded') return outcomeUnavailable();

  const providerOutput = await input.runtimeAdapter.createTask(input.providerInput);
  return persistFunctionalProviderOutput({
    repository: input.outcomeRepository,
    scope: input.outcomeScope,
    occurredAt: input.occurredAt,
    providerOutput,
  });
}

async function persistFunctionalProviderOutput(input: Readonly<{
  repository: WeComCustomerBroadcastTaskOutcomeRepository;
  scope: WeComCustomerBroadcastTaskOutcomeScope;
  occurredAt: string;
  providerOutput: WeComCustomerBroadcastTaskRuntimeOutput;
}>): Promise<WeComBroadcastTaskFunctionalExecutionOutcome> {
  switch (input.providerOutput.kind) {
    case 'task_created': {
      const created = await persistFunctionalOutcome({
        repository: input.repository,
        scope: input.scope,
        action: {
          action: 'record_task_created',
          occurredAt: input.occurredAt,
          taskRefDigest: input.providerOutput.taskRefDigest,
        },
      });
      if (created.kind !== 'recorded') return outcomeUnavailable();
      const awaiting = await persistFunctionalOutcome({
        repository: input.repository,
        scope: input.scope,
        action: { action: 'record_awaiting_member_confirmation', occurredAt: input.occurredAt },
      });
      return awaiting.kind === 'recorded'
        ? Object.freeze({
            ...FUNCTIONAL_EXECUTION_BASE,
            kind: 'task_created' as const,
            sendResultStatus: 'awaiting_member_confirmation' as const,
          })
        : outcomeUnavailable();
    }
    case 'rejected': {
      const failed = await persistFunctionalOutcome({
        repository: input.repository,
        scope: input.scope,
        action: { action: 'record_task_create_failed', occurredAt: input.occurredAt },
      });
      return failed.kind === 'recorded'
        ? Object.freeze({ ...FUNCTIONAL_EXECUTION_BASE, kind: 'task_create_failed' as const })
        : outcomeUnavailable();
    }
    case 'timeout':
    case 'transport_error':
    case 'indeterminate':
    case 'provider_disabled': {
      const category = input.providerOutput.kind === 'provider_disabled'
        ? 'indeterminate' as const
        : input.providerOutput.kind;
      const unknown = await persistFunctionalOutcome({
        repository: input.repository,
        scope: input.scope,
        action: {
          action: 'record_task_create_unknown',
          occurredAt: input.occurredAt,
          providerResultCategory: category,
        },
      });
      return unknown.kind === 'recorded'
        ? Object.freeze({
            ...FUNCTIONAL_EXECUTION_BASE,
            kind: 'manual_review_required' as const,
            providerResultKind: input.providerOutput.kind,
          })
        : outcomeUnavailable();
    }
  }
}
