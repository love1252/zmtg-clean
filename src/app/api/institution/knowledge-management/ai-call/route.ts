import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import {
  requestInstitutionAiCallService,
  recordAiCallQuotaRejection,
  getDefaultAiVendor,
} from '@/modules/institution/server/institution-ai-call-service';

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

const forbiddenInstitutionAiModelSelectionFields = ['vendor', 'provider', 'model', 'modelId', 'providerId'] as const;

function hasInstitutionAiModelSelection(input: Record<string, unknown>) {
  return forbiddenInstitutionAiModelSelectionFields.some((field) => Object.prototype.hasOwnProperty.call(input, field));
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
    if (hasInstitutionAiModelSelection(body)) {
      return NextResponse.json(
        {
          code: 'INSTITUTION_AI_MODEL_SELECTION_FORBIDDEN',
          error: '机构端不能选择 AI 模型或供应商，AI 服务由平台统一配置',
        },
        { status: 400 },
      );
    }
    const vendor = getDefaultAiVendor();

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

    const result = await requestInstitutionAiCallService({
      repository: createAiCallUsageRepository(db),
      vendor,
      input: {
        tenantId: accessContext.tenantId,
        institutionId: accessContext.institutionId,
        userId: accessContext.userId,
        question: questionText || null,
      },
      db,
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
