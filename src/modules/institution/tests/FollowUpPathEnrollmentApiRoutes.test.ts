import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as templatesGet } from '@/app/api/institution/followup-paths/templates/route';
import {
  GET as enrollmentsGet,
  POST as enrollmentsPost,
} from '@/app/api/institution/followup-paths/enrollments/route';
import { GET as enrollmentGet } from '@/app/api/institution/followup-paths/enrollments/[enrollmentId]/route';
import { POST as enrollmentCancelPost } from '@/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route';

const routeMocks = vi.hoisted(() => {
  const auditRecord = vi.fn();
  const transactionDatabase = { database: 'transaction-db' };
  const database = {
    database: 'test-db',
    transaction: vi.fn(async (operation: (tx: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    auditRecord,
    canAccessResource: vi.fn(),
    cancelFollowUpPathEnrollment: vi.fn(),
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createEnrollmentFromTreatmentSummary: vi.fn(),
    createTenantBusinessRepository: vi.fn(() => ({ repository: 'tenant-business' })),
    createTreatmentSummaryRepository: vi.fn(() => ({ repository: 'treatment-summary' })),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    getFollowUpPathEnrollment: vi.fn(),
    listFollowUpPathTemplates: vi.fn(),
    listFollowUpPathEnrollments: vi.fn(),
    transactionDatabase,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-business-repository')>();
  return {
    ...actual,
    createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
  };
});

vi.mock('@/modules/institution/server/treatment-summary-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/treatment-summary-repository')>();
  return {
    ...actual,
    createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
  };
});

vi.mock('@/modules/institution/server/followup-path-enrollment-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/followup-path-enrollment-service')
  >();
  return {
    ...actual,
    cancelFollowUpPathEnrollment: routeMocks.cancelFollowUpPathEnrollment,
    createEnrollmentFromTreatmentSummary: routeMocks.createEnrollmentFromTreatmentSummary,
    getFollowUpPathEnrollment: routeMocks.getFollowUpPathEnrollment,
    listFollowUpPathTemplates: routeMocks.listFollowUpPathTemplates,
    listFollowUpPathEnrollments: routeMocks.listFollowUpPathEnrollments,
  };
});

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.cancelFollowUpPathEnrollment.mockReset();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createEnrollmentFromTreatmentSummary.mockReset();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getFollowUpPathEnrollment.mockReset();
  routeMocks.listFollowUpPathTemplates.mockReset();
  routeMocks.listFollowUpPathEnrollments.mockReset();
});

describe('follow-up path enrollment API routes', () => {
  it('GET templates 对任意普通输入固定关闭且不回显输入或初始化下游', async () => {
    const expectedPayload = {
      code: 'capability_disabled',
      error: '随访路径模板能力暂未启用',
    };
    const responses = await Promise.all([
      templatesGet(request('/api/institution/followup-paths/templates')),
      templatesGet(
        request('/api/institution/followup-paths/templates?tenantId=secret-tenant&include=private'),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const payload = await json(response);
      expect(payload).toEqual(expectedPayload);
      expect(JSON.stringify(payload)).not.toMatch(/secret-tenant|private|records|templateKey|tenantId/i);
    }

    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.listFollowUpPathTemplates).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET templates 对 hostile Request 不触发 trap、外部请求或下游调用', async () => {
    let requestTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await templatesGet(hostileRequest);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await json(response)).toEqual({
        code: 'capability_disabled',
        error: '随访路径模板能力暂未启用',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.listFollowUpPathTemplates).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET enrollments 固定关闭且不读取普通请求或查询参数', async () => {
    const plainResponse = await enrollmentsGet(request('/api/institution/followup-paths/enrollments'));
    const queryResponse = await enrollmentsGet(
      request('/api/institution/followup-paths/enrollments?status=active&include=stages', {
        headers: { cookie: 'session=secret-cookie' },
      }),
    );
    const expectedPayload = {
      code: 'follow_up_path_enrollment_list_capability_disabled',
      error: '随访路径实例列表能力暂未启用',
    };

    expect(plainResponse.status).toBe(503);
    expect(plainResponse.headers.get('cache-control')).toBe('no-store');
    expect(await json(plainResponse)).toEqual(expectedPayload);
    expect(queryResponse.status).toBe(503);
    expect(queryResponse.headers.get('cache-control')).toBe('no-store');
    expect(await json(queryResponse)).toEqual(expectedPayload);

    const payloadText = JSON.stringify(expectedPayload);
    expect(payloadText).not.toMatch(/active|stages|secret-cookie/i);
    expect(payloadText).not.toContain('records');
    expect(payloadText).not.toContain('customer');
    expect(payloadText).not.toContain('stages');
    expect(payloadText).not.toContain('task');
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.listFollowUpPathEnrollments).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET enrollments 对 hostile Request 不触发 trap 或依赖调用', async () => {
    let requestTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await enrollmentsGet(hostileRequest);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await json(response)).toEqual({
        code: 'follow_up_path_enrollment_list_capability_disabled',
        error: '随访路径实例列表能力暂未启用',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.listFollowUpPathEnrollments).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST enrollments 对普通、查询和非法输入固定返回低敏 503 且不回显输入', async () => {
    const expectedPayload = {
      code: 'capability_disabled',
      error: '随访路径纳入能力暂未启用',
    };
    const responses = await Promise.all([
      enrollmentsPost(
        request('/api/institution/followup-paths/enrollments', { method: 'POST' }),
      ),
      enrollmentsPost(
        request('/api/institution/followup-paths/enrollments?tenantId=other-tenant', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'treatment_summary',
            sourceId: 'summary_secret_001',
            templateKey: 'hydro_injection_care',
          }),
        }),
      ),
      enrollmentsPost(
        request('/api/institution/followup-paths/enrollments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{invalid-json',
        }),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const payload = await json(response);
      expect(payload).toEqual(expectedPayload);
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('record');
      expect(serialized).not.toContain('source');
      expect(serialized).not.toContain('summary_secret_001');
      expect(serialized).not.toContain('customer');
      expect(serialized).not.toContain('stages');
      expect(serialized).not.toContain('task');
      expect(serialized).not.toContain('audit');
    }

    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.createEnrollmentFromTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST enrollments 对 hostile Request 不触发 trap、外部请求或下游调用', async () => {
    let requestTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await enrollmentsPost(hostileRequest);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await json(response)).toEqual({
        code: 'capability_disabled',
        error: '随访路径纳入能力暂未启用',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.createEnrollmentFromTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST enrollments 源码不包含已关闭的解析、授权、持久化或审计路径', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/api/institution/followup-paths/enrollments/route.ts'),
      'utf8',
    );

    expect(source).not.toMatch(
      /readJsonBody|parseCreatePayload|getDemoAccessContextFromRequest|getDatabase|createAuditEventRepository|createTenantBusinessRepository|createTreatmentSummaryRepository|createEnrollmentFromTreatmentSummary|canAccessResource/,
    );
    expect(source).not.toMatch(/fetch\(|axios|webhook|oauth|\bHIS\b|已创建/i);
  });

  it('GET enrollment detail 固定关闭且不读取普通请求或路径参数', async () => {
    const plainResponse = await enrollmentGet(
      request('/api/institution/followup-paths/enrollments/enrollment_001'),
      { params: Promise.resolve({ enrollmentId: 'enrollment_001' }) },
    );
    const parameterizedResponse = await enrollmentGet(
      request('/api/institution/followup-paths/enrollments/enrollment_002?include=stages', {
        headers: { cookie: 'session=secret-cookie' },
      }),
      { params: Promise.resolve({ enrollmentId: 'enrollment_002' }) },
    );

    const expectedPayload = {
      code: 'follow_up_path_enrollment_detail_capability_disabled',
      error: '随访路径详情能力暂未启用',
    };
    expect(plainResponse.status).toBe(503);
    expect(plainResponse.headers.get('cache-control')).toBe('no-store');
    expect(await json(plainResponse)).toEqual(expectedPayload);
    expect(parameterizedResponse.status).toBe(503);
    expect(parameterizedResponse.headers.get('cache-control')).toBe('no-store');
    expect(await json(parameterizedResponse)).toEqual(expectedPayload);

    const payloadText = JSON.stringify(expectedPayload);
    expect(payloadText).not.toMatch(/enrollment_001|enrollment_002|stages|secret-cookie/i);
    expect(payloadText).not.toContain('record');
    expect(payloadText).not.toContain('stages');
    expect(payloadText).not.toContain('taskIds');
    expect(payloadText).not.toContain('customerId');
    expect(payloadText).not.toContain('customerDisplayName');
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.getFollowUpPathEnrollment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET enrollment detail 对 hostile Request 和 context 不触发 trap 或依赖调用', async () => {
    let requestTraps = 0;
    let contextTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const hostileContext = new Proxy(
      {},
      {
        get() {
          contextTraps += 1;
          throw new Error('context must not be read');
        },
        has() {
          contextTraps += 1;
          throw new Error('context must not be checked');
        },
        ownKeys() {
          contextTraps += 1;
          throw new Error('context must not be enumerated');
        },
      },
    ) as unknown as { params: Promise<{ enrollmentId: string }> };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await enrollmentGet(hostileRequest, hostileContext);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await json(response)).toEqual({
        code: 'follow_up_path_enrollment_detail_capability_disabled',
        error: '随访路径详情能力暂未启用',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(contextTraps).toBe(0);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.getFollowUpPathEnrollment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST cancel 对任意普通输入固定关闭且不回显或调用下游', async () => {
    const expectedPayload = {
      code: 'capability_disabled',
      error: '随访路径取消能力暂未启用',
    };
    const responses = await Promise.all([
      enrollmentCancelPost(
        request('/api/institution/followup-paths/enrollments/enrollment_001/cancel', {
          method: 'POST',
        }),
        { params: Promise.resolve({ enrollmentId: 'enrollment_001' }) },
      ),
      enrollmentCancelPost(
        request(
          '/api/institution/followup-paths/enrollments/secret-enrollment/cancel?tenantId=secret-tenant',
          { method: 'POST', body: 'secret-body' },
        ),
        { params: Promise.resolve({ enrollmentId: 'secret-enrollment' }) },
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const payload = await json(response);
      expect(payload).toEqual(expectedPayload);
      expect(JSON.stringify(payload)).not.toMatch(/secret|enrollment_001|record|customer|audit/i);
    }

    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.cancelFollowUpPathEnrollment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST cancel 对 hostile Request/context/params 不触发 trap、外部请求或下游调用', async () => {
    let requestTraps = 0;
    let contextTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const hostileContext = new Proxy(
      {},
      {
        get() {
          contextTraps += 1;
          throw new Error('context and params must not be read');
        },
        has() {
          contextTraps += 1;
          throw new Error('context and params must not be checked');
        },
        ownKeys() {
          contextTraps += 1;
          throw new Error('context and params must not be enumerated');
        },
      },
    ) as unknown as { params: Promise<{ enrollmentId: string }> };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await enrollmentCancelPost(hostileRequest, hostileContext);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await json(response)).toEqual({
        code: 'capability_disabled',
        error: '随访路径取消能力暂未启用',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(contextTraps).toBe(0);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.cancelFollowUpPathEnrollment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });
});
