import { NextResponse } from 'next/server';
import { answerInstitutionKnowledgeRagQuestion } from '@/modules/institution/server/institution-knowledge-rag-answer-service';
import { createInstitutionDryRunAiChatProvider } from '@/modules/institution/server/institution-rag-answer-provider';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  return 200;
}

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return Object.prototype.toString.call(body) === '[object Object]'
      ? body as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId || !accessContext.institutionId) {
    return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
  }

  try {
    const body = await readBody(request);
    const result = await answerInstitutionKnowledgeRagQuestion({
      repository: createPlatformKnowledgeManagementRepository(getDatabase()),
      provider: createInstitutionDryRunAiChatProvider(),
      tenantId: accessContext.tenantId,
      institutionId: accessContext.institutionId,
      question: typeof body.question === 'string' ? body.question : null,
      topK: typeof body.topK === 'number' || typeof body.topK === 'string' ? body.topK : null,
    });

    const responseBody = {
      status: result.status,
      answer: result.answer,
      sources: result.sources,
      ...('noAnswerReason' in result ? { noAnswerReason: result.noAnswerReason } : {}),
      ...('message' in result ? { message: result.message } : {}),
    };

    return NextResponse.json(responseBody, { status: statusCodeForResult(result.status) });
  } catch {
    return NextResponse.json(
      {
        status: 'service_unavailable',
        answer: '知识库问答服务暂时不可用，请稍后重试。仅供内部运营参考，需人工确认',
        sources: [],
      },
      { status: 503 },
    );
  }
}
