import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
import { runTenantBusinessAuditTransaction } from '@/modules/institution/server/tenant-business-audit-transaction';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import {
  parseCreateAppointmentPayload,
  parseUpdateAppointmentPayload,
} from '@/modules/institution/server/tenant-business-write-input';
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
      resource: 'appointment',
      list: repository.listAppointmentsByTenant,
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseCreateAppointmentPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'appointment',
      action: 'create',
      mutate: ({ tenantId, successAuditEvent }) =>
        runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
          const record = await repository.createAppointment({
            ...parsed.value,
            id: globalThis.crypto.randomUUID(),
            tenantId,
            scheduledAt: new Date(parsed.value.scheduledAt),
          });

          await auditRepository.record(successAuditEvent);

          return { kind: 'success', record };
        }),
      auditRepository,
      successStatus: 201,
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

  const parsed = parseUpdateAppointmentPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'appointment',
      action: 'update',
      mutate: ({ tenantId, successAuditEvent }) =>
        runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
          const record = await repository.updateAppointment({
            tenantId,
            ...parsed.value,
          });

          if (!record) {
            return { kind: 'not_found' };
          }

          await auditRepository.record(successAuditEvent);

          return { kind: 'success', record };
        }),
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
