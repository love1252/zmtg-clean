import { describe, expect, it } from 'vitest';
import * as overviewRoute from '@/app/api/v1/open-platform/knowledge-management/route';
import * as filesRoute from '@/app/api/v1/open-platform/knowledge-management/files/route';
import * as itemsRoute from '@/app/api/v1/open-platform/knowledge-management/items/route';
import {
  buildReadonlyApiError,
  getPlatformKnowledgeFilesResponse,
  getPlatformKnowledgeItemsResponse,
  getPlatformKnowledgeOverviewResponse,
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
      dataSource: 'mock',
      scope: {
        tenantId: null,
        scopeName: '全部机构',
      },
      allTotals: expect.any(Object),
      totals: expect.any(Object),
      tenants: expect.any(Array),
      categoryStats: expect.any(Array),
      topQuestions: expect.any(Array),
      importJobs: expect.any(Array),
    });
    expect(routePayload).not.toHaveProperty('knowledgeItems');
    expect(routePayload).not.toHaveProperty('files');
    expect(routePayload).toEqual(directPayload);
    expectReadonlyPayload(routePayload);
  });

  it('overview helper 支持按机构返回当前范围统计，不返回知识正文或文件列表', () => {
    const allScope = getPlatformKnowledgeOverviewResponse();
    const tenantScope = getPlatformKnowledgeOverviewResponse({ tenantId: 'tenant-low-hit' });

    expect(tenantScope.scope).toEqual({
      tenantId: 'tenant-low-hit',
      scopeName: '低命中修复门诊',
    });
    expect(tenantScope.allTotals).toEqual(allScope.allTotals);
    expect(tenantScope.totals.tenantCount).toBe(1);
    expect(tenantScope.totals.knowledgeCount).toBeLessThan(allScope.totals.knowledgeCount);
    expect(tenantScope.topQuestions.every((question) => question.tenantId === 'tenant-low-hit')).toBe(true);
    expect(tenantScope.importJobs.every((job) => job.tenantId === 'tenant-low-hit')).toBe(true);
    expect(tenantScope).not.toHaveProperty('knowledgeItems');
    expect(tenantScope).not.toHaveProperty('files');
    expectReadonlyPayload(tenantScope);
  });

  it('files 支持 tenantId、keyword、status 过滤和分页', async () => {
    const response = getPlatformKnowledgeFilesResponse({
      tenantId: 'tenant-low-hit',
      keyword: '修复',
      status: 'parsed',
      page: '1',
      pageSize: '2',
    });

    expect(response.records.length).toBeGreaterThan(0);
    expect(response.records.length).toBeLessThanOrEqual(2);
    expect(response.pageInfo).toEqual(expect.objectContaining({ page: 1, pageSize: 2 }));
    expect(response.records.every((file) => file.tenantId === 'tenant-low-hit')).toBe(true);
    expect(response.records.every((file) => file.parseStatus === 'parsed')).toBe(true);
    expect(response.records.some((file) => file.fileName.includes('修复') || file.category.includes('修复') || file.folder.includes('修复'))).toBe(true);
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
      title: '暂无匹配的知识库运营数据',
      description: '请调整机构范围或文件名搜索条件后再查看。',
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

    expect(response.records).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-low-hit',
        category: '话术库',
        trainingStatus: 'pending',
        descriptionPreview: expect.stringContaining('恢复期'),
      }),
    ]);
    expect(response.records[0]).not.toHaveProperty('summaryPreview');
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
      title: '暂无匹配的知识库运营数据',
      description: '请调整机构范围或文件名搜索条件后再查看。',
    }));
    expectReadonlyPayload(payload);
  });

  it('空结果返回中文空状态，非法分页返回中文产品化错误', async () => {
    const emptyFiles = getPlatformKnowledgeFilesResponse({ keyword: '没有匹配结果', page: '1', pageSize: '10' });
    expect(emptyFiles.records).toEqual([]);
    expect(emptyFiles.emptyState).toEqual(expect.objectContaining({
      title: '暂无匹配的知识库运营数据',
      description: '请调整机构范围或文件名搜索条件后再查看。',
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
