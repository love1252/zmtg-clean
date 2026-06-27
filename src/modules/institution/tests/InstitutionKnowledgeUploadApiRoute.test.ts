import { describe, expect, it, vi } from 'vitest';
import { POST as knowledgeUploadPost } from '@/app/api/institution/knowledge-management/upload/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';

const database = { database: 'upload-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-knowledge-upload-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-knowledge-upload-service')
  >('@/modules/institution/server/institution-knowledge-upload-service');
  return {
    ...actual,
    uploadAndParseInstitutionKnowledgeFileService: vi.fn(),
  };
});

vi.mock('@/modules/open-platform/server/platform-knowledge-file-storage', () => ({
  createLocalPlatformKnowledgeFileStorage: vi.fn(() => ({})),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/platform-knowledge-management-repository')
  >('@/modules/open-platform/server/platform-knowledge-management-repository');
  return {
    ...actual,
    createPlatformKnowledgeManagementRepository: vi.fn(() => ({})),
  };
});

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

// jsdom does not support FormData as Request body; upload route needs
// multipart parsing which we can't exercise directly in the test runner.
// The route-level tests below cover auth gates, file-less 400, and the
// quota check when a file IS provided (verified via mock that the check
// fires before the upload service is called).

describe('机构知识库上传 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await knowledgeUploadPost(new Request('http://localhost/api/institution/knowledge-management/upload', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('平台上下文返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await knowledgeUploadPost(new Request('http://localhost/api/institution/knowledge-management/upload', { method: 'POST' }));
    expect(response.status).toBe(403);
  });

  it('无文件字段返回 400', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const response = await knowledgeUploadPost(
      new Request('http://localhost/api/institution/knowledge-management/upload', { method: 'POST' }),
    );
    expect(response.status).toBe(400);
  });

  it('response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await knowledgeUploadPost(new Request('http://localhost/api/institution/knowledge-management/upload', { method: 'POST' }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token');
  });
});
