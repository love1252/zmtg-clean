import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import {
  buildFollowUpOperationsDashboard,
  getFollowUpDraftOperationsSummary as buildDraftOperationsSummary,
  getFollowUpOperationsOverview as buildOperationsOverview,
  getFollowUpPathPerformance as buildPathPerformance,
  getFollowUpRiskSummary as buildRiskSummary,
  getFollowUpTaskWorkload as buildTaskWorkload,
  type FollowUpDraftOperationsSummary,
  type FollowUpOperationsDashboard,
  type FollowUpOperationsOverview,
  type FollowUpOperationsSnapshot,
  type FollowUpPathPerformanceItem,
  type FollowUpRiskSummary,
  type FollowUpTaskWorkloadItem,
} from '@/modules/institution/domain/followup-operations-dashboard';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';

export type FollowUpOperationsForbiddenReason =
  | 'missing_tenant'
  | 'cross_tenant_denied'
  | 'role_denied'
  | 'sensitive_detail_denied';

export type GetFollowUpOperationsDashboardResult =
  | { kind: 'success'; dashboard: FollowUpOperationsDashboard }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

export type GetFollowUpOperationsOverviewResult =
  | { kind: 'success'; overview: FollowUpOperationsOverview }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

export type GetFollowUpPathPerformanceResult =
  | { kind: 'success'; pathPerformance: FollowUpPathPerformanceItem[] }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

export type GetFollowUpTaskWorkloadResult =
  | { kind: 'success'; workload: FollowUpTaskWorkloadItem[] }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

export type GetFollowUpDraftOperationsSummaryResult =
  | { kind: 'success'; draftOperations: FollowUpDraftOperationsSummary }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

export type GetFollowUpRiskSummaryResult =
  | { kind: 'success'; riskSummary: FollowUpRiskSummary }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason };

type OperationsRepository = Pick<TenantBusinessRepository, 'listFollowUpOperationsSnapshot'>;

function canReadFollowUpOperations(context: AccessContext) {
  return canAccessResource({
    context,
    resource: 'follow_up',
    action: 'read_own_tenant',
    targetTenantId: context.tenantId,
  });
}

function hasTenant(context: AccessContext): context is AccessContext & { tenantId: string } {
  return Boolean(context.tenantId);
}

async function readSnapshot(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
}): Promise<
  | { kind: 'success'; snapshot: FollowUpOperationsSnapshot }
  | { kind: 'forbidden'; reason: FollowUpOperationsForbiddenReason }
> {
  const decision = canReadFollowUpOperations(input.context);
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const snapshot = await input.tenantBusinessRepository.listFollowUpOperationsSnapshot({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
  });

  return { kind: 'success', snapshot };
}

export async function getFollowUpOperationsDashboard(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
  now?: Date;
}): Promise<GetFollowUpOperationsDashboardResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    dashboard: buildFollowUpOperationsDashboard({
      snapshot: snapshotResult.snapshot,
      now: input.now ?? new Date(),
    }),
  };
}

export async function getFollowUpOperationsOverview(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
  now?: Date;
}): Promise<GetFollowUpOperationsOverviewResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    overview: buildOperationsOverview({
      snapshot: snapshotResult.snapshot,
      now: input.now ?? new Date(),
    }),
  };
}

export async function getFollowUpPathPerformance(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
  now?: Date;
}): Promise<GetFollowUpPathPerformanceResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    pathPerformance: buildPathPerformance({
      snapshot: snapshotResult.snapshot,
      now: input.now ?? new Date(),
    }),
  };
}

export async function getFollowUpTaskWorkload(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
  now?: Date;
}): Promise<GetFollowUpTaskWorkloadResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    workload: buildTaskWorkload({
      snapshot: snapshotResult.snapshot,
      now: input.now ?? new Date(),
    }),
  };
}

export async function getFollowUpDraftOperationsSummary(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
}): Promise<GetFollowUpDraftOperationsSummaryResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    draftOperations: buildDraftOperationsSummary(snapshotResult.snapshot),
  };
}

export async function getFollowUpRiskSummary(input: {
  context: AccessContext;
  tenantBusinessRepository: OperationsRepository;
  now?: Date;
}): Promise<GetFollowUpRiskSummaryResult> {
  const snapshotResult = await readSnapshot(input);
  if (snapshotResult.kind !== 'success') return snapshotResult;

  return {
    kind: 'success',
    riskSummary: buildRiskSummary({
      snapshot: snapshotResult.snapshot,
      now: input.now ?? new Date(),
    }),
  };
}
