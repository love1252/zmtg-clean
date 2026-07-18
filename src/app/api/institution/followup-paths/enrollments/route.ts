import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createEnrollmentFromTreatmentSummary } from '@/modules/institution/server/followup-path-enrollment-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { treatmentPathTemplateKeys, type TreatmentPathTemplateKey } from '@/modules/institution/domain/treatment-path-templates';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function deniedAudit(input: {
  context: AccessContext;
  action: 'create' | 'read_own_tenant';
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    action: input.action,
    reason: input.reason,
    occurredAt: input.occurredAt,
    resourceId: input.resourceId,
  });
}

function parseCreatePayload(payload: unknown) {
  if (!payload || Object.prototype.toString.call(payload) !== '[object Object]') {
    return { ok: false as const, error: '请求格式不正确' };
  }

  const record = payload as Record<string, unknown>;
  const allowedKeys = new Set(['sourceType', 'sourceId', 'templateKey']);
  const extraKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  if (extraKey) {
    return { ok: false as const, error: `请求包含不允许的字段: ${extraKey}` };
  }

  const sourceType = typeof record.sourceType === 'string' ? record.sourceType.trim() : '';
  const sourceId = typeof record.sourceId === 'string' ? record.sourceId.trim() : '';
  const templateKey = typeof record.templateKey === 'string' ? record.templateKey.trim() : '';

  if (sourceType !== 'treatment_summary') {
    return { ok: false as const, error: 'sourceType 仅支持 treatment_summary' };
  }

  if (!sourceId) {
    return { ok: false as const, error: 'sourceId 不可为空' };
  }

  if (templateKey && !treatmentPathTemplateKeys.includes(templateKey as TreatmentPathTemplateKey)) {
    return { ok: false as const, error: 'templateKey 不在允许范围内' };
  }

  return {
    ok: true as const,
    value: {
      sourceType,
      sourceId,
      templateKey: templateKey ? (templateKey as TreatmentPathTemplateKey) : null,
    },
  };
}

const disabledListResponse = Object.freeze({
  code: 'follow_up_path_enrollment_list_capability_disabled',
  error: '随访路径实例列表能力暂未启用',
});

/**
 * This endpoint remains disabled until the list has a formal institution-scoped reader.
 * Do not inspect the request here: a disabled list must not trigger session, data,
 * audit, or service side effects from untrusted input.
 */
export async function GET(_request: Request) {
  return NextResponse.json(disabledListResponse, { status: 503 });
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseCreatePayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const occurredAt = new Date().toISOString();
    const auditRepository = createAuditEventRepository(db);
    const decision = canAccessResource({
      context,
      resource: 'follow_up',
      action: 'create',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedAudit({
          context,
          action: 'create',
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    return await db.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const transactionAuditRepository = createAuditEventRepository(transactionDb);
      const result = await createEnrollmentFromTreatmentSummary({
        context,
        sourceId: parsed.value.sourceId,
        templateKey: parsed.value.templateKey,
        treatmentSummaryRepository: createTreatmentSummaryRepository(transactionDb),
        tenantBusinessRepository: createTenantBusinessRepository(transactionDb),
        occurredAt,
      });

      if (result.kind === 'created') {
        await transactionAuditRepository.record(
          createAuditEvent({
            eventId: createAuditEventId(),
            context,
            resource: 'follow_up',
            resourceId: result.enrollment.enrollmentId,
            action: 'create',
            result: 'allowed',
            reason: decision.reason,
            occurredAt,
          }),
        );
        return NextResponse.json({ record: result.enrollment }, { status: 201 });
      }

      const reason: AuditReason =
        result.kind === 'conflict'
          ? result.reason
          : result.kind === 'no_matching_template'
            ? result.safeReasonCode
            : result.kind === 'voided'
              ? 'treatment_summary_voided'
              : result.kind === 'forbidden'
                ? result.reason
                : 'not_found_or_not_owned';
      await transactionAuditRepository.record(
        deniedAudit({
          context,
          action: 'create',
          reason,
          occurredAt,
          resourceId: result.kind === 'conflict' ? result.resourceId : parsed.value.sourceId,
        }),
      );

      if (result.kind === 'conflict') {
        return NextResponse.json(
          { code: result.reason, error: '该治疗摘要已纳入当前路径，请刷新后查看' },
          { status: 409 },
        );
      }
      if (result.kind === 'no_matching_template') {
        return NextResponse.json(
          { code: result.safeReasonCode, error: '未匹配到可用随访路径模板' },
          { status: 409 },
        );
      }
      if (result.kind === 'voided') {
        return NextResponse.json({ error: '治疗摘要已作废，不能纳入路径' }, { status: 409 });
      }
      if (result.kind === 'forbidden') {
        return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
      }

      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
