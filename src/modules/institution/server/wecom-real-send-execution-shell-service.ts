import {
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import {
  evaluateWeComRealSendProofPermission,
  type WeComRealSendProofFailureCode,
  type WeComRealSendProofStatus,
} from '@/modules/institution/domain/wecom-real-send-proof';
import type { WeComRealSendProofRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
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
