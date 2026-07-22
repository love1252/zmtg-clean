import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as treatmentSummariesPost } from '@/app/api/institution/customers/[customerId]/treatment-summaries/route';
import { PATCH as treatmentSummaryPatch } from '@/app/api/institution/treatment-summaries/[summaryId]/route';
import { POST as treatmentSummaryVoidPost } from '@/app/api/institution/treatment-summaries/[summaryId]/void/route';

const routeMocks = vi.hoisted(() => {
  const transaction = vi.fn();

  return {
    canAccessResource: vi.fn(),
    createAuditEventRepository: vi.fn(),
    createTenantBusinessRepository: vi.fn(),
    createTreatmentSummaryRepository: vi.fn(),
    getDatabase: vi.fn(() => ({ transaction })),
    getDemoAccessContextFromRequest: vi.fn(),
    parseCreateTreatmentSummaryPayload: vi.fn(),
    parseUpdateTreatmentSummaryPayload: vi.fn(),
    parseVoidTreatmentSummaryPayload: vi.fn(),
    transaction,
  };
});

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));

vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

vi.mock('@/modules/institution/server/treatment-summary-write-input', () => ({
  parseCreateTreatmentSummaryPayload: routeMocks.parseCreateTreatmentSummaryPayload,
  parseUpdateTreatmentSummaryPayload: routeMocks.parseUpdateTreatmentSummaryPayload,
  parseVoidTreatmentSummaryPayload: routeMocks.parseVoidTreatmentSummaryPayload,
}));

type RouteContext = {
  params: Promise<{ summaryId: string }>;
};

type DisabledMutationHandler = (
  request: Request,
  context: RouteContext,
) => Response | Promise<Response>;

type DisabledMutationContract = {
  error: string;
  handler: DisabledMutationHandler;
  method: 'PATCH' | 'POST';
  path: string;
  sourcePath: string;
  sourceExport: 'PATCH' | 'POST';
};

const downstreamMocks = [
  routeMocks.getDemoAccessContextFromRequest,
  routeMocks.canAccessResource,
  routeMocks.getDatabase,
  routeMocks.createTenantBusinessRepository,
  routeMocks.createTreatmentSummaryRepository,
  routeMocks.createAuditEventRepository,
  routeMocks.parseCreateTreatmentSummaryPayload,
  routeMocks.parseUpdateTreatmentSummaryPayload,
  routeMocks.parseVoidTreatmentSummaryPayload,
  routeMocks.transaction,
] as const;

function routeContext(summaryId = 'summary_safe_001'): RouteContext {
  return { params: Promise.resolve({ summaryId }) };
}

function requestVariants(method: 'PATCH' | 'POST', path: string) {
  return [
    {
      label: '普通请求',
      request: new Request(`http://localhost${path}`, {
        method,
        body: JSON.stringify({ summary: 'caller_marker_summary' }),
      }),
    },
    {
      label: 'query、header 与 cookie 注入请求',
      request: new Request(
        `http://localhost${path}?tenantId=caller_marker_tenant&institutionId=caller_marker_institution`,
        {
          method,
          headers: {
            cookie: 'session=caller_marker_cookie',
            'x-tenant-id': 'caller_marker_header',
          },
          body: JSON.stringify({
            customer: 'caller_marker_customer',
            nextCareAction: 'caller_marker_action',
            voidReason: 'caller_marker_reason',
          }),
        },
      ),
    },
    {
      label: '非法 JSON 请求',
      request: new Request(`http://localhost${path}`, {
        method,
        body: '{caller_marker_invalid_json',
      }),
    },
  ] as const;
}

function createHostileProxy(label: string) {
  const trap = vi.fn(() => {
    throw new Error(`${label} trap must not run`);
  });
  const proxy = new Proxy({}, {
    get: trap,
    getOwnPropertyDescriptor: trap,
    getPrototypeOf: trap,
    has: trap,
    ownKeys: trap,
    set: trap,
  });

  return { proxy, trap };
}

function expectNoDownstreamCalls() {
  for (const downstream of downstreamMocks) {
    expect(downstream).not.toHaveBeenCalled();
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
}

async function expectDisabledResponse(response: Response, error: string) {
  const expected = { code: 'capability_disabled', error };
  const text = await response.text();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(text).toBe(JSON.stringify(expected));
  expect(Object.keys(JSON.parse(text) as Record<string, unknown>)).toEqual(['code', 'error']);
  expect(text).not.toMatch(
    /caller_marker|summary|nextCareAction|voidReason|customer|record|tenantId|institutionId/u,
  );
}

function describeDisabledMutation(contract: DisabledMutationContract) {
  describe(`${contract.sourceExport} ${contract.path} capability-off 边界`, () => {
    it.each(requestVariants(contract.method, contract.path))(
      '$label 同步返回固定低敏 503，且不读取或初始化下游',
      async ({ request }) => {
        const result = contract.handler(request, routeContext());

        expect(result).toBeInstanceOf(Response);
        await expectDisabledResponse(result as Response, contract.error);
        expectNoDownstreamCalls();
      },
    );

    it('不读取 hostile Request 或 context Proxy', async () => {
      const hostileRequest = createHostileProxy('request');
      const hostileContext = createHostileProxy('context');

      const result = contract.handler(
        hostileRequest.proxy as unknown as Request,
        hostileContext.proxy as unknown as RouteContext,
      );

      expect(result).toBeInstanceOf(Response);
      await expectDisabledResponse(result as Response, contract.error);
      expect(hostileRequest.trap).not.toHaveBeenCalled();
      expect(hostileContext.trap).not.toHaveBeenCalled();
      expectNoDownstreamCalls();
    });

    it('不读取 context 内嵌 params Proxy', async () => {
      const hostileParams = createHostileProxy('params');
      const result = contract.handler(
        new Request(`http://localhost${contract.path}`, { method: contract.method }),
        { params: hostileParams.proxy } as unknown as RouteContext,
      );

      expect(result).toBeInstanceOf(Response);
      await expectDisabledResponse(result as Response, contract.error);
      expect(hostileParams.trap).not.toHaveBeenCalled();
      expectNoDownstreamCalls();
    });

    it('生产 source 仅导入 NextResponse，保留必填双参数且不恢复旧链', () => {
      const source = readFileSync(join(process.cwd(), contract.sourcePath), 'utf8');
      const importLines = source.split('\n').filter((line) => line.startsWith('import '));
      const signature = new RegExp(
        `export function ${contract.sourceExport}\\(\\s*_request: Request,\\s*_context: [A-Za-z]+,\\s*\\)`,
        'u',
      );

      expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
      expect(source).toMatch(signature);
      expect(source).not.toMatch(/_request\?:|_context\?:/u);
      expect(source).not.toMatch(
        /getDemoAccessContextFromRequest|canAccessResource|getDatabase|createTenantBusinessRepository|createTreatmentSummaryRepository|createAuditEventRepository|readJsonBody|parseUpdateTreatmentSummaryPayload|parseVoidTreatmentSummaryPayload|\.transaction\(|\b_?request\s*(?:\.|\[)|\b_?context\s*(?:\.|\[)|fetch\s*\(/u,
      );
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('已关闭的客户治疗摘要创建 route 回归', () => {
  it('仍固定返回低敏 503，且不进入旧创建链', async () => {
    const response = treatmentSummariesPost(
      new Request(
        'http://localhost/api/institution/customers/caller_marker_customer/treatment-summaries',
        {
          method: 'POST',
          body: JSON.stringify({ summary: 'caller_marker_summary' }),
        },
      ),
      { params: Promise.resolve({ customerId: 'caller_marker_customer' }) },
    );

    expect(response).toBeInstanceOf(Response);
    await expectDisabledResponse(response, '客户治疗摘要创建能力暂未启用');
    expectNoDownstreamCalls();
  });
});

describeDisabledMutation({
  error: '治疗摘要编辑能力暂未启用',
  handler: treatmentSummaryPatch,
  method: 'PATCH',
  path: '/api/institution/treatment-summaries/caller_marker_summary',
  sourcePath: 'src/app/api/institution/treatment-summaries/[summaryId]/route.ts',
  sourceExport: 'PATCH',
});

describeDisabledMutation({
  error: '治疗摘要作废能力暂未启用',
  handler: treatmentSummaryVoidPost,
  method: 'POST',
  path: '/api/institution/treatment-summaries/caller_marker_summary/void',
  sourcePath: 'src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts',
  sourceExport: 'POST',
});
