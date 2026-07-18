import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
import { runTenantBusinessAuditTransaction } from '@/modules/institution/server/tenant-business-audit-transaction';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import {
  parseCreateCustomerPayload,
  parseUpdateCustomerPayload,
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

const customerListReadDisabled = Object.freeze({
  code: 'customer_list_capability_disabled',
  error: '客户列表能力暂未启用',
});

/**
 * No request data is inspected until an institution-scoped server guard and reader exist.
 * This deliberately avoids demo-session, database, repository, audit, and fetch side effects.
 */
export async function GET() {
  return NextResponse.json(customerListReadDisabled, { status: 503 });
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

  const parsed = parseCreateCustomerPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const institutionId = context.institutionId;
  if (!institutionId) {
    return NextResponse.json({ error: '当前登录上下文缺少机构信息' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'customer',
      action: 'create',
      mutate: async ({ tenantId, successAuditEvent }) => {
        const quotaDecision = await checkTenantQuotaForCreate({
          database: db,
          tenantId,
          resource: 'customers',
        });
        if (!quotaDecision.allowed) {
          return { kind: 'quota_denied', decision: quotaDecision };
        }

        return runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
          const record = await repository.createCustomer({
            id: globalThis.crypto.randomUUID(),
            tenantId,
            institutionId,
            ...parsed.value,
          });

          await auditRepository.record({ ...successAuditEvent, resourceId: record.id });

          return { kind: 'success', record };
        });
      },
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

  const parsed = parseUpdateCustomerPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'customer',
      action: 'update',
      mutate: ({ tenantId, successAuditEvent }) =>
        runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
          const record = await repository.updateCustomer({
            tenantId,
            ...parsed.value,
          });

          if (!record) {
            return { kind: 'not_found' };
          }

          await auditRepository.record({ ...successAuditEvent, resourceId: record.id });

          return { kind: 'success', record };
        }),
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
