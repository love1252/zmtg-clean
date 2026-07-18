import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const downstream = vi.hoisted(() => {
  const auditRecord = vi.fn(() => {
    throw new Error('audit record must not run');
  });
  const createCustomer = vi.fn(() => {
    throw new Error('customer create must not run');
  });
  const databaseTransaction = vi.fn(() => {
    throw new Error('database transaction must not run');
  });
  const listCustomersForImport = vi.fn(() => {
    throw new Error('customer import query must not run');
  });

  return {
    auditRecord,
    canAccessResource: vi.fn(() => {
      throw new Error('authorization must not run');
    }),
    checkTenantQuotaForUsage: vi.fn(() => {
      throw new Error('quota check must not run');
    }),
    createAuditEvent: vi.fn(() => {
      throw new Error('audit event must not be created');
    }),
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createCustomer,
    createTenantBusinessRepository: vi.fn(() => ({
      createCustomer,
      listCustomersByTenantAndInstitutionForImport: listCustomersForImport,
    })),
    databaseTransaction,
    getCustomerImportRowsForExecution: vi.fn(() => {
      throw new Error('customer import execution parser must not run');
    }),
    getDatabase: vi.fn(() => ({ transaction: databaseTransaction })),
    getDemoAccessContextFromRequest: vi.fn(() => {
      throw new Error('session must not be read');
    }),
    listCustomersForImport,
    previewLowSensitiveCustomerImport: vi.fn(() => {
      throw new Error('customer import preview parser must not run');
    }),
    runTenantBusinessAuditTransaction: vi.fn(() => {
      throw new Error('business audit transaction must not run');
    }),
  };
});

vi.mock('@/modules/audit/domain/audit-events', () => ({
  createAuditEvent: downstream.createAuditEvent,
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: downstream.createAuditEventRepository,
}));

vi.mock('@/modules/institution/server/customer-import', () => ({
  getCustomerImportRowsForExecution: downstream.getCustomerImportRowsForExecution,
  previewLowSensitiveCustomerImport: downstream.previewLowSensitiveCustomerImport,
}));

vi.mock('@/modules/institution/server/tenant-business-audit-transaction', () => ({
  runTenantBusinessAuditTransaction: downstream.runTenantBusinessAuditTransaction,
}));

vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: downstream.createTenantBusinessRepository,
}));

vi.mock('@/modules/institution/server/tenant-quota-enforcement', () => ({
  checkTenantQuotaForUsage: downstream.checkTenantQuotaForUsage,
}));

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: downstream.canAccessResource,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: downstream.getDemoAccessContextFromRequest,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: downstream.getDatabase,
}));

import {
  POST as customerImportPost,
  PUT as customerImportPut,
} from '@/app/api/institution/customers/import/route';

type CustomerImportHandler = (request: Request) => Response;

const expectedPayload = Object.freeze({
  code: 'capability_disabled',
  error: '机构客户导入能力暂未启用。',
});
const routeSourcePath = 'src/app/api/institution/customers/import/route.ts';

const handlers = [
  { method: 'POST', handler: customerImportPost },
  { method: 'PUT', handler: customerImportPut },
] as const;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNoDownstreamCalls() {
  for (const dependency of Object.values(downstream)) {
    expect(dependency).not.toHaveBeenCalled();
  }
}

async function expectCapabilityDisabledResponse(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedPayload);
}

function createRequest(input: {
  method: 'POST' | 'PUT';
  body: string;
  forged?: boolean;
}) {
  const marker = input.forged ? 'private-forged-import-marker' : 'ordinary-import-marker';

  return new Request(
    `http://localhost/api/institution/customers/import?tenantId=${marker}&payload=${marker}`,
    {
      method: input.method,
      headers: {
        authorization: `Bearer ${marker}`,
        cookie: `demo_session=${marker}`,
        'content-type': 'application/json',
        'x-institution-id': marker,
        'x-tenant-id': marker,
      },
      body: input.body,
    },
  );
}

function createHostileRequest() {
  const traps = {
    get: 0,
    getOwnPropertyDescriptor: 0,
    getPrototypeOf: 0,
    has: 0,
    ownKeys: 0,
  };
  const request = new Proxy({} as Request, {
    get() {
      traps.get += 1;
      throw new Error('Request must not be inspected');
    },
    getOwnPropertyDescriptor() {
      traps.getOwnPropertyDescriptor += 1;
      throw new Error('Request descriptors must not be read');
    },
    getPrototypeOf() {
      traps.getPrototypeOf += 1;
      throw new Error('Request prototype must not be read');
    },
    has() {
      traps.has += 1;
      throw new Error('Request keys must not be checked');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('Request keys must not be enumerated');
    },
  });

  return { request, traps };
}

describe('客户导入 API capability-off 边界', () => {
  it.each(handlers)('$method 普通 JSON 请求同步固定返回无缓存 503', async ({ method, handler }) => {
    const request = createRequest({
      method,
      body: JSON.stringify({ rows: [{ customerDisplayName: '普通导入输入' }] }),
    });

    const response = (handler as CustomerImportHandler)(request);

    expect(response).toBeInstanceOf(Response);
    expect(request.bodyUsed).toBe(false);
    await expectCapabilityDisabledResponse(response);
    expectNoDownstreamCalls();
  });

  it.each(handlers)('$method 伪造上下文和敏感输入不被读取或回显', async ({ method, handler }) => {
    const privateMarker = 'private-forged-import-marker';
    const request = createRequest({
      method,
      forged: true,
      body: JSON.stringify({
        institutionId: privateMarker,
        operatorRef: privateMarker,
        rows: [{ accessToken: privateMarker, phoneNumber: privateMarker }],
        tenantId: privateMarker,
      }),
    });

    const response = (handler as CustomerImportHandler)(request);
    const responseCopy = response.clone();

    expect(response).toBeInstanceOf(Response);
    expect(request.bodyUsed).toBe(false);
    await expectCapabilityDisabledResponse(response);
    const serialized = JSON.stringify(await responseCopy.json());
    expect(serialized).not.toContain(privateMarker);
    expect(serialized).not.toMatch(/accessToken|authorization|cookie|institutionId|operatorRef|phoneNumber|tenantId/iu);
    expectNoDownstreamCalls();
  });

  it.each(handlers)('$method 非法 JSON 仍同步固定返回无缓存 503 且 body 未消费', async ({ method, handler }) => {
    const invalidMarker = 'private-invalid-json-import-marker';
    const request = createRequest({
      method,
      body: `{broken-json:${invalidMarker}`,
    });

    const response = (handler as CustomerImportHandler)(request);
    const responseCopy = response.clone();

    expect(response).toBeInstanceOf(Response);
    expect(request.bodyUsed).toBe(false);
    await expectCapabilityDisabledResponse(response);
    expect(JSON.stringify(await responseCopy.json())).not.toContain(invalidMarker);
    expectNoDownstreamCalls();
  });

  it.each(handlers)('$method 对 hostile Proxy Request 零读取、零副作用', async ({ handler }) => {
    const hostile = createHostileRequest();

    const response = (handler as CustomerImportHandler)(hostile.request);

    expect(response).toBeInstanceOf(Response);
    await expectCapabilityDisabledResponse(response);
    expect(hostile.traps).toEqual({
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      ownKeys: 0,
    });
    expectNoDownstreamCalls();
  });

  it.each(handlers)('$method 不读取 body、headers、method、URL 或任一 body reader', async ({ method, handler }) => {
    const privateMarker = `private-input-${method.toLowerCase()}`;
    const bodyReaders = {
      arrayBuffer: vi.fn(async () => new TextEncoder().encode(privateMarker).buffer),
      blob: vi.fn(async () => new Blob([privateMarker])),
      formData: vi.fn(async () => new FormData()),
      json: vi.fn(async () => ({ payload: privateMarker })),
      text: vi.fn(async () => privateMarker),
    };
    const requestFieldRead = vi.fn((value: unknown) => value);
    const request = Object.defineProperties(
      { ...bodyReaders },
      {
        body: { get: () => requestFieldRead(privateMarker) },
        bodyUsed: { get: () => requestFieldRead(false) },
        headers: {
          get: () => requestFieldRead(new Headers({ authorization: privateMarker })),
        },
        method: { get: () => requestFieldRead(method) },
        url: {
          get: () =>
            requestFieldRead(
              `http://localhost/api/institution/customers/import?payload=${privateMarker}`,
            ),
        },
      },
    ) as unknown as Request;

    const response = (handler as CustomerImportHandler)(request);
    const responseCopy = response.clone();

    expect(response).toBeInstanceOf(Response);
    await expectCapabilityDisabledResponse(response);
    expect(JSON.stringify(await responseCopy.json())).not.toContain(privateMarker);
    for (const reader of Object.values(bodyReaders)) {
      expect(reader).not.toHaveBeenCalled();
    }
    expect(requestFieldRead).not.toHaveBeenCalled();
    expectNoDownstreamCalls();
  });

  it('route 仅加载 NextResponse，且源码不保留输入、权限或下游执行链路', () => {
    const source = readFileSync(resolve(process.cwd(), routeSourcePath), 'utf8');
    const importLines = source.split('\n').filter((line) => line.startsWith('import '));

    expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
    for (const method of ['POST', 'PUT']) {
      expect(source).toContain(`export function ${method}(_request: Request)`);
      expect(source).not.toContain(`export async function ${method}`);
    }
    expect(source).not.toMatch(/\b_request\s*(?:\.|\[)/u);

    for (const forbiddenSource of [
      '_request.json(',
      '_request.text(',
      '_request.formData(',
      '_request.arrayBuffer(',
      '_request.blob(',
      '_request.body',
      '_request.headers',
      '_request.method',
      '_request.url',
      'new URL',
      'searchParams',
      'getDemoAccessContextFromRequest',
      'canAccessResource',
      'getDatabase',
      'createTenantBusinessRepository',
      'listCustomersByTenantAndInstitutionForImport',
      'checkTenantQuotaForUsage',
      'createAuditEvent',
      'createAuditEventRepository',
      'runTenantBusinessAuditTransaction',
      'previewLowSensitiveCustomerImport',
      'getCustomerImportRowsForExecution',
      'repository',
      'quota',
      'audit',
      'transaction',
      'fetch',
      'globalThis',
      'process.env',
    ]) {
      expect(source).not.toContain(forbiddenSource);
    }
  });
});
