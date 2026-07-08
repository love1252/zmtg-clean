import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  deriveSafetySwitchViewModel,
  hasRealChannelEnableAttempt,
  type SafetySwitchState,
} from '@/modules/security/domain/safety-switch';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSafetySwitchPatch(value: unknown): Partial<SafetySwitchState> {
  if (!isRecord(value)) return {};

  return {
    tenantRealChannelEnabled: value.tenantRealChannelEnabled === true,
    institutionRealChannelEnabled: value.institutionRealChannelEnabled === true,
    weComRealSendEnabled: value.weComRealSendEnabled === true,
    smsRealSendEnabled: value.smsRealSendEnabled === true,
    webhookEnabled: value.webhookEnabled === true,
    emergencyStopEnabled: value.emergencyStopEnabled !== false,
    allowRealSend: value.allowRealSend === true,
    externalChannelEnabled: value.externalChannelEnabled === true,
  };
}

function deniedAudit(input: {
  context: AccessContext;
  action: 'read' | 'update';
  reason: AuditReason;
  occurredAt: string;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'safety_switch',
    action: input.action,
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context,
      resource: 'safety_switch',
      action: 'read',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedAudit({
          context,
          action: 'read',
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const viewModel = deriveSafetySwitchViewModel();
    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource: 'safety_switch',
        action: 'read',
        result: 'allowed',
        reason: 'safety_switch_read',
        occurredAt,
      }),
    );

    return NextResponse.json(viewModel);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  const patch = parseSafetySwitchPatch(body.value);

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const updateDecision = canAccessResource({
      context,
      resource: 'safety_switch',
      action: 'update',
      targetTenantId: context.tenantId,
    });

    if (!updateDecision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedAudit({
          context,
          action: 'update',
          reason: updateDecision.allowed ? 'missing_tenant' : updateDecision.reason,
          occurredAt,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const reason = hasRealChannelEnableAttempt(patch)
      ? 'real_channel_enable_blocked'
      : 'real_channel_disabled';
    const viewModel = deriveSafetySwitchViewModel(patch);

    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource: 'safety_switch',
        action: 'update',
        result: 'denied',
        reason,
        occurredAt,
      }),
    );
    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource: 'safety_switch',
        action: 'update',
        result: 'allowed',
        reason: 'safety_switch_updated',
        occurredAt,
      }),
    );

    return NextResponse.json(viewModel);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
