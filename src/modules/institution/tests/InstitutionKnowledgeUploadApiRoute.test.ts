import { describe, expect, it, vi } from 'vitest';
import { POST as knowledgeUploadPost } from '@/app/api/institution/knowledge-management/upload/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import { uploadAndParseInstitutionKnowledgeFileService } from '@/modules/institution/server/institution-knowledge-upload-service';

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

vi.mock('@/modules/institution/server/institution-knowledge-write-repository', () => ({
  createInstitutionKnowledgeWriteRepository: vi.fn(() => ({})),
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

/**
 * Create a Request whose formData() returns a valid file object.
 * We override formData on the instance so the route can read a file
 * without depending on jsdom multipart parsing.
 */
function createRequestWithMockFile(): Request {
  const req = new Request('http://localhost/api/institution/knowledge-management/upload', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=test' },
  });
  const mockFile = {
    name: 'test.txt',
    type: 'text/plain',
    size: 6,
    arrayBuffer: async () => new ArrayBuffer(6),
  };
  const mockFormData = {
    get: (key: string) => (key === 'file' ? mockFile : null),
    has: (key: string) => key === 'file',
  };
  // Override instance formData to return our mock
  Object.defineProperty(req, 'formData', {
    value: async () => mockFormData,
    writable: true,
    configurable: true,
  });
  return req;
}

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

  it('知识库文件达到上限时返回 409 且不调用 upload service', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 20,
      limit: 20,
      reason: 'quota_exceeded_knowledge_files',
      resource: 'knowledge_files',
    });

    const response = await knowledgeUploadPost(createRequestWithMockFile());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('quota_exceeded_knowledge_files');
    expect(body.error).toContain('知识库文件');
    expect(uploadAndParseInstitutionKnowledgeFileService).not.toHaveBeenCalled();
  });

  it('知识库超限 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 20,
      limit: 20,
      reason: 'quota_exceeded_knowledge_files',
      resource: 'knowledge_files',
    });

    const response = await knowledgeUploadPost(createRequestWithMockFile());
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
  });

  it('知识库未超限时上传 .txt 成功（mock quota 放行）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true,
      current: 5,
      limit: 20,
      resource: 'knowledge_files',
    });
    vi.mocked(uploadAndParseInstitutionKnowledgeFileService).mockResolvedValueOnce({
      status: 'created',
      knowledgeId: 'k1',
      sourceId: 's1',
      file: {
        fileId: 'f1', tenantId: 'demo-tenant-001', knowledgeId: 'k1',
        originalFilename: 'test.txt', mimeType: 'text/plain', sizeBytes: 100,
        status: 'active', fileType: 'TXT', sizeLabel: '1 KB',
        parseStatus: 'succeeded', failureReasonCode: null, safeFailureMessage: null,
        textLength: 12, chunkCount: 1, parserVersion: 'v1',
        uploadedByUserId: 'demo-user-admin', createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), archivedAt: null,
      },
      parse: { textLength: 12, chunkCount: 1, parserVersion: 'v1' },
      chunkCount: 1,
    });

    const response = await knowledgeUploadPost(createRequestWithMockFile());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe('created');
    expect(body.chunkCount).toBe(1);
  });
});
