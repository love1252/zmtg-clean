import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  assertRealChannelPreflightLowSensitivePayload,
  createDefaultRealChannelPreflightInput,
  evaluateRealChannelPreflight,
  type RealChannelPreflightInput,
  type RealChannelRoute,
} from '@/modules/institution/domain/real-channel-preflight';
import { canAccessResource, type AccessContext, type AccessRole } from '@/modules/security/domain/access-control';
import { defaultSafetySwitchState, type SafetySwitchState } from '@/modules/security/domain/safety-switch';
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

function isRealChannelRoute(value: unknown): value is RealChannelRoute {
  return (
    value === 'official_wecom_self_built' ||
    value === 'official_wecom_third_party' ||
    value === 'official_wecom_service_provider' ||
    value === 'account_custody'
  );
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

function parseSafetySwitchSummary(value: unknown): Partial<SafetySwitchState> {
  if (!isRecord(value)) return defaultSafetySwitchState;

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

function parsePreflightInput(value: unknown, context: AccessContext): RealChannelPreflightInput {
  const body = isRecord(value) ? value : {};
  const safetySwitchSummary = parseSafetySwitchSummary(body.safetySwitchSummary);
  const channelRoute = isRealChannelRoute(body.channelRoute)
    ? body.channelRoute
    : 'official_wecom_self_built';

  return createDefaultRealChannelPreflightInput({
    tenantId: context.tenantId ?? 'tenant-low-sensitive-001',
    institutionId: context.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: isAccessRole(body.operatorRole) ? body.operatorRole : context.role,
    channelRoute,
    hasManualConfirmation: body.hasManualConfirmation === true,
    hasConsent: body.hasConsent === true,
    hasOptOut: body.hasOptOut === true,
    frequencyCapPassed: body.frequencyCapPassed !== false,
    aiStrategyDecision: typeof body.aiStrategyDecision === 'string' && body.aiStrategyDecision.startsWith('blocked_')
      ? 'blocked_unknown_intent'
      : body.aiStrategyDecision === 'mock_auto_reply_allowed' || body.aiStrategyDecision === 'mock_followup_allowed' || body.aiStrategyDecision === 'draft_requires_human' || body.aiStrategyDecision === 'recommend_only'
        ? body.aiStrategyDecision
        : 'draft_requires_human',
    aiStrategyLevel: body.aiStrategyLevel === 'L0' || body.aiStrategyLevel === 'L1' || body.aiStrategyLevel === 'L2' || body.aiStrategyLevel === 'L3' || body.aiStrategyLevel === 'L4'
      ? body.aiStrategyLevel
      : 'L1',
    riskTags: Array.isArray(body.riskTags)
      ? body.riskTags.filter((tag): tag is RealChannelPreflightInput['riskTags'][number] =>
          tag === 'medical_advice_risk' ||
          tag === 'efficacy_commitment_risk' ||
          tag === 'price_commitment_risk' ||
          tag === 'allergy_or_postoperative_abnormal_risk' ||
          tag === 'complaint_or_dissatisfaction_risk' ||
          tag === 'privacy_field_leakage_risk',
        )
      : [],
    safetySwitchSummary,
    allowRealSend: false,
    externalChannelEnabled: false,
    emergencyStopEnabled: safetySwitchSummary.emergencyStopEnabled !== false,
    hasSensitiveConfigInput: !assertRealChannelPreflightLowSensitivePayload(value),
    isAccountCustodyRoute: channelRoute === 'account_custody' || body.isAccountCustodyRoute === true,
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

    const preflight = evaluateRealChannelPreflight(createDefaultRealChannelPreflightInput({
      tenantId: context.tenantId,
      institutionId: context.institutionId ?? 'institution-low-sensitive-001',
      operatorRole: context.role,
    }));

    await recordAudit({
      context,
      action: 'read',
      result: 'allowed',
      reason: 'real_channel_preflight_viewed',
      occurredAt,
    });

    return NextResponse.json({
      preflight,
      boundary: {
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noRealExternalIntegration: true,
        labels: [
          '当前仅前置检查',
          '不接真实企业微信 / 微信',
          '不配置 secret / token',
          '不真实发送',
          '不真实出网',
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

    const preflight = evaluateRealChannelPreflight(parsePreflightInput(body.value, context));

    await recordAudit({
      context,
      action: 'review',
      result: preflight.blocked ? 'denied' : 'allowed',
      reason: preflight.auditReason,
      occurredAt,
    });

    return NextResponse.json({
      preflight,
      boundary: {
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        localSimulationOnly: true,
        noSecretAccepted: true,
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
