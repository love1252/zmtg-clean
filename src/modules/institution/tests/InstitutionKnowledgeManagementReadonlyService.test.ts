import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { InstitutionKnowledgeWriteRepository } from '@/modules/institution/server/institution-knowledge-write-repository';
import {
  archiveInstitutionKnowledgeItemService,
  createInstitutionKnowledgeItemService,
  listInstitutionKnowledgeItemsService,
  updateInstitutionKnowledgeItemService,
} from '@/modules/institution/server/institution-knowledge-management-service';

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

function createWriteRepository(): InstitutionKnowledgeWriteRepository {
  const state = new Map(records.map((record) => [record.knowledgeId, { ...record }]));
  return {
    findKnowledgeItem: vi.fn(async (input: { tenantId: string; knowledgeId: string }) => {
      const record = state.get(input.knowledgeId);
      return record && record.tenantId === input.tenantId ? record : null;
    }),
    createInstitutionKnowledgeSource: vi.fn(async () => ({ sourceId: 'new-source' })),
    createInstitutionKnowledgeDocument: vi.fn(async (input: {
      tenantId: string;
      institutionId: string;
      sourceId: string;
      title: string;
      description?: string | null;
    }) => {
      state.set('new-knowledge', {
        knowledgeId: 'new-knowledge',
        tenantId: input.tenantId,
        tenantName: '租户 A',
        institutionId: input.institutionId,
        workspaceId: input.institutionId,
        title: input.title,
        version: input.description || 'v1',
        sourceKind: 'seed',
        status: 'ready',
        readonlyStatus: 'readonly',
        category: '分类 / 目录口径',
        descriptionPreview: input.description || 'v1',
        chunkCount: 0,
        visibleInstitutionIds: [input.institutionId],
        createdAt: now,
        updatedAt: now,
      });
      return { documentId: 'new-knowledge' };
    }),
    updateInstitutionKnowledgeDocument: vi.fn(async (input: {
      tenantId: string;
      institutionId: string;
      knowledgeId: string;
      title: string;
      category: string;
      description: string;
    }) => {
      const current = state.get(input.knowledgeId);
      if (!current || current.tenantId !== input.tenantId || current.institutionId !== input.institutionId) {
        return { status: 'not_found' as const };
      }
      const record = {
        ...current,
        title: input.title,
        category: input.category,
        descriptionPreview: input.description,
        updatedAt: now,
      };
      state.set(input.knowledgeId, record);
      return { status: 'updated' as const, record };
    }),
    archiveInstitutionKnowledgeDocument: vi.fn(async (input: {
      tenantId: string;
      institutionId: string;
      knowledgeId: string;
    }) => {
      const current = state.get(input.knowledgeId);
      if (!current || current.tenantId !== input.tenantId || current.institutionId !== input.institutionId) {
        return { status: 'not_found' as const };
      }
      const record = { ...current, status: 'disabled' as const, readonlyStatus: 'blocked' as const };
      state.set(input.knowledgeId, record);
      return { status: 'archived' as const, record };
    }),
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

  it('新建知识由服务端机构范围决定并写入分类 / 目录口径和摘要', async () => {
    const repository = createWriteRepository();

    const result = await createInstitutionKnowledgeItemService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        title: '新建护理知识',
        category: '护理分类',
        description: '低敏摘要',
      },
    });

    expect(result).toMatchObject({ status: 'created', record: { title: '新建护理知识', visibility: 'owned' } });
    expect(repository.createInstitutionKnowledgeSource).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      sourceLabel: '护理分类',
    });
    expect(repository.createInstitutionKnowledgeDocument).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      sourceId: 'new-source',
      title: '新建护理知识',
      description: '低敏摘要',
    });
  });

  it('新建知识失败时返回 validation_failed', async () => {
    const repository = createWriteRepository();

    const result = await createInstitutionKnowledgeItemService({
      repository,
      input: { tenantId: 'tenant-a', institutionId: 'inst-current', title: '   ' },
    });

    expect(result).toEqual({ status: 'validation_failed', message: '标题不能为空' });
    expect(repository.createInstitutionKnowledgeDocument).not.toHaveBeenCalled();
  });

  it('编辑知识成功且不允许修改租户或机构归属', async () => {
    const repository = createWriteRepository();

    const result = await updateInstitutionKnowledgeItemService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        knowledgeId: 'knowledge-owned-a',
        title: '更新后的知识',
        category: '更新分类',
        description: '更新摘要',
      },
    });

    expect(result).toMatchObject({ status: 'updated', record: { title: '更新后的知识', category: '更新分类' } });
    expect(repository.updateInstitutionKnowledgeDocument).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      knowledgeId: 'knowledge-owned-a',
      title: '更新后的知识',
      category: '更新分类',
      description: '更新摘要',
    });
  });

  it('编辑知识失败时返回 validation_failed', async () => {
    const repository = createWriteRepository();

    const result = await updateInstitutionKnowledgeItemService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        knowledgeId: 'knowledge-owned-a',
        title: '',
      },
    });

    expect(result).toEqual({ status: 'validation_failed', message: '标题不能为空' });
    expect(repository.updateInstitutionKnowledgeDocument).not.toHaveBeenCalled();
  });

  it('跨机构不能编辑或归档知识', async () => {
    const repository = createWriteRepository();

    await expect(updateInstitutionKnowledgeItemService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        knowledgeId: 'knowledge-authorized-a',
        title: '不应修改',
        category: '不应修改',
        description: '不应修改',
      },
    })).resolves.toEqual({ status: 'forbidden', message: '没有访问权限' });

    await expect(archiveInstitutionKnowledgeItemService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        knowledgeId: 'knowledge-authorized-a',
      },
    })).resolves.toEqual({ status: 'forbidden', message: '没有访问权限' });
    expect(repository.updateInstitutionKnowledgeDocument).not.toHaveBeenCalled();
    expect(repository.archiveInstitutionKnowledgeDocument).not.toHaveBeenCalled();
  });

  it('归档知识做软归档并返回 disabled 状态', async () => {
    const repository = createWriteRepository();

    const result = await archiveInstitutionKnowledgeItemService({
      repository,
      input: { tenantId: 'tenant-a', institutionId: 'inst-current', knowledgeId: 'knowledge-owned-a' },
    });

    expect(result).toMatchObject({ status: 'archived', record: { status: 'disabled', readonlyStatus: 'blocked' } });
    expect(repository.archiveInstitutionKnowledgeDocument).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      knowledgeId: 'knowledge-owned-a',
    });
  });

});
