import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import * as itemsRoute from '@/app/api/v1/open-platform/knowledge-management/items/route';
import * as visibilityRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/visibility/route';

const database = { database: 'platform-knowledge-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
  bindInstitutionVisibility: vi.fn(),
  unbindInstitutionVisibility: vi.fn(),
};

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
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

const apiUrl = 'http://localhost/api/v1/open-platform/knowledge-management/items';
const visibilityUrl =
  'http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/visibility';
const now = new Date('2026-06-13T08:00:00.000Z');

const routeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-route-a',
    tenantId: 'tenant-route-a',
    tenantName: '路由租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '平台端真实列表记录',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '演示知识',
    descriptionPreview: '只返回低敏摘要。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
];

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

describe('平台知识库管理 V1 真实数据 API route', () => {
  beforeEach(() => {
    repository.listKnowledgeItems.mockReset();
    repository.bindInstitutionVisibility.mockReset();
    repository.unbindInstitutionVisibility.mockReset();
  });

  it('items GET 带 tenantId 时接入真实 repository/service 并保持低敏 payload', async () => {
    repository.listKnowledgeItems.mockResolvedValue(routeRecords);

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?tenantId=tenant-route-a&keyword=${encodeURIComponent('真实列表')}`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeItems).toHaveBeenCalledWith({ tenantId: 'tenant-route-a' });
    expect(payload.dataSource).toBe('repository');
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-route-a',
        tenantId: 'tenant-route-a',
        visibleInstitutionIds: ['inst-visible-a'],
      }),
    ]);
    expect(serialized).not.toContain('"content"');
    expect(serialized).not.toContain('"embeddingVectorJson"');
    expect(serialized).not.toContain('"parsedContent"');
    expect(serialized).not.toContain('"trainingContent"');
  });

  it('visibility POST/DELETE 接入绑定和解绑 service', async () => {
    repository.bindInstitutionVisibility.mockResolvedValue({
      status: 'bound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: ['inst-visible-a'],
    });
    repository.unbindInstitutionVisibility.mockResolvedValue({
      status: 'unbound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: [],
    });

    const postResponse = await visibilityRoute.POST(
      new Request(visibilityUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route-a', institutionId: 'inst-visible-a' }),
      }),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    expect(postResponse.status).toBe(200);
    expect(await readJson(postResponse)).toEqual({
      status: 'bound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: ['inst-visible-a'],
    });
    expect(repository.bindInstitutionVisibility).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      institutionId: 'inst-visible-a',
    });

    const deleteResponse = await visibilityRoute.DELETE(
      new Request(visibilityUrl, {
        method: 'DELETE',
        body: JSON.stringify({ tenantId: 'tenant-route-a', institutionId: 'inst-visible-a' }),
      }),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    expect(deleteResponse.status).toBe(200);
    expect(await readJson(deleteResponse)).toEqual({
      status: 'unbound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: [],
    });
    expect(repository.unbindInstitutionVisibility).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      institutionId: 'inst-visible-a',
    });
  });
});
