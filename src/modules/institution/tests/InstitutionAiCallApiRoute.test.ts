import { describe, expect, it, vi } from 'vitest';
import { POST as aiCallPost } from '@/app/api/institution/knowledge-management/ai-call/route';
import { GET as aiCallUsageGet } from '@/app/api/institution/knowledge-management/ai-call/usage/route';
import { GET as platformAiUsageGet } from '@/app/api/v1/open-platform/ai-usage/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const database = { database: 'ai-call-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-ai-call-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-ai-call-service')
  >('@/modules/institution/server/institution-ai-call-service');
  return {
    ...actual,
    requestInstitutionAiCallService: vi.fn(),
    listInstitutionAiCallUsageService: vi.fn(),
    listPlatformAiUsageSummaryService: vi.fn(),
  };
});

vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => ({
  createAiCallUsageRepository: vi.fn(() => ({})),
}));

vi.mock('@/modules/institution/server/tenant-quota-enforcement', () => ({
  checkTenantQuotaForCreate: vi.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 100, resource: 'ai_calls' })),
}));

const tenantContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'demo_session' as const,
};

const platformContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

describe('机构端 AI 调用 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('平台账号返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    expect(response.status).toBe(403);
  });

  it('机构账号访问平台端 AI 用量仍 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(403);
  });

  it('response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('Bearer');
  });

  it('缺少 question 返回 400', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const { requestInstitutionAiCallService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(requestInstitutionAiCallService).mockResolvedValue({
      status: 'validation_failed',
      message: '请输入问题',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    }));
    expect(response.status).toBe(400);
  });
});

describe('机构端 AI 调用记录 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(401);
  });

  it('平台账号返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(403);
  });
});

describe('平台端 AI 用量聚合 API route', () => {
  it('平台管理员可访问', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const { listPlatformAiUsageSummaryService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listPlatformAiUsageSummaryService).mockResolvedValue({
      requestId: 'platform-ai-usage-summary',
      readonly: true,
      dataSource: 'repository',
      records: [{ tenantId: 't-001', callCount: 3, totalTokens: 300, succeededCount: 2, failedCount: 1 }],
      emptyState: { title: '暂无 AI 调用数据', description: '还没有任何租户发起过 AI 调用。' },
    });
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(200);
  });

  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(401);
  });
});
