import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createDefaultWeComOfficialDryRunInput,
  detectWeComOfficialDryRunPayloadGuards,
  evaluateWeComOfficialDryRun,
  type WeComOfficialDryRunNetworkMode,
} from '@/modules/institution/domain/wecom-official-dry-run';
import type { RealChannelPreflightStatus } from '@/modules/institution/domain/real-channel-preflight';
import type { WeComDryRunRouteInput, WeComOfficialDryRunConfigStatus } from '@/modules/institution/domain/wecom-official-dry-run-config';
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

function isConfigStatus(value: unknown): value is WeComOfficialDryRunConfigStatus {
  return (
    value === 'not_configured' ||
    value === 'placeholder_ready' ||
    value === 'dry_run_ready' ||
    value === 'blocked_missing_institution' ||
    value === 'blocked_missing_route' ||
    value === 'blocked_account_custody_route' ||
    value === 'blocked_missing_callback_url' ||
    value === 'blocked_missing_manual_confirmation' ||
    value === 'blocked_sensitive_value_detected' ||
    value === 'blocked_secret_read_attempt' ||
    value === 'blocked_real_network_forbidden' ||
    value === 'blocked_real_send_forbidden' ||
    value === 'blocked_preflight_not_ready'
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

function isNetworkMode(value: unknown): value is WeComOfficialDryRunNetworkMode {
  return value === 'disabled' || value === 'mock' || value === 'live_dry_run_requested';
}

function parseDryRunInput(value: unknown, context: AccessContext) {
  const body = isRecord(value) ? value : {};
  const guards = detectWeComOfficialDryRunPayloadGuards(value);

  return createDefaultWeComOfficialDryRunInput({
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : context.tenantId ?? 'tenant-low-sensitive-001',
    institutionId: typeof body.institutionId === 'string' ? body.institutionId : context.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: isAccessRole(body.operatorRole) ? body.operatorRole : context.role,
    officialRoute: isOfficialRouteInput(body.officialRoute) ? body.officialRoute : null,
    dryRunConfigStatus: isConfigStatus(body.dryRunConfigStatus) ? body.dryRunConfigStatus : 'not_configured',
    preflightStatus: isPreflightStatus(body.preflightStatus) ? body.preflightStatus : 'not_configured',
    proofEligibleMock: body.proofEligibleMock === true,
    hasManualConfirmation: body.hasManualConfirmation === true,
    hasSecretPlaceholder: body.hasSecretPlaceholder === true,
    hasCallbackUrlPlaceholder: body.hasCallbackUrlPlaceholder === true,
    networkMode: isNetworkMode(body.networkMode) ? body.networkMode : 'disabled',
    allowRealSend: body.allowRealSend === true,
    externalChannelEnabled: body.externalChannelEnabled === true,
    realSendAllowed: body.realSendAllowed === true,
    noSecretRead: body.noSecretRead !== false,
    noRealSend: body.noRealSend !== false,
    dryRunOnly: body.dryRunOnly !== false,
    hasSensitivePayload: guards.hasSensitivePayload,
    hasSecretReadAttempt: guards.hasSecretReadAttempt,
    hasRealNetworkAttempt: guards.hasRealNetworkAttempt,
    hasRealSendAttempt: guards.hasRealSendAttempt,
  });
}

async function recordAudit(input: {
  context: AccessContext;
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
      action: 'review',
      result: input.result,
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
  );
}

async function recordDenied(input: {
  context: AccessContext;
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
      action: 'review',
      reason: input.reason,
      occurredAt: input.occurredAt,
    }),
  );
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
        reason: decision.allowed ? 'missing_tenant' : decision.reason,
        occurredAt,
      });
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const dryRun = evaluateWeComOfficialDryRun(parseDryRunInput(body.value, context));

    await recordAudit({
      context,
      result: dryRun.mockDryRunCompleted || dryRun.dryRunPlanReady ? 'allowed' : 'denied',
      reason: dryRun.auditReason,
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
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
