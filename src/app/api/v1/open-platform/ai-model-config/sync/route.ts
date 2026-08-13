import { NextResponse } from 'next/server';
import { createAttributedTenantAuditEventV1, createAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { isSupportedVendor, type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import {
  createDefaultAiModelVendorAdapter,
  createDryRunAiModelVendorAdapter,
  defaultAiModelVendorRateLimiter,
  runAiModelVendorSync,
  type AiModelVendorSyncedModel,
  type AiModelVendorOperationStatus,
} from '@/modules/open-platform/server/platformAiModelVendorOperations';
import { savePlatformAiModelConfigPersistedView } from '@/modules/open-platform/server/platformAiModelConfigPersistence';
import { createPlatformAiModelConfigSnapshotRepository } from '@/modules/open-platform/server/platformAiModelConfigPersistenceRepository';
import { createVendorProviderConfigRepository } from '@/modules/open-platform/server/vendorProviderConfigRepository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(
  status: number,
  errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_FAILED' | 'AI_MODEL_VENDOR_OPERATION_UNAVAILABLE',
) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function operationReason(status: AiModelVendorOperationStatus): AuditReason {
  if (status === 'success') return 'test_connection_completed';
  if (status === 'timeout') return 'provider_timeout';
  if (status === 'not_configured') return 'test_connection_missing_credential';
  if (status === 'rate_limited') return 'provider_circuit_open';
  return 'provider_unavailable';
}

function createRouteVendorAdapter() {
  return process.env.AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED === 'true'
    ? createDefaultAiModelVendorAdapter()
    : createDryRunAiModelVendorAdapter();
}

async function recordAudit(input: {
  context: AccessContext;
  result: 'allowed' | 'denied';
  reason: AuditReason;
  resourceId?: string;
}) {
  try {
    const repository = createAuditEventRepository(getDatabase());
    const event = createAuditEvent({
      eventId: crypto.randomUUID(),
      context: input.context,
      resource: 'ai_model_config',
      resourceId: input.resourceId,
      action: 'update',
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
    await repository.recordAttributed(attributedEvent);
  } catch {
    // Keep the external operation response low-sensitive and independent from audit persistence failures.
  }
}

async function requireAccess(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };

  const decision = canAccessResource({
    context,
    resource: 'ai_model_config',
    action: 'update',
  });

  if (!decision.allowed) {
    await recordAudit({
      context,
      result: 'denied',
      reason: decision.reason,
    });
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const, context };
}

async function readVendor(request: Request): Promise<SupportedVendor | null> {
  const body = await request.json().catch(() => null);
  const vendor = typeof body === 'object' && body !== null
    ? (body as { vendor?: unknown }).vendor
    : null;

  return isSupportedVendor(vendor) ? vendor : null;
}

function syncedModelToConfigModel(model: AiModelVendorSyncedModel) {
  return {
    modelId: model.modelId,
    displayName: model.displayName,
    description: `${model.displayName} 官方模型列表实时拉取模型`,
    pricingLabel: '按量计费',
    contextWindowLabel: '-',
    capabilityIds: model.capabilityIds && model.capabilityIds.length > 0 ? model.capabilityIds : ['text' as const],
    enabled: false,
    testStatus: 'dry_run' as const,
  };
}

async function persistSyncedModels(input: {
  context: AccessContext;
  vendor: SupportedVendor;
  models: AiModelVendorSyncedModel[];
}) {
  if (input.models.length === 0) return;

  try {
    await savePlatformAiModelConfigPersistedView({
      repository: createPlatformAiModelConfigSnapshotRepository(getDatabase()),
      accessContext: input.context,
      input: {
        providerStates: [{
          providerId: input.vendor,
          syncStatus: 'dry_run',
          syncedModels: input.models.map(syncedModelToConfigModel),
        }],
        dryRunResults: [{
          targetType: 'provider_sync',
          targetId: input.vendor,
          status: 'dry_run',
          message: `同步已完成：${input.vendor}，模型数 ${input.models.length}`,
        }],
      },
    });
  } catch {
    // Sync responses must stay low-sensitive even if persistence is temporarily unavailable.
  }
}

export async function POST(request: Request) {
  const access = await requireAccess(request);
  if (!access.ok) return access.response;

  const vendor = await readVendor(request);
  if (!vendor) return lowSensitiveError(400, 'VALIDATION_FAILED');

  try {
    const repository = createVendorProviderConfigRepository(getDatabase());
    const adapter = createRouteVendorAdapter();
    const result = await runAiModelVendorSync({
      repository,
      adapter,
      rateLimiter: defaultAiModelVendorRateLimiter,
      vendor,
    });

    await recordAudit({
      context: access.context,
      result: result.payload.ok ? 'allowed' : 'denied',
      reason: operationReason(result.payload.status),
      resourceId: vendor,
    });

    if (result.payload.ok) {
      await persistSyncedModels({
        context: access.context,
        vendor,
        models: result.payload.syncedModels,
      });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'AI_MODEL_VENDOR_OPERATION_UNAVAILABLE');
  }
}
