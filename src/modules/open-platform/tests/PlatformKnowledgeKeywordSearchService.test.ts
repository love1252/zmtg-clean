import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  searchInstitutionKnowledgeChunksService,
  searchPlatformKnowledgeChunksService,
  type KnowledgeChunkSearchResponse,
  type KnowledgeChunkSearchRepositoryRecord,
} from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const unsafeFragments = [
  'storageKey',
  'tenant-a/knowledge-a/file-a.bin',
  '/Users/',
  'SQL',
  'stack',
  'token',
  'secret',
  'embedding',
  'trainingContent',
  'answer',
  'textContent',
  'fullText',
  'parsedContent',
];

const knowledgeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '术后护理知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '低敏摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-owned',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-owned',
    title: '本机构知识库',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '机构知识',
    descriptionPreview: '本机构归属摘要。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-hidden',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-hidden',
    workspaceId: 'workspace-hidden',
    title: '未授权知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-owner-b',
    workspaceId: 'workspace-b',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant A 不可见。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

const chunks: KnowledgeChunkSearchRepositoryRecord[] = [
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-a',
    fileName: '护理说明.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-1',
    chunkIndex: 1,
    textPreview: '第二段包含 冷敷 和复诊提醒。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-a',
    fileName: '护理说明.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-0',
    chunkIndex: 0,
    textPreview: '术后护理需要冷敷，避免暴晒。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-owned',
    knowledgeTitle: '本机构知识库',
    fileId: 'file-owned',
    fileName: '机构护理.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-owned-0',
    chunkIndex: 0,
    textPreview: '本机构可见的冷敷片段。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-hidden',
    knowledgeTitle: '未授权知识库',
    fileId: 'file-hidden',
    fileName: '隐藏.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-hidden-0',
    chunkIndex: 0,
    textPreview: '未授权机构不能看到冷敷。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-pending',
    fileName: '待解析.txt',
    fileStatus: 'active',
    parseStatus: 'pending',
    chunkId: 'chunk-pending',
    chunkIndex: 0,
    textPreview: 'pending 冷敷 不应返回。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-failed',
    fileName: '失败.txt',
    fileStatus: 'active',
    parseStatus: 'failed',
    chunkId: 'chunk-failed',
    chunkIndex: 0,
    textPreview: 'failed 冷敷 不应返回。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-archived',
    fileName: '归档.txt',
    fileStatus: 'archived',
    parseStatus: 'succeeded',
    chunkId: 'chunk-archived',
    chunkIndex: 0,
    textPreview: 'archived 冷敷 不应返回。',
  },
  {
    tenantId: 'tenant-b',
    knowledgeId: 'knowledge-b',
    knowledgeTitle: '跨租户知识库',
    fileId: 'file-b',
    fileName: '跨租户.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-b-0',
    chunkIndex: 0,
    textPreview: 'tenant B 的冷敷内容。',
  },
];

function createRepository() {
  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      knowledgeRecords.filter((record) => record.tenantId === input.tenantId),
    ),
    searchKnowledgeFileParseChunks: vi.fn(async (input: {
      tenantId: string;
      keyword: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      chunks
        .filter((chunk) => chunk.tenantId === input.tenantId)
        .filter((chunk) => !input.knowledgeId || chunk.knowledgeId === input.knowledgeId)
        .filter((chunk) => !input.fileId || chunk.fileId === input.fileId)
        .filter((chunk) => chunk.textPreview.toLowerCase().includes(input.keyword.toLowerCase())),
    ),
  };
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function expectSearchResponse(
  response: Awaited<ReturnType<typeof searchPlatformKnowledgeChunksService>>,
): KnowledgeChunkSearchResponse {
  if ('status' in response) {
    throw new Error(`expected search response, got ${response.status}`);
  }

  return response;
}

describe('知识库关键词检索 service', () => {
  it('平台端按关键词命中已解析 chunk，并按 knowledgeId/fileId 分页过滤与稳定排序', async () => {
    const repository = createRepository();

    const response = expectSearchResponse(await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '冷敷',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
        page: 1,
        pageSize: 1,
      },
    }));

    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      keyword: '冷敷',
      knowledgeId: 'knowledge-a',
      fileId: 'file-a',
    });
    expect(response.records).toEqual([
      {
        knowledgeId: 'knowledge-a',
        knowledgeTitle: '术后护理知识库',
        fileId: 'file-a',
        fileName: '护理说明.txt',
        chunkId: 'chunk-a-0',
        chunkIndex: 0,
        textPreview: '术后护理需要冷敷，避免暴晒。',
        matchReason: '片段包含关键词“冷敷”',
        parseStatus: 'succeeded',
      },
    ]);
    expect(response.pageInfo).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        total: 2,
        hasNextPage: true,
      }),
    );
    expectSafePayload(response);
  });

  it('平台端不返回 pending / failed / archived 文件内容，tenant mismatch 不可见', async () => {
    const repository = createRepository();

    const response = expectSearchResponse(await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '冷敷',
        page: 1,
        pageSize: 20,
      },
    }));

    expect(response.records.map((record) => record.chunkId)).toEqual([
      'chunk-a-0',
      'chunk-a-1',
      'chunk-hidden-0',
      'chunk-owned-0',
    ]);
    expect(JSON.stringify(response)).not.toContain('chunk-pending');
    expect(JSON.stringify(response)).not.toContain('chunk-failed');
    expect(JSON.stringify(response)).not.toContain('chunk-archived');
    expect(JSON.stringify(response)).not.toContain('chunk-b-0');
    expectSafePayload(response);
  });

  it('平台端空关键词返回 validation_failed 和明确中文提示', async () => {
    const repository = createRepository();

    const response = await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '   ',
      },
    });

    expect(response).toEqual({
      status: 'validation_failed',
      message: '请输入关键词后再检索知识片段',
    });
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
  });

  it('机构端只检索当前机构自有或平台授权知识库，机构 B 和 tenant B 不可见', async () => {
    const repository = createRepository();

    const response = expectSearchResponse(await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
        page: 1,
        pageSize: 20,
      },
    }));

    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      keyword: '冷敷',
      knowledgeId: undefined,
      fileId: undefined,
    });
    expect(response.records.map((record) => record.chunkId)).toEqual(['chunk-owned-0']);
    expect(JSON.stringify(response)).not.toContain('chunk-hidden-0');
    expect(JSON.stringify(response)).not.toContain('chunk-b-0');
    expectSafePayload(response);
  });

  it('机构端可检索平台授权给本机构的知识库内容', async () => {
    const repository = createRepository();

    const response = expectSearchResponse(await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        keyword: '冷敷',
        knowledgeId: 'knowledge-a',
        page: 1,
        pageSize: 10,
      },
    }));

    expect(response.records.map((record) => record.chunkId)).toEqual(['chunk-a-0', 'chunk-a-1']);
    expectSafePayload(response);
  });

  it('无结果返回空态且不泄露底层细节', async () => {
    const repository = createRepository();

    const response = expectSearchResponse(await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '不存在关键词',
        page: 1,
        pageSize: 10,
      },
    }));

    expect(response.records).toEqual([]);
    expect(response.emptyState).toEqual({
      title: '暂无匹配片段',
      description: '当前范围没有命中关键词的已解析知识片段。',
    });
    expectSafePayload(response);
  });
});
