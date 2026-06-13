import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { listInstitutionKnowledgeItemsService } from '@/modules/institution/server/institution-knowledge-management-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const forbiddenFields = [
  'content',
  'rawContent',
  'parsedContent',
  'embedding',
  'embeddingVectorJson',
  'trainingContent',
];

const records: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-authorized-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '授权可见术后护理',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '授权给本机构的低敏护理摘要。',
    chunkCount: 3,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-owned-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-current',
    title: '本机构自有知识',
    version: 'v2',
    sourceKind: 'seed',
    status: 'disabled',
    readonlyStatus: 'readonly',
    category: '机构知识',
    descriptionPreview: '本机构明确归属的低敏摘要。',
    chunkCount: 0,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-other-institution',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-other',
    workspaceId: 'workspace-other',
    title: '未授权机构知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应出现在本机构。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-cross-tenant',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-current',
    workspaceId: 'workspace-b',
    title: '跨租户知识',
    version: 'v1',
    sourceKind: 'mock',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: '不应跨 tenant 可见。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

function expectNoForbiddenKnowledgePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  forbiddenFields.forEach((field) => {
    expect(serialized).not.toContain(`"${field}"`);
  });
}

function createRepository() {
  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      records.filter((record) => record.tenantId === input.tenantId),
    ),
  };
}

describe('机构端知识库管理 V1 只读 service', () => {
  it('只返回当前 tenant 且授权给当前 institution 或明确归属本机构的低敏记录', async () => {
    const repository = createRepository();

    const response = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        page: 1,
        pageSize: 10,
      },
    });

    expect(repository.listKnowledgeItems).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(response.records.map((item) => item.knowledgeId)).toEqual([
      'knowledge-authorized-a',
      'knowledge-owned-a',
    ]);
    expect(response.records[0]).toMatchObject({
      visibility: 'platform_authorized',
      title: '授权可见术后护理',
    });
    expect(response.records[1]).toMatchObject({
      visibility: 'owned',
      status: 'disabled',
    });
    expectNoForbiddenKnowledgePayload(response);
  });

  it('搜索和分页不会泄露未授权机构或跨 tenant 数据', async () => {
    const repository = createRepository();

    const searched = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '知识',
        page: 1,
        pageSize: 1,
      },
    });

    expect(searched.records).toEqual([
      expect.objectContaining({ knowledgeId: 'knowledge-owned-a' }),
    ]);
    expect(searched.pageInfo).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        total: 1,
        hasNextPage: false,
      }),
    );

    const unauthorizedInstitution = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-other-unbound',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });

    expect(unauthorizedInstitution.records).toEqual([]);
    expectNoForbiddenKnowledgePayload(unauthorizedInstitution);
  });
});
