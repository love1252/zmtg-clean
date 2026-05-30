import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { parseFollowUpTransitionPayload } from '@/modules/institution/server/tenant-business-write-input';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessListRequest({
      context,
      resource: 'follow_up',
      list: repository.listFollowUpTasksByTenant,
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseFollowUpTransitionPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'follow_up',
      action: 'update',
      mutate: async (tenantId) => {
        const result = await repository.transitionFollowUpTask({
          tenantId,
          id: parsed.value.id,
          nextStatus: parsed.value.nextStatus,
          actorId: context.userId,
          occurredAt: new Date().toISOString(),
        });

        return result.kind === 'updated'
          ? { kind: 'success', record: result.task }
          : result;
      },
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
