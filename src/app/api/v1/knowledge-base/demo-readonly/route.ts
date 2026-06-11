import { NextResponse } from 'next/server';
import {
  buildV1KnowledgeBaseDemoReadonlyApiContractResponse,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract';
import {
  buildV1KnowledgeBaseDemoReadonlyFacade,
  type V1KnowledgeBaseDemoReadonlyFacadeInput,
  type V1KnowledgeBaseDemoReadonlyFacadePolicy,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-facade';

const demoReadonlyPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseDemoReadonlyFacade: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  viewerScope: 'institution',
  viewerInstitutionScopeCode: 'demo-inst-a',
} as const satisfies V1KnowledgeBaseDemoReadonlyFacadePolicy;

const demoReadonlyInput = {
  sources: [
    {
      tenantId: 'demo-tenant-a',
      institutionId: 'platform',
      workspaceId: 'demo-workspace-a',
      knowledgeBaseId: 'kb-platform-demo',
      knowledgeItemId: 'item-platform-published',
      knowledgeBaseType: 'platform',
      knowledgeType: 'faq',
      sourceType: 'demo_reference',
      sourceLabel: '平台 FAQ demo 来源',
      catalogPath: ['平台知识库', 'FAQ'],
      publishStatus: 'published',
      reviewStatus: 'approved',
      version: 'v1',
      visibilityScope: 'specified_institution:demo-inst-a',
      lastReviewedAt: '2026-06-01',
      lastPublishedAt: '2026-06-02',
      lastRetiredAt: 'none',
      citationSourceSummary: 'demo faq reference',
      riskFlags: ['none'],
      mockSeedDemoFlag: 'demo',
    },
    {
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      knowledgeBaseId: 'kb-institution-demo',
      knowledgeItemId: 'item-institution-draft',
      knowledgeBaseType: 'institution',
      knowledgeType: 'institution_faq',
      sourceType: 'seed_catalog',
      sourceLabel: '机构 FAQ seed 来源',
      catalogPath: ['机构知识库', 'FAQ'],
      publishStatus: 'draft',
      reviewStatus: 'pending',
      version: 'v2-review',
      visibilityScope: 'institution_private:demo-inst-a',
      lastReviewedAt: '2026-06-03',
      lastPublishedAt: 'none',
      lastRetiredAt: 'none',
      citationSourceSummary: 'seed faq reference',
      riskFlags: ['review_pending'],
      mockSeedDemoFlag: 'seed',
    },
  ],
} as const satisfies V1KnowledgeBaseDemoReadonlyFacadeInput;

export function GET(_request: Request) {
  const facade = buildV1KnowledgeBaseDemoReadonlyFacade(demoReadonlyInput, demoReadonlyPolicy);
  const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
    requestId: 'demo-readonly-api-route-request',
    facade,
  });

  return NextResponse.json(response, { status: 200 });
}
