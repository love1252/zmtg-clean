import { describe, expect, it, vi } from 'vitest';
import { listInstitutionKnowledgeItemsService } from '@/modules/institution/server/institution-knowledge-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  bindPlatformKnowledgeInstitutionVisibilityService,
  listPlatformKnowledgeItemsService,
  unbindPlatformKnowledgeInstitutionVisibilityService,
} from '@/modules/open-platform/server/platform-knowledge-management-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const forbiddenKnowledgeFields = [
  'content',
  'rawContent',
  'parsedContent',
  'embedding',
  'embeddingVectorJson',
  'trainingContent',
];

const acceptanceRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-e2e-care',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-care',
    title: '平台授权术后护理知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '平台授权后机构端可见的低敏摘要。',
    chunkCount: 4,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-e2e-other-institution',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-other-owner',
    workspaceId: 'workspace-other',
    title: '其他机构未授权知识',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '机构知识',
    descriptionPreview: '未授权机构不应看到。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-e2e-tenant-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-a',
    workspaceId: 'workspace-cross-tenant',
    title: '跨租户知识不应可见',
    version: 'v1',
    sourceKind: 'mock',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant B 的摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-a'],
    createdAt: now,
    updatedAt: now,
  },
];

function expectNoForbiddenKnowledgePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenKnowledgeFields.forEach((field) => {
    expect(serialized).not.toContain(`"${field}"`);
  });
}

function createAcceptanceRepository() {
  const visibleByKnowledgeId = new Map<string, string[]>(
    acceptanceRecords.map((record) => [record.knowledgeId, [...record.visibleInstitutionIds]]),
  );
  const tenantInstitutions = new Map<string, string[]>([
    ['tenant-a', ['inst-a', 'inst-b', 'inst-owner', 'inst-other-owner']],
    ['tenant-b', ['inst-a']],
  ]);

  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      acceptanceRecords
        .filter((record) => record.tenantId === input.tenantId)
        .map((record) => ({
          ...record,
          visibleInstitutionIds: visibleByKnowledgeId.get(record.knowledgeId) ?? [],
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
      const record = acceptanceRecords.find(
        (item) => item.tenantId === input.tenantId && item.knowledgeId === input.knowledgeId,
      );
      if (!record) return { status: 'not_found' as const };

      const current = visibleByKnowledgeId.get(input.knowledgeId) ?? [];
      if (!current.includes(input.institutionId)) current.push(input.institutionId);
      visibleByKnowledgeId.set(input.knowledgeId, current);

      return {
        status: 'bound' as const,
        tenantId: input.tenantId,
        knowledgeId: input.knowledgeId,
        visibleInstitutionIds: current,
      };
    }),
    unbindInstitutionVisibility: vi.fn(async (input: {
      tenantId: string;
      knowledgeId: string;
      institutionId: string;
    }) => {
      const record = acceptanceRecords.find(
        (item) => item.tenantId === input.tenantId && item.knowledgeId === input.knowledgeId,
      );
      if (!record) return { status: 'not_found' as const };

      const next = (visibleByKnowledgeId.get(input.knowledgeId) ?? []).filter(
        (institutionId) => institutionId !== input.institutionId,
      );
      visibleByKnowledgeId.set(input.knowledgeId, next);

      return {
        status: 'unbound' as const,
        tenantId: input.tenantId,
        knowledgeId: input.knowledgeId,
        visibleInstitutionIds: next,
      };
    }),
  };
}

describe('知识库管理 V1 平台端-机构端端到端验收', () => {
  it('平台端绑定和解绑 visibility 会直接影响机构端只读可见范围', async () => {
    const repository = createAcceptanceRepository();

    const beforeBind = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });
    expect(beforeBind.records).toEqual([]);

    const bound = await bindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-e2e-care',
        institutionId: 'inst-a',
      },
    });
    expect(bound).toEqual({
      status: 'bound',
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-e2e-care',
      visibleInstitutionIds: ['inst-a'],
    });

    const platformAfterBind = await listPlatformKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });
    expect(platformAfterBind.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-e2e-care',
        visibleInstitutionIds: ['inst-a'],
      }),
    ]);

    const institutionAfterBind = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        keyword: '护理',
        page: 1,
        pageSize: 1,
      },
    });
    expect(institutionAfterBind.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-e2e-care',
        title: '平台授权术后护理知识',
        visibility: 'platform_authorized',
      }),
    ]);
    expect(institutionAfterBind.pageInfo).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        total: 1,
        hasNextPage: false,
      }),
    );
    expectNoForbiddenKnowledgePayload(institutionAfterBind);

    const institutionB = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-b',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });
    expect(institutionB.records).toEqual([]);

    const tenantB = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-b',
        institutionId: 'inst-a',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });
    expect(tenantB.records).toEqual([]);

    const unbound = await unbindPlatformKnowledgeInstitutionVisibilityService({
      repository,
      input: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-e2e-care',
        institutionId: 'inst-a',
      },
    });
    expect(unbound).toEqual({
      status: 'unbound',
      tenantId: 'tenant-a',
      knowledgeId: 'knowledge-e2e-care',
      visibleInstitutionIds: [],
    });

    const institutionAfterUnbind = await listInstitutionKnowledgeItemsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        keyword: '护理',
        page: 1,
        pageSize: 10,
      },
    });
    expect(institutionAfterUnbind.records).toEqual([]);
    expectNoForbiddenKnowledgePayload(institutionAfterUnbind);
  });
});
