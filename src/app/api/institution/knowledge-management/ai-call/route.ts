import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import {
  requestInstitutionAiCallService,
  recordAiCallQuotaRejection,
  getDefaultAiVendor,
  isAllowedAiVendor,
} from '@/modules/institution/server/institution-ai-call-service';
import { searchInstitutionKnowledgeChunksService } from '@/modules/institution/server/institution-knowledge-keyword-search-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { KnowledgeChunkSearchResultDto } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';

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
    const vendor = typeof body.vendor === 'string' && isAllowedAiVendor(body.vendor)
      ? body.vendor
      : getDefaultAiVendor();

    const db = getDatabase();

    // 检查 AI 调用配额
    const quotaDecision = await checkTenantQuotaForCreate({
      database: db,
      tenantId: accessContext.tenantId,
      resource: 'ai_calls',
    });
    if (!quotaDecision.allowed) {
      try {
        // 写入超限拒绝审计记录，不调用 provider
        await recordAiCallQuotaRejection({
          repository: createAiCallUsageRepository(db),
          tenantId: accessContext.tenantId,
          institutionId: accessContext.institutionId,
          actorUserId: accessContext.userId,
          vendor,
        });
      } catch {
        return NextResponse.json(
          { code: 'ai_quota_rejection_audit_failed', error: 'AI 超限审计记录写入失败，请稍后重试' },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { code: 'quota_exceeded_ai_calls', error: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐' },
        { status: 409 },
      );
    }

    const questionText = typeof body.question === 'string' ? body.question.trim() : '';
    const searchKeyword = questionText.slice(0, 80);

    // 服务端知识库关键词检索（不可由客户端覆盖 tenantId/institutionId）
    let knowledgeChunks: KnowledgeChunkSearchResultDto[] = [];
    if (searchKeyword) {
      try {
        const searchResult = await searchInstitutionKnowledgeChunksService({
          repository: createPlatformKnowledgeManagementRepository(db),
          params: {
            tenantId: accessContext.tenantId,
            institutionId: accessContext.institutionId,
            keyword: searchKeyword,
            page: 1,
            pageSize: 5,
          },
        });

        if ('records' in searchResult) {
          knowledgeChunks = searchResult.records;
        }
        // validation_failed 表示 keyword 无效 -> 无片段，正常继续
      } catch {
        // 检索失败 -> 安全起见返回受控 503，不调用 provider
        return NextResponse.json(
          { code: 'knowledge_retrieval_failed', error: '知识库检索暂时不可用，请稍后重试' },
          { status: 503 },
        );
      }
    }

    const result = await requestInstitutionAiCallService({
      repository: createAiCallUsageRepository(db),
      vendor,
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        userId: accessContext.userId,
        question: questionText || null,
      },
      knowledgeChunks,
    });

    if (result.status === 'validation_failed' || result.status === 'sensitive_input_rejected') {
      return NextResponse.json(
        { code: result.status === 'sensitive_input_rejected' ? 'sensitive_input_rejected' : 'validation_error', error: result.message },
        { status: result.status === 'sensitive_input_rejected' ? 422 : 400 },
      );
    }
    if (result.status === 'service_unavailable') {
      return NextResponse.json(
        { code: 'service_unavailable', error: result.message },
        { status: 503 },
      );
    }
    if (result.status === 'rate_limited') {
      return NextResponse.json(
        { code: 'rate_limited', error: result.message },
        { status: 429 },
      );
    }
    if (result.status === 'provider_unavailable') {
      return NextResponse.json(
        { code: 'provider_error', error: result.message, answer: result.answer || '' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      answer: result.answer,
      record: result.record,
      knowledgeContext: result.knowledgeContext ?? null,
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { code: 'service_unavailable', error: 'AI 调用暂时不可用' },
      { status: 503 },
    );
  }
}
