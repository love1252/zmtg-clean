import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_retrieval_capability_disabled',
  message: '机构知识库检索暂未启用。',
});

const noStoreHeaders = { 'Cache-Control': 'no-store' } as const;

async function GET(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'knowledge',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
