import { NextResponse } from 'next/server';
import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';
import { recordManualFollowUpFeedback } from '@/modules/institution/server/followup-customer-timeline-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

const riskLevels = new Set<FollowUpRiskLevel>(['normal', 'watch', 'urgent']);
const forbiddenFeedbackPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整治疗|完整病历|咨询全文|病历号|身份证|手机号原文/u,
  /\bHIS\b|his payload|externalSystemPayload/iu,
  /\b(?:provider|model|token|vendor|cost|prompt|raw ai response|secret|api key|baseUrl)\b/iu,
];

async function getCustomerId(context: RouteContext) {
  const params = await context.params;
  return params.customerId.trim();
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function containsForbiddenFeedback(value: string) {
  return forbiddenFeedbackPatterns.some((pattern) => pattern.test(value.normalize('NFKC')));
}

function parsePayload(input: unknown):
  | { ok: true; value: { safeSummary: string; riskLevel: FollowUpRiskLevel; relatedTaskId: string | null } }
  | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: '请求体必须是 JSON object' };

  const allowedKeys = new Set(['safeSummary', 'riskLevel', 'relatedTaskId']);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) return { ok: false, error: '请求包含不允许的字段' };
  }

  const safeSummary = typeof input.safeSummary === 'string'
    ? input.safeSummary.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 240)
    : '';
  if (!safeSummary) return { ok: false, error: '字段 safeSummary 必须是非空字符串' };
  if (containsForbiddenFeedback(safeSummary)) return { ok: false, error: '字段 safeSummary 只能记录低敏反馈摘要' };

  const riskLevel = typeof input.riskLevel === 'string' && riskLevels.has(input.riskLevel as FollowUpRiskLevel)
    ? input.riskLevel as FollowUpRiskLevel
    : null;
  if (!riskLevel) return { ok: false, error: '字段 riskLevel 值不在允许范围内' };

  const relatedTaskId = typeof input.relatedTaskId === 'string' && input.relatedTaskId.trim()
    ? input.relatedTaskId.trim().slice(0, 64)
    : null;

  return { ok: true, value: { safeSummary, riskLevel, relatedTaskId } };
}

export async function POST(request: Request, context: RouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const customerId = await getCustomerId(context);
  if (!customerId) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parsePayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const repository = createTenantBusinessRepository(getDatabase());
    const result = await recordManualFollowUpFeedback({
      context: accessContext,
      customerId,
      safeSummary: parsed.value.safeSummary,
      riskLevel: parsed.value.riskLevel,
      relatedTaskId: parsed.value.relatedTaskId,
      tenantBusinessRepository: repository,
      occurredAt: new Date().toISOString(),
    });

    if (result.kind === 'forbidden') {
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ record: result.event }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
