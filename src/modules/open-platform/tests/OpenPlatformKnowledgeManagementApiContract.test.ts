import { describe, expect, it } from 'vitest';
import * as overviewRoute from '@/app/api/v1/open-platform/knowledge-management/route';
import * as filesRoute from '@/app/api/v1/open-platform/knowledge-management/files/route';
import * as itemsRoute from '@/app/api/v1/open-platform/knowledge-management/items/route';
import {
  buildPlatformKnowledgeDirectories,
  buildReadonlyApiError,
  getPlatformKnowledgeFilesResponse,
  getPlatformKnowledgeItemsResponse,
  getPlatformKnowledgeOverviewResponse,
  PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

const overviewUrl = 'http://localhost/api/v1/open-platform/knowledge-management';
const filesUrl = 'http://localhost/api/v1/open-platform/knowledge-management/files';
const itemsUrl = 'http://localhost/api/v1/open-platform/knowledge-management/items';

const forbiddenFragments = [
  'Cannot find module',
  'worker failed',
  'node_modules',
  'H:\\',
  '/Users/',
  'DATABASE_URL',
  'secret',
  'token',
  'stack trace',
  'database error',
  'embedding provider raw error',
];

const forbiddenFields = [
  'content',
  'body',
  'rawContent',
  'fullText',
  'knowledgeBody',
  'fileContent',
  'downloadUrl',
  'uploadUrl',
  'exportUrl',
  'storageKey',
  'secret',
  'token',
];

function expectReadonlyPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
  forbiddenFields.forEach((field) => {
    expect(serialized).not.toContain(`"${field}"`);
  });
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

describe('平台知识库管理 V1 只读 API contract', () => {
  it('route 只暴露只读 GET', () => {
    expect(Object.keys(overviewRoute).sort()).toEqual(['GET']);
    expect(Object.keys(filesRoute).sort()).toEqual(['GET']);
    expect(Object.keys(itemsRoute).sort()).toEqual(['GET']);
  });

  it('overview 返回 totals、tenants、categoryStats、topQuestions 和 importJobs', async () => {
    const directPayload = getPlatformKnowledgeOverviewResponse();
    const routeResponse = await overviewRoute.GET(new Request(overviewUrl));
    const routePayload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(routePayload).toMatchObject({
      readonly: true,
      dataSource: 'unconnected',
      scope: {
        tenantId: null,
        scopeName: '全部机构',
      },
      allTotals: expect.any(Object),
      totals: expect.any(Object),
      tenants: expect.any(Array),
      categoryStats: expect.any(Array),
      directories: expect.any(Array),
      topQuestions: expect.any(Array),
      importJobs: expect.any(Array),
    });
    expect(routePayload.directories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          directoryId: 'directory:all-knowledge',
          kind: 'virtual_root',
          name: '全部知识库',
          knowledgeCount: 0,
          fileCount: 0,
          canRename: false,
          canCreateChild: true,
          canArchive: false,
          status: 'active',
        }),
      ]),
    );
    expect(routePayload.tenants).toEqual([]);
    expect(routePayload.categoryStats).toEqual([]);
    expect(routePayload.topQuestions).toEqual([]);
    expect(routePayload.importJobs).toEqual([]);
    expect(routePayload).not.toHaveProperty('knowledgeItems');
    expect(routePayload).not.toHaveProperty('files');
    expect(routePayload).toEqual(directPayload);
    expectReadonlyPayload(routePayload);
    expect(JSON.stringify(routePayload)).not.toContain('星澜医美中心');
  });

  it('overview helper 支持按机构返回当前范围统计，不返回知识正文或文件列表', () => {
    const allScope = getPlatformKnowledgeOverviewResponse();
    const tenantScope = getPlatformKnowledgeOverviewResponse({ tenantId: 'tenant-low-hit' });

    expect(tenantScope.scope).toEqual({
      tenantId: 'tenant-low-hit',
      scopeName: '已选择机构',
    });
    expect(tenantScope.allTotals).toEqual(allScope.allTotals);
    expect(tenantScope.totals.tenantCount).toBe(0);
    expect(tenantScope.totals.knowledgeCount).toBe(0);
    expect(tenantScope.directories.every((directory) => directory.status === 'active')).toBe(true);
    expect(tenantScope.directories.some((directory) => directory.name === '全部知识库')).toBe(true);
    expect(tenantScope.topQuestions).toEqual([]);
    expect(tenantScope.importJobs).toEqual([]);
    expect(tenantScope).not.toHaveProperty('knowledgeItems');
    expect(tenantScope).not.toHaveProperty('files');
    expectReadonlyPayload(tenantScope);
  });

  it('目录 contract 会按目录源更新时间保持服务端排序', () => {
    const directories = buildPlatformKnowledgeDirectories({
      items: [],
      files: [],
      sources: [
        {
          tenantId: 'tenant-a',
          sourceLabel: '第二知识库',
          workspaceId: PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID,
          status: 'empty',
          updatedAt: '2026-06-20T00:00:02.000Z',
        },
        {
          tenantId: 'tenant-a',
          sourceLabel: '第一知识库',
          workspaceId: PLATFORM_KNOWLEDGE_LIBRARY_WORKSPACE_ID,
          status: 'empty',
          updatedAt: '2026-06-20T00:00:01.000Z',
        },
        {
          tenantId: 'tenant-a',
          sourceLabel: '第一知识库',
          workspaceId: '子目录 B',
          status: 'empty',
          updatedAt: '2026-06-20T00:00:04.000Z',
        },
        {
          tenantId: 'tenant-a',
          sourceLabel: '第一知识库',
          workspaceId: '子目录 A',
          status: 'empty',
          updatedAt: '2026-06-20T00:00:03.000Z',
        },
      ],
    });

    expect(directories.map((directory) => directory.name)).toEqual([
      '全部知识库',
      '第一知识库',
      '子目录 A',
      '子目录 B',
      '第二知识库',
    ]);
    expectReadonlyPayload(directories);
  });

  it('files 支持 tenantId、keyword、status 过滤和分页', async () => {
    const response = getPlatformKnowledgeFilesResponse({
      tenantId: 'tenant-low-hit',
      keyword: '修复',
      status: 'parsed',
      page: '1',
      pageSize: '2',
    });

    expect(response.dataSource).toBe('unconnected');
    expect(response.records).toEqual([]);
    expect(response.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 2,
      total: 0,
      pageCount: 0,
    }));
    expectReadonlyPayload(response);

    const routeResponse = await filesRoute.GET(new Request(`${filesUrl}?tenantId=tenant-low-hit&keyword=${encodeURIComponent('修复')}&status=parsed&page=1&pageSize=2`));
    expect(routeResponse.status).toBe(200);
    expect(await readJson(routeResponse)).toEqual(response);
  });

  it('files route 对异常分页参数使用安全默认值，并保持空结果为中文空状态', async () => {
    const invalidPageResponse = await filesRoute.GET(new Request(`${filesUrl}?keyword=${encodeURIComponent('没有匹配结果')}&page=-2&pageSize=999`));
    const payload = await readJson(invalidPageResponse);

    expect(invalidPageResponse.status).toBe(200);
    expect(payload.records).toEqual([]);
    expect(payload.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    }));
    expect(payload.emptyState).toEqual(expect.objectContaining({
      title: '暂无真实知识库运营数据',
      description: '当前未接入知识库数据库或暂无知识库记录，请在真实数据写入后查看。',
    }));
    expectReadonlyPayload(payload);
  });

  it('items 支持 tenantId、keyword、category、trainingStatus 过滤，且只返回 descriptionPreview', async () => {
    const response = getPlatformKnowledgeItemsResponse({
      tenantId: 'tenant-low-hit',
      keyword: '恢复期',
      category: '话术库',
      trainingStatus: 'pending',
      page: '1',
      pageSize: '5',
    });

    expect(response.dataSource).toBe('unconnected');
    expect(response.records).toEqual([]);
    expectReadonlyPayload(response);

    const routeResponse = await itemsRoute.GET(new Request(`${itemsUrl}?tenantId=tenant-low-hit&keyword=${encodeURIComponent('恢复期')}&category=${encodeURIComponent('话术库')}&trainingStatus=pending&page=1&pageSize=5`));
    expect(routeResponse.status).toBe(200);
    expect(await readJson(routeResponse)).toEqual(response);
  });

  it('items route 对异常分页参数使用安全默认值，并保持空结果为中文空状态', async () => {
    const invalidPageResponse = await itemsRoute.GET(new Request(`${itemsUrl}?keyword=${encodeURIComponent('没有匹配结果')}&page=abc&pageSize=0`));
    const payload = await readJson(invalidPageResponse);

    expect(invalidPageResponse.status).toBe(200);
    expect(payload.records).toEqual([]);
    expect(payload.pageInfo).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    }));
    expect(payload.emptyState).toEqual(expect.objectContaining({
      title: '暂无真实知识库运营数据',
      description: '当前未接入知识库数据库或暂无知识库记录，请在真实数据写入后查看。',
    }));
    expectReadonlyPayload(payload);
  });

  it('空结果返回中文空状态，非法分页返回中文产品化错误', async () => {
    const emptyFiles = getPlatformKnowledgeFilesResponse({ keyword: '没有匹配结果', page: '1', pageSize: '10' });
    expect(emptyFiles.records).toEqual([]);
    expect(emptyFiles.emptyState).toEqual(expect.objectContaining({
      title: '暂无真实知识库运营数据',
      description: '当前未接入知识库数据库或暂无知识库记录，请在真实数据写入后查看。',
    }));

    const error = buildReadonlyApiError('页码参数不正确');
    expect(error).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '页码参数不正确',
      },
    });
    expectReadonlyPayload(emptyFiles);
    expectReadonlyPayload(error);
  });
});
