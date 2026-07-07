import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/followup-operations/dashboard/route';
import type { FollowUpOperationsDashboard } from '@/modules/institution/domain/followup-operations-dashboard';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const auditRecord = vi.fn();
  const database = { database: 'test-db' };

  return {
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createTenantBusinessRepository: vi.fn(() => ({ repository: 'tenant-business' })),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    getFollowUpOperationsDashboard: vi.fn(),
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

vi.mock('@/modules/institution/server/followup-operations-dashboard-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/followup-operations-dashboard-service')
  >();
  return {
    ...actual,
    getFollowUpOperationsDashboard: routeMocks.getFollowUpOperationsDashboard,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  source: 'demo_session',
};

const dashboard: FollowUpOperationsDashboard = {
  overview: {
    activeEnrollmentCount: 2,
    todayDueTaskCount: 3,
    overdueTaskCount: 1,
    pendingTaskCount: 4,
    completedTaskCount: 5,
    escalatedTaskCount: 1,
    highRiskTaskCount: 2,
    draftCount: 6,
    approvedDraftCount: 2,
    markedSentCount: 1,
    approvedButNotMarkedSentCount: 1,
    messageDeliveryCount: 4,
    mockSentCount: 1,
    mockFailedCount: 1,
    skippedCount: 1,
    externalDisabledCount: 1,
    manualFeedbackCount: 1,
  },
  pathPerformance: [
    {
      templateKey: 'hydro_injection_care',
      pathName: '水光术后管理',
      activeEnrollmentCount: 1,
      generatedTaskCount: 3,
      pendingTaskCount: 2,
      completedTaskCount: 1,
      overdueTaskCount: 1,
      escalatedTaskCount: 0,
      completionRate: 33.33,
      nextDueAt: '2026-07-07T10:00:00.000Z',
    },
  ],
  workload: [
    {
      handlerRole: 'medical_assistant',
      assignedUserId: null,
      pendingTaskCount: 2,
      overdueTaskCount: 1,
      completedTaskCount: 1,
      escalatedTaskCount: 0,
    },
  ],
  draftOperations: {
    draftCount: 6,
    approvedDraftCount: 2,
    rejectedDraftCount: 1,
    markedSentCount: 1,
    approvedButNotMarkedSentCount: 1,
  },
  messageDeliveries: {
    messageDeliveryCount: 4,
    mockSentCount: 1,
    mockFailedCount: 1,
    skippedCount: 1,
    externalDisabledCount: 1,
    recentDeliveries: [
      {
        deliveryId: 'msg-delivery:draft_001',
        customerId: 'cust_001',
        followUpTaskId: 'task_001',
        messageDraftId: 'draft_001',
        channelType: 'mock',
        deliveryMode: 'mock',
        recipientRef: 'customer:cust_001',
        contentSnapshot: '低敏人工确认内容快照',
        status: 'mock_sent',
        failureReason: null,
        createdAt: '2026-07-06T10:00:00.000Z',
        sentAt: '2026-07-06T10:00:00.000Z',
        updatedAt: '2026-07-06T10:00:00.000Z',
      },
    ],
  },
  riskSummary: {
    escalatedTaskCount: 1,
    highRiskTaskCount: 2,
    highRiskPendingTaskCount: 1,
    overdueHighRiskTaskCount: 1,
    manualFeedbackCount: 1,
  },
};

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.getFollowUpOperationsDashboard.mockReset();
});

describe('follow-up operations dashboard API route', () => {
  it('GET 返回只读运营看板且不暴露租户、隐私或 provider 字段', async () => {
    routeMocks.getFollowUpOperationsDashboard.mockResolvedValue({
      kind: 'success',
      dashboard,
    });

    const response = await GET(request('/api/institution/followup-operations/dashboard'));
    const payload = await json(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).toEqual(dashboard);
    expect(routeMocks.getFollowUpOperationsDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        context: tenantContext,
        tenantBusinessRepository: { repository: 'tenant-business' },
        now: expect.any(Date),
      }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'allowed', resource: 'follow_up', action: 'read_own_tenant' }),
    );
    expect(serialized).not.toMatch(
      /tenantId|institutionId|phoneNumber|idNumber|medicalRecordNo|HIS|provider|model|token|cost|vendor|prompt|raw|DATABASE_URL|secret|stack/i,
    );
  });

  it('未登录时返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(request('/api/institution/followup-operations/dashboard'));
    const payload = await json(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.getFollowUpOperationsDashboard).not.toHaveBeenCalled();
  });

  it('缺少 tenant 或 service 拒绝时返回 403 并记录 denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...tenantContext,
      tenantId: null,
    });

    const response = await GET(request('/api/institution/followup-operations/dashboard'));
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: '没有访问权限' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'denied', reason: 'missing_tenant' }),
    );
    expect(routeMocks.getFollowUpOperationsDashboard).not.toHaveBeenCalled();
  });

  it('数据异常时返回稳定 503 文案且不泄露错误详情', async () => {
    routeMocks.getFollowUpOperationsDashboard.mockRejectedValue(
      new Error('select * from follow_up_tasks; DATABASE_URL=postgres://secret; token=abc'),
    );

    const response = await GET(request('/api/institution/followup-operations/dashboard'));
    const payload = await json(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expect(serialized).not.toMatch(/select \*|DATABASE_URL|postgres:\/\/|token|secret|stack/i);
  });
});
