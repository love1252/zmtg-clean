import { NextResponse } from 'next/server';
import { createAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { getSupportedVendorConfig, isSupportedVendor, type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import {
  createDefaultAiModelVendorAdapter,
  createDryRunAiModelVendorAdapter,
  defaultAiModelVendorRateLimiter,
  runAiModelVendorTest,
  type AiModelVendorOperationStatus,
  type AiModelVendorTestPayload,
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

function isExternalVendorCallEnabled() {
  return process.env.AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED === 'true';
}

async function runRouteDryRunVendorTest(input: {
  vendor: SupportedVendor;
  modelId: string;
}) {
  const rate = defaultAiModelVendorRateLimiter.check({ vendor: input.vendor, operation: 'test' });
  if (!rate.allowed) {
    return {
      status: 'completed' as const,
      payload: {
        ok: false,
        status: 'rate_limited' as const,
        vendor: input.vendor,
        modelId: input.modelId,
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
        errorCode: 'RATE_LIMITED' as const,
        retryAfterMs: rate.retryAfterMs,
      },
    };
  }

  const adapter = createDryRunAiModelVendorAdapter();
  const vendorConfig = getSupportedVendorConfig(input.vendor);
  const payload = await adapter.testModel({
    vendor: input.vendor,
    baseUrl: vendorConfig.defaultBaseUrl,
    apiKey: 'dry-run-placeholder',
    modelId: input.modelId,
  });

  return { status: 'completed' as const, payload };
}

async function recordAudit(input: {
  context: AccessContext;
  result: 'allowed' | 'denied';
  reason: AuditReason;
  resourceId?: string;
}) {
  try {
    const repository = createAuditEventRepository(getDatabase());
    await repository.record(createAuditEvent({
      eventId: crypto.randomUUID(),
      context: input.context,
      resource: 'ai_model_config',
      resourceId: input.resourceId,
      action: 'test_connection',
      result: input.result,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
    }));
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
    action: 'test_connection',
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

async function readPayload(request: Request): Promise<{ vendor: SupportedVendor; modelId: string } | null> {
  const body = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return null;

  const vendor = (body as { vendor?: unknown }).vendor;
  const modelId = (body as { modelId?: unknown }).modelId;
  if (!isSupportedVendor(vendor) || typeof modelId !== 'string' || modelId.trim().length === 0) return null;

  return { vendor, modelId: modelId.trim() };
}

function testResultStatus(payload: AiModelVendorTestPayload) {
  if (payload.status === 'success') return 'dry_run' as const;
  if (payload.status === 'not_configured' || payload.status === 'rate_limited') return 'disabled' as const;
  return 'not_available' as const;
}

function testResultMessage(payload: AiModelVendorTestPayload) {
  if (payload.status === 'success') return `测试已完成：${payload.modelId}`;
  if (payload.status === 'not_configured') return `测试未执行：${payload.modelId} 未配置 Key`;
  if (payload.status === 'rate_limited') return `测试限流：${payload.modelId}`;
  if (payload.status === 'timeout') return `测试超时：${payload.modelId}`;
  return `测试不可用：${payload.modelId}`;
}

async function persistTestResult(input: {
  context: AccessContext;
  payload: AiModelVendorTestPayload;
}) {
  try {
    await savePlatformAiModelConfigPersistedView({
      repository: createPlatformAiModelConfigSnapshotRepository(getDatabase()),
      accessContext: input.context,
      input: {
        dryRunResults: [{
          targetType: 'model_test',
          targetId: `${input.payload.vendor}:${input.payload.modelId}`,
          status: testResultStatus(input.payload),
          message: testResultMessage(input.payload),
        }],
      },
    });
  } catch {
    // Test responses must stay low-sensitive even if persistence is temporarily unavailable.
  }
}

export async function POST(request: Request) {
  const access = await requireAccess(request);
  if (!access.ok) return access.response;

  const payload = await readPayload(request);
  if (!payload) return lowSensitiveError(400, 'VALIDATION_FAILED');

  try {
    const result = isExternalVendorCallEnabled()
      ? await runAiModelVendorTest({
        repository: createVendorProviderConfigRepository(getDatabase()),
        adapter: createRouteVendorAdapter(),
        rateLimiter: defaultAiModelVendorRateLimiter,
        vendor: payload.vendor,
        modelId: payload.modelId,
      })
      : await runRouteDryRunVendorTest({
        vendor: payload.vendor,
        modelId: payload.modelId,
      });

    await recordAudit({
      context: access.context,
      result: result.payload.ok ? 'allowed' : 'denied',
      reason: operationReason(result.payload.status),
      resourceId: `${payload.vendor}:${payload.modelId}`,
    });

    await persistTestResult({
      context: access.context,
      payload: result.payload,
    });

    return NextResponse.json(result.payload, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'AI_MODEL_VENDOR_OPERATION_UNAVAILABLE');
  }
}
