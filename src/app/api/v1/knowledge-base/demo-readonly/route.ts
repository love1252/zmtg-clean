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
  viewerScope: 'institution',
} as const satisfies V1KnowledgeBaseDemoReadonlyFacadePolicy;

const demoReadonlyInput = {
  sources: [],
} as const satisfies V1KnowledgeBaseDemoReadonlyFacadeInput;

export function GET(_request: Request) {
  const facade = buildV1KnowledgeBaseDemoReadonlyFacade(demoReadonlyInput, demoReadonlyPolicy);
  const response = buildV1KnowledgeBaseDemoReadonlyApiContractResponse({
    requestId: 'demo-readonly-api-route-request',
    facade,
  });

  return NextResponse.json(response, { status: 200 });
}
