import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { createAttributedTenantAuditEventV1, createAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { canAccessResource, type AccessContext, type AccessDecision, type ProtectedAction } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  getPlatformAiModelConfigPersistedView,
  savePlatformAiModelConfigPersistedView,
} from '@/modules/open-platform/server/platformAiModelConfigPersistence';
import { createPlatformAiModelConfigSnapshotRepository } from '@/modules/open-platform/server/platformAiModelConfigPersistenceRepository';
import type { PlatformAiModelConfigPersistedInput } from '@/modules/open-platform/server/platformAiModelConfigPersistenceTypes';

function lowSensitiveError(
  status: number,
  errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_FAILED' | 'AI_MODEL_CONFIG_UNAVAILABLE',
) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function repositories() {
  const database = getDatabase();
  return {
    configRepository: createPlatformAiModelConfigSnapshotRepository(database),
    auditRepository: createAuditEventRepository(database),
  };
}

async function recordAccessAudit(input: {
  context: AccessContext;
  action: ProtectedAction;
  result: 'allowed' | 'denied';
  reason: AccessDecision['reason'];
}) {
  try {
    const event = createAuditEvent({
      eventId: crypto.randomUUID(),
      context: input.context,
      resource: 'ai_model_config',
      action: input.action,
      result: input.result,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
    });
    const attributedEvent = createAttributedTenantAuditEventV1({
      event,
      attribution: {
        institutionAttribution: 'not_applicable',
        tenantId: event.tenantId,
        institutionId: null,
      },
    });
    if (!attributedEvent) throw new Error('invalid_platform_audit_attribution');
    await repositories().auditRepository.recordAttributed(attributedEvent);
  } catch {
    // Audit failures are intentionally not reflected into the low-sensitive API response.
  }
}

async function requireAccess(request: Request, action: ProtectedAction) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  }

  const decision = canAccessResource({
    context,
    resource: 'ai_model_config',
    action,
  });

  if (!decision.allowed) {
    await recordAccessAudit({
      context,
      action,
      result: 'denied',
      reason: decision.reason,
    });
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const, context };
}

export async function GET(request: Request) {
  const access = await requireAccess(request, 'read_detail');
  if (!access.ok) return access.response;

  try {
    const { configRepository } = repositories();
    const payload = await getPlatformAiModelConfigPersistedView({ repository: configRepository });
    await recordAccessAudit({
      context: access.context,
      action: 'read_detail',
      result: 'allowed',
      reason: 'allowed_by_policy',
    });

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'AI_MODEL_CONFIG_UNAVAILABLE');
  }
}

export async function PUT(request: Request) {
  const access = await requireAccess(request, 'update');
  if (!access.ok) return access.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const { configRepository } = repositories();
    const result = await savePlatformAiModelConfigPersistedView({
      repository: configRepository,
      accessContext: access.context,
      input: payload as PlatformAiModelConfigPersistedInput,
    });

    if (result.status === 'validation_failed') {
      return NextResponse.json(result.payload, { status: 400 });
    }
    if (result.status === 'permission_denied') {
      return NextResponse.json(result.payload, { status: 403 });
    }

    await recordAccessAudit({
      context: access.context,
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
    });

    return NextResponse.json(result.payload, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'AI_MODEL_CONFIG_UNAVAILABLE');
  }
}
