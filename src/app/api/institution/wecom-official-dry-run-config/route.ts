import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createDefaultRealChannelPreflightInput,
  evaluateRealChannelPreflight,
  type RealChannelPreflightStatus,
} from '@/modules/institution/domain/real-channel-preflight';
import {
  createDefaultWeComOfficialDryRunConfigInput,
  detectWeComOfficialDryRunPayloadGuards,
  evaluateWeComOfficialDryRunConfig,
  type WeComDryRunRouteInput,
  type WeComOfficialDryRunConfigInput,
} from '@/modules/institution/domain/wecom-official-dry-run-config';
import { canAccessResource, type AccessContext, type AccessRole } from '@/modules/security/domain/access-control';
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

function isAccessRole(value: unknown): value is AccessRole {
  return (
    value === 'tenant_admin' ||
    value === 'tenant_operator' ||
    value === 'consultant' ||
    value === 'customer_service' ||
    value === 'platform_admin' ||
    value === 'platform_operator' ||
    value === 'security_auditor'
  );
}

function isOfficialRouteInput(value: unknown): value is WeComDryRunRouteInput {
  return (
    value === 'official_wecom_self_built' ||
    value === 'official_wecom_third_party' ||
    value === 'official_wecom_service_provider' ||
    value === 'account_custody' ||
    value === null
  );
}

function isPreflightStatus(value: unknown): value is RealChannelPreflightStatus | 'not_configured' {
  return (
    value === 'not_configured' ||
    value === 'mock_ready' ||
    value === 'blocked_missing_manual_confirmation' ||
    value === 'blocked_safety_switch' ||
    value === 'blocked_real_channel_disabled' ||
    value === 'blocked_sensitive_config' ||
    value === 'blocked_no_permission' ||
    value === 'blocked_missing_consent' ||
    value === 'blocked_opt_out' ||
    value === 'blocked_frequency_cap' ||
    value === 'blocked_high_risk' ||
    value === 'blocked_strategy_not_allowed' ||
    value === 'blocked_account_custody_route' ||
    value === 'blocked_route_unverified'
  );
}

function parseDryRunInput(value: unknown, context: AccessContext): WeComOfficialDryRunConfigInput {
  const body = isRecord(value) ? value : {};
  const guards = detectWeComOfficialDryRunPayloadGuards(value);
  const officialRoute = isOfficialRouteInput(body.officialRoute) ? body.officialRoute : null;
  const preflightStatus = isPreflightStatus(body.preflightStatus) ? body.preflightStatus : 'not_configured';

  return createDefaultWeComOfficialDryRunConfigInput({
    tenantId: context.tenantId ?? 'tenant-low-sensitive-001',
    institutionId: typeof body.institutionId === 'string'
      ? body.institutionId
      : context.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: isAccessRole(body.operatorRole) ? body.operatorRole : context.role,
    officialRoute,
    proofInstitutionRef: typeof body.proofInstitutionRef === 'string' ? body.proofInstitutionRef : null,
    callbackUrlPlaceholder: typeof body.callbackUrlPlaceholder === 'string' ? body.callbackUrlPlaceholder : null,
    hasTestWeComEnvironment: body.hasTestWeComEnvironment === true,
    hasCallbackDomainPlaceholder: body.hasCallbackDomainPlaceholder === true,
    hasSecretKeeperConfirmed: body.hasSecretKeeperConfirmed === true,
    hasManualConfirmation: body.hasManualConfirmation === true,
    preflightStatus,
    proofEligibleMock: body.proofEligibleMock === true,
    allowRealSend: body.allowRealSend === true,
    externalChannelEnabled: body.externalChannelEnabled === true,
    realSendAllowed: body.realSendAllowed === true,
    dryRunOnly: body.dryRunOnly !== false,
    hasRealNetworkAttempt: guards.hasRealNetworkAttempt || body.hasRealNetworkAttempt === true,
    hasRealSendAttempt: body.hasRealSendAttempt === true,
    hasSensitiveValueInput: guards.hasSensitiveValueInput,
    hasSecretReadAttempt: guards.hasSecretReadAttempt,
  });
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

function createDefaultGetConfig(context: AccessContext) {
  const preflight = evaluateRealChannelPreflight(createDefaultRealChannelPreflightInput({
    tenantId: context.tenantId ?? 'tenant-low-sensitive-001',
    institutionId: context.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: context.role,
  }));

  return evaluateWeComOfficialDryRunConfig(createDefaultWeComOfficialDryRunConfigInput({
    tenantId: context.tenantId ?? 'tenant-low-sensitive-001',
    institutionId: context.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: context.role,
    preflightStatus: preflight.preflightStatus,
    proofEligibleMock: preflight.proofEligibleMock,
  }));
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

    const config = createDefaultGetConfig(context);

    await recordAudit({
      context,
      action: 'read',
      result: 'allowed',
      reason: 'wecom_dry_run_config_viewed',
      occurredAt,
    });

    return NextResponse.json({
      config,
      boundary: {
        dryRunOnly: true,
        noSecretStored: true,
        noSecretRead: true,
        noRealNetwork: true,
        noRealSend: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        labels: [
          '当前仅官方企业微信 dry-run 配置占位',
          '不读取 secret / token',
          '不配置真实企业微信',
          '不真实出网',
          '不真实发送',
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

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
        action: 'review',
        reason: decision.allowed ? 'missing_tenant' : decision.reason,
        occurredAt,
      });
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const config = evaluateWeComOfficialDryRunConfig(parseDryRunInput(body.value, context));

    await recordAudit({
      context,
      action: 'review',
      result: config.dryRunReady ? 'allowed' : 'denied',
      reason: config.auditReason,
      occurredAt,
    });

    return NextResponse.json({
      config,
      boundary: {
        localSimulationOnly: true,
        dryRunOnly: true,
        noSecretAccepted: true,
        noSecretStored: true,
        noSecretRead: true,
        noRealNetwork: true,
        noRealSend: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
