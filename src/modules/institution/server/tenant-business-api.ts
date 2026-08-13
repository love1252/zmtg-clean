import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  createInstitutionAttributedTenantAuditEventV1,
  type AttributedTenantAuditEventV1,
  type InstitutionAuditEventAttributionV1,
} from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type {
  TenantQuotaDecision,
  TenantQuotaDenialReason,
} from '@/modules/institution/domain/quota-enforcement';
import {
  canAccessResource,
  type AccessContext,
  type ProtectedAction,
  type ProtectedResource,
} from '@/modules/security/domain/access-control';

type TenantBusinessResource = Extract<ProtectedResource, 'customer' | 'appointment' | 'follow_up'>;

type TenantBusinessListRequest<Item> = {
  context: AccessContext | null;
  resource: TenantBusinessResource;
  list: (tenantId: string) => Promise<Item[]>;
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: InstitutionAuditEventAttributionV1;
};

export type TenantBusinessMutationResult<Item> =
  | { kind: 'success'; record: Item }
  | { kind: 'not_found'; resourceId?: string | null }
  | { kind: 'conflict'; reason: 'stale_transition'; resourceId?: string | null }
  | { kind: 'invalid_transition'; from: string; to: string; resourceId?: string | null }
  | { kind: 'quota_denied'; decision: Extract<TenantQuotaDecision, { allowed: false }> };

export type TenantBusinessMutationRequest<Item> = {
  context: AccessContext | null;
  resource: TenantBusinessResource;
  action: Extract<ProtectedAction, 'create' | 'update'>;
  mutate: (input: {
    tenantId: string;
    successAuditEvent: AttributedTenantAuditEventV1;
  }) => Promise<TenantBusinessMutationResult<Item>>;
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: InstitutionAuditEventAttributionV1;
  successStatus?: 200 | 201;
};

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function attributeTenantBusinessAuditEvent(
  event: Parameters<typeof createInstitutionAttributedTenantAuditEventV1>[0]['event'],
  attribution: InstitutionAuditEventAttributionV1,
): AttributedTenantAuditEventV1 {
  const attributedEvent = createInstitutionAttributedTenantAuditEventV1({
    event,
    attribution,
  });
  if (!attributedEvent) throw new Error('invalid_tenant_business_audit_attribution');
  return attributedEvent;
}

const tenantQuotaDenialMessages: Record<TenantQuotaDenialReason, string> = {
  missing_active_plan: '当前租户未配置有效套餐，暂时无法新增记录',
  missing_quota_limit: '当前租户套餐配额未配置，暂时无法新增记录',
  quota_exceeded_appointments: '预约配额已达上限，请联系平台管理员调整套餐',
  quota_exceeded_customers: '客户数量已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_items: '知识库条目数量已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_files: '知识库文件数量已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_total_storage_mb: '知识库总容量已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_single_file_size_mb: '文件大小已超过当前套餐单文件上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_parse_jobs_monthly: '知识库解析任务额度已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_embedding_jobs_monthly: '知识库向量任务额度已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_ocr_jobs_monthly: 'OCR 任务额度已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_rag_answers_monthly: '知识库问答额度已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_knowledge_index_rebuild_jobs_monthly: '知识库索引重建额度已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_staff_seats: '员工席位已达到当前套餐上限，请联系平台管理员调整套餐',
  quota_exceeded_ai_calls: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐',
  feature_disabled: '当前套餐未包含该能力，请联系平台管理员调整套餐',
};

function getTenantQuotaDenialMessage(reason: TenantQuotaDenialReason) {
  return tenantQuotaDenialMessages[reason];
}

export async function handleTenantBusinessListRequest<Item>({
  context,
  resource,
  list,
  auditRepository,
  auditAttribution,
}: TenantBusinessListRequest<Item>) {
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const action = 'read_own_tenant';
  const occurredAt = new Date().toISOString();
  const decision = canAccessResource({
    context,
    resource,
    action,
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: decision.reason,
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  if (!context.tenantId) {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: 'missing_tenant',
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const records = await list(context.tenantId);

  await auditRepository.recordAttributed(
    attributeTenantBusinessAuditEvent(createAuditEvent({
      eventId: createAuditEventId(),
      context,
      resource,
      action,
      result: 'allowed',
      reason: decision.reason,
      occurredAt,
    }), auditAttribution),
  );

  return NextResponse.json({ records });
}

export async function handleTenantBusinessMutationRequest<Item>({
  context,
  resource,
  action,
  mutate,
  auditRepository,
  auditAttribution,
  successStatus = 200,
}: TenantBusinessMutationRequest<Item>) {
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const occurredAt = new Date().toISOString();
  const decision = canAccessResource({
    context,
    resource,
    action,
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: decision.reason,
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  if (!context.tenantId) {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: 'missing_tenant',
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const successAuditEvent = attributeTenantBusinessAuditEvent(createAuditEvent({
    eventId: createAuditEventId(),
    context,
    resource,
    action,
    result: 'allowed',
    reason: decision.reason,
    occurredAt,
  }), auditAttribution);
  const result = await mutate({ tenantId: context.tenantId, successAuditEvent });

  if (result.kind === 'not_found') {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        resourceId: result.resourceId,
        action,
        result: 'denied',
        reason: 'not_found_or_not_owned',
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  if (result.kind === 'invalid_transition') {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        resourceId: result.resourceId,
        action,
        result: 'denied',
        reason: 'invalid_transition',
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '随访状态不允许这样流转' }, { status: 409 });
  }

  if (result.kind === 'conflict') {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        resourceId: result.resourceId,
        action,
        result: 'denied',
        reason: result.reason,
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json({ error: '随访状态已变化，请刷新后重试' }, { status: 409 });
  }

  if (result.kind === 'quota_denied') {
    await auditRepository.recordAttributed(
      attributeTenantBusinessAuditEvent(createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        result: 'denied',
        reason: result.decision.reason,
        occurredAt,
      }), auditAttribution),
    );

    return NextResponse.json(
      { code: result.decision.reason, error: getTenantQuotaDenialMessage(result.decision.reason) },
      { status: 409 },
    );
  }

  return NextResponse.json({ record: result.record }, { status: successStatus });
}
