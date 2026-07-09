import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createDefaultWeComOfficialDryRunInput,
  evaluateWeComOfficialDryRun,
} from '@/modules/institution/domain/wecom-official-dry-run';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function recordAudit(input: {
  context: AccessContext;
  action: 'read' | 'review';
  reason: AuditReason;
  result: 'allowed' | 'denied';
  occurredAt: string;
}) {
  const db = getDatabase();
  const auditRepository = createAuditEventRepository(db);
  await auditRepository.record(
    createAuditEvent({
      eventId: createAuditEventId(),
      context: input.context,
      resource: 'real_channel',
      action: input.action,
      result: input.result,
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
  );
}

async function recordDenied(input: {
  context: AccessContext;
  action: 'read' | 'review';
  reason: AuditReason;
  occurredAt: string;
}) {
  const db = getDatabase();
  const auditRepository = createAuditEventRepository(db);
  await auditRepository.record(
    createDeniedAccessAuditEvent({
      eventId: createAuditEventId(),
      context: input.context,
      resource: 'real_channel',
      action: input.action,
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
  );
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context,
      resource: 'real_channel',
      action: 'read',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await recordDenied({
        context,
        action: 'read',
        reason: decision.allowed ? 'missing_tenant' : decision.reason,
        occurredAt,
      });
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const dryRun = evaluateWeComOfficialDryRun(createDefaultWeComOfficialDryRunInput({
      tenantId: context.tenantId,
      institutionId: context.institutionId ?? 'institution-low-sensitive-001',
      operatorRole: context.role,
      dryRunConfigStatus: 'not_configured',
      preflightStatus: 'not_configured',
      proofEligibleMock: false,
      hasManualConfirmation: false,
      hasSecretPlaceholder: false,
      hasCallbackUrlPlaceholder: false,
      networkMode: 'disabled',
    }));

    await recordAudit({
      context,
      action: 'read',
      result: 'allowed',
      reason: 'wecom_official_dry_run_viewed',
      occurredAt,
    });

    return NextResponse.json({
      dryRun,
      boundary: {
        localSimulationOnly: true,
        dryRunOnly: true,
        noSecretAccepted: true,
        noSecretRead: true,
        noSecretOutput: true,
        noRealNetwork: true,
        noRealSend: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        labels: [
          '当前仅官方路线 dry-run 执行计划状态',
          '不读取 secret / token',
          '不输出 secret / token',
          '不调用企业微信 / 微信 / 短信 / HIS / webhook',
          '不真实出网',
          '不真实发送',
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
