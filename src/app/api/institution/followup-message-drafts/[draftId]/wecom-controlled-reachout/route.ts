import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  auditReasonForWeComControlledReachOutFailure,
  parseWeComControlledReachOutRequest,
  type WeComControlledReachOutFailureCode,
} from '@/modules/institution/domain/wecom-controlled-reachout';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import { createWeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import {
  getWeComControlledReachOut,
  prepareWeComControlledReachOut,
  WeComControlledReachOutTransactionAbort,
} from '@/modules/institution/server/wecom-controlled-reachout-service';
import { runWeComControlledReachOutTransaction } from '@/modules/institution/server/wecom-controlled-reachout-transaction';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const MAX_BODY_BYTES = 512;

type RouteContext = { params: Promise<{ draftId: string }> };

type FailedAuditInput = {
  context: AccessContext;
  action: 'read' | 'approve';
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
};

function auditEventId() {
  return globalThis.crypto.randomUUID();
}

function responseForFailure(reason: WeComControlledReachOutFailureCode) {
  const status = reason === 'conflict'
    ? 409
    : reason === 'draft_not_found'
      ? 404
      : reason === 'manual_confirmation_invalid'
        ? 400
        : 422;
  return NextResponse.json({ code: reason, error: reason }, { status });
}

async function readBoundedJsonBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; error: 'invalid_request' | 'body_too_large' }
> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'body_too_large' };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'body_too_large' };
    }
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: 'invalid_request' };
  }
}

function accessAllowed(input: { context: AccessContext; action: 'read_own_tenant' | 'approve' }) {
  const decision = canAccessResource({
    context: input.context,
    resource: 'follow_up',
    action: input.action,
    targetTenantId: input.context.tenantId,
  });
  return {
    allowed: decision.allowed && Boolean(input.context.tenantId && input.context.institutionId),
    reason: decision.allowed
      ? (!input.context.tenantId ? 'missing_tenant' as const : 'role_denied' as const)
      : decision.reason,
  };
}

async function recordFailedAudit(input: FailedAuditInput) {
  const auditRepository = createAuditEventRepository(getDatabase());
  await auditRepository.record(createAuditEvent({
    eventId: auditEventId(),
    context: input.context,
    resource: 'follow_up',
    resourceId: input.resourceId,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: input.occurredAt,
  }));
}

export async function GET(request: Request, { params }: RouteContext) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { draftId } = await params;
  if (!draftId) return NextResponse.json({ error: 'draftId 不可为空' }, { status: 400 });
  const occurredAt = new Date().toISOString();
  const access = accessAllowed({ context, action: 'read_own_tenant' });

  try {
    if (!access.allowed) {
      await recordFailedAudit({ context, action: 'read', occurredAt, reason: access.reason });
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const db = getDatabase();
    const result = await getWeComControlledReachOut({
      context,
      draftId,
      repository: createTenantBusinessRepository(db),
      mappingRepository: createWeComCustomerMappingRepository(db),
      safetyRepository: createTrustedReachOutSafetyRepository(db),
      occurredAt,
    });
    if (result.kind === 'failed') {
      await recordFailedAudit({
        context,
        action: 'read',
        occurredAt,
        reason: auditReasonForWeComControlledReachOutFailure(result.reason),
      });
      return responseForFailure(result.reason);
    }

    return NextResponse.json({ preflight: result.preflight });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { draftId } = await params;
  if (!draftId) return NextResponse.json({ error: 'draftId 不可为空' }, { status: 400 });
  const occurredAt = new Date().toISOString();
  const access = accessAllowed({ context, action: 'approve' });

  try {
    if (!access.allowed || context.role !== 'tenant_admin') {
      await recordFailedAudit({ context, action: 'approve', occurredAt, reason: access.allowed ? 'role_denied' : access.reason });
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const body = await readBoundedJsonBody(request);
    if (!body.ok) {
      await recordFailedAudit({
        context,
        action: 'approve',
        occurredAt,
        reason: body.error === 'body_too_large'
          ? 'wecom_controlled_reachout_body_too_large'
          : 'wecom_controlled_reachout_invalid_request',
      });
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const parsed = parseWeComControlledReachOutRequest(body.value);
    if (!parsed.ok) {
      await recordFailedAudit({
        context,
        action: 'approve',
        occurredAt,
        reason: parsed.reason === 'manual_confirmation_invalid'
          ? 'wecom_controlled_reachout_manual_confirmation_invalid'
          : 'wecom_controlled_reachout_invalid_request',
      });
      return NextResponse.json({ error: parsed.reason }, { status: 400 });
    }

    const db = getDatabase();
    try {
      return await runWeComControlledReachOutTransaction(
        db,
        async ({ repository, mappingRepository, safetyRepository, auditRepository }) => {
          const result = await prepareWeComControlledReachOut({
            context,
            draftId,
            repository,
            mappingRepository,
            safetyRepository,
            auditRepository,
            occurredAt,
            createId: auditEventId,
          });
          if (result.kind === 'failed') {
            await auditRepository.record(createAuditEvent({
              eventId: auditEventId(),
              context,
              resource: 'follow_up',
              action: 'approve',
              result: 'denied',
              reason: auditReasonForWeComControlledReachOutFailure(result.reason),
              occurredAt,
              ...(result.reason === 'draft_not_found' ? {} : { resourceId: draftId }),
            }));
            return responseForFailure(result.reason);
          }

          if (!result.idempotent) {
            await auditRepository.record(createAuditEvent({
              eventId: auditEventId(),
              context,
              resource: 'follow_up',
              resourceId: draftId,
              action: 'approve',
              result: 'transitioned',
              reason: 'wecom_controlled_reachout_ready_no_send',
              occurredAt,
            }));
          }

          return NextResponse.json({
            preflight: result.preflight,
            idempotent: result.idempotent,
          });
        },
      );
    } catch (error) {
      if (error instanceof WeComControlledReachOutTransactionAbort) {
        await recordFailedAudit({
          context,
          action: 'approve',
          resourceId: draftId,
          occurredAt,
          reason: auditReasonForWeComControlledReachOutFailure(error.reason),
        });
        return responseForFailure(error.reason);
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
