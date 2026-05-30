import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  canAccessResource,
  type AccessContext,
  type ProtectedResource,
} from '@/modules/security/domain/access-control';

type TenantBusinessResource = Extract<ProtectedResource, 'customer' | 'appointment' | 'follow_up'>;

type TenantBusinessListRequest<Item> = {
  context: AccessContext | null;
  resource: TenantBusinessResource;
  list: (tenantId: string) => Promise<Item[]>;
  auditRepository: Pick<AuditEventRepository, 'record'>;
};

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

export async function handleTenantBusinessListRequest<Item>({
  context,
  resource,
  list,
  auditRepository,
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
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: decision.reason,
        occurredAt,
      }),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  if (!context.tenantId) {
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: 'missing_tenant',
        occurredAt,
      }),
    );

    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const records = await list(context.tenantId);

  await auditRepository.record(
    createAuditEvent({
      eventId: createAuditEventId(),
      context,
      resource,
      action,
      result: 'allowed',
      reason: decision.reason,
      occurredAt,
    }),
  );

  return NextResponse.json({ records });
}
