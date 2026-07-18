import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
  getDatabase: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  recordManualFollowUpFeedback: vi.fn(),
  createAuditEventRepository: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));

vi.mock('@/modules/institution/server/followup-customer-timeline-service', () => ({
  recordManualFollowUpFeedback: routeMocks.recordManualFollowUpFeedback,
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

import { POST } from '@/app/api/institution/customers/[customerId]/followup-feedback/route';

const disabledBody = {
  code: 'capability_disabled',
  error: '客户随访反馈记录能力暂未启用',
};

function routeContext(customerId = 'customer_safe_001') {
  return { params: Promise.resolve({ customerId }) };
}

describe('客户随访反馈记录 API capability-off 边界', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    new Request('http://localhost/api/institution/customers/customer_safe_001/followup-feedback', {
      method: 'POST',
      body: JSON.stringify({
        safeSummary: '低敏测试反馈',
        riskLevel: 'normal',
        relatedTaskId: null,
      }),
    }),
    null,
    undefined,
    'invalid-request',
  ])('对普通或非法输入同步返回固定低敏 503，且不初始化下游', async (request) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await POST(
      request as unknown as Request,
      routeContext() as Parameters<typeof POST>[1],
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(disabledBody);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.recordManualFollowUpFeedback).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('不读取 hostile Request、context 或嵌套 params Proxy', async () => {
    const requestTrap = vi.fn(() => {
      throw new Error('request trap must not run');
    });
    const contextTrap = vi.fn(() => {
      throw new Error('context trap must not run');
    });
    const paramsTrap = vi.fn(() => {
      throw new Error('params trap must not run');
    });
    const hostileRequest = new Proxy({}, {
      get: requestTrap,
      getOwnPropertyDescriptor: requestTrap,
      getPrototypeOf: requestTrap,
      ownKeys: requestTrap,
    });
    const hostileContext = new Proxy({}, {
      get: contextTrap,
      getOwnPropertyDescriptor: contextTrap,
      getPrototypeOf: contextTrap,
      ownKeys: contextTrap,
    });
    const hostileParams = new Proxy({}, {
      get: paramsTrap,
      getOwnPropertyDescriptor: paramsTrap,
      getPrototypeOf: paramsTrap,
      ownKeys: paramsTrap,
    });

    const response = await POST(
      hostileRequest as unknown as Request,
      hostileContext as Parameters<typeof POST>[1],
    );
    expect(response.status).toBe(503);
    expect(requestTrap).not.toHaveBeenCalled();
    expect(contextTrap).not.toHaveBeenCalled();

    const nestedParamsResponse = await POST(
      new Request('http://localhost/api/institution/customers/ignored/followup-feedback'),
      { params: hostileParams } as unknown as Parameters<typeof POST>[1],
    );
    expect(nestedParamsResponse.status).toBe(503);
    expect(paramsTrap).not.toHaveBeenCalled();
  });

  it('响应不回显客户、反馈、任务或任意调用方输入', async () => {
    const response = await POST(
      new Request('http://localhost/api/institution/customers/private_customer/followup-feedback', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'private_customer',
          safeSummary: 'private_feedback',
          relatedTaskId: 'private_task',
        }),
      }),
      routeContext('private_customer') as Parameters<typeof POST>[1],
    );
    const bodyText = await response.text();
    const responseBody = JSON.parse(bodyText) as Record<string, unknown>;

    expect(bodyText).toBe(JSON.stringify(disabledBody));
    expect(Object.keys(responseBody)).toEqual(['code', 'error']);
    expect(responseBody).not.toHaveProperty('customer');
    expect(responseBody).not.toHaveProperty('feedback');
    expect(responseBody).not.toHaveProperty('task');
    expect(responseBody).not.toHaveProperty('record');
    expect(bodyText).not.toMatch(/private_/u);
  });

  it('生产 route source 不得恢复 session、body、DB、repository、service 或 audit 链', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/app/api/institution/customers/[customerId]/followup-feedback/route.ts',
      ),
      'utf8',
    );

    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|createTenantBusinessRepository|recordManualFollowUpFeedback|createAuditEventRepository|readJsonBody|parsePayload|\.transaction\(/u,
    );
    expect(source).not.toMatch(
      /@\/modules\/(?:security\/server\/access-context|audit\/|institution\/server\/)|@\/server\/db\/client/u,
    );
  });
});
