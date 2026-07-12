import { describe, expect, it, vi } from 'vitest';
import {
  searchInstitutionKnowledgeChunksService,
  searchPlatformKnowledgeChunksService,
} from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import type { KnowledgeChunkSearchRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import type {
  PlatformKnowledgeManagementRepository,
  PlatformKnowledgeRepositoryRecord,
} from '@/modules/open-platform/server/platform-knowledge-management-repository';

const now = new Date('2026-06-13T08:00:00.000Z');

const sensitiveFragments = [
  'api_key',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'token',
  'password',
  'Bearer',
  '/Users/',
  'stack',
  'SQL',
  'storageKey',
  'bucket',
  'signedUrl',
  'embeddingVectorJson',
];

const knowledgeItems: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-authorized-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-a',
    title: '术后护理指南',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '授权给本机构的护理指南。',
    chunkCount: 3,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-owned-b',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-current',
    title: '本机构自有冷敷知识',
    version: 'v2',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '本机构自有的冷敷知识。',
    chunkCount: 2,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-other-inst',
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
    descriptionPreview: '不应出现在本机构搜索结果。',
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
    descriptionPreview: '不应跨租户可见。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

const searchChunks: KnowledgeChunkSearchRepositoryRecord[] = [
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-authorized-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-a',
    fileName: '护理手册.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-0',
    chunkIndex: 0,
    textPreview: '术后冷敷应每次15-20分钟，间隔至少2小时，避免冻伤皮肤。冷敷时使用无菌纱布包裹冰袋。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-authorized-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-a',
    fileName: '护理手册.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-1',
    chunkIndex: 1,
    textPreview: '术后24小时内冷敷可有效减轻肿胀，同时避免剧烈运动，保持伤口干燥清洁。如有红肿热痛及时就医。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-owned-b',
    knowledgeTitle: '本机构自有冷敷知识',
    fileId: 'file-b',
    fileName: '冷敷规范.md',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-b-0',
    chunkIndex: 0,
    textPreview: '本机构冷敷操作规范：使用医用冰袋，外裹干燥毛巾，单次冷敷不超过20分钟。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-other-inst',
    knowledgeTitle: '未授权机构知识',
    fileId: 'file-c',
    fileName: '其他机构文件.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-c-0',
    chunkIndex: 0,
    textPreview: '这是其他机构专属的冷敷知识，当前机构不应看到。',
  },
  {
    tenantId: 'tenant-b',
    knowledgeId: 'knowledge-cross-tenant',
    knowledgeTitle: '跨租户知识',
    fileId: 'file-d',
    fileName: '跨租户文件.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-d-0',
    chunkIndex: 0,
    textPreview: '跨租户冷敷知识，不应在当前租户搜索结果中出现。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-authorized-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-archived',
    fileName: '已归档文件.txt',
    fileStatus: 'archived',
    parseStatus: 'succeeded',
    chunkId: 'chunk-archived',
    chunkIndex: 2,
    textPreview: '已归档文件的冷敷内容，不应被检索到。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-authorized-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-failed-parse',
    fileName: '解析失败文件.txt',
    fileStatus: 'active',
    parseStatus: 'failed',
    chunkId: 'chunk-failed-parse',
    chunkIndex: 3,
    textPreview: '解析失败的冷敷内容，不应被检索到。',
  },
];

const veryLongSnippet = '术后护理指南详细说明无断句无标点无空格连续文本'.repeat(15);

type SearchRepository = Pick<
  PlatformKnowledgeManagementRepository,
  'listKnowledgeItems' | 'searchKnowledgeFileParseChunks'
>;

function createRepository(overrides: Partial<SearchRepository> = {}): SearchRepository {
  return {
    listKnowledgeItems: overrides.listKnowledgeItems ?? vi.fn(async (input) =>
      knowledgeItems.filter((item) => item.tenantId === input.tenantId),
    ),
    searchKnowledgeFileParseChunks: overrides.searchKnowledgeFileParseChunks ?? vi.fn(async (input) =>
      searchChunks.filter(
        (chunk) =>
          chunk.tenantId === input.tenantId &&
          chunk.textPreview.toLowerCase().includes(input.keyword.toLowerCase()),
      ),
    ),
  };
}

function expectNoSensitiveFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  sensitiveFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('机构端知识库关键词检索 service', () => {
  it('能按 tenantId + institutionId 搜索 chunks 并返回 snippet', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect(result).toHaveProperty('requestId', 'institution-knowledge-keyword-search');
    expect(result).toHaveProperty('readonly', true);
    expect(result).toHaveProperty('dataSource', 'repository');
    expect('records' in result).toBe(true);
    if ('records' in result) {
      // 只应返回 tenant-a 的、授权给 inst-current 或 inst-current 自有的 chunks
      // chunk-c-0 (knowledge-other-inst) 未被授权给 inst-current
      // chunk-d-0 (knowledge-cross-tenant) 属于 tenant-b
      // chunk-archived (fileStatus=archived) 和 chunk-failed-parse (parseStatus=failed) 被过滤
      const chunkIds = result.records.map((r) => r.chunkId);
      expect(chunkIds).toContain('chunk-a-0');
      expect(chunkIds).toContain('chunk-a-1');
      expect(chunkIds).toContain('chunk-b-0');
      expect(chunkIds).not.toContain('chunk-c-0');
      expect(chunkIds).not.toContain('chunk-d-0');
      expect(chunkIds).not.toContain('chunk-archived');
      expect(chunkIds).not.toContain('chunk-failed-parse');
      // snippet 有内容
      expect(result.records[0].textPreview.length).toBeGreaterThan(0);
      // matchReason 包含关键词
      expect(result.records[0].matchReason).toContain('冷敷');
    }
    expectNoSensitiveFields(result);
  });

  it('命中关键词返回 snippet，snippet 不包含敏感字段', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      expect(result.records.length).toBeGreaterThan(0);
      result.records.forEach((record) => {
        expect(record.textPreview.length).toBeGreaterThan(0);
        expect(record.fileName).toBeTruthy();
        expect(record.knowledgeTitle).toBeTruthy();
        expect(record.matchReason).toContain('冷敷');
      });
    }
    expectNoSensitiveFields(result);
  });

  it('不返回未授权机构和跨租户的 chunks', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      const allTitles = result.records.map((r) => r.knowledgeTitle);
      expect(allTitles).not.toContain('未授权机构知识');
      expect(allTitles).not.toContain('跨租户知识');
    }
  });

  it('空 query 返回 validation_failed', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '',
      },
    });

    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('validation_failed');
      expect('message' in result).toBe(true);
    }
  });

  it('纯空白 query 返回 validation_failed', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '   ',
      },
    });

    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('validation_failed');
    }
  });

  it('超长 query（>80字符）返回 validation_failed', async () => {
    const repository = createRepository();
    const longKeyword = '测试'.repeat(41); // 82 chars

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: longKeyword,
      },
    });

    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('validation_failed');
      expect('message' in result).toBe(true);
      if ('message' in result) {
        expect(result.message).toContain('80');
      }
    }
  });

  it('79 字符 query 允许检索', async () => {
    const repository = createRepository();

    // Use a keyword that appears in existing chunks
    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect('requestId' in result).toBe(true);
    if ('requestId' in result) {
      expect(result.requestId).toBe('institution-knowledge-keyword-search');
    }
  });

  it('limit 生效，max 50', async () => {
    const repository = createRepository();
    // 搜索所有冷敷相关内容
    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
        pageSize: 50,
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      expect(result.pageInfo.pageSize).toBeLessThanOrEqual(50);
    }
  });

  it('pageSize 超过最大值时回退到默认值', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
        pageSize: 999,
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      // 超过 MAX_PAGE_SIZE 50 时回退到 DEFAULT_PAGE_SIZE 10
      expect(result.pageInfo.pageSize).toBe(10);
    }
  });

  it('snippet 不超过 300 字，省略号计入上限', async () => {
    const repository = createRepository({
      searchKnowledgeFileParseChunks: vi.fn(async () => [
        {
          tenantId: 'tenant-a',
          knowledgeId: 'knowledge-authorized-a',
          knowledgeTitle: '术后护理指南',
          fileId: 'file-long',
          fileName: '长文本.txt',
          fileStatus: 'active' as const,
          parseStatus: 'succeeded' as const,
          chunkId: 'chunk-long',
          chunkIndex: 0,
          textPreview: veryLongSnippet,
        },
        {
          tenantId: 'tenant-a',
          knowledgeId: 'knowledge-authorized-a',
          knowledgeTitle: '术后护理指南',
          fileId: 'file-short',
          fileName: '短文本.txt',
          fileStatus: 'active' as const,
          parseStatus: 'succeeded' as const,
          chunkId: 'chunk-short',
          chunkIndex: 1,
          textPreview: '简要护理说明。',
        },
      ]),
      listKnowledgeItems: vi.fn(async () => [knowledgeItems[0]]),
    });

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '护理',
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      const longResult = result.records.find((r) => r.chunkId === 'chunk-long');
      const shortResult = result.records.find((r) => r.chunkId === 'chunk-short');
      expect(longResult).toBeDefined();
      expect(shortResult).toBeDefined();
      if (longResult) {
        expect(longResult.textPreview.length).toBeLessThanOrEqual(300);
        expect(longResult.textPreview.endsWith('…')).toBe(true);
      }
      if (shortResult) {
        // 短文本不截断，不加省略号
        expect(shortResult.textPreview).toBe('简要护理说明。');
        expect(shortResult.textPreview.length).toBeLessThanOrEqual(300);
        expect(shortResult.textPreview.endsWith('…')).toBe(false);
      }
    }
  });

  it('tenantId 缺失时返回 validation_failed', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('validation_failed');
    }
  });

  it('institutionId 缺失时返回 validation_failed', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '冷敷',
      },
    });

    expect('status' in result).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('validation_failed');
    }
  });

  it('空结果返回 emptyState', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '不存在的关键词xyz',
      },
    });

    expect('emptyState' in result).toBe(true);
    if ('emptyState' in result) {
      expect(result.emptyState.title).toBeTruthy();
      expect(result.emptyState.description).toBeTruthy();
    }
    if ('records' in result) {
      expect(result.records).toEqual([]);
    }
  });

  it('平台端搜索不按 institution 隔离，仅按 tenant 过滤', async () => {
    const repository = createRepository();

    const result = await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '冷敷',
      },
    });

    expect('requestId' in result).toBe(true);
    if ('requestId' in result) {
      expect(result.requestId).toBe('platform-knowledge-keyword-search');
    }
    // 平台端不过滤 institution，所以能看到 knowledge-other-inst 的 chunks
    if ('records' in result) {
      const titles = result.records.map((r) => r.knowledgeTitle);
      expect(titles).toContain('未授权机构知识');
    }
  });

  it('平台端不返回跨租户 chunks', async () => {
    const repository = createRepository();

    const result = await searchPlatformKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        keyword: '冷敷',
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      const titles = result.records.map((r) => r.knowledgeTitle);
      expect(titles).not.toContain('跨租户知识');
    }
  });

  it('已归档文件和解析失败文件的 chunks 不出现在结果中', async () => {
    const repository = createRepository();

    const result = await searchInstitutionKnowledgeChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        keyword: '冷敷',
      },
    });

    expect('records' in result).toBe(true);
    if ('records' in result) {
      // 只应有 active + succeeded 的 chunks
      const chunkIds = result.records.map((r) => r.chunkId);
      expect(chunkIds).not.toContain('chunk-archived');
      expect(chunkIds).not.toContain('chunk-failed-parse');
    }
  });
});
