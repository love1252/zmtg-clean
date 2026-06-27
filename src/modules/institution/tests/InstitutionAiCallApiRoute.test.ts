import { describe, expect, it, vi } from 'vitest';
import { POST as aiCallPost } from '@/app/api/institution/knowledge-management/ai-call/route';
import { GET as aiCallUsageGet } from '@/app/api/institution/knowledge-management/ai-call/usage/route';
import { GET as platformAiUsageGet } from '@/app/api/v1/open-platform/ai-usage/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import { requestInstitutionAiCallService } from '@/modules/institution/server/institution-ai-call-service';

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

vi.mock('@/modules/institution/server/tenant-quota-enforcement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-quota-enforcement')>();
  return {
    ...actual,
    checkTenantQuotaForCreate: vi.fn(),
  };
});

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

beforeEach(() => {
  vi.clearAllMocks();
});

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
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 0, limit: 100, resource: 'ai_calls',
    });
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

  it('AI 调用达到上限时返回 409', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('quota_exceeded_ai_calls');
    expect(body.error).toContain('AI 调用');
  });

  it('AI 超限时不调用 provider（不调用 service）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    // 超限时不应调用 AI call service，因为 quota 检查在 service 调用之前
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
  });

  it('AI 超限 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
  });

  it('AI 未超限时正常调用（mock quota 放行）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true,
      current: 5,
      limit: 100,
      resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '冷敷建议保持清洁干燥',
      record: {
        id: 'rec-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
        actorUserId: 'demo-user-admin', provider: 'deepseek', model: 'deepseek-v4-flash',
        promptTokens: 50, completionTokens: 30, totalTokens: 80, latencyMs: 500,
        status: 'succeeded', errorCode: null, createdAt: new Date().toISOString(),
      },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.answer).toBeTruthy();
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
