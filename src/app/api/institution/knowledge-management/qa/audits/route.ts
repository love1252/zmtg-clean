import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

import { NextResponse } from 'next/server';

const capabilityDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_qa_audits_capability_disabled',
  error: '机构知识库问答审计暂未启用。',
});

function GET() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({
  sectionId: 'knowledge',
  handler: GET,
});

export { _base02B4GuardedGET as GET };
