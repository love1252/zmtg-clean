import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sideEffects = vi.hoisted(() => ({
  createDeniedAccessAuditEvent: vi.fn(() => {
    throw new Error('audit event must not be created');
  }),
  createAuditEventRepository: vi.fn(() => {
    throw new Error('audit repository must not be created');
  }),
  getDatabase: vi.fn(() => {
    throw new Error('database must not be opened');
  }),
  getAccessContext: vi.fn(() => {
    throw new Error('session must not be read');
  }),
  createCredentialStorage: vi.fn(() => {
    throw new Error('credential storage must not be initialized');
  }),
  parseCreate: vi.fn(() => {
    throw new Error('create payload must not be parsed');
  }),
  parseUpdate: vi.fn(() => {
    throw new Error('update payload must not be parsed');
  }),
  parseRotate: vi.fn(() => {
    throw new Error('rotate payload must not be parsed');
  }),
  parseClear: vi.fn(() => {
    throw new Error('clear payload must not be parsed');
  }),
  parseRevoke: vi.fn(() => {
    throw new Error('revoke payload must not be parsed');
  }),
  createService: vi.fn(() => {
    throw new Error('create service must not run');
  }),
  updateService: vi.fn(() => {
    throw new Error('update service must not run');
  }),
  rotateService: vi.fn(() => {
    throw new Error('rotate service must not run');
  }),
  clearService: vi.fn(() => {
    throw new Error('clear service must not run');
  }),
  revokeService: vi.fn(() => {
    throw new Error('revoke service must not run');
  }),
}));

vi.mock('@/modules/audit/domain/audit-events', () => ({
  createDeniedAccessAuditEvent: sideEffects.createDeniedAccessAuditEvent,
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: sideEffects.createAuditEventRepository,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: sideEffects.getDatabase,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: sideEffects.getAccessContext,
}));

vi.mock('@/modules/institution/server/his-connection-credential-storage', () => ({
  createInMemoryHisConnectionCredentialStorage: sideEffects.createCredentialStorage,
}));

vi.mock('@/modules/institution/server/his-connection-credential-input', () => ({
  parseCreateHisConnectionCredentialInput: sideEffects.parseCreate,
  parseUpdateHisConnectionCredentialInput: sideEffects.parseUpdate,
  parseRotateHisConnectionCredentialInput: sideEffects.parseRotate,
  parseClearHisConnectionCredentialInput: sideEffects.parseClear,
  parseRevokeHisConnectionCredentialInput: sideEffects.parseRevoke,
}));

vi.mock('@/modules/institution/server/his-connection-credential-service', () => ({
  createHisConnectionCredentialForTenantService: sideEffects.createService,
  updateHisConnectionCredentialForTenantService: sideEffects.updateService,
  rotateHisConnectionCredentialForTenantService: sideEffects.rotateService,
  clearHisConnectionCredentialForTenantService: sideEffects.clearService,
  revokeHisConnectionCredentialForTenantService: sideEffects.revokeService,
}));

import { POST as credentialClearPost } from '@/app/api/institution/his-connections/[connectionId]/credentials/clear/route';
import { POST as credentialRevokePost } from '@/app/api/institution/his-connections/[connectionId]/credentials/revoke/route';
import { POST as credentialRotatePost } from '@/app/api/institution/his-connections/[connectionId]/credentials/rotate/route';
import {
  PATCH as credentialUpdatePatch,
  POST as credentialCreatePost,
} from '@/app/api/institution/his-connections/[connectionId]/credentials/route';

type RouteHandler = (
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) => Response | Promise<Response>;

const expectedBody = Object.freeze({
  code: 'capability_disabled',
  error: '机构 HIS 连接凭证操作暂未启用。',
});

const routeCases: ReadonlyArray<{ name: string; call: RouteHandler }> = [
  { name: 'create', call: credentialCreatePost },
  { name: 'update', call: credentialUpdatePatch },
  { name: 'rotate', call: credentialRotatePost },
  { name: 'clear', call: credentialClearPost },
  { name: 'revoke', call: credentialRevokePost },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function expectNoCredentialSideEffects() {
  for (const dependency of Object.values(sideEffects)) {
    expect(dependency).not.toHaveBeenCalled();
  }
}

function hostileRequest() {
  return new Proxy({} as Request, {
    get() {
      throw new Error('Request must not be inspected');
    },
    has() {
      throw new Error('Request keys must not be checked');
    },
    ownKeys() {
      throw new Error('Request keys must not be enumerated');
    },
  });
}

function hostileRouteContext() {
  return new Proxy(
    {} as { params: Promise<{ connectionId: string }> },
    {
      get() {
        throw new Error('route params must not be inspected');
      },
      has() {
        throw new Error('route params must not be checked');
      },
      ownKeys() {
        throw new Error('route params must not be enumerated');
      },
    },
  );
}

async function expectCapabilityDisabledResponse(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedBody);
}

describe('HIS 连接凭证 API capability-off 共享边界', () => {
  it('create、update、rotate、clear、revoke 对敌意 Request 和 params 固定返回无缓存 503', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('external service must not be called');
    });

    for (const routeCase of routeCases) {
      const response = await routeCase.call(hostileRequest(), hostileRouteContext());

      await expectCapabilityDisabledResponse(response);
      expect(JSON.stringify(expectedBody)).not.toContain(routeCase.name);
      expect(fetchSpy).not.toHaveBeenCalled();
      expectNoCredentialSideEffects();
    }
  });

  it('五类操作均不读取 body、headers、URL、connectionId 或 payload，且不回显输入', async () => {
    for (const routeCase of routeCases) {
      const sensitiveConnectionId = `his_conn_private_${routeCase.name}`;
      const sensitivePayload = `private_payload_${routeCase.name}`;
      const bodyReaders = {
        arrayBuffer: vi.fn(async () => new TextEncoder().encode(sensitivePayload).buffer),
        formData: vi.fn(async () => new FormData()),
        json: vi.fn(async () => ({
          action: routeCase.name,
          connectionId: sensitiveConnectionId,
          payload: sensitivePayload,
          token: 'secret_token_must_not_escape',
        })),
        text: vi.fn(async () => sensitivePayload),
      };
      const headerRead = vi.fn(
        () => new Headers({ authorization: 'Bearer secret_token_must_not_escape' }),
      );
      const requestFieldRead = vi.fn((value: unknown) => value);
      const paramsRead = vi.fn(() => Promise.resolve({ connectionId: sensitiveConnectionId }));
      const request = Object.defineProperties(
        { ...bodyReaders },
        {
          body: { get: () => requestFieldRead(sensitivePayload) },
          headers: { get: headerRead },
          method: { get: () => requestFieldRead(routeCase.name) },
          url: {
            get: () =>
              requestFieldRead(
                `http://localhost/api/institution/his-connections/${sensitiveConnectionId}/credentials?action=${routeCase.name}&payload=${sensitivePayload}`,
              ),
          },
        },
      ) as unknown as Request;
      const context = Object.defineProperty({}, 'params', {
        get: paramsRead,
      }) as { params: Promise<{ connectionId: string }> };

      const response = await routeCase.call(request, context);
      const responseBody = await response.json();
      const serialized = JSON.stringify(responseBody);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(responseBody).toEqual(expectedBody);
      expect(serialized).not.toContain(routeCase.name);
      expect(serialized).not.toContain(sensitiveConnectionId);
      expect(serialized).not.toContain(sensitivePayload);
      expect(serialized).not.toMatch(/tenantId|credentialRef|token|secret|api[_-]?key/iu);
      for (const bodyReader of Object.values(bodyReaders)) {
        expect(bodyReader).not.toHaveBeenCalled();
      }
      expect(headerRead).not.toHaveBeenCalled();
      expect(requestFieldRead).not.toHaveBeenCalled();
      expect(paramsRead).not.toHaveBeenCalled();
      expectNoCredentialSideEffects();
    }
  });

  it('共享 handler 源码不保留 session、数据库、audit、parser、storage 或 service 链路', () => {
    const implementation = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/his-connections/[connectionId]/credentials/credential-route.ts',
      ),
      'utf8',
    );
    const importSources = [...implementation.matchAll(/from ['"]([^'"]+)['"]/gu)].map(
      (match) => match[1],
    );

    expect(importSources).toEqual(['next/server']);
    for (const forbidden of [
      'createDeniedAccessAuditEvent',
      'createAuditEventRepository',
      'getDatabase',
      'getDemoAccessContextFromRequest',
      'createInMemoryHisConnectionCredentialStorage',
      'parseCreateHisConnectionCredentialInput',
      'parseUpdateHisConnectionCredentialInput',
      'parseRotateHisConnectionCredentialInput',
      'parseClearHisConnectionCredentialInput',
      'parseRevokeHisConnectionCredentialInput',
      'createHisConnectionCredentialForTenantService',
      'updateHisConnectionCredentialForTenantService',
      'rotateHisConnectionCredentialForTenantService',
      'clearHisConnectionCredentialForTenantService',
      'revokeHisConnectionCredentialForTenantService',
      '_request.json(',
      '_request.formData(',
      '_request.arrayBuffer(',
      '_context.params',
    ]) {
      expect(implementation).not.toContain(forbidden);
    }
  });
});
