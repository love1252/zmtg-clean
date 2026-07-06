import { NextResponse } from 'next/server';
import { answerInstitutionKnowledgeRagQuestion } from '@/modules/institution/server/institution-knowledge-rag-answer-service';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import {
  getDefaultAiVendor,
  recordAiCallQuotaRejection,
  recordKnowledgeRagAnswerUsageSuccess,
} from '@/modules/institution/server/institution-ai-call-service';
import { createInstitutionRagAnswerProviderResolver } from '@/modules/institution/server/institution-rag-answer-provider';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import type { TenantQuotaDecision } from '@/modules/institution/domain/quota-enforcement';
import {
  createKnowledgeQuotaUsageRepository,
  recordKnowledgeQuotaDecision,
  recordKnowledgeQuotaOutcome,
} from '@/modules/institution/server/knowledge-quota-usage-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function statusCodeForResult(status: string) {
  if (status === 'validation_failed') return 400;
  if (status === 'quota_exceeded') return 409;
  if (status === 'provider_disabled') return 503;
  if (status === 'provider_failure' || status === 'service_unavailable') return 502;
  return 200;
}

const forbiddenInstitutionProviderFields = ['vendor', 'provider', 'model', 'modelId', 'providerId'] as const;

function hasInstitutionProviderSelection(input: Record<string, unknown>) {
  return forbiddenInstitutionProviderFields.some((field) => Object.prototype.hasOwnProperty.call(input, field));
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

  const tenantId = accessContext.tenantId;
  const institutionId = accessContext.institutionId;
  const actorUserId = accessContext.userId;

  try {
    const body = await readBody(request);
    if (hasInstitutionProviderSelection(body)) {
      return NextResponse.json(
        { code: 'INSTITUTION_AI_MODEL_SELECTION_FORBIDDEN', error: '机构端不能选择 AI 模型或供应商，AI 服务由平台统一配置' },
        { status: 400 },
      );
    }

    const db = getDatabase();
    const repository = createPlatformKnowledgeManagementRepository(db);
    const usageRepository = createAiCallUsageRepository(db);
    const quotaUsageRepository = createKnowledgeQuotaUsageRepository(db);
    const vendor = getDefaultAiVendor();
    let lastRagQuotaDecision: TenantQuotaDecision | null = null;

    const result = await answerInstitutionKnowledgeRagQuestion({
      repository,
      providerResolver: createInstitutionRagAnswerProviderResolver({
        repository: usageRepository,
        vendor,
      }),
      quota: {
        check: async () => {
          const ragQuotaDecision = await checkTenantQuotaForCreate({
            database: db,
            tenantId: tenantId,
            resource: 'knowledge_rag_answers_monthly',
          });
          lastRagQuotaDecision = ragQuotaDecision;
          await recordKnowledgeQuotaDecision({
            repository: quotaUsageRepository,
            tenantId,
            institutionId,
            actorUserId,
            resourceKey: 'knowledge_rag_answers_monthly',
            action: 'rag_answer',
            decision: ragQuotaDecision,
            quantity: 1,
          });
          if (!ragQuotaDecision.allowed) return ragQuotaDecision;

          const aiQuotaDecision = await checkTenantQuotaForCreate({
            database: db,
            tenantId: tenantId,
            resource: 'ai_calls',
          });
          if (!aiQuotaDecision.allowed) return aiQuotaDecision;
          return ragQuotaDecision;
        },
        onRejected: async () => {
          if (lastRagQuotaDecision?.allowed === false && lastRagQuotaDecision.resource === 'knowledge_rag_answers_monthly') return;
          await recordAiCallQuotaRejection({
            repository: usageRepository,
            tenantId: tenantId,
            institutionId: institutionId,
            actorUserId: actorUserId,
            vendor,
          });
        },
      },
      usageRecorder: async (usageInput) => {
        await recordKnowledgeRagAnswerUsageSuccess({
          repository: usageRepository,
          tenantId: tenantId,
          institutionId: institutionId,
          actorUserId: actorUserId,
          vendor: usageInput.providerId,
          model: usageInput.model,
          promptTokens: usageInput.usage?.inputTokens ?? null,
          completionTokens: usageInput.usage?.outputTokens ?? null,
          latencyMs: usageInput.latencyMs ?? null,
          sources: usageInput.sources.map((source) => ({
            knowledgeId: source.knowledgeId,
            knowledgeTitle: source.knowledgeTitle,
            fileId: source.fileId,
            fileName: source.fileName,
            chunkId: source.chunkId,
            chunkIndex: source.chunkIndex,
            textPreview: source.textPreview,
            matchReason: source.matchReason,
          })),
        });
        await recordKnowledgeQuotaOutcome({
          repository: quotaUsageRepository,
          tenantId,
          institutionId,
          actorUserId,
          resourceKey: 'knowledge_rag_answers_monthly',
          action: 'rag_answer',
          status: 'succeeded',
          quantity: 1,
        });
      },
      tenantId: tenantId,
      institutionId: institutionId,
      actorUserId: actorUserId,
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
