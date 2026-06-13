import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import * as itemsRoute from '@/app/api/institution/knowledge-management/items/route';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const database = { database: 'institution-knowledge-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
};

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/platform-knowledge-management-repository')
  >('@/modules/open-platform/server/platform-knowledge-management-repository');

  return {
    ...actual,
    createPlatformKnowledgeManagementRepository: vi.fn(() => repository),
  };
});

const apiUrl = 'http://localhost/api/institution/knowledge-management/items';
const now = new Date('2026-06-13T08:00:00.000Z');
const unsafeError = new Error(
  'DATABASE_URL postgres://root:password@localhost token=secret /Users/demo/path SQL stack',
);
const unsafeFragments = [
  'DATABASE_URL',
  'postgres',
  'password',
  'token',
  'secret',
  '/Users/',
  'SQL',
  'stack',
];
const forbiddenKnowledgeFields = [
  'content',
  'rawContent',
  'parsedContent',
  'embedding',
  'embeddingVectorJson',
  'trainingContent',
];

const routeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-visible-route',
    tenantId: 'tenant-route',
    tenantName: '路由租户',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-route',
    title: '机构端授权可见知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '机构端只读低敏摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-hidden-route',
    tenantId: 'tenant-route',
    tenantName: '路由租户',
    institutionId: 'inst-other',
    workspaceId: 'workspace-hidden',
    title: '未授权知识',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
];

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

describe('机构端知识库管理 V1 只读 API route', () => {
  beforeEach(() => {
    repository.listKnowledgeItems.mockReset();
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      source: 'demo_session',
    });
  });

  it('GET 只返回当前机构被平台授权可见的低敏知识库记录', async () => {
    repository.listKnowledgeItems.mockResolvedValue(routeRecords);

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?keyword=${encodeURIComponent('授权')}&page=1&pageSize=10`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeItems).toHaveBeenCalledWith({ tenantId: 'tenant-route' });
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible-route',
        title: '机构端授权可见知识',
        visibility: 'platform_authorized',
      }),
    ]);
    expect(serialized).not.toContain('knowledge-hidden-route');
    forbiddenKnowledgeFields.forEach((field) => {
      expect(serialized).not.toContain(`"${field}"`);
    });
  });

  it('没有机构上下文时拒绝访问且不初始化 repository', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValueOnce({
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: null,
      source: 'demo_session',
    });

    const response = await itemsRoute.GET(new Request(apiUrl));
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
  });

  it('底层异常时返回固定中文安全错误文案', async () => {
    repository.listKnowledgeItems.mockRejectedValue(unsafeError);

    const response = await itemsRoute.GET(new Request(apiUrl));
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库只读数据暂时不可用',
    });
    unsafeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });
});
