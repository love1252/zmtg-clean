import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
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
  auditRepository: Pick<AuditEventRepository, 'record'>;
};

export type TenantBusinessMutationResult<Item> =
  | { kind: 'success'; record: Item }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; from: string; to: string };

export type TenantBusinessMutationRequest<Item> = {
  context: AccessContext | null;
  resource: TenantBusinessResource;
  action: Extract<ProtectedAction, 'create' | 'update'>;
  mutate: (tenantId: string) => Promise<TenantBusinessMutationResult<Item>>;
  auditRepository: Pick<AuditEventRepository, 'record'>;
  successStatus?: 200 | 201;
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

export async function handleTenantBusinessMutationRequest<Item>({
  context,
  resource,
  action,
  mutate,
  auditRepository,
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

  const result = await mutate(context.tenantId);

  if (result.kind === 'not_found') {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  if (result.kind === 'invalid_transition') {
    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        result: 'denied',
        reason: 'invalid_transition',
        occurredAt,
      }),
    );

    return NextResponse.json({ error: '随访状态不允许这样流转' }, { status: 409 });
  }

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

  return NextResponse.json({ record: result.record }, { status: successStatus });
}
