import { NextResponse } from 'next/server';
import {
  archiveInstitutionKnowledgeItemService,
  createInstitutionKnowledgeItemService,
  listInstitutionKnowledgeItemsService,
  updateInstitutionKnowledgeItemService,
} from '@/modules/institution/server/institution-knowledge-management-service';
import { createInstitutionKnowledgeWriteRepository } from '@/modules/institution/server/institution-knowledge-write-repository';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: '知识库只读数据暂时不可用' },
    { status: 503 },
  );
}

function mutationStatusCode(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'forbidden') return 403;
  if (status === 'not_found') return 404;
  return 200;
}

function mutationErrorPayload(status: string, message: string) {
  if (status === 'forbidden') return { code: 'forbidden', error: '没有访问权限' };
  if (status === 'not_found') return { code: 'not_found', error: '记录不存在' };
  return { code: 'validation_error', error: message || '请求参数不正确' };
}

function isMutationFailure(result: { status: string }): result is {
  status: 'validation_failed' | 'forbidden' | 'not_found';
  message: string;
} {
  return result.status === 'validation_failed' || result.status === 'forbidden' || result.status === 'not_found';
}

async function readJsonBody(request: Request) {
  try {
    const payload = await request.json();
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return forbiddenResponse();
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const repository = createPlatformKnowledgeManagementRepository(getDatabase());
    const response = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        keyword: searchParams.get('keyword'),
        page: searchParams.get('page'),
        pageSize: searchParams.get('pageSize'),
      },
    });

    return NextResponse.json(response);
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function POST(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return unauthorizedResponse();
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return forbiddenResponse();
  }

  try {
    const body = await readJsonBody(request);
    const result = await createInstitutionKnowledgeItemService({
      repository: createInstitutionKnowledgeWriteRepository(getDatabase()),
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        title: typeof body.title === 'string' ? body.title : null,
        category: typeof body.category === 'string' ? body.category : null,
        description: typeof body.description === 'string' ? body.description : null,
      },
    });
    if (isMutationFailure(result)) {
      return NextResponse.json(mutationErrorPayload(result.status, result.message), {
        status: mutationStatusCode(result.status),
      });
    }

    return NextResponse.json({ status: 'created', record: result.record }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识条目暂时无法新建' },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return unauthorizedResponse();
  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return forbiddenResponse();
  }

  try {
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'update';
    const repository = createInstitutionKnowledgeWriteRepository(getDatabase());
    const commonInput = {
      tenantId: accessContext.tenantId,
      institutionId: accessContext.institutionId,
      knowledgeId: typeof body.knowledgeId === 'string' ? body.knowledgeId : null,
      title: typeof body.title === 'string' ? body.title : null,
      category: typeof body.category === 'string' ? body.category : null,
      description: typeof body.description === 'string' ? body.description : null,
    };
    const result = action === 'archive'
      ? await archiveInstitutionKnowledgeItemService({ repository, input: commonInput })
      : await updateInstitutionKnowledgeItemService({ repository, input: commonInput });

    if (isMutationFailure(result)) {
      return NextResponse.json(mutationErrorPayload(result.status, result.message), {
        status: mutationStatusCode(result.status),
      });
    }

    return NextResponse.json({ status: result.status, record: result.record }, { status: 200 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: '知识条目暂时无法更新' },
      { status: 503 },
    );
  }
}
