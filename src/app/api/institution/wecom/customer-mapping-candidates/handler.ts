import { NextResponse } from 'next/server';

import {
  readWeComCustomerMappingCandidateReference,
  readWeComCustomerMappingCandidates,
} from '@/modules/institution/server/wecom-customer-mapping-candidates-reader';
import {
  createWeComCustomerMappingCandidatesFailClosedRawView,
  parseWeComCustomerMappingCandidatesReadonlyResponse,
  parseWeComCustomerMappingCandidatesResponse,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';
import type {
  WeComCustomerMappingReviewSnapshotReader,
} from '@/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

type HandlerDependencies = Readonly<{
  snapshotReader: WeComCustomerMappingReviewSnapshotReader;
  getAccessContext?: (request: Request) => AccessContext | null;
}>;

export function createWeComCustomerMappingCandidatesGetHandler(
  dependencies: HandlerDependencies,
) {
  const snapshotReader = dependencies.snapshotReader;
  const getAccessContext = dependencies.getAccessContext ?? getDemoAccessContextFromRequest;

  return async function get(request: Request) {
    const context = getAccessContext(request);
    if (!context) {
      return NextResponse.json({ error: '请先登录' }, {
        status: 401,
        headers: noStoreHeaders,
      });
    }

    const decision = canAccessResource({
      context,
      resource: 'customer',
      action: 'read',
      targetTenantId: context.tenantId,
    });
    if (
      !decision.allowed
      || context.scope !== 'tenant'
      || !context.tenantId
      || !context.institutionId
    ) {
      return NextResponse.json({ error: '没有访问权限' }, {
        status: 403,
        headers: noStoreHeaders,
      });
    }

    let responseBody;
    try {
      const candidateReference = readWeComCustomerMappingCandidateReference(
        context.tenantId,
      );
      const reviewSnapshot = candidateReference === null
        ? null
        : snapshotReader.readMappingSnapshot({
            tenantId: context.tenantId,
            institutionId: context.institutionId,
            candidateReference,
          });
      const candidateView = readWeComCustomerMappingCandidates(
        context.tenantId,
        reviewSnapshot,
      );
      responseBody = parseWeComCustomerMappingCandidatesReadonlyResponse(
        candidateView,
      );
    } catch {
      responseBody = null;
    }

    responseBody ??= parseWeComCustomerMappingCandidatesResponse(
      createWeComCustomerMappingCandidatesFailClosedRawView({
        tenantId: context.tenantId,
        reason: 'response_contract_invalid',
      }),
      context.tenantId,
    );

    return NextResponse.json(responseBody, { headers: noStoreHeaders });
  };
}
