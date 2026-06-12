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
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
} as const satisfies V1WorkspaceDashboardReadonlyAggregationPolicy;

const demoReadonlyInput = {
  businessLoopCandidates: [
    {
      sourceKey: 'business_closed_loop_readonly',
      label: '主业务闭环',
      lowSensitiveSummary: 'demo 主业务闭环只读摘要',
      readiness: 'ready',
      metricValue: '3 readonly signals',
      mockSeedDemoFlag: 'demo',
    },
    {
      sourceKey: 'management_readonly_config',
      label: '管理配置',
      lowSensitiveSummary: 'seed 管理配置只读摘要',
      readiness: 'blocked',
      metricValue: '1 blocked signal',
      mockSeedDemoFlag: 'seed',
    },
  ],
  managementConfigCandidates: [
    {
      scope: 'platform',
      configKey: 'platform-governance',
      label: '平台治理配置',
      lowSensitiveSummary: 'demo 平台配置摘要',
      readiness: 'ready',
      mockSeedDemoFlag: 'demo',
    },
    {
      scope: 'institution',
      configKey: 'institution-governance',
      label: '机构治理配置',
      lowSensitiveSummary: 'seed 机构配置摘要',
      readiness: 'blocked',
      mockSeedDemoFlag: 'seed',
    },
  ],
  knowledgeGovernanceInput: {
    knowledgeBaseCandidates: [
      {
        scope: 'platform_knowledge_base',
        knowledgeType: 'faq',
        title: '平台 FAQ',
        lowSensitiveSummary: 'demo 平台 FAQ 治理摘要',
        sourceLabel: '平台知识种子',
        visibilityScope: 'specified_institution:demo-inst-a',
        publishStatus: 'published',
        versionSummary: 'v1 stable',
        versionStatus: 'current',
        permissionStatus: 'visible',
        mockSeedDemoFlag: 'demo',
      },
      {
        scope: 'institution_knowledge_base',
        knowledgeType: 'institution_faq',
        title: '机构 FAQ',
        lowSensitiveSummary: 'seed 机构 FAQ 治理摘要',
        sourceLabel: '机构知识种子',
        visibilityScope: 'institution_private:demo-inst-a',
        publishStatus: 'draft',
        versionSummary: 'v2 review',
        versionStatus: 'reviewing',
        permissionStatus: 'restricted',
        mockSeedDemoFlag: 'seed',
      },
    ],
    auditCandidates: [
      {
        knowledgeBaseId: 'kb-demo-001',
        tenantId: 'demo-tenant-a',
        institutionId: 'demo-inst-a',
        workspaceId: 'demo-workspace-a',
        scope: 'institution_knowledge_base',
        knowledgeType: 'institution_faq',
        sourceType: 'seed_catalog',
        sourceLabel: '机构 FAQ 种子来源',
        reviewStatus: 'approved',
        publishStatus: 'published',
        visibilityScope: 'institution_private',
        lastReviewedAt: '2026-06-01',
        lastPublishedAt: '2026-06-02',
        lastRetiredAt: 'none',
        citationSourceSummary: 'seed faq reference',
        riskFlags: ['none'],
        mockSeedDemoFlag: 'seed',
      },
    ],
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
