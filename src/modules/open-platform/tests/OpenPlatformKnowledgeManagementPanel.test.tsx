import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as viewLoader from '@/modules/open-platform/lib/platformKnowledgeManagementViewLoader';
import { OpenPlatformKnowledgeManagementPanel } from '@/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';
import {
  buildPlatformKnowledgeDirectories,
  getPlatformKnowledgeFilesResponse,
  getPlatformKnowledgeItemsResponse,
  getPlatformKnowledgeOverviewResponse,
  type PlatformKnowledgeFileDto,
} from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

vi.mock('@/modules/open-platform/lib/platformKnowledgeManagementViewLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/lib/platformKnowledgeManagementViewLoader')>();

  return {
    ...actual,
    loadOpenPlatformKnowledgeManagementView: vi.fn(actual.loadOpenPlatformKnowledgeManagementView),
    loadOpenPlatformKnowledgeManagementFiles: vi.fn(actual.loadOpenPlatformKnowledgeManagementFiles),
    loadOpenPlatformKnowledgeManagementItems: vi.fn(actual.loadOpenPlatformKnowledgeManagementItems),
  };
});

function expectNoRawRuntimeError(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('Cannot find module');
  expect(text).not.toContain('worker failed');
  expect(text).not.toContain('node_modules');
  expect(text).not.toContain('/Users/');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('sk_test');
}

const panelKnowledgeItems = [
  {
    knowledgeId: 'knowledge-price-reply',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    title: '客户询问价格时怎么回复？',
    descriptionPreview: '平台端测试用低敏知识摘要。',
    category: '星澜医美中心',
    folder: '话术库',
    hitCount: 42,
    trainingStatus: 'ready',
    updatedAt: '2026-06-14 10:00',
    institutionId: 'inst-xinglan',
    workspaceId: 'workspace-xinglan',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'ready',
    visibleInstitutionIds: ['inst-xinglan'],
    createdAt: '2026-06-13T08:00:00.000Z',
  },
  {
    knowledgeId: 'knowledge-repair-diet',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    title: '修复术后饮食要注意什么？',
    descriptionPreview: '测试低命中机构筛选用低敏摘要。',
    category: '低命中修复门诊',
    folder: '项目知识',
    hitCount: 1,
    trainingStatus: 'ready',
    updatedAt: '2026-06-15 10:00',
    institutionId: 'inst-low-hit',
    workspaceId: 'workspace-low-hit',
    version: 'v1',
    sourceKind: 'fixture',
    status: 'ready',
    readonlyStatus: 'ready',
    visibleInstitutionIds: ['inst-low-hit'],
    createdAt: '2026-06-15T08:00:00.000Z',
  },
];

const panelKnowledgeFiles = [
  {
    fileId: 'file-ui-a',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    knowledgeId: 'knowledge-price-reply',
    knowledgeTitle: '价格回复知识库',
    fileName: '星澜医美中心术后护理指南.pdf',
    originalFilename: '平台文件.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 10,
    sizeBytes: 10,
    sizeLabel: '10 B',
    sha256: 'c'.repeat(64),
    status: 'active',
    parseStatus: 'pending',
    safeErrorMessage: null,
    safeFailureMessage: null,
    uploadedByUserId: 'platform-ui',
    textLength: 0,
    chunkCount: 0,
    parserVersion: null,
    category: '星澜医美中心',
    folder: '话术库',
    updatedAt: '2026-06-14 10:00',
    createdAt: '2026-06-13T08:00:00.000Z',
    archivedAt: null,
  },
  {
    fileId: 'file-ui-failed',
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    knowledgeId: 'knowledge-price-reply',
    knowledgeTitle: '价格回复知识库',
    fileName: '星澜导入失败记录.xlsx',
    originalFilename: '星澜导入失败记录.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileType: 'XLSX',
    fileSizeKb: 12,
    sizeBytes: 12,
    sizeLabel: '12 B',
    sha256: 'd'.repeat(64),
    status: 'active',
    parseStatus: 'failed',
    safeErrorMessage: '文件格式暂不支持',
    safeFailureMessage: '文件格式暂不支持',
    uploadedByUserId: 'platform-ui',
    textLength: 0,
    chunkCount: 0,
    parserVersion: null,
    category: '星澜医美中心',
    folder: '导入记录',
    updatedAt: '2026-06-14 11:00',
    createdAt: '2026-06-13T09:00:00.000Z',
    archivedAt: null,
  },
  {
    fileId: 'file-low-hit-a',
    tenantId: 'tenant-low-hit',
    tenantName: '低命中修复门诊',
    knowledgeId: 'knowledge-repair-diet',
    knowledgeTitle: '修复术后饮食要注意什么？',
    fileName: '低命中修复术后答疑.docx',
    originalFilename: '低命中修复术后答疑.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'DOCX',
    fileSizeKb: 16,
    sizeBytes: 16,
    sizeLabel: '16 B',
    sha256: 'e'.repeat(64),
    status: 'active',
    parseStatus: 'parsed',
    safeErrorMessage: null,
    safeFailureMessage: null,
    uploadedByUserId: 'platform-ui',
    textLength: 120,
    chunkCount: 2,
    parserVersion: 'fixture-parser',
    category: '低命中修复门诊',
    folder: '项目知识',
    updatedAt: '2026-06-15 10:00',
    createdAt: '2026-06-15T08:00:00.000Z',
    archivedAt: null,
  },
  {
    fileId: 'file-unknown-failed',
    tenantId: 'tenant-unknown',
    tenantName: '机构名称异常',
    knowledgeId: 'knowledge-unknown',
    knowledgeTitle: '未命名机构',
    fileName: '机构名称异常资料.pdf',
    originalFilename: '机构名称异常资料.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 18,
    sizeBytes: 18,
    sizeLabel: '18 B',
    sha256: 'f'.repeat(64),
    status: 'active',
    parseStatus: 'failed',
    safeErrorMessage: 'PDF 解析服务异常',
    safeFailureMessage: 'PDF 解析服务异常',
    uploadedByUserId: 'platform-ui',
    textLength: 0,
    chunkCount: 0,
    parserVersion: null,
    category: '机构名称异常',
    folder: '未命名机构',
    updatedAt: '2026-06-16 10:00',
    createdAt: '2026-06-16T08:00:00.000Z',
    archivedAt: null,
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    fileId: `file-page-extra-${index + 1}`,
    tenantId: 'tenant-xinglan',
    tenantName: '星澜医美中心',
    knowledgeId: 'knowledge-price-reply',
    knowledgeTitle: '客户询问价格时怎么回复？',
    fileName: `星澜分页资料 ${index + 1}.txt`,
    originalFilename: `星澜分页资料 ${index + 1}.txt`,
    mimeType: 'text/plain',
    fileType: 'TXT',
    fileSizeKb: 8,
    sizeBytes: 8,
    sizeLabel: '8 B',
    sha256: String(index + 1).repeat(64).slice(0, 64),
    status: 'active',
    parseStatus: 'parsed',
    safeErrorMessage: null,
    safeFailureMessage: null,
    uploadedByUserId: 'platform-ui',
    textLength: 80,
    chunkCount: 1,
    parserVersion: 'fixture-parser',
    category: '星澜医美中心',
    folder: '话术库',
    updatedAt: '2026-06-14 12:00',
    createdAt: '2026-06-14T08:00:00.000Z',
    archivedAt: null,
  })),
];

function pageInfoFor(total: number, page = 1, pageSize = 10) {
  return {
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    hasPreviousPage: page > 1,
    hasNextPage: page * pageSize < total,
  };
}

function selectTenantCard(directory: HTMLElement, tenantName: string) {
  const [tenantCard] = within(directory).getAllByRole('button', { name: new RegExp(tenantName) });
  expect(tenantCard).toBeInTheDocument();
  fireEvent.click(tenantCard);
  return tenantCard;
}

describe('平台端知识库管理只读看板', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | Request | URL, init?: RequestInit) => {
        const requestUrl = typeof url === 'string' ? url : url instanceof Request ? url.url : url.toString();
        const parsedUrl = new URL(requestUrl, 'http://localhost');
        const method = init?.method ?? 'GET';
        if (parsedUrl.pathname === '/api/v1/open-platform/knowledge-management/directories/reorder' && method === 'PATCH') {
          return Response.json({
            requestId: 'open-platform-knowledge-directory-management',
            readonly: false,
            status: 'reordered',
            message: '目录排序已保存',
            affected: {
              sources: 2,
              documents: 0,
              chunks: 0,
              jobs: 0,
            },
          });
        }
        if (parsedUrl.pathname === '/api/v1/open-platform/knowledge-management/directories' && method === 'POST') {
          const body = typeof init?.body === 'string'
            ? JSON.parse(init.body) as { name?: string; parentId?: string | null }
            : {};
          const name = body.name ?? '新目录';
          const parentId = body.parentId ?? null;
          const isChild = Boolean(parentId);
          return Response.json({
            requestId: 'open-platform-knowledge-directory-management',
            readonly: false,
            status: 'created',
            message: '目录已创建',
            directory: {
              directoryId: isChild
                ? `${parentId}:child:${encodeURIComponent(name)}`
                : `directory:library:${encodeURIComponent(name)}`,
              parentId,
              kind: isChild ? 'folder' : 'knowledge_library',
              name,
              depth: isChild ? 1 : 0,
              sortOrder: isChild ? 101 : 100,
              knowledgeCount: 0,
              fileCount: 0,
              canRename: true,
              canCreateChild: !isChild,
              canArchive: true,
              archiveBlockedReason: null,
              status: 'active',
            },
            affected: {
              sources: 1,
              documents: 0,
              chunks: 0,
              jobs: 0,
            },
          }, { status: 201 });
        }
        if (parsedUrl.pathname.includes('/api/v1/open-platform/knowledge-management/directories/') && method === 'PATCH') {
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { name?: string } : {};
          const name = body.name ?? '自定义目录';
          return Response.json({
            requestId: 'open-platform-knowledge-directory-management',
            readonly: false,
            status: 'renamed',
            message: '目录名称已保存',
            directory: {
              directoryId: `directory:library:${encodeURIComponent(name)}`,
              parentId: null,
              kind: 'knowledge_library',
              name,
              depth: 0,
              sortOrder: 100,
              knowledgeCount: 1,
              fileCount: 1,
              canRename: true,
              canCreateChild: true,
              canArchive: false,
              archiveBlockedReason: '目录下仍有知识条目或文件',
              status: 'active',
            },
            affected: {
              sources: 1,
              documents: 0,
              chunks: 0,
              jobs: 0,
            },
          });
        }
        if (parsedUrl.pathname.includes('/api/v1/open-platform/knowledge-management/directories/') && method === 'DELETE') {
          const encodedDirectoryId = parsedUrl.pathname.split('/').at(-1) ?? '';
          const directoryId = decodeURIComponent(decodeURIComponent(encodedDirectoryId));
          if (directoryId.includes('新目录') || directoryId.includes('新子目录')) {
            return Response.json({
              requestId: 'open-platform-knowledge-directory-management',
              readonly: false,
              status: 'archived',
              message: '目录已归档',
              directory: {
                directoryId,
                parentId: null,
                kind: 'knowledge_library',
                name: directoryId.includes('新子目录') ? '新子目录' : '新目录',
                depth: 0,
                sortOrder: 100,
                knowledgeCount: 0,
                fileCount: 0,
                canRename: true,
                canCreateChild: true,
                canArchive: false,
                archiveBlockedReason: '目录已归档',
                status: 'archived',
              },
            });
          }
          return Response.json({
            requestId: 'open-platform-knowledge-directory-management',
            readonly: false,
            status: 'blocked',
            message: '目录下仍有知识条目或文件，请先迁移后再归档',
          }, { status: 409 });
        }
        if (parsedUrl.pathname === '/api/v1/open-platform/knowledge-management') {
          const selectedTenantId = parsedUrl.searchParams.get('tenantId');
          const itemsForView = selectedTenantId
            ? panelKnowledgeItems.filter((item) => item.tenantId === selectedTenantId)
            : panelKnowledgeItems;
          const filesForView = selectedTenantId
            ? panelKnowledgeFiles.filter((file) => file.tenantId === selectedTenantId)
            : panelKnowledgeFiles;
          const directories = buildPlatformKnowledgeDirectories({
            items: itemsForView,
            files: filesForView,
            sources: [
              {
                tenantId: 'tenant-xinglan',
                sourceLabel: '星澜医美中心',
                workspaceId: 'workspace-xinglan',
                status: 'active',
                updatedAt: '2026-06-14T10:00:00.000Z',
              },
              {
                tenantId: 'tenant-low-hit',
                sourceLabel: '低命中修复门诊',
                workspaceId: 'workspace-low-hit',
                status: 'active',
                updatedAt: '2026-06-15T10:00:00.000Z',
              },
              {
                tenantId: 'tenant-unknown',
                sourceLabel: '机构名称异常',
                workspaceId: 'workspace-unknown',
                status: 'active',
                updatedAt: '2026-06-16T10:00:00.000Z',
              },
            ],
          });
          return Response.json({
            ...getPlatformKnowledgeOverviewResponse({
            tenantId: parsedUrl.searchParams.get('tenantId'),
            }),
            dataSource: 'repository',
            allTotals: {
              ...getPlatformKnowledgeOverviewResponse().allTotals,
              tenantCount: 1,
              knowledgeCount: itemsForView.length,
              categoryCount: new Set(itemsForView.map((item) => item.category)).size,
              folderCount: new Set(filesForView.map((file) => file.folder)).size,
              hitCount: itemsForView.reduce((sum, item) => sum + item.hitCount, 0),
              chunkCount: filesForView.reduce((sum, file) => sum + file.chunkCount, 0),
              averageHitCount: itemsForView.length === 0 ? 0 : Math.round(itemsForView.reduce((sum, item) => sum + item.hitCount, 0) / itemsForView.length),
              trainedCount: itemsForView.filter((item) => item.trainingStatus === 'ready').length,
              failedTrainingCount: 0,
              zeroHitCount: itemsForView.filter((item) => item.hitCount === 0).length,
              hitCoverageRate: itemsForView.length === 0 ? 0 : 100,
              trainingCoverageRate: itemsForView.length === 0 ? 0 : 100,
              importSuccessRate: filesForView.length === 0 ? 0 : Math.round((filesForView.filter((file) => file.parseStatus !== 'failed').length / filesForView.length) * 100),
              sourceFileCount: panelKnowledgeFiles.length,
              importJobCount: 1,
              failedImportJobCount: 1,
              pendingOptimizationCount: 1,
            },
            totals: {
              ...getPlatformKnowledgeOverviewResponse().totals,
              tenantCount: 1,
              knowledgeCount: itemsForView.length,
              categoryCount: new Set(itemsForView.map((item) => item.category)).size,
              folderCount: new Set(filesForView.map((file) => file.folder)).size,
              hitCount: itemsForView.reduce((sum, item) => sum + item.hitCount, 0),
              chunkCount: filesForView.reduce((sum, file) => sum + file.chunkCount, 0),
              averageHitCount: itemsForView.length === 0 ? 0 : Math.round(itemsForView.reduce((sum, item) => sum + item.hitCount, 0) / itemsForView.length),
              trainedCount: itemsForView.filter((item) => item.trainingStatus === 'ready').length,
              failedTrainingCount: 0,
              zeroHitCount: itemsForView.filter((item) => item.hitCount === 0).length,
              hitCoverageRate: itemsForView.length === 0 ? 0 : 100,
              trainingCoverageRate: itemsForView.length === 0 ? 0 : 100,
              importSuccessRate: filesForView.length === 0 ? 0 : Math.round((filesForView.filter((file) => file.parseStatus !== 'failed').length / filesForView.length) * 100),
              sourceFileCount: filesForView.length,
              importJobCount: 1,
              failedImportJobCount: 1,
              pendingOptimizationCount: 1,
            },
            tenants: [
              {
                tenantId: 'tenant-xinglan',
                tenantName: '星澜医美中心',
                knowledgeCount: 1,
                categoryCount: 1,
                folderCount: 2,
                hitCount: 42,
                chunkCount: 1,
                averageHitCount: 42,
                trainedCount: 1,
                failedTrainingCount: 0,
                zeroHitCount: 0,
                hitCoverageRate: 100,
                trainingCoverageRate: 100,
                importSuccessRate: 83,
                sourceFileCount: panelKnowledgeFiles.length,
                totalFileSizeKb: 22,
                parsedFileCount: 1,
                failedFileCount: 1,
                importJobCount: 1,
                failedImportJobCount: 1,
                pendingOptimizationCount: 1,
              },
              {
                tenantId: 'tenant-low-hit',
                tenantName: '低命中修复门诊',
                knowledgeCount: 1,
                categoryCount: 1,
                folderCount: 1,
                hitCount: 1,
                chunkCount: 2,
                averageHitCount: 1,
                trainedCount: 1,
                failedTrainingCount: 0,
                zeroHitCount: 0,
                hitCoverageRate: 100,
                trainingCoverageRate: 100,
                importSuccessRate: 100,
                sourceFileCount: 1,
                totalFileSizeKb: 16,
                parsedFileCount: 1,
                failedFileCount: 0,
                importJobCount: 1,
                failedImportJobCount: 0,
                pendingOptimizationCount: 1,
              },
              {
                tenantId: 'tenant-unknown',
                tenantName: '机构名称异常',
                knowledgeCount: 0,
                categoryCount: 1,
                folderCount: 1,
                hitCount: 0,
                chunkCount: 0,
                averageHitCount: 0,
                trainedCount: 0,
                failedTrainingCount: 0,
                zeroHitCount: 0,
                hitCoverageRate: 0,
                trainingCoverageRate: 0,
                importSuccessRate: 0,
                sourceFileCount: 1,
                totalFileSizeKb: 18,
                parsedFileCount: 0,
                failedFileCount: 1,
                importJobCount: 1,
                failedImportJobCount: 1,
                pendingOptimizationCount: 1,
              },
            ],
            categoryStats: [
              {
                categoryCode: 'xinglan',
                categoryName: '星澜医美中心',
                category: '星澜医美中心',
                knowledgeCount: 1,
                hitCount: 42,
                averageHitCount: 42,
                trainedCount: 1,
                failedTrainingCount: 0,
                zeroHitCount: 0,
                chunkCount: 1,
                hitCoverageRate: 100,
                trainingCoverageRate: 100,
              },
              {
                categoryCode: 'low-hit',
                categoryName: '低命中修复门诊',
                category: '低命中修复门诊',
                knowledgeCount: 1,
                hitCount: 1,
                averageHitCount: 1,
                trainedCount: 1,
                failedTrainingCount: 0,
                zeroHitCount: 0,
                chunkCount: 2,
                hitCoverageRate: 100,
                trainingCoverageRate: 100,
              },
            ],
            directories,
            topQuestions: [
              {
                knowledgeId: 'knowledge-price-reply',
                question: '冷敷后怎么护理？',
                questionTitle: '冷敷后怎么护理？',
                tenantId: 'tenant-xinglan',
                tenantName: '星澜医美中心',
                category: '星澜医美中心',
                folder: '话术库',
                hitCount: 12,
                lastAskedAt: '2026-06-14 10:00',
                updatedAt: '2026-06-14 10:00',
              },
            ],
            importJobs: (selectedTenantId === 'tenant-low-hit' ? [
              {
                taskId: 'import-job-low-hit',
                jobId: 'import-job-low-hit',
                tenantId: 'tenant-low-hit',
                tenantName: '低命中修复门诊',
                title: '低命中机构修复资料导入',
                fileName: '低命中机构修复资料导入',
                status: 'completed',
                totalCount: 8,
                successCount: 8,
                failedCount: 0,
                totalRows: 8,
                successRows: 8,
                failedRows: 0,
                createdAt: '2026-06-15 11:00',
                updatedAt: '2026-06-15 11:10',
              },
            ] : [
              {
                taskId: 'import-job-xinglan-failed',
                jobId: 'import-job-xinglan-failed',
                tenantId: 'tenant-xinglan',
                tenantName: '星澜医美中心',
                title: '星澜导入失败记录.xlsx',
                fileName: '星澜导入失败记录.xlsx',
                status: 'failed',
                totalCount: 10,
                successCount: 0,
                failedCount: 10,
                totalRows: 10,
                successRows: 0,
                failedRows: 10,
                createdAt: '2026-06-14 11:00',
                updatedAt: '2026-06-14 11:10',
              },
            ]),
          });
        }
        if (parsedUrl.pathname === '/api/v1/open-platform/knowledge-management/files') {
          const keyword = parsedUrl.searchParams.get('keyword')?.trim() ?? '';
          const status = parsedUrl.searchParams.get('status')?.trim() ?? '';
          const tenantId = parsedUrl.searchParams.get('tenantId')?.trim() ?? '';
          const page = Number(parsedUrl.searchParams.get('page') ?? 1);
          const pageSize = Number(parsedUrl.searchParams.get('pageSize') ?? 10);
          const records = panelKnowledgeFiles.filter((file) => {
            const tenantMatched = tenantId.length === 0 || file.tenantId === tenantId;
            const keywordMatched = keyword.length === 0 || file.fileName.includes(keyword) || file.originalFilename.includes(keyword);
            const statusMatched = status.length === 0 || status === 'all' || file.parseStatus === status || file.status === status;
            return tenantMatched && keywordMatched && statusMatched;
          });
          const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
          return Response.json({
            ...getPlatformKnowledgeFilesResponse({
            tenantId: parsedUrl.searchParams.get('tenantId'),
            keyword: parsedUrl.searchParams.get('keyword'),
            status: parsedUrl.searchParams.get('status'),
            page: parsedUrl.searchParams.get('page'),
            pageSize: parsedUrl.searchParams.get('pageSize'),
            }),
            dataSource: 'repository',
            records: pageRecords,
            pageInfo: pageInfoFor(records.length, page, pageSize),
          });
        }
        if (parsedUrl.pathname === '/api/v1/open-platform/knowledge-management/items') {
          const keyword = parsedUrl.searchParams.get('keyword')?.trim() ?? '';
          const category = parsedUrl.searchParams.get('category')?.trim() ?? '';
          const tenantId = parsedUrl.searchParams.get('tenantId')?.trim() ?? '';
          const page = Number(parsedUrl.searchParams.get('page') ?? 1);
          const pageSize = Number(parsedUrl.searchParams.get('pageSize') ?? 10);
          const records = panelKnowledgeItems.filter((item) => {
            const tenantMatched = tenantId.length === 0 || item.tenantId === tenantId;
            const keywordMatched = keyword.length === 0 || item.title.includes(keyword) || item.descriptionPreview.includes(keyword);
            const categoryMatched = category.length === 0 || category === 'all' || item.category === category;
            return tenantMatched && keywordMatched && categoryMatched;
          });
          const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
          return Response.json({
            ...getPlatformKnowledgeItemsResponse({
            tenantId: parsedUrl.searchParams.get('tenantId'),
            keyword: parsedUrl.searchParams.get('keyword'),
            category: parsedUrl.searchParams.get('category'),
            trainingStatus: parsedUrl.searchParams.get('trainingStatus'),
            page: parsedUrl.searchParams.get('page'),
            pageSize: parsedUrl.searchParams.get('pageSize'),
            }),
            dataSource: 'repository',
            records: pageRecords,
            pageInfo: pageInfoFor(records.length, page, pageSize),
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/capabilities')) {
          return Response.json({
            requestId: 'knowledge-base-production-capabilities',
            readonly: true,
            capabilities: [
              {
                id: 'fileManagement',
                label: '文件管理',
                enabled: true,
                status: 'enabled',
                summary: '内部受控文件管理已启用',
                disabledReason: null,
                entryCondition: null,
              },
              {
                id: 'mockQa',
                label: 'mock/local QA',
                enabled: true,
                status: 'enabled',
                summary: '内部受控 mock/local QA 已启用',
                disabledReason: null,
                entryCondition: null,
              },
              {
                id: 'realAiProvider',
                label: '真实 AI provider',
                enabled: false,
                status: 'disabled',
                summary: 'AI provider 适配层已准备，真实 AI 未启用',
                disabledReason: '真实 AI 未启用，未接入真实第三方 AI',
                entryCondition: '完成真实 AI 接入方案评审、安全策略和质量验收后再开启。',
              },
              {
                id: 'ocr',
                label: 'OCR',
                enabled: false,
                status: 'disabled',
                summary: 'OCR 未启用',
                disabledReason: '未接入 OCR',
                entryCondition: '完成 OCR 解析方案评审和质量验收后再开启。',
              },
              {
                id: 'runtimeIngestion',
                label: 'runtime ingestion',
                enabled: false,
                status: 'disabled',
                summary: 'runtime ingestion 未启用',
                disabledReason: '未接入 runtime ingestion',
                entryCondition: '完成队列、worker、重试、死信和可观测性方案评审后再开启。',
              },
            ],
            qaQuotaPolicy: {
              tenantDailyLimit: 100,
              institutionDailyLimit: 30,
              usageLimitedMessage: '当前知识库问答次数已达上限，请稍后再试',
            },
            permissionMatrix: {
              platform: { actions: [] },
              institution: { allowedActions: [], forbiddenActions: [] },
            },
            sensitiveFieldPolicy: {
              allowlist: ['knowledgeId', 'fileId', 'chunkId', 'auditId'],
              denylist: ['storageKey', 'embeddingVectorJson', 'token', 'secret'],
            },
            controlledTrial: {
              stage: '10-6',
              status: '内部受控试用发布包',
              baselineCommit: 'c7f9b7603b7536fc7a4191213120b4cf6e62585f',
              summary: '知识库内部受控试用发布包已收口，当前可交付内部试用人员。',
              supportedFileTypes: [
                { id: 'txt', label: 'TXT', behavior: '按纯文本解析。' },
                { id: 'md', label: 'Markdown', behavior: '按 Markdown 文本解析。' },
                { id: 'csv', label: 'CSV', behavior: '抽取表格文本。' },
                { id: 'pdf_text', label: '文本型 PDF', behavior: '仅抽取文本型 PDF；扫描件安全失败。' },
                { id: 'docx', label: 'DOCX', behavior: '抽取正文文本。' },
                { id: 'xlsx', label: 'XLSX', behavior: '抽取工作表文本。' },
              ],
              safetyLimits: [
                { label: '文件大小限制', value: '20MB', description: '超过限制会安全拒绝解析。' },
                { label: '解析文本上限', value: '32000 字符', description: '超过上限会截断并保留低敏状态。' },
                { label: 'ZIP 单文件解压上限', value: '5MB', description: 'DOCX/XLSX 解压单文件限制。' },
                { label: 'ZIP 总解压上限', value: '12MB', description: 'DOCX/XLSX 解压总量限制。' },
                { label: 'PDF 单段解压上限', value: '8MB', description: 'PDF 文本流解压限制。' },
              ],
              platform: {
                notice: '平台端可按 tenant 范围试用知识库管理闭环。',
                trialSteps: [
                  { id: 'capability', label: '确认 capability 与 No-Go', description: '先确认能力边界。' },
                  { id: 'parse', label: '上传白名单文件并发起解析', description: '验证解析链路。' },
                  { id: 'chunks', label: '查看解析状态与 chunk 预览', description: '确认低敏片段。' },
                  { id: 'keyword', label: '执行关键词检索', description: '验证关键词召回。' },
                  { id: 'vector', label: '执行 mock 向量检索', description: '验证 mock 语义召回。' },
                  { id: 'qa', label: '发起 mock/local QA', description: '验证本地问答。' },
                  { id: 'audit', label: '核对 citations 与 QA audit', description: '核对引用和审计。' },
                  { id: 'quota', label: '核对 quota 与失败态说明', description: '核对用量和失败态。' },
                ],
                acceptanceChecklist: [
                  { id: 'parse-copy', label: '解析状态和失败文案可理解', description: '中文安全文案。' },
                  { id: 'chunk-safe', label: '检索和 QA 均基于低敏 chunk', description: '不展示全文。' },
                  { id: 'audit-quota', label: 'citations、audit、quota、capability 可核对', description: '闭环可验收。' },
                  { id: 'no-go', label: 'No-Go 和禁止外显字段持续可见', description: '边界可见。' },
                ],
                allowedCapabilities: [
                  { id: 'upload', label: '文件上传', description: '平台端受控上传。' },
                  { id: 'parse', label: '真实文本文件解析', description: '仅文本型文件解析。' },
                  { id: 'chunks', label: 'chunk 查看', description: '只展示低敏片段预览。' },
                  { id: 'keyword', label: '关键词检索', description: '基于已解析片段。' },
                  { id: 'vector', label: 'mock 向量检索', description: '使用本地 mock embedding。' },
                  { id: 'qa', label: 'mock/local QA', description: '不调用真实 AI。' },
                  { id: 'citations', label: 'citations', description: '展示引用片段。' },
                  { id: 'audit', label: 'QA audit', description: '低敏审计。' },
                  { id: 'quota', label: 'quota', description: '受每日次数限制。' },
                  { id: 'capability', label: 'capability', description: '展示能力状态。' },
                ],
              },
              institution: {
                notice: '机构端仅可只读试用授权内容。',
                allowedCapabilities: [],
                forbiddenActions: [],
                trialSteps: [],
                acceptanceChecklist: [],
              },
              blockedCapabilities: [
                { id: 'ocr', label: 'OCR', reason: '未接入图片文字识别。' },
                { id: 'scannedPdf', label: '扫描 PDF / 图片文字识别', reason: '扫描件不做识别。' },
                { id: 'realAi', label: '真实 AI', reason: '真实 AI 未启用。' },
                { id: 'credentials', label: '真实凭据 / API 凭据', reason: '不读取真实凭据。' },
                { id: 'externalNetwork', label: '外部网络服务', reason: '不调用外部网络服务。' },
                { id: 'vectorStore', label: '真实向量数据库', reason: '仅 mock embedding。' },
                { id: 'runtimeIngestion', label: 'runtime ingestion', reason: '未启用 runtime ingestion。' },
                { id: 'workerQueue', label: 'worker / queue / scheduler', reason: '未启用后台队列。' },
                { id: 'training', label: '训练系统', reason: '不训练模型。' },
                { id: 'billing', label: '计费系统', reason: '不接入计费。' },
                { id: 'dashboard', label: 'dashboard 聚合', reason: '不做 dashboard 聚合。' },
                { id: 'homepage', label: '首页编辑', reason: '不开发首页编辑。' },
              ],
              lowSensitiveBoundaries: ['仅展示低敏摘要、解析状态、chunk 预览、引用和审计摘要。'],
              forbiddenFieldHints: ['存储定位键', '本地文件系统路径', '数据库语句', '异常堆栈', '令牌', '密钥', 'API 凭据'],
              commonFailureStates: [
                { id: 'empty', label: '空态', message: '暂无授权可见知识库', operatorGuidance: '确认授权范围。' },
                { id: 'parseFailed', label: '解析失败', message: '知识库文件解析失败，请稍后重试', operatorGuidance: '检查文件类型。' },
                { id: 'quota', label: 'quota 超限', message: '当前知识库问答次数已达上限，请稍后再试', operatorGuidance: '稍后重试。' },
                { id: 'noCitation', label: '无引用', message: '当前问题没有命中可引用的知识片段', operatorGuidance: '调整问题。' },
                { id: 'noResult', label: '无检索结果', message: '当前范围没有命中关键词或相似片段', operatorGuidance: '调整关键词。' },
              ],
              passingCriteria: [
                '平台端按步骤完成上传、解析、chunk、检索、QA、citations、audit、quota、capability 验收。',
                '空态、失败态、权限态、quota 超限态、无引用态、无检索结果均展示中文安全文案。',
              ],
              releasePackage: {
                deliveryStatus: '可交付内部受控试用',
                conclusion: '当前版本可以交付内部试用人员，按手册完成低敏验收。',
                packageChecklist: [
                  { id: 'overview', label: '阶段总交付说明', description: '说明当前阶段边界。' },
                  { id: 'platform-manual', label: '平台端内部试用操作手册', description: '平台端试用步骤。' },
                  { id: 'institution-manual', label: '机构端只读试用操作手册', description: '机构端只读步骤。' },
                  { id: 'report-template', label: '内部验收报告模板', description: '统一记录验收项。' },
                  { id: 'no-go', label: '已完成能力与 No-Go 清单', description: '清楚区分允许与禁止。' },
                  { id: 'next-entry', label: '后续进入条件说明', description: '下一阶段前置条件。' },
                ],
                platformManualSummary: [
                  { id: 'status', label: '确认发布状态和 No-Go', description: '先看发布状态。' },
                  { id: 'parse', label: '按白名单上传并解析文件', description: '验证解析。' },
                  { id: 'qa', label: '核对 chunk、检索、QA 与引用', description: '验证引用。' },
                  { id: 'audit', label: '记录 audit、quota 与失败态', description: '记录验收。' },
                ],
                institutionManualSummary: [
                  { id: 'readonly-status', label: '确认只读交付状态', description: '确认只读。' },
                  { id: 'files', label: '查看授权知识库和文件解析状态', description: '查看授权内容。' },
                  { id: 'qa', label: '完成只读检索、QA 与 citations', description: '完成只读问答。' },
                  { id: 'record', label: '记录只读边界和失败态', description: '记录边界。' },
                ],
                acceptanceReportFields: [
                  { id: 'tester', label: '试用人员与日期', description: '记录人员和日期。' },
                  { id: 'platform', label: '平台端试用记录', description: '记录平台端步骤。' },
                  { id: 'institution', label: '机构端只读试用记录', description: '记录机构端步骤。' },
                  { id: 'parse', label: '文件解析样本与失败态', description: '记录解析样本。' },
                  { id: 'qa', label: '检索、QA、citations 与 audit 记录', description: '记录问答链路。' },
                  { id: 'governance', label: 'quota、capability 与 No-Go 核对', description: '记录治理项。' },
                  { id: 'handoff', label: '问题、风险与交接结论', description: '记录交接结论。' },
                ],
                completedCapabilities: [
                  { id: 'parse', label: '真实文本文件解析', description: '白名单文本文件解析。' },
                  { id: 'chunks', label: 'chunk 预览', description: '低敏片段预览。' },
                  { id: 'keyword', label: '关键词检索', description: '关键词召回。' },
                  { id: 'vector', label: 'mock 向量检索', description: 'mock 相似召回。' },
                  { id: 'qa', label: 'mock/local QA', description: '本地问答。' },
                  { id: 'citations', label: 'citations', description: '引用展示。' },
                  { id: 'audit', label: 'QA audit', description: '审计记录。' },
                  { id: 'quota', label: 'quota', description: '用量限制。' },
                  { id: 'capability', label: 'capability', description: '能力状态。' },
                  { id: 'platform-low-sensitive', label: '平台端低敏展示', description: '平台端边界。' },
                  { id: 'institution-readonly', label: '机构端只读低敏展示', description: '机构端边界。' },
                ],
                nextStageEntryConditions: [
                  { id: 'real-ai', label: '真实 AI', description: '必须先完成密钥治理、成本限额、质量评估、安全评估、灰度开关、回滚方案。' },
                  { id: 'ocr', label: 'OCR', description: '必须先完成文件安全策略、扫描件识别质量评估、失败补偿、人工复核边界。' },
                  { id: 'vector-store', label: '真实向量库', description: '必须先完成选型、schema/migration 审批、租户隔离、删除回滚、索引重建策略。' },
                  { id: 'runtime-ingestion', label: 'runtime ingestion', description: '必须先完成 worker/queue/scheduler 方案、幂等、重试、死信、可观测性和回滚。' },
                  { id: 'external-service', label: '任何真实外部服务', description: '必须先完成凭据管理、审计、限流、成本控制和降级策略。' },
                ],
              },
              failureMessages: [
                '当前文件类型暂不支持解析',
                '文件大小超过解析限制，请拆分后重新上传',
                '文件未提取到可解析文本，扫描件或图片内容暂不支持',
                '知识库文件解析失败，请稍后重试',
                '解析文本超过长度限制，已截断为低敏预览',
                '当前知识库问答次数已达上限，请稍后再试',
                '当前账号没有访问该知识库内容的权限',
              ],
            },
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/qa/audits')) {
          return Response.json({
            requestId: 'platform-knowledge-qa-audits',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                auditId: 'kb-qa-audit-platform-ui-a',
                tenantId: 'tenant-xinglan',
                institutionId: 'inst-xinglan',
                actorScope: 'institution',
                actorUserId: 'tenant-user',
                question: '冷敷后怎么护理？',
                answerPreview: '基于已召回的知识片段：平台端审计回答预览。',
                retrievalMode: 'hybrid',
                citationCount: 2,
                safeStatus: 'answered',
                safeFailureMessage: null,
                createdAt: '2026-06-14T08:00:00.000Z',
              },
            ],
            pageInfo: {
              page: 1,
              pageSize: 10,
              total: 1,
              pageCount: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
            emptyState: {
              title: '暂无问答审计',
              description: '当前范围还没有知识库问答审计记录。',
            },
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/qa')) {
          return Response.json({
            answer: '基于已召回的知识片段：平台端知识库问答回答。',
            citations: [
              {
                knowledgeId: 'knowledge-price-reply',
                knowledgeTitle: '价格回复知识库',
                fileId: 'file-ui-a',
                fileName: '平台文件.pdf',
                chunkId: 'qa-chunk-ui-a',
                chunkIndex: 0,
                textPreview: '平台端问答引用片段',
                score: 1,
                matchReason: '片段包含关键词“冷敷”',
              },
            ],
            retrievalMode: 'hybrid',
            auditId: 'kb-qa-audit-ui-a',
            safeStatus: 'answered',
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/embeddings')) {
          return Response.json({
            status: 'succeeded',
            embeddingCount: 1,
            embeddings: [
              {
                embeddingId: 'embedding-ui-a',
                tenantId: 'tenant-xinglan',
                knowledgeId: 'knowledge-price-reply',
                fileId: 'file-ui-a',
                chunkId: 'chunk-ui-a',
                embeddingProvider: 'mock_local_embedding',
                embeddingModel: 'mock-local-embedding-v1',
                embeddingDimensions: 8,
                status: 'ready',
              },
            ],
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/vector-search')) {
          return Response.json({
            requestId: 'platform-knowledge-vector-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-price-reply',
                knowledgeTitle: '价格回复知识库',
                fileId: 'file-ui-a',
                fileName: '平台文件.pdf',
                chunkId: 'vector-chunk-ui-a',
                chunkIndex: 0,
                textPreview: '平台端语义相似引用片段',
                score: 0.876543,
                matchReason: 'mock embedding 相似度 0.877',
              },
            ],
            pageInfo: {
              page: 1,
              pageSize: 10,
              total: 1,
              pageCount: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
            emptyState: {
              title: '暂无相似片段',
              description: '当前范围没有命中语义相似的已解析知识片段。',
            },
          });
        }
        if (requestUrl.includes('/api/v1/open-platform/knowledge-management/search')) {
          return Response.json({
            requestId: 'platform-knowledge-keyword-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-price-reply',
                knowledgeTitle: '价格回复知识库',
                fileId: 'file-ui-a',
                fileName: '平台文件.pdf',
                chunkId: 'search-chunk-ui-a',
                chunkIndex: 0,
                textPreview: '平台端冷敷引用片段预览',
                matchReason: '片段包含关键词“冷敷”',
              },
            ],
            pageInfo: {
              page: 1,
              pageSize: 10,
              total: 1,
              pageCount: 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
            emptyState: {
              title: '暂无匹配片段',
              description: '当前范围没有命中关键词的已解析知识片段。',
            },
          });
        }
        if (requestUrl.includes('/parse/chunks')) {
          return Response.json({
            records: [
              {
                chunkId: 'chunk-ui-a',
                tenantId: 'tenant-xinglan',
                knowledgeId: 'knowledge-price-reply',
                fileId: 'file-ui-a',
                chunkIndex: 0,
                textPreview: '平台文件解析片段预览',
                charCount: 10,
                createdAt: '2026-06-13T08:00:00.000Z',
                updatedAt: '2026-06-13T08:00:00.000Z',
              },
            ],
          });
        }
        if (requestUrl.includes('/parse') && method === 'POST') {
          return Response.json({
            status: 'succeeded',
            parse: {
              parseId: 'parse-ui-a',
              tenantId: 'tenant-xinglan',
              knowledgeId: 'knowledge-price-reply',
              fileId: 'file-ui-a',
              parseStatus: 'succeeded',
              failureReasonCode: null,
              safeFailureMessage: null,
              textLength: 10,
              chunkCount: 1,
              parserVersion: 'local-text-parser-v1',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
            },
          });
        }
        if (requestUrl.includes('/download')) {
          return new Response('file bytes', {
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('平台文件.pdf')}`,
            },
          });
        }
        if (method === 'POST') {
          return Response.json({
            status: 'uploaded',
            file: {
              fileId: 'file-ui-uploaded',
              tenantId: 'tenant-xinglan',
              knowledgeId: 'knowledge-price-reply',
              originalFilename: '平台文件.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'c'.repeat(64),
              status: 'active',
              uploadedByUserId: 'platform-ui',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: null,
              fileType: 'PDF',
              sizeLabel: '10 B',
              parseStatus: 'pending',
              failureReasonCode: null,
              safeFailureMessage: null,
              textLength: 0,
              chunkCount: 0,
              parserVersion: null,
            },
          }, { status: 201 });
        }
        if (method === 'DELETE') {
          return Response.json({
            status: 'archived',
            file: {
              fileId: 'file-ui-a',
              tenantId: 'tenant-xinglan',
              knowledgeId: 'knowledge-price-reply',
              originalFilename: '平台文件.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'c'.repeat(64),
              status: 'archived',
              uploadedByUserId: 'platform-ui',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: '2026-06-13T09:00:00.000Z',
              fileType: 'PDF',
              sizeLabel: '10 B',
              parseStatus: 'pending',
              failureReasonCode: null,
              safeFailureMessage: null,
              textLength: 0,
              chunkCount: 0,
              parserVersion: null,
            },
          });
        }
        return Response.json({
          records: [
            {
              fileId: 'file-ui-a',
              tenantId: 'tenant-xinglan',
              knowledgeId: 'knowledge-price-reply',
              originalFilename: '平台文件.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'c'.repeat(64),
              status: 'active',
              uploadedByUserId: 'platform-ui',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: null,
              fileType: 'PDF',
              sizeLabel: '10 B',
              parseStatus: 'pending',
              failureReasonCode: null,
              safeFailureMessage: null,
              textLength: 0,
              chunkCount: 0,
              parserVersion: null,
            },
          ],
          pageInfo: {
            page: 1,
            pageSize: 10,
            total: 1,
            pageCount: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        });
      }),
    );
  });

  it('初始加载时展示中文 loading 状态', () => {
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementView).mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(screen.getByText('正在加载知识库运营数据...')).toBeInTheDocument();
    expect(screen.getByText('正在读取只读运营 contract。')).toBeInTheDocument();
  });

  it('可以从平台侧菜单进入白色主题知识库工作台并默认展示文件管理', async () => {
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: '知识库管理' }));

    expect(container.querySelector('main')).toHaveClass('bg-[#f7f9fc]');
    const bannerHeading = screen.getByRole('heading', { name: '知识库管理' });
    const banner = bannerHeading.closest('[data-platform-banner="true"]');
    expect(banner).not.toBeNull();
    expect(banner).toHaveClass('rounded-xl', 'py-4', 'lg:py-5');
    expect(bannerHeading).toHaveClass('text-2xl', 'sm:text-[28px]');
    expect(screen.getByText('按机构、目录、文件和问答链路管理知识库。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传文档' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建知识' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '同步数据' })).toBeInTheDocument();
    expect(viewLoader.loadOpenPlatformKnowledgeManagementView).toHaveBeenCalledWith({ tenantId: null });
    expect(viewLoader.loadOpenPlatformKnowledgeManagementFiles).toHaveBeenCalledWith({
      tenantId: null,
      keyword: '',
      page: 1,
      pageSize: 6,
    });
    expect(viewLoader.loadOpenPlatformKnowledgeManagementItems).toHaveBeenCalledWith({
      tenantId: null,
      page: 1,
      pageSize: 50,
    });

    expect(await screen.findByText('接入机构')).toBeInTheDocument();
    expect(screen.getAllByText('知识条目')[0]).toBeInTheDocument();
    expect(screen.getAllByText('累计命中')[0]).toBeInTheDocument();
    expect(screen.getAllByText('训练 / 解析覆盖')[0]).toBeInTheDocument();
    expect(screen.getByText('待优化')).toBeInTheDocument();
    expect(screen.getByLabelText('当前范围健康卡')).toBeInTheDocument();
    expect(screen.getAllByText('导入成功率').length).toBeGreaterThan(0);
    expect(screen.getByText('命中覆盖率')).toBeInTheDocument();
    expect(screen.getByText('训练 / 解析覆盖率')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识目录' })).toBeInTheDocument();
    const workbench = screen.getByLabelText('知识库管理工作台');
    expect(within(workbench).getByLabelText('知识目录')).toBeInTheDocument();
    expect(within(workbench).getByLabelText('文件管理工作区')).toBeInTheDocument();
    expect(within(workbench).getByLabelText('运营信号')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: '知识库工作区' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '文件管理' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '知识条目' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '检索测试' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '问答审计' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '导入任务' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '文件管理' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '运营信号' })).toBeInTheDocument();
    expect(screen.getByText('高频问题')).toBeInTheDocument();
    expect(screen.getByText('热门分类')).toBeInTheDocument();
    expect(screen.getByText('零命中知识')).toBeInTheDocument();
    expect(screen.getAllByText('导入成功率').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '更多筛选' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '解析已选' })).toBeDisabled();
    expect(
      Array.from(container.querySelectorAll('[class]')).some((element) =>
        element.getAttribute('class')?.includes('xl:grid-cols-[1fr_300px_300px]'),
      ),
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll('[class]')).some((element) =>
        element.getAttribute('class')?.includes('xl:grid-cols-[240px_minmax(0,1fr)_260px]') &&
        element.getAttribute('class')?.includes('items-start'),
      ),
    ).toBe(true);
    expect(screen.queryByLabelText('当前知识库范围')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('知识库功能真实性状态')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '功能真实性' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '机构上传文件' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '文件管理操作' })).not.toBeInTheDocument();

    expectNoRawRuntimeError(container);
    expect(screen.getByRole('button', { name: '上传文件' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '下载文件' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '归档文件' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('真实下载');
    expect(container.textContent).not.toContain('开始训练');
    expect(container.textContent).not.toContain('CSV 导出');
    expect(screen.queryByRole('button', { name: /导出|训练|编辑|删除/ })).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(container.querySelector('a[download]')).toBeNull();
  });

  it('平台端文件管理操作区支持上传、下载、解析、查看片段和归档 API 调用', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '上传与解析' })).toBeInTheDocument();
    expect(await screen.findByText('平台文件.pdf')).toBeInTheDocument();

    const uploadInput = screen.getByLabelText('选择知识库文件');
    fireEvent.change(uploadInput, {
      target: {
        files: [new File(['file bytes'], '平台文件.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '上传文件' }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/items/knowledge-price-reply/files'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-ui-a/download?tenantId=tenant-xinglan'),
        expect.objectContaining({ method: 'GET' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '发起解析' }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-ui-a/parse?tenantId=tenant-xinglan'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('文件解析已完成')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-ui-a/parse/chunks?tenantId=tenant-xinglan'),
        expect.objectContaining({ method: 'GET' }),
      ),
    );
    expect(await screen.findByText('平台文件解析片段预览')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '归档文件' }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-ui-a?tenantId=tenant-xinglan'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('文件管理页签优先展示上传与解析卡片，并保留文件卡片网格', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const uploadPanel = await screen.findByLabelText('知识库文件管理操作区');
    const fileListPanel = await screen.findByLabelText('机构上传文件列表');
    const fileCardGrid = await screen.findByLabelText('文件卡片网格');

    expect(uploadPanel.compareDocumentPosition(fileListPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fileCardGrid).toBeInTheDocument();
  });

  it('文件卡片网格展示文件名、机构、状态、类型大小、分类文件夹、解析字符数、更新时间和错误信息', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const fileCardGrid = await screen.findByLabelText('文件卡片网格');

    expect(within(fileCardGrid).getByText('星澜医美中心术后护理指南.pdf')).toBeInTheDocument();
    expect(within(fileCardGrid).getAllByText('星澜医美中心').length).toBeGreaterThan(0);
    expect(within(fileCardGrid).getByText('待解析')).toBeInTheDocument();
    expect(within(fileCardGrid).getByText('PDF · 10 KB')).toBeInTheDocument();
    expect(within(fileCardGrid).getAllByText('话术库').length).toBeGreaterThan(0);
    expect(within(fileCardGrid).getAllByText('0 字符').length).toBeGreaterThan(0);
    expect(within(fileCardGrid).getByText('2026-06-14 10:00')).toBeInTheDocument();
    expect(within(fileCardGrid).getAllByText('错误信息：暂无解析错误').length).toBeGreaterThan(0);
    expect(within(fileCardGrid).getByText('星澜导入失败记录.xlsx')).toBeInTheDocument();
    expect(within(fileCardGrid).getByText('XLSX · 12 KB')).toBeInTheDocument();
    expect(within(fileCardGrid).getByText('导入记录')).toBeInTheDocument();
    expect(within(fileCardGrid).getByText('错误信息：文件格式暂不支持')).toBeInTheDocument();
    expect(within(fileCardGrid).getAllByRole('button', { name: '下载' }).length).toBeGreaterThan(0);
    expect(within(fileCardGrid).getAllByRole('button', { name: '操作受控' }).length).toBeGreaterThan(0);
  });
  it('顶部上传文档入口会跳转到真实上传区并打开文件选择', async () => {
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '上传与解析' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

    await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
    expect(inputClickSpy).toHaveBeenCalled();

    inputClickSpy.mockRestore();
  });

  it('上传区选择文件和上传文件控件保持单行文案', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '上传与解析' })).toBeInTheDocument();
    const uploadInput = screen.getByLabelText('选择知识库文件');
    const chooseFileControl = uploadInput.closest('label');
    const uploadButton = screen.getByRole('button', { name: '上传文件' });

    expect(chooseFileControl).toHaveClass('whitespace-nowrap');
    expect(chooseFileControl).toHaveClass('min-w-[96px]');
    expect(uploadButton).toHaveClass('whitespace-nowrap');
    expect(uploadButton).toHaveClass('min-w-[96px]');
  });

  it('顶部上传文档入口在没有可绑定知识条目时展示阻断原因', async () => {
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementItems).mockResolvedValueOnce({
      requestId: 'open-platform-knowledge-management-items',
      readonly: true,
      dataSource: 'repository',
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 50,
        total: 0,
        pageCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      emptyState: {
        title: '暂无匹配的知识库运营数据',
        description: '请调整机构范围或文件名搜索条件后再查看。',
      },
    });

    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '上传与解析' })).toBeInTheDocument();
    const ownerSelect = screen.getByLabelText('选择文件所属知识库');
    expect(ownerSelect).toBeDisabled();
    expect(within(ownerSelect).getByRole('option', { name: '暂无可选知识库' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

    expect(await screen.findByText('暂无可上传的知识库条目，请先新建知识后再上传文档。')).toBeInTheDocument();
    expect(inputClickSpy).not.toHaveBeenCalled();

    inputClickSpy.mockRestore();
  });

  it('左侧知识目录使用服务端目录 contract 而不是硬编码目录', async () => {
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementView).mockResolvedValueOnce({
      ...getPlatformKnowledgeOverviewResponse(),
      dataSource: 'repository',
      scopeName: '全部机构',
      allTenantStats: {
        tenantId: 'all',
        tenantName: '全部机构',
        status: 'active',
        knowledgeCount: 3,
        folderCount: 2,
        hitCount: 0,
        trainedCount: 0,
        failedTrainingCount: 0,
        zeroHitCount: 0,
        chunkCount: 0,
        averageHitCount: 0,
        hitCoverageRate: 0,
        trainingCoverageRate: 0,
        importSuccessRate: 0,
      },
      directories: [
        {
          directoryId: 'library-custom-root',
          parentId: null,
          name: '自定义知识库',
          depth: 0,
          sortOrder: 10,
          knowledgeCount: 2,
          fileCount: 1,
          canRename: true,
          canCreateChild: true,
          canArchive: false,
          archiveBlockedReason: '目录下仍有知识条目',
          status: 'active',
        },
        {
          directoryId: 'folder-custom-child',
          parentId: 'library-custom-root',
          name: '自定义子目录',
          depth: 1,
          sortOrder: 20,
          knowledgeCount: 1,
          fileCount: 1,
          canRename: true,
          canCreateChild: false,
          canArchive: true,
          archiveBlockedReason: null,
          status: 'active',
        },
      ],
    } as unknown as viewLoader.OpenPlatformKnowledgeManagementView);

    render(<OpenPlatformKnowledgeManagementPanel />);

    const directory = await screen.findByLabelText('知识目录');
    expect(within(directory).getByText('自定义知识库')).toBeInTheDocument();
    expect(within(directory).getByText('自定义子目录')).toBeInTheDocument();
    expect(within(directory).queryByText('医学美容知识库')).not.toBeInTheDocument();
  });

  it('选定具体机构后可 inline 重命名目录并展示保存状态', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const directory = await screen.findByLabelText('知识目录');
    selectTenantCard(directory, '星澜医美中心');
    const renameButton = await within(directory).findByRole('button', { name: '重命名 话术库' });

    fireEvent.click(renameButton);
    const nameInput = within(directory).getByLabelText('目录名称');
    fireEvent.change(nameInput, { target: { value: '自定义话术库' } });
    fireEvent.click(within(directory).getByRole('button', { name: '保存目录名称' }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/directories/'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ tenantId: 'tenant-xinglan', name: '自定义话术库' }),
        }),
      ),
    );
    expect(await within(directory).findByText('目录名称已保存')).toBeInTheDocument();
    expect(within(directory).getByText('自定义话术库')).toBeInTheDocument();
  });

  it('目录新增、空目录归档和排序入口使用真实状态反馈', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const directory = await screen.findByLabelText('知识目录');
    selectTenantCard(directory, '星澜医美中心');

    fireEvent.click(await within(directory).findByRole('button', { name: '新增目录' }));
    expect(await within(directory).findByText('目录已创建')).toBeInTheDocument();
    expect(within(directory).getByRole('button', { name: '筛选目录 新目录' })).toBeInTheDocument();

    fireEvent.click(within(directory).getByRole('button', { name: '归档 话术库' }));
    expect(await within(directory).findByText('目录下仍有知识条目或文件，请先迁移后再归档')).toBeInTheDocument();

    fireEvent.click(within(directory).getByRole('button', { name: '归档 新目录' }));
    expect(await within(directory).findByText('目录已归档')).toBeInTheDocument();
    expect(within(directory).queryByRole('button', { name: '筛选目录 新目录' })).not.toBeInTheDocument();

    fireEvent.click(within(directory).getByRole('button', { name: '新增子目录 星澜医美中心' }));
    expect(await within(directory).findByText('目录已创建')).toBeInTheDocument();
    expect(within(directory).getByRole('button', { name: '筛选目录 新子目录' })).toBeInTheDocument();

    fireEvent.click(within(directory).getByRole('button', { name: '上移 低命中修复门诊' }));
    expect(await within(directory).findByText('目录排序已保存')).toBeInTheDocument();
  });

  it('点击左侧目录后联动知识条目范围和上传归属下拉', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const directory = await screen.findByLabelText('知识目录');
    selectTenantCard(directory, '星澜医美中心');
    fireEvent.click(await within(directory).findByRole('button', { name: '筛选目录 话术库' }));

    expect(within(directory).getByRole('button', { name: '筛选目录 话术库' })).toHaveAttribute('aria-current', 'true');
    const ownerSelect = screen.getByLabelText('选择文件所属知识库');
    expect(ownerSelect).toBeEnabled();
    expect(within(ownerSelect).getByRole('option', { name: '客户询问价格时怎么回复？' })).toBeInTheDocument();
    expect(within(ownerSelect).queryByRole('option', { name: 'AOPT 的应用' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '知识条目' }));
    const knowledgeItemsSection = screen.getByRole('heading', { name: '知识条目' }).closest('article');
    expect(knowledgeItemsSection).not.toBeNull();
    expect(within(knowledgeItemsSection as HTMLElement).getByText('客户询问价格时怎么回复？')).toBeInTheDocument();
    expect(within(knowledgeItemsSection as HTMLElement).queryByText('AOPT 的应用')).not.toBeInTheDocument();
  });

  it('平台端新增检索片段区域，可按关键词查看引用片段', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '检索测试' }));
    expect(await screen.findByRole('heading', { name: '检索片段' })).toBeInTheDocument();
    const searchSection = screen.getByLabelText('平台端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入检索关键词'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('平台端冷敷引用片段预览')).toBeInTheDocument();
    expect(screen.getByText('片段包含关键词“冷敷”')).toBeInTheDocument();
    expect(screen.getByText('价格回复知识库 · 平台文件.pdf · 片段 1')).toBeInTheDocument();
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/search?'),
        expect.objectContaining({ cache: 'no-store' }),
      ),
    );
    expect(searchSection.textContent).not.toContain('embedding');
    expect(searchSection.textContent).not.toContain('训练');
    expect(searchSection.textContent).not.toContain('问答');
  });

  it('平台端新增向量索引和语义检索区域，使用受控向量索引引用片段', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '检索测试' }));
    expect(await screen.findByRole('heading', { name: '生成向量索引' })).toBeInTheDocument();
    const indexSection = screen.getByLabelText('平台端知识向量索引');
    fireEvent.click(within(indexSection).getByRole('button', { name: '生成向量索引' }));

    expect(await screen.findByText('已生成 1 个受控向量索引')).toBeInTheDocument();
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/open-platform/knowledge-management/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('tenant-xinglan'),
        }),
      ),
    );

    const vectorSection = screen.getByLabelText('平台端语义检索');
    fireEvent.change(within(vectorSection).getByLabelText('输入语义检索内容'), {
      target: { value: '冷敷护理' },
    });
    fireEvent.click(within(vectorSection).getByRole('button', { name: '语义检索' }));

    expect(await screen.findByText('平台端语义相似引用片段')).toBeInTheDocument();
    expect(screen.getByText('受控向量相似度 0.877')).toBeInTheDocument();
    expect(screen.getByText('相似度 0.877')).toBeInTheDocument();
    expect(indexSection.textContent).not.toContain('mock embedding');
    expect(vectorSection.textContent).not.toContain('mock embedding');
    expect(vectorSection.textContent).not.toContain('OCR');
    expect(vectorSection.textContent).not.toContain('训练');
    expect(vectorSection.textContent).not.toContain('问答');
    expect(vectorSection.textContent).not.toContain('第三方 AI');
  });

  it('平台端新增知识库问答区域，展示回答、引用来源和审计编号', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '检索测试' }));
    expect(await screen.findByRole('heading', { name: '知识库问答' })).toBeInTheDocument();
    const qaSection = screen.getByLabelText('平台端知识库问答');
    fireEvent.change(within(qaSection).getByLabelText('输入知识库问题'), {
      target: { value: '冷敷后怎么护理？' },
    });
    fireEvent.change(within(qaSection).getByLabelText('选择问答检索模式'), {
      target: { value: 'hybrid' },
    });
    fireEvent.click(within(qaSection).getByRole('button', { name: '发起问答' }));

    expect(await screen.findByText('基于已召回的知识片段：平台端知识库问答回答。')).toBeInTheDocument();
    expect(screen.getByText('平台端问答引用片段')).toBeInTheDocument();
    expect(screen.getByText('片段包含关键词“冷敷”')).toBeInTheDocument();
    expect(screen.getByText('审计编号 kb-qa-audit-ui-a')).toBeInTheDocument();
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/open-platform/knowledge-management/qa',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('tenant-xinglan'),
        }),
      ),
    );
    expect(qaSection.textContent).not.toContain('真实 AI');
    expect(qaSection.textContent).not.toContain('OCR');
    expect(qaSection.textContent).not.toContain('训练');
    expect(qaSection.textContent).not.toContain('runtime');
  });

  it('平台端新增问答审计区域，展示低敏审计字段', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '问答审计' }));
    expect(await screen.findByRole('heading', { name: '问答审计' })).toBeInTheDocument();
    const auditSection = screen.getByLabelText('平台端问答审计');
    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));

    expect(await screen.findByText('冷敷后怎么护理？')).toBeInTheDocument();
    expect(screen.getByText('基于已召回的知识片段：平台端审计回答预览。')).toBeInTheDocument();
    expect(screen.getByText('混合检索 · 引用 2')).toBeInTheDocument();
    expect(screen.getByText('answered')).toBeInTheDocument();
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/qa/audits?'),
        expect.objectContaining({ cache: 'no-store' }),
      ),
    );
    expect(auditSection.textContent).not.toContain('storageKey');
    expect(auditSection.textContent).not.toContain('embeddingVectorJson');
    expect(auditSection.textContent).not.toContain('真实 AI');
    expect(auditSection.textContent).not.toContain('OCR');
    expect(auditSection.textContent).not.toContain('训练');
    expect(auditSection.textContent).not.toContain('runtime');
  });

  it('平台端知识库管理下线生产能力状态卡片，避免覆盖旧系统模板主流程', async () => {
    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect((await screen.findAllByText('星澜医美中心术后护理指南.pdf')).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('当前知识库范围')).not.toBeInTheDocument();
    expect(screen.getByLabelText('知识库管理工作台')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '生产能力状态' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('平台端知识库生产能力状态')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('平台端知识库内部受控试用状态')).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      '/api/v1/open-platform/knowledge-management/capabilities',
      expect.anything(),
    );
    expect(container.textContent).not.toContain('storageKey');
    expect(container.textContent).not.toContain('/Users/');
    expect(container.textContent).not.toContain('SQL');
    expect(container.textContent).not.toContain('stack');
    expect(container.textContent).not.toContain('token');
    expect(container.textContent).not.toContain('secret');
    expect(container.textContent).not.toContain('API key');
  });

  it('默认展示全部机构，切换机构后过滤文件、分类、问题、知识条目和任务', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    const directory = await screen.findByLabelText('知识目录');
    expect(await within(directory).findByRole('button', { name: /全部机构/ })).toHaveAttribute('aria-current', 'true');
    expect((await screen.findAllByText('星澜医美中心术后护理指南.pdf')).length).toBeGreaterThan(0);

    selectTenantCard(directory, '低命中修复门诊');

    await waitFor(() =>
      expect(within(directory).getAllByRole('button', { name: /低命中修复门诊/ })[0]).toHaveAttribute('aria-current', 'true'),
    );
    expect((await screen.findAllByText('低命中修复术后答疑.docx')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryAllByText('星澜医美中心术后护理指南.pdf')).toHaveLength(0));
    fireEvent.click(screen.getByRole('tab', { name: '知识条目' }));
    expect(screen.getAllByText('修复术后饮食要注意什么？')[0]).toBeInTheDocument();
    expect(screen.queryByText('水光针术后需要注意什么？')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '导入任务' }));
    expect(screen.getByText('低命中机构修复资料导入')).toBeInTheDocument();
    expect(viewLoader.loadOpenPlatformKnowledgeManagementView).toHaveBeenLastCalledWith({ tenantId: 'tenant-low-hit' });
  });

  it('支持按文件名搜索、选择本页、分页和同步 loading', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect((await screen.findAllByText('星澜医美中心术后护理指南.pdf')).length).toBeGreaterThan(0);
    const fileSection = await screen.findByLabelText('机构上传文件列表');
    const searchInput = within(fileSection).getByPlaceholderText('搜索文件名');
    fireEvent.change(searchInput, { target: { value: '星澜导入失败记录' } });

    expect((await screen.findAllByText('星澜导入失败记录.xlsx')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryAllByText('星澜医美中心术后护理指南.pdf')).toHaveLength(0));
    expect(viewLoader.loadOpenPlatformKnowledgeManagementFiles).toHaveBeenLastCalledWith({
      tenantId: null,
      keyword: '星澜导入失败记录',
      page: 1,
      pageSize: 6,
    });

    fireEvent.click(within(fileSection).getByRole('button', { name: '选择本页' }));
    expect(screen.getByText('已选择 1 个文件')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    expect((await screen.findAllByText('星澜医美中心术后护理指南.pdf')).length).toBeGreaterThan(0);
    await waitFor(() => expect(within(fileSection).getByRole('button', { name: '下一页' })).toBeEnabled());
    fireEvent.click(within(fileSection).getByRole('button', { name: '下一页' }));
    expect(await screen.findByText(/第 2\/2 页/)).toBeInTheDocument();

    const syncButton = screen.getByRole('button', { name: '同步数据' });
    fireEvent.click(syncButton);
    expect(screen.getByRole('button', { name: '同步中...' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: '同步数据' })).toBeInTheDocument();
  });

  it('批量下载已选文件按每个文件自己的 tenant 和 knowledgeId 调用真实下载接口', async () => {
    const filesResponse = getPlatformKnowledgeFilesResponse({ page: 1, pageSize: 2 });
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementFiles).mockResolvedValueOnce({
      ...filesResponse,
      dataSource: 'repository',
      records: panelKnowledgeFiles.slice(0, 2).map((file, index) => ({
        fileId: index === 0 ? 'file-bulk-a' : 'file-bulk-b',
        taskId: `task-bulk-${index + 1}`,
        tenantId: index === 0 ? 'tenant-xinglan' : 'tenant-low-hit',
        tenantName: file.tenantName,
        knowledgeId: index === 0 ? 'knowledge-price-reply' : 'knowledge-repair-diet',
        fileName: index === 0 ? '批量下载 A.pdf' : '批量下载 B.pdf',
        mimeType: file.mimeType,
        fileType: file.fileType,
        fileSizeKb: file.fileSizeKb,
        category: file.category,
        folder: file.folder,
        parseStatus: file.parseStatus as PlatformKnowledgeFileDto['parseStatus'],
        taskStatus: (file.parseStatus === 'failed' ? 'failed' : 'completed') as PlatformKnowledgeFileDto['taskStatus'],
        parsedChars: file.textLength,
        safeErrorMessage: file.safeErrorMessage,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })),
      pageInfo: {
        page: 1,
        pageSize: 2,
        total: 2,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    render(<OpenPlatformKnowledgeManagementPanel />);

    const fileSection = await screen.findByLabelText('机构上传文件列表');
    fireEvent.click(within(fileSection).getByRole('button', { name: '选择本页' }));
    fireEvent.click(screen.getByRole('button', { name: '打包下载' }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/items/knowledge-price-reply/files/file-bulk-a/download?tenantId=tenant-xinglan'),
        expect.objectContaining({ method: 'GET' }),
      ),
    );
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/open-platform/knowledge-management/items/knowledge-repair-diet/files/file-bulk-b/download?tenantId=tenant-low-hit'),
        expect.objectContaining({ method: 'GET' }),
      ),
    );
  });

  it('展示中文安全错误文案、空状态和异常机构名称兜底', async () => {
    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect((await screen.findAllByText('星澜医美中心术后护理指南.pdf')).length).toBeGreaterThan(0);
    const fileSection = await screen.findByLabelText('机构上传文件列表');
    const searchInput = within(fileSection).getByPlaceholderText('搜索文件名');
    fireEvent.change(searchInput, { target: { value: '星澜导入失败记录' } });

    expect((await screen.findAllByText('星澜导入失败记录.xlsx')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('文件格式暂不支持').length).toBeGreaterThan(0);
    expectNoRawRuntimeError(container);

    fireEvent.change(searchInput, { target: { value: '没有匹配的文件名' } });
    expect(await screen.findByText('暂无真实知识库运营数据')).toBeInTheDocument();
    expect(screen.getByText('当前未接入知识库数据库或暂无知识库记录，请在真实数据写入后查看。')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    const directory = screen.getByLabelText('知识目录');
    selectTenantCard(directory, '机构名称异常');

    await waitFor(() =>
      expect(within(directory).getAllByRole('button', { name: /机构名称异常/ })[0]).toHaveAttribute('aria-current', 'true'),
    );
    expect(screen.getAllByText('机构名称异常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未命名机构').length).toBeGreaterThan(0);
    expect(screen.getByText('PDF 解析服务异常')).toBeInTheDocument();
    expectNoRawRuntimeError(container);
  });

  it('helper 异常时展示中文产品化错误，不暴露底层错误', async () => {
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementView).mockRejectedValueOnce(
      new Error('Cannot find module /Users/local/node_modules/worker failed'),
    );

    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByText('知识库运营数据暂时无法加载')).toBeInTheDocument();
    expect(screen.getByText('请稍后重试或点击同步数据重新加载。')).toBeInTheDocument();
    expectNoRawRuntimeError(container);
  });

  it('知识条目为空时展示中文空状态，且不展示只读 contract 禁止字段', async () => {
    vi.mocked(viewLoader.loadOpenPlatformKnowledgeManagementItems).mockResolvedValueOnce({
      requestId: 'open-platform-knowledge-management-items',
      readonly: true,
      dataSource: 'unconnected',
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 50,
        total: 0,
        pageCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      emptyState: {
        title: '暂无匹配的知识库运营数据',
        description: '请调整机构范围或文件名搜索条件后再查看。',
      },
    });

    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: '知识条目' }));
    expect(await screen.findByText('暂无知识条目')).toBeInTheDocument();
    expect(container.textContent).not.toContain('fileContent');
    expect(container.textContent).not.toContain('downloadUrl');
    expect(container.textContent).not.toContain('uploadUrl');
    expect(container.textContent).not.toContain('exportUrl');
  });
});
