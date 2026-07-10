import { NextResponse } from 'next/server';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createWeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import {
  readWeComCustomerMapping,
  writeWeComCustomerMapping,
} from '@/modules/institution/server/wecom-customer-mapping-service';
import { runWeComCustomerMappingTransaction } from '@/modules/institution/server/wecom-customer-mapping-transaction';
import {
  weComCustomerMappingActions,
  weComCustomerMappingProof,
  type WeComCustomerMappingAction,
} from '@/modules/institution/domain/wecom-customer-mapping';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const requestKeys = ['action', 'proofContactId', 'customerId'] as const;
const requestMaxBytes = 512;

type MappingRequest = {
  action: WeComCustomerMappingAction;
  proofContactId: typeof weComCustomerMappingProof.proofContactId;
  customerId: string;
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `mapping_${Date.now()}`;
}

function contextResponse(request: Request, action: 'read' | 'update'):
  | { ok: true; context: AccessContext & { tenantId: string; institutionId: string } }
  | { ok: false; response: NextResponse } {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  }

  const decision = canAccessResource({
    context,
    resource: 'customer',
    action,
    targetTenantId: context.tenantId,
  });
  if (!decision.allowed || !context.tenantId || !context.institutionId) {
    return {
      ok: false,
      response: NextResponse.json({ error: '没有访问权限' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    context: context as AccessContext & { tenantId: string; institutionId: string },
  };
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > requestMaxBytes) {
    return { ok: false as const, reason: 'body_too_large' as const };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > requestMaxBytes) {
      return { ok: false as const, reason: 'body_too_large' as const };
    }
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, reason: 'invalid_request' as const };
  }
}

function parseRequest(value: unknown): MappingRequest | null {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return null;
  const keys = Object.keys(value);
  if (keys.length !== requestKeys.length || !requestKeys.every((key) => keys.includes(key))) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
  if (
    !weComCustomerMappingActions.includes(body.action as WeComCustomerMappingAction) ||
    body.proofContactId !== weComCustomerMappingProof.proofContactId ||
    !customerId ||
    customerId.length > 64
  ) {
    return null;
  }

  return {
    action: body.action as WeComCustomerMappingAction,
    proofContactId: weComCustomerMappingProof.proofContactId,
    customerId,
  };
}

export async function GET(request: Request) {
  const access = contextResponse(request, 'read');
  if (!access.ok) return access.response;

  try {
    const database = getDatabase();
    const result = await readWeComCustomerMapping({
      tenantId: access.context.tenantId,
      institutionId: access.context.institutionId,
      repositories: {
        customerRepository: createTenantBusinessRepository(database),
        mappingRepository: createWeComCustomerMappingRepository(database),
      },
    });
    const canWrite = canAccessResource({
      context: access.context,
      resource: 'customer',
      action: 'update',
      targetTenantId: access.context.tenantId,
    }).allowed;

    return NextResponse.json({ ...result, canWrite });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = contextResponse(request, 'update');
  if (!access.ok) return access.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json(
      {
        code: body.reason,
        error: body.reason === 'body_too_large' ? '请求体不能超过 512 bytes' : '请求格式不正确',
      },
      { status: body.reason === 'body_too_large' ? 413 : 400 },
    );
  }
  const parsed = parseRequest(body.value);
  if (!parsed) {
    return NextResponse.json(
      { code: 'invalid_request', error: '请求格式不正确' },
      { status: 400 },
    );
  }

  try {
    const database = getDatabase();
    const result = await runWeComCustomerMappingTransaction(database, (repositories) =>
      writeWeComCustomerMapping({
        context: access.context,
        tenantId: access.context.tenantId,
        institutionId: access.context.institutionId,
        action: parsed.action,
        customerId: parsed.customerId,
        occurredAt: new Date().toISOString(),
        createId,
        repositories,
      }),
    );

    if (result.kind === 'customer_not_found') {
      return NextResponse.json(
        { code: 'customer_not_found', error: '客户不存在或不属于当前机构' },
        { status: 404 },
      );
    }
    if (result.kind === 'conflict') {
      return NextResponse.json(
        { code: 'conflict', error: '映射状态已变化，请刷新后重试' },
        { status: 409 },
      );
    }
    if (result.kind === 'invalid_transition') {
      return NextResponse.json(
        { code: 'invalid_transition', error: '当前状态不允许执行此操作' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      outcome: result.kind,
      mapping: {
        ...weComCustomerMappingProof,
        status: result.state.status,
        customerId: result.state.customerId,
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
