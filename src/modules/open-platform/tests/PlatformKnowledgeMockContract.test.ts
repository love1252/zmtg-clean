import { describe, expect, it } from 'vitest';
import {
  calculateScopeTotals,
  filterKnowledgeFiles,
  filterKnowledgeItems,
  getPlatformKnowledgeMockData,
  getPlatformKnowledgeScope,
  normalizeTenantName,
} from '@/modules/open-platform/mock/platformKnowledge';

const rawRuntimeFragments = [
  'Cannot find module',
  'worker failed',
  'node_modules',
  'H:\\',
  '/Users/',
  'stack trace',
  'database error',
  'embedding provider raw error',
];

describe('平台知识库 mock contract', () => {
  it('提供完整 mock contract、中文兜底和安全错误文案', () => {
    const data = getPlatformKnowledgeMockData();
    const serialized = JSON.stringify(data);

    expect(data.tenants).toHaveLength(3);
    expect(data.knowledgeItems.length).toBeGreaterThanOrEqual(10);
    expect(data.files.length).toBeGreaterThanOrEqual(12);
    expect(data.importJobs.length).toBeGreaterThanOrEqual(6);
    expect(data.topQuestions.length).toBeGreaterThanOrEqual(5);
    expect(data.categories.length).toBeGreaterThanOrEqual(4);

    expect(data.totals).toMatchObject({
      tenantCount: 3,
      categoryCount: expect.any(Number),
      folderCount: expect.any(Number),
      averageHitCount: expect.any(Number),
      failedTrainingCount: expect.any(Number),
      importJobCount: expect.any(Number),
      failedImportJobCount: expect.any(Number),
      pendingOptimizationCount: expect.any(Number),
    });

    expect([...new Set(data.knowledgeItems.map((item) => item.category))]).toEqual(
      expect.arrayContaining(['话术库', '项目知识', '术后护理', '活动知识']),
    );
    expect([...new Set(data.files.map((file) => file.parseStatus))]).toEqual(
      expect.arrayContaining(['parsed', 'failed', 'parsing', 'pending']),
    );
    expect([...new Set(data.files.map((file) => file.mimeType))]).toEqual(
      expect.arrayContaining([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'image/png',
      ]),
    );
    expect([...new Set(data.importJobs.map((job) => job.status))]).toEqual(
      expect.arrayContaining(['completed', 'running', 'failed', 'partial_failed']),
    );
    expect(data.files.filter((file) => file.parseStatus === 'failed').every((file) => Boolean(file.safeErrorMessage))).toBe(true);
    expect(data.files.some((file) => file.isDownloadable)).toBe(false);

    rawRuntimeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
    expect(normalizeTenantName('')).toBe('未命名机构');
    expect(normalizeTenantName('??enterprise??-79164001')).toBe('机构名称异常');
  });

  it('支持范围、筛选和统计函数，且列表保持运营排序', () => {
    const data = getPlatformKnowledgeMockData();
    const lowHitTenant = data.tenants.find((tenant) => tenant.tenantName === '低命中修复门诊');
    expect(lowHitTenant).toBeDefined();

    const allScope = getPlatformKnowledgeScope(data);
    expect(allScope.scopeName).toBe('全部机构');
    expect(allScope.knowledgeItems).toHaveLength(data.knowledgeItems.length);

    const tenantScope = getPlatformKnowledgeScope(data, lowHitTenant?.tenantId);
    expect(tenantScope.scopeName).toBe('低命中修复门诊');
    expect(tenantScope.files.every((file) => file.tenantId === lowHitTenant?.tenantId)).toBe(true);
    expect(tenantScope.knowledgeItems.every((item) => item.tenantId === lowHitTenant?.tenantId)).toBe(true);

    expect(filterKnowledgeFiles(data.files, { keyword: '图片' }).map((file) => file.mimeType)).toContain('image/png');
    expect(filterKnowledgeFiles(data.files, { keyword: '解析失败', status: 'failed' }).every((file) => file.parseStatus === 'failed')).toBe(true);
    expect(filterKnowledgeFiles(data.files, { keyword: '话术库' }).length).toBeGreaterThan(0);

    const failedItems = filterKnowledgeItems(data.knowledgeItems, { trainingStatus: 'failed' });
    expect(failedItems.length).toBeGreaterThan(0);
    expect(failedItems.every((item) => item.trainingStatus === 'failed')).toBe(true);
    expect(filterKnowledgeItems(data.knowledgeItems, { keyword: '恢复期', category: '话术库' }).length).toBeGreaterThan(0);

    const totals = calculateScopeTotals(data, lowHitTenant?.tenantId);
    expect(totals.knowledgeCount).toBe(tenantScope.knowledgeItems.length);
    expect(totals.hitCount).toBe(tenantScope.knowledgeItems.reduce((sum, item) => sum + item.hitCount, 0));
    expect(totals.pendingOptimizationCount).toBeGreaterThanOrEqual(totals.zeroHitCount);

    expect(data.topQuestions.map((question) => question.hitCount)).toEqual(
      [...data.topQuestions.map((question) => question.hitCount)].sort((a, b) => b - a),
    );
    expect(data.categories.map((category) => category.hitCount)).toEqual(
      [...data.categories.map((category) => category.hitCount)].sort((a, b) => b - a),
    );
  });
});
