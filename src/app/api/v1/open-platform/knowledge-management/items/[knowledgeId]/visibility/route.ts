import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  bindPlatformKnowledgeInstitutionVisibilityService,
  unbindPlatformKnowledgeInstitutionVisibilityService,
} from '@/modules/open-platform/server/platform-knowledge-management-service';
import { buildReadonlyApiError } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

type VisibilityRouteContext = {
  params: Promise<{ knowledgeId: string }> | { knowledgeId: string };
};

async function readRouteParams(context: VisibilityRouteContext) {
  return Promise.resolve(context.params);
}

async function readVisibilityInput(request: Request, context: VisibilityRouteContext) {
  const params = await readRouteParams(context);
  const body = await request.json().catch(() => ({}));

  return {
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : '',
    knowledgeId: params.knowledgeId,
    institutionId: typeof body.institutionId === 'string' ? body.institutionId : '',
  };
}

function hasVisibilityInputScope(input: Awaited<ReturnType<typeof readVisibilityInput>>) {
  return (
    input.tenantId.trim().length > 0 &&
    input.knowledgeId.trim().length > 0 &&
    input.institutionId.trim().length > 0
  );
}

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'not_found') return 404;

  return 200;
}

export async function POST(request: Request, context: VisibilityRouteContext) {
  try {
    const input = await readVisibilityInput(request, context);
    if (!hasVisibilityInputScope(input)) {
      return NextResponse.json({ status: 'validation_failed' }, { status: 400 });
    }

    const result = await bindPlatformKnowledgeInstitutionVisibilityService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input,
    });

    return NextResponse.json(result, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库可见范围暂时无法更新'),
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: VisibilityRouteContext) {
  try {
    const input = await readVisibilityInput(request, context);
    if (!hasVisibilityInputScope(input)) {
      return NextResponse.json({ status: 'validation_failed' }, { status: 400 });
    }

    const result = await unbindPlatformKnowledgeInstitutionVisibilityService({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      input,
    });

    return NextResponse.json(result, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      buildReadonlyApiError('知识库可见范围暂时无法更新'),
      { status: 400 },
    );
  }
}
