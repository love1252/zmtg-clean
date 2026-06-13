import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  bindPlatformKnowledgeInstitutionVisibilityService,
  listPlatformKnowledgeItemsService,
  unbindPlatformKnowledgeInstitutionVisibilityService,
} from '@/modules/open-platform/server/platform-knowledge-management-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const forbiddenFields = [
  'content',
  'body',
  'rawContent',
  'fullText',
  'knowledgeBody',
  'fileContent',
  'embedding',
  'embeddingVector',
  'embeddingVectorJson',
  'parsedContent',
  'trainingContent',
];

const records: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-ready-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '水光针术后护理说明',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '低敏护理摘要，仅用于平台管理列表展示。',
    chunkCount: 3,
    visibleInstitutionIds: ['inst-visible-a'],
    updatedAt: now,
    createdAt: now,
  },
  {
    knowledgeId: 'knowledge-disabled-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '已下架活动口径',
    version: 'v2',
    sourceKind: 'seed',
    status: 'disabled',
    readonlyStatus: 'readonly',
    category: '活动知识',
    descriptionPreview: '已下架知识仍可在平台端以禁用状态审计查看。',
    chunkCount: 0,
    visibleInstitutionIds: [],
    updatedAt: new Date('2026-06-12T08:00:00.000Z'),
    createdAt: new Date('2026-06-12T08:00:00.000Z'),
  },
  {
    knowledgeId: 'knowledge-ready-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-owner-b',
    workspaceId: 'workspace-b',
    title: '跨租户不应可见',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '话术库',
    descriptionPreview: '另一租户摘要。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-visible-b'],
    updatedAt: now,
    createdAt: now,
  },
];

function expectNoForbiddenKnowledgePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFields.forEach((field) => {
    expect(serialized).not.toContain(`"${field}"`);
  });
}

function createRepository() {
  const visibleByDocument = new Map<string, string[]>(
    records.map((record) => [record.knowledgeId, [...record.visibleInstitutionIds]]),
  );
  const tenantInstitutions = new Map<string, string[]>([
    ['tenant-a', ['inst-owner-a', 'inst-visible-a', 'inst-new-visible']],
    ['tenant-b', ['inst-owner-b', 'inst-visible-b']],
  ]);

  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      records
        .filter((record) => record.tenantId === input.tenantId)
        .map((record) => ({
          ...record,
          visibleInstitutionIds: visibleByDocument.get(record.knowledgeId) ?? [],
        })),
    ),
    hasTenantInstitution: vi.fn(async (input: { tenantId: string; institutionId: string }) =>
      (tenantInstitutions.get(input.tenantId) ?? []).includes(input.institutionId),
    ),
    bindInstitutionVisibility: vi.fn(async (input: {
      tenantId: string;
      knowledgeId: string;
      institutionId: string;
    }) => {
      const record = records.find(
        (item) => item.tenantId === input.tenantId && item.knowledgeId === input.knowledgeId,
      );
      if (!record) return { status: 'not_found' as const };

      const current = visibleByDocument.get(input.knowledgeId) ?? [];
      if (!current.includes(input.institutionId)) {
        current.push(input.institutionId);
      }
      visibleByDocument.set(input.knowledgeId, current);

      return {
        status: 'bound' as const,
        knowledgeId: input.knowledgeId,
        tenantId: input.tenantId,
        visibleInstitutionIds: current,
      };
    }),
    unbindInstitutionVisibility: vi.fn(async (input: {
      tenantId: string;
      knowledgeId: string;
      institutionId: string;
    }) => {
      const record = records.find(
        (item) => item.tenantId === input.tenantId && item.knowledgeId === input.knowledgeId,
      );
      if (!record) return { status: 'not_found' as const };

      const next = (visibleByDocument.get(input.knowledgeId) ?? []).filter(
        (institutionId) => institutionId !== input.institutionId,
      );
      visibleByDocument.set(input.knowledgeId, next);

      return {
        status: 'unbound' as const,
        knowledgeId: input.knowledgeId,
        tenantId: input.tenantId,
        visibleInstitutionIds: next,
      };
    }),
  };
}

describe('平台知识库管理 V1 真实数据底座 service', () => {
  it('平台端列表读取只返回当前 tenant 的低敏知识库记录，并返回禁用状态', async () => {
    const repository = createRepository();
    const response = await listPlatformKnowledgeItemsService({
      repository,
      params: { tenantId: 'tenant-a', page: 1, pageSize: 10 },
    });

    expect(response.dataSource).toBe('repository');
    expect(response.records.map((item) => item.knowledgeId)).toEqual([
      'knowledge-ready-a',
      'knowledge-disabled-a',
    ]);
    expect(response.records.find((item) => item.knowledgeId === 'knowledge-disabled-a')).toMatchObject({
      enabled: false,
      status: 'disabled',
      trainingStatus: 'failed',
    });
    expect(response.records.every((item) => item.tenantId === 'tenant-a')).toBe(true);
    expectNoForbiddenKnowledgePayload(response);
  });

  it('支持搜索、分页、机构筛选和状态筛选', async () => {
    const repository = createRepository();

    const searched = await listPlatformKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '护理',
        institutionId: 'inst-visible-a',
        status: 'ready',
        page: 1,
        pageSize: 1,
      },
    });

    expect(searched.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-ready-a',
        title: '水光针术后护理说明',
        visibleInstitutionIds: ['inst-visible-a'],
      }),
    ]);
    expect(searched.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 1,
      total: 1,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    }));

    const secondPage = await listPlatformKnowledgeItemsService({
      repository,
      params: { tenantId: 'tenant-a', page: 2, pageSize: 1 },
    });
    expect(secondPage.records).toHaveLength(1);
    expect(secondPage.pageInfo).toEqual(expect.objectContaining({
      page: 2,
      pageSize: 1,
      total: 2,
      pageCount: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    }));
  });

  it('tenant mismatch 不可见，绑定和解绑也不能跨 tenant 操作', async () => {
    const repository = createRepository();

    const listResponse = await listPlatformKnowledgeItemsService({
      repository,
      params: { tenantId: 'tenant-a', keyword: '跨租户', page: 1, pageSize: 10 },
    });
    expect(listResponse.records).toEqual([]);

    const bindMismatch = await bindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-b',
        institutionId: 'inst-visible-a',
      },
    });
    expect(bindMismatch).toEqual({ status: 'not_found' });

    const unbindMismatch = await unbindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-b',
        institutionId: 'inst-visible-a',
      },
    });
    expect(unbindMismatch).toEqual({ status: 'not_found' });
  });

  it('institution 属于 tenant 时允许平台端绑定和解绑机构可见范围', async () => {
    const repository = createRepository();

    const bound = await bindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-a',
        institutionId: 'inst-new-visible',
      },
    });
    expect(repository.bindInstitutionVisibility).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-ready-a',
      institutionId: 'inst-new-visible',
    });
    expect(bound).toEqual({
      status: 'bound',
      knowledgeId: 'knowledge-ready-a',
      tenantId: 'tenant-a',
      visibleInstitutionIds: ['inst-visible-a', 'inst-new-visible'],
    });

    const unbound = await unbindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-a',
        institutionId: 'inst-visible-a',
      },
    });
    expect(unbound).toEqual({
      status: 'unbound',
      knowledgeId: 'knowledge-ready-a',
      tenantId: 'tenant-a',
      visibleInstitutionIds: ['inst-new-visible'],
    });
  });

  it('institution 不属于 tenant 时拒绝绑定和解绑，且不写入 visibility repository', async () => {
    const repository = createRepository();

    const bound = await bindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-a',
        institutionId: 'inst-visible-b',
      },
    });
    const unbound = await unbindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-ready-a',
        institutionId: 'inst-visible-b',
      },
    });

    expect(bound).toEqual({ status: 'validation_failed' });
    expect(unbound).toEqual({ status: 'validation_failed' });
    expect(repository.hasTenantInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-visible-b',
    });
    expect(repository.bindInstitutionVisibility).not.toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-ready-a',
      institutionId: 'inst-visible-b',
    });
    expect(repository.unbindInstitutionVisibility).not.toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-ready-a',
      institutionId: 'inst-visible-b',
    });
  });
});
