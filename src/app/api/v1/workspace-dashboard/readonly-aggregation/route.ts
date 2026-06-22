import { NextResponse } from 'next/server';
import { buildV1WorkspaceDashboardReadonlyAggregationApiContractResponse } from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-api-contract';
import {
  buildV1WorkspaceDashboardReadonlyAggregationSummary,
  type V1WorkspaceDashboardReadonlyAggregationInput,
  type V1WorkspaceDashboardReadonlyAggregationPolicy,
} from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-aggregation-view-models';

const demoReadonlyPolicy = {
  featureEnabled: true,
  canReadWorkspaceDashboardAggregation: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
} as const satisfies V1WorkspaceDashboardReadonlyAggregationPolicy;

const demoReadonlyInput = {
  businessLoopCandidates: [],
  managementConfigCandidates: [],
  knowledgeGovernanceInput: {
    knowledgeBaseCandidates: [],
    auditCandidates: [],
  },
} as const satisfies V1WorkspaceDashboardReadonlyAggregationInput;

export function GET(_request: Request) {
  const aggregation = buildV1WorkspaceDashboardReadonlyAggregationSummary(
    demoReadonlyInput,
    demoReadonlyPolicy,
  );
  const response = buildV1WorkspaceDashboardReadonlyAggregationApiContractResponse({
    requestId: 'workspace-dashboard-readonly-aggregation-route-request',
    aggregation,
  });

  return NextResponse.json(response, { status: 200 });
}
