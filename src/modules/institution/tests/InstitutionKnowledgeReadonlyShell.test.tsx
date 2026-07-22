import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionKnowledgeReadonlyShell } from '@/modules/institution/components/InstitutionKnowledgeReadonlyShell';
import { listInstitutionKnowledgeItems } from '@/modules/institution/client/tenant-business-client';

type IndexingJobsRoute = typeof import('@/app/api/institution/knowledge-management/indexing-jobs/route');

const indexingRouteModulePaths = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/open-platform/server/platform-knowledge-management-repository',
  '@/modules/open-platform/server/platform-knowledge-file-storage',
  '@/modules/open-platform/server/platform-knowledge-indexing-job-service',
] as const;

const indexingCapabilityDisabledPayload = {
  status: 'capability_disabled',
  code: 'knowledge_indexing_jobs_capability_disabled',
  message: '机构知识库索引任务暂未启用。',
};

let indexingJobsEnabled = true;

vi.mock('@/modules/institution/client/tenant-business-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/client/tenant-business-client')
  >('@/modules/institution/client/tenant-business-client');

  return {
    ...actual,
    listInstitutionKnowledgeItems: vi.fn(),
  };
});

const pageInfo = {
  page: 1,
  pageSize: 10,
  total: 1,
  pageCount: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

describe('机构端知识库只读列表 UI', () => {
  beforeEach(() => {
    indexingJobsEnabled = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/institution/knowledge-management/indexing-jobs')) {
          if (!indexingJobsEnabled) {
            return Response.json(indexingCapabilityDisabledPayload, { status: 503 });
          }
          if (init?.method === 'POST') {
            return Response.json({
              status: 'failed',
              job: {
                jobId: 'kb-index-job-ocr-ui',
                jobType: 'ocr_file',
                status: 'failed',
                knowledgeId: 'knowledge-ui-a',
                fileId: 'institution-file-image',
                totalCount: 1,
                processedCount: 0,
                failedCount: 1,
                failureReasonCode: 'ocr_required',
                safeMessage: '该文件需要 OCR 识别；当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务',
                createdAt: '2026-06-13T08:00:00.000Z',
                startedAt: '2026-06-13T08:00:01.000Z',
                finishedAt: '2026-06-13T08:00:02.000Z',
                updatedAt: '2026-06-13T08:00:02.000Z',
              },
              safeMessage: '该文件需要 OCR 识别；当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务',
            });
          }
          return Response.json({
            records: [
              {
                jobId: 'kb-index-job-ui-a',
                jobType: 'rebuild_embeddings',
                status: 'succeeded',
                knowledgeId: 'knowledge-ui-a',
                fileId: 'institution-file-a',
                totalCount: 1,
                processedCount: 1,
                failedCount: 0,
                failureReasonCode: null,
                safeMessage: '向量索引任务已完成',
                createdAt: '2026-06-13T08:00:00.000Z',
                startedAt: '2026-06-13T08:00:01.000Z',
                finishedAt: '2026-06-13T08:00:02.000Z',
                updatedAt: '2026-06-13T08:00:02.000Z',
              },
            ],
          });
        }
        if (url.includes('/api/institution/entitlement-usage')) {
          return Response.json({
            tenantId: 'demo-tenant-001',
            institutionId: 'demo-inst-001',
            planCode: 'starter-care',
            planName: '成长版',
            readable: true,
            source: 'mixed',
            items: [
              { resource: 'ai_calls', label: 'AI 调用（本月）', used: 12, limit: 100, remaining: 88, status: 'normal' },
            ],
          });
        }
        if (url.includes('/api/institution/knowledge-management/qa/audits')) {
          return Response.json({
            requestId: 'institution-knowledge-qa-audits',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                auditId: 'kb-qa-audit-institution-list-ui-a',
                tenantId: 'tenant-a',
                institutionId: 'inst-current',
                actorScope: 'institution',
                actorUserId: 'tenant-user',
                question: '复诊前怎么准备？',
                answerPreview: '基于已召回的知识片段：机构端审计回答预览。',
                retrievalMode: 'keyword',
                citationCount: 1,
                safeStatus: 'answered',
                safeFailureMessage: null,
                createdAt: '2026-06-14T08:10:00.000Z',
              },
            ],
            pageInfo: pageInfo,
            emptyState: {
              title: '暂无问答审计',
              description: '当前机构还没有知识库问答审计记录。',
            },
          });
        }
        if (url.includes('/api/institution/knowledge-management/retrieval')) {
          return Response.json({
            requestId: 'institution-knowledge-hybrid-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-ui-a',
                knowledgeTitle: '授权可见术后护理',
                fileId: 'institution-file-a',
                fileName: '机构文件.pdf',
                chunkId: 'institution-hybrid-chunk-a',
                chunkIndex: 0,
                textPreview: '机构端 hybrid rerank 引用片段',
                retrievalMode: 'hybrid',
                keywordScore: 1,
                vectorScore: 0.765432,
                rerankScore: 0.91,
                matchReason: '关键词匹配 1.000；向量相似度 0.765；deterministic rerank',
              },
            ],
            pageInfo: pageInfo,
            emptyState: {
              title: '暂无检索命中',
              description: '当前范围没有命中已解析知识片段。',
            },
          });
        }
        if (url.includes('/api/institution/knowledge-management/qa')) {
          return Response.json({
            answer: '基于已召回的知识片段：机构端知识库问答回答。',
            citations: [
              {
                knowledgeId: 'knowledge-ui-a',
                knowledgeTitle: '授权可见术后护理',
                fileId: 'institution-file-a',
                fileName: '机构文件.pdf',
                chunkId: 'institution-qa-chunk-a',
                chunkIndex: 0,
                textPreview: '机构端问答引用片段',
                score: 1,
                matchReason: '片段包含关键词“冷敷”',
              },
            ],
            retrievalMode: 'hybrid',
            auditId: 'kb-qa-audit-institution-ui-a',
            safeStatus: 'answered',
          });
        }
        if (url.includes('/api/institution/knowledge-management/vector-search')) {
          return Response.json({
            requestId: 'institution-knowledge-vector-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-ui-a',
                knowledgeTitle: '授权可见术后护理',
                fileId: 'institution-file-a',
                fileName: '机构文件.pdf',
                chunkId: 'institution-vector-chunk-a',
                chunkIndex: 0,
                textPreview: '机构端语义相似引用片段',
                score: 0.765432,
                matchReason: '向量相似度 0.765',
              },
            ],
            pageInfo: pageInfo,
            emptyState: {
              title: '暂无相似片段',
              description: '当前范围没有命中语义相似的已解析知识片段。',
            },
          });
        }
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({
            requestId: 'institution-knowledge-keyword-search',
            readonly: true,
            dataSource: 'repository',
            records: [
              {
                knowledgeId: 'knowledge-ui-a',
                knowledgeTitle: '授权可见术后护理',
                fileId: 'institution-file-a',
                fileName: '机构文件.pdf',
                chunkId: 'institution-search-chunk-a',
                chunkIndex: 0,
                textPreview: '机构端冷敷引用片段',
                matchReason: '片段包含关键词“冷敷”',
              },
            ],
            pageInfo: pageInfo,
            emptyState: {
              title: '暂无匹配片段',
              description: '当前范围没有命中关键词的已解析知识片段。',
            },
          });
        }
        if (url.includes('/parse/chunks')) {
          return Response.json({
            readonly: true,
            records: [
              {
                chunkId: 'institution-chunk-a',
                tenantId: 'tenant-a',
                knowledgeId: 'knowledge-ui-a',
                fileId: 'institution-file-a',
                chunkIndex: 0,
                textPreview: '机构端授权可见解析片段',
                charCount: 12,
                createdAt: '2026-06-13T08:00:00.000Z',
                updatedAt: '2026-06-13T08:00:00.000Z',
                embeddingStatus: 'ready',
              },
            ],
          });
        }
        if (url.includes('/download')) {
          return new Response('file bytes', {
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('机构文件.pdf')}`,
            },
          });
        }

        return Response.json({
          requestId: 'institution-knowledge-management-files',
          readonly: true,
          dataSource: 'repository',
          records: [
            {
              fileId: 'institution-file-a',
              tenantId: 'tenant-a',
              knowledgeId: 'knowledge-ui-a',
              originalFilename: '机构文件.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'd'.repeat(64),
              status: 'active',
              uploadedByUserId: 'platform-user',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: null,
              fileType: 'PDF',
              sizeLabel: '10 B',
              parseStatus: 'succeeded',
              ocrStatus: 'pending',
              safeFailureMessage: null,
              chunkCount: 1,
            },
            {
              fileId: 'institution-file-image',
              tenantId: 'tenant-a',
              knowledgeId: 'knowledge-ui-a',
              originalFilename: '术后照片.png',
              mimeType: 'image/png',
              sizeBytes: 10,
              sha256: 'e'.repeat(64),
              status: 'active',
              uploadedByUserId: 'platform-user',
              createdAt: '2026-06-13T08:00:00.000Z',
              updatedAt: '2026-06-13T08:00:00.000Z',
              archivedAt: null,
              fileType: 'PNG',
              sizeLabel: '10 B',
              parseStatus: 'failed',
              ocrStatus: 'ocr_required',
              failureReasonCode: 'ocr_required',
              safeFailureMessage: '该文件需要 OCR 识别；当前为 OCR-ready 最小闭环，尚未接入生产 OCR 服务',
              chunkCount: 0,
            },
          ],
          pageInfo: pageInfo,
        });
      }),
    );
    vi.mocked(listInstitutionKnowledgeItems).mockReset();
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
      ok: true,
      records: [
        {
          knowledgeId: 'knowledge-ui-a',
          title: '授权可见术后护理',
          category: '术后护理',
          status: 'ready',
          readonlyStatus: 'readonly',
          sourceKind: 'demo',
          descriptionPreview: '低敏摘要，不包含正文。',
          chunkCount: 3,
          visibility: 'platform_authorized',
          updatedAt: '2026-06-13T08:00:00.000Z',
          createdAt: '2026-06-13T08:00:00.000Z',
        },
      ],
      pageInfo,
    });
  });

  it('展示 loading、低敏记录、搜索、刷新和分页状态', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(screen.getByText('正在加载机构知识库...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    expect(screen.getByText('低敏摘要，不包含正文。')).toBeInTheDocument();
    expect(screen.getByText('分块 3')).toBeInTheDocument();
    expect(screen.getByText('平台授权')).toBeInTheDocument();
    const indexingSection = screen.getByLabelText('机构端知识库索引任务');
    expect(within(indexingSection).getByText('索引任务')).toBeInTheDocument();
    expect(within(indexingSection).getByText('当前索引任务仅展示已确认的机构范围任务状态。')).toBeInTheDocument();
    expect(within(indexingSection).getByText('重建文件向量索引')).toBeInTheDocument();
    expect(within(indexingSection).getByText('向量索引任务已完成')).toBeInTheDocument();
    expect(screen.getByLabelText('机构端 OCR-ready 边界说明').textContent).toContain('OCR-ready 最小闭环');
    expect(screen.getByLabelText('机构端 OCR-ready 边界说明').textContent).toContain('不接外部云 OCR');
    expect(screen.getByLabelText('机构端 OCR-ready 边界说明').textContent).toContain('不做生产级批量 OCR');

    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));
    expect(await screen.findByText('机构文件.pdf')).toBeInTheDocument();
    expect(screen.getByText('解析成功 · OCR 待触发 · 1 片段')).toBeInTheDocument();
    expect(screen.getAllByText('术后照片.png').length).toBeGreaterThan(0);
    expect(screen.getByText('解析失败 · 需要 OCR · 0 片段')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '查看解析片段' })[0]);
    expect(await screen.findByText('机构端授权可见解析片段')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/parse/chunks',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(screen.getAllByRole('button', { name: '下载文件' })[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '下载文件' })[0]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/download',
      expect.objectContaining({ method: 'GET' }),
    );

    expect(screen.getAllByRole('button', { name: '执行 OCR / 重建 OCR 索引' })[1]).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: '执行 OCR / 重建 OCR 索引' })[1]);
    });
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/institution/knowledge-management/indexing-jobs',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ jobType: 'ocr_file', knowledgeId: 'knowledge-ui-a', fileId: 'institution-file-image' }),
        }),
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('搜索机构知识库'), {
        target: { value: '护理' },
      });
      fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    });

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    expect(listInstitutionKnowledgeItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '护理', page: 1 }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    });
    expect(listInstitutionKnowledgeItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: '护理', page: 1 }),
    );
  });

  it('解析片段先成功后返回 503 时清除旧 textPreview 并显示受控错误', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    await screen.findByRole('heading', { name: '授权可见术后护理' });
    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));
    await screen.findByText('机构文件.pdf');
    fireEvent.click(screen.getAllByRole('button', { name: '查看解析片段' })[0]);
    expect(await screen.findByText('机构端授权可见解析片段')).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async () => Response.json({
      status: 'capability_disabled',
      code: 'capability_disabled',
      error: '机构知识库解析片段暂未启用。',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    }));

    fireEvent.click(screen.getAllByRole('button', { name: '查看解析片段' })[0]);

    expect(await screen.findByText('解析片段暂时不可用')).toBeInTheDocument();
    expect(screen.queryByText('机构端授权可见解析片段')).not.toBeInTheDocument();
  });

  it('文件列表先成功后 pending/503/异常/非法 payload 均清除旧敏感元数据且不冒充空态', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    await screen.findByRole('heading', { name: '授权可见术后护理' });
    const filesButton = screen.getByRole('button', { name: '查看文件' });
    const knowledgeArticle = screen.getByRole('heading', { name: '授权可见术后护理' }).closest('article');
    expect(knowledgeArticle).not.toBeNull();
    const knowledgeFiles = within(knowledgeArticle as HTMLElement);
    fireEvent.click(filesButton);
    expect(await knowledgeFiles.findByText('机构文件.pdf')).toBeInTheDocument();
    expect(knowledgeFiles.getByText('解析成功 · OCR 待触发 · 1 片段')).toBeInTheDocument();
    expect(knowledgeFiles.getByText('解析失败 · 需要 OCR · 0 片段')).toBeInTheDocument();

    let resolvePendingFiles!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolvePendingFiles = resolve;
      }),
    );

    fireEvent.click(filesButton);

    await waitFor(() => {
      expect(knowledgeFiles.queryByText('机构文件.pdf')).not.toBeInTheDocument();
      expect(knowledgeFiles.queryByText('术后照片.png')).not.toBeInTheDocument();
      expect(knowledgeFiles.queryByText('解析成功 · OCR 待触发 · 1 片段')).not.toBeInTheDocument();
      expect(knowledgeFiles.queryByText('解析失败 · 需要 OCR · 0 片段')).not.toBeInTheDocument();
    });
    expect(knowledgeFiles.getByText('正在读取知识库文件...')).toBeInTheDocument();
    expect(knowledgeFiles.queryByText('暂无可下载文件')).not.toBeInTheDocument();

    resolvePendingFiles(Response.json({
      status: 'capability_disabled',
      code: 'knowledge_files_capability_disabled',
      error: '机构知识库文件列表暂未启用。',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    }));

    expect(await knowledgeFiles.findByText('知识库文件暂时不可用')).toBeInTheDocument();
    expect(knowledgeFiles.queryByText('机构文件.pdf')).not.toBeInTheDocument();
    expect(knowledgeFiles.queryByText('术后照片.png')).not.toBeInTheDocument();
    expect(knowledgeFiles.queryByText('暂无可下载文件')).not.toBeInTheDocument();

    let resolveOlderSuccess!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        resolveOlderSuccess = resolve;
      }),
    );
    fireEvent.click(filesButton);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(Response.json({
      status: 'capability_disabled',
      code: 'knowledge_files_capability_disabled',
      error: '机构知识库文件列表暂未启用。',
    }, { status: 503 }));
    fireEvent.click(filesButton);
    expect(await knowledgeFiles.findByText('知识库文件暂时不可用')).toBeInTheDocument();

    resolveOlderSuccess(Response.json({
      requestId: 'institution-knowledge-management-files',
      readonly: true,
      dataSource: 'repository',
      records: [{
        fileId: 'stale-file',
        originalFilename: '过期敏感文件名.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        status: 'active',
        fileType: 'PDF',
        sizeLabel: '1 B',
        parseStatus: 'succeeded',
        ocrStatus: 'succeeded',
        safeFailureMessage: null,
        chunkCount: 1,
      }],
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(knowledgeFiles.queryByText('过期敏感文件名.pdf')).not.toBeInTheDocument();
    expect(knowledgeFiles.queryByText('暂无可下载文件')).not.toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('files request failed'));
    fireEvent.click(filesButton);
    expect(await knowledgeFiles.findByText('知识库文件暂时不可用')).toBeInTheDocument();
    expect(knowledgeFiles.queryByText('机构文件.pdf')).not.toBeInTheDocument();
    expect(knowledgeFiles.queryByText('暂无可下载文件')).not.toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(Response.json({
      requestId: 'institution-knowledge-management-files',
      readonly: true,
      dataSource: 'repository',
      records: 'not-an-array',
    }));
    fireEvent.click(filesButton);
    expect(await knowledgeFiles.findByText('知识库文件暂时不可用')).toBeInTheDocument();
    expect(knowledgeFiles.queryByText('机构文件.pdf')).not.toBeInTheDocument();
    expect(knowledgeFiles.queryByText('暂无可下载文件')).not.toBeInTheDocument();
  });

  it('文件列表仅在权威成功且 records 为空时显示确认空态', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    await screen.findByRole('heading', { name: '授权可见术后护理' });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(Response.json({
      requestId: 'institution-knowledge-management-files',
      readonly: true,
      dataSource: 'repository',
      records: [],
      pageInfo,
    }));

    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));

    expect(await screen.findByText('暂无可下载文件')).toBeInTheDocument();
    expect(screen.queryByText('知识库文件暂时不可用')).not.toBeInTheDocument();
  });

  it('索引 root API 返回 503 时隐藏任务、OCR、重建和取消动作，仅保留刷新', async () => {
    indexingJobsEnabled = false;
    render(<InstitutionKnowledgeReadonlyShell />);

    await screen.findByText('机构知识库索引任务暂未启用。');
    const section = screen.getByLabelText('机构端知识库索引任务');
    expect(within(section).getByRole('button', { name: '刷新任务' })).toBeInTheDocument();
    expect(within(section).queryByText('暂无索引任务')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: '取消等待任务' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重建当前知识索引' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));
    await screen.findByText('机构文件.pdf');
    expect(screen.queryByRole('button', { name: '执行 OCR / 重建 OCR 索引' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '生成 / 重建向量索引' })).not.toBeInTheDocument();
  });

  it('机构端知识库入口展示卡片功能壳且操作仍受控', async () => {
    const { container } = render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const cardPanel = screen.getByLabelText('机构知识库卡片功能壳');

    expect(within(cardPanel).getByRole('heading', { name: '机构知识库' })).toBeInTheDocument();
    ['知识条目', '文件数', '已解析 / 待解析', '待优化 / 低命中'].forEach((label) => {
      expect(within(cardPanel).getAllByText(label).length).toBeGreaterThan(0);
    });
    expect(within(cardPanel).getByRole('heading', { name: '知识目录' })).toBeInTheDocument();
    expect(within(cardPanel).getByRole('heading', { name: '文件 / 文档' })).toBeInTheDocument();
    expect(within(cardPanel).getByRole('heading', { name: '检索测试' })).toBeInTheDocument();
    expect(within(cardPanel).getByRole('heading', { name: '解析 / 训练任务记录' })).toBeInTheDocument();
    expect(within(cardPanel).getByRole('heading', { name: '运营建议 / 风险提示' })).toBeInTheDocument();

    expect(within(cardPanel).getByRole('button', { name: '上传文档' })).toBeEnabled();
    expect(within(cardPanel).getByRole('button', { name: '新建知识' })).toBeEnabled();
    ['新建文件夹', '重新训练'].forEach((label) => {
      expect(within(cardPanel).getByRole('button', { name: new RegExp(`^${label}（`) })).toBeDisabled();
    });
    expect(within(cardPanel).getByRole('button', { name: '开始检索测试' })).toBeEnabled();

    [
      '真实训练已完成',
      '真实解析已完成',
      '真实统计 API 已接入',
      '已接入真实知识库数据库',
    ].forEach((text) => {
      expect(container.textContent).not.toContain(text);
    });
  });

  it('机构端展示只读试用说明、授权能力和禁止操作，且不提供受控外入口', async () => {
    const { container } = render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const trialNotice = screen.getByLabelText('机构端知识库只读试用说明');

    expect(within(trialNotice).getByText('内部受控试用发布包')).toBeInTheDocument();
    expect(within(trialNotice).getByText('机构端仅可只读试用授权内容。')).toBeInTheDocument();
    expect(trialNotice.textContent).toContain('可交付内部受控试用');
    expect(trialNotice.textContent).toContain('当前版本可以交付内部试用人员');
    [
      '授权知识库查看',
      '授权文件查看',
      '解析状态查看',
      'chunk 预览',
      '关键词检索',
      'mock/local QA',
      'citations',
      'QA audit',
    ].forEach((label) => {
      expect(within(trialNotice).getByText(label)).toBeInTheDocument();
    });
    [
      '确认只读授权范围',
      '查看授权知识库与授权文件',
      '查看解析状态与 chunk 预览',
      '执行关键词检索',
      '执行 mock 向量检索',
      '发起 mock/local QA',
      '核对 citations 与本机构 QA audit',
      '确认禁止操作不可用',
    ].forEach((label) => {
      expect(within(trialNotice).getByText(label)).toBeInTheDocument();
    });
    [
      '只能查看授权知识库内容',
      '只读链路可完成检索、QA、citations、audit 验收',
      '上传、归档、解析、训练、embedding、visibility、真实 AI 入口不可见',
      '跨机构、跨 tenant、未授权内容不可见',
    ].forEach((label) => {
      expect(within(trialNotice).getByText(label)).toBeInTheDocument();
    });
    ['上传', '归档', '发起解析', '训练', '生成 embedding', '管理 visibility', '调用真实 AI'].forEach(
      (label) => {
        expect(within(trialNotice).getByText(label)).toBeInTheDocument();
        expect(within(trialNotice).queryByRole('button', { name: label })).not.toBeInTheDocument();
      },
    );
    [
      'OCR',
      '扫描 PDF / 图片文字识别',
      '真实 AI',
      '真实凭据 / API 凭据',
      '外部网络服务',
      '真实向量数据库',
      'runtime ingestion',
      'worker / queue / scheduler',
    ].forEach((label) => {
      expect(within(trialNotice).getAllByText(label).length).toBeGreaterThan(0);
      expect(within(trialNotice).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
    expect(trialNotice.textContent).toContain('仅展示低敏摘要、解析状态、chunk 预览、引用和审计摘要。');
    expect(trialNotice.textContent).toContain('当前账号没有访问该知识库内容的权限');
    expect(trialNotice.textContent).toContain('当前知识库问答次数已达上限，请稍后再试');
    expect(trialNotice.textContent).toContain('当前问题没有命中可引用的知识片段');
    expect(trialNotice.textContent).toContain('当前范围没有命中关键词或相似片段');
    expect(trialNotice.textContent).toContain('机构端按步骤完成授权内容只读查看、检索、QA、citations 和本机构 audit 验收。');
    [
      '机构端只读试用操作手册',
      '确认只读交付状态',
      '查看授权知识库和文件解析状态',
      '完成只读检索、QA 与 citations',
      '记录只读边界和失败态',
      '机构端只读试用记录',
      '文件解析样本与失败态',
      '检索、QA、citations 与 audit 记录',
      'quota、capability 与 No-Go 核对',
      '问题、风险与交接结论',
      '真实 AI',
      'OCR',
      '真实向量库',
      'runtime ingestion',
      '任何真实外部服务',
    ].forEach((label) => {
      expect(within(trialNotice).getAllByText(label).length).toBeGreaterThan(0);
    });
    expect(trialNotice.textContent).toContain('密钥治理、成本限额、质量评估、安全评估、灰度开关、回滚方案');
    expect(trialNotice.textContent).toContain('文件安全策略、扫描件识别质量评估、失败补偿、人工复核边界');
    expect(container.textContent).not.toContain('storageKey');
    expect(container.textContent).not.toContain('/Users/');
    expect(container.textContent).not.toContain('SQL');
    expect(container.textContent).not.toContain('stack');
    expect(container.textContent).not.toContain('token');
    expect(container.textContent).not.toContain('secret');
    expect(container.textContent).not.toContain('API key');
  });

  it('机构端新增检索测试台，展示 hybrid / vector / rerank 命中', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索内容'), {
      target: { value: '冷敷' },
    });
    fireEvent.change(within(searchSection).getByLabelText('选择检索模式'), {
      target: { value: 'hybrid' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('机构端 hybrid rerank 引用片段')).toBeInTheDocument();
    expect(screen.getByText('关键词匹配 1.000；向量相似度 0.765；deterministic rerank')).toBeInTheDocument();
    expect(within(searchSection).getAllByText('hybrid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('rerank 0.910')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&keyword=%E5%86%B7%E6%95%B7&mode=hybrid&topK=5&pageSize=5',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(searchSection.textContent).not.toContain('embeddingVectorJson');
    expect(searchSection.textContent).not.toContain('provider');
    expect(searchSection.textContent).not.toContain('训练队列完成');
  });

  it('机构端新增语义检索只读区域，不提供向量生成入口', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const vectorSection = screen.getByLabelText('机构端语义检索');
    fireEvent.change(within(vectorSection).getByLabelText('输入语义检索内容'), {
      target: { value: '冷敷护理' },
    });
    fireEvent.click(within(vectorSection).getByRole('button', { name: '语义检索' }));

    expect(await screen.findByText('机构端语义相似引用片段')).toBeInTheDocument();
    expect(screen.getByText('向量相似度 0.765')).toBeInTheDocument();
    expect(screen.getByText('相似度 0.765')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/vector-search?query=%E5%86%B7%E6%95%B7%E6%8A%A4%E7%90%86',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(within(vectorSection).queryByRole('button', { name: '生成向量索引' })).not.toBeInTheDocument();
    expect(vectorSection.textContent).not.toContain('OCR');
    expect(vectorSection.textContent).not.toContain('真实出网');
    expect(vectorSection.textContent).not.toContain('问答');
    expect(vectorSection.textContent).not.toContain('第三方 AI');
  });

  it('机构端新增知识库问答只读区域，展示回答、引用来源和审计编号', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const qaSection = screen.getByLabelText('机构端知识库问答');
    fireEvent.change(within(qaSection).getByLabelText('输入知识库问题'), {
      target: { value: '冷敷后怎么护理？' },
    });
    fireEvent.change(within(qaSection).getByLabelText('选择问答检索模式'), {
      target: { value: 'hybrid' },
    });
    fireEvent.click(within(qaSection).getByRole('button', { name: '发起问答' }));

    expect(await screen.findByText('基于已召回的知识片段：机构端知识库问答回答。')).toBeInTheDocument();
    expect(screen.getByText('机构端问答引用片段')).toBeInTheDocument();
    expect(screen.getByText('片段包含关键词“冷敷”')).toBeInTheDocument();
    expect(screen.getByText('审计编号 kb-qa-audit-institution-ui-a')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/qa',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('冷敷后怎么护理？'),
      }),
    );
    expect(within(qaSection).queryByRole('button', { name: '生成向量索引' })).not.toBeInTheDocument();
    expect(qaSection.textContent).not.toContain('真实 AI');
    expect(qaSection.textContent).not.toContain('OCR');
    expect(qaSection.textContent).not.toContain('训练');
    expect(qaSection.textContent).not.toContain('runtime');
  });

  it('机构端新增问答审计只读区域，只展示本机构低敏审计字段', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const auditSection = screen.getByLabelText('机构端问答审计');
    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));

    expect(await screen.findByText('复诊前怎么准备？')).toBeInTheDocument();
    expect(screen.getByText('基于已召回的知识片段：机构端审计回答预览。')).toBeInTheDocument();
    expect(screen.getByText('关键词 · 引用 1')).toBeInTheDocument();
    expect(screen.getByText('answered')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/qa/audits',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(auditSection.textContent).not.toContain('storageKey');
    expect(auditSection.textContent).not.toContain('embeddingVectorJson');
    expect(auditSection.textContent).not.toContain('真实 AI');
    expect(auditSection.textContent).not.toContain('OCR');
    expect(auditSection.textContent).not.toContain('训练');
    expect(auditSection.textContent).not.toContain('runtime');
  });

  it('问答审计先成功后刷新 pending/503 时立即清除旧问题和回答预览', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const auditSection = screen.getByLabelText('机构端问答审计');
    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));
    expect(await screen.findByText('复诊前怎么准备？')).toBeInTheDocument();
    expect(screen.getByText('基于已召回的知识片段：机构端审计回答预览。')).toBeInTheDocument();

    let resolvePendingAudit!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvePendingAudit = resolve;
        }),
    );

    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));

    await waitFor(() => {
      expect(screen.queryByText('复诊前怎么准备？')).not.toBeInTheDocument();
      expect(
        screen.queryByText('基于已召回的知识片段：机构端审计回答预览。'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('正在读取问答审计...')).toBeInTheDocument();
    expect(screen.queryByText('暂无问答审计')).not.toBeInTheDocument();

    resolvePendingAudit(
      Response.json(
        {
          status: 'capability_disabled',
          code: 'knowledge_qa_audits_capability_disabled',
          error: '机构知识库问答审计暂未启用。',
        },
        { status: 503 },
      ),
    );

    expect(await screen.findByText('问答审计暂时不可用')).toBeInTheDocument();
    expect(screen.queryByText('复诊前怎么准备？')).not.toBeInTheDocument();
    expect(
      screen.queryByText('基于已召回的知识片段：机构端审计回答预览。'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('暂无问答审计')).not.toBeInTheDocument();
  });

  it('问答审计异常或非法 payload 后保持 unavailable，不冒充确认空数据', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const auditSection = screen.getByLabelText('机构端问答审计');
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('audit request failed'));

    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));

    expect(await screen.findByText('问答审计暂时不可用')).toBeInTheDocument();
    expect(screen.queryByText('暂无问答审计')).not.toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      Response.json({ status: 'succeeded', records: 'not-an-array' }),
    );
    fireEvent.click(within(auditSection).getByRole('button', { name: '刷新审计' }));

    expect(await screen.findByText('问答审计暂时不可用')).toBeInTheDocument();
    expect(screen.queryByText('暂无问答审计')).not.toBeInTheDocument();
  });

  it('展示 empty 和 error 状态，并且不出现上传下载导出解析训练等 CTA', async () => {
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: true,
      records: [],
      pageInfo: { ...pageInfo, total: 0, pageCount: 0 },
    });

    const { rerender } = render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByText('暂无授权可见知识库')).toBeInTheDocument();

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '知识库只读数据暂时不可用',
        status: 503,
      },
    });

    rerender(<InstitutionKnowledgeReadonlyShell />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    });

    expect(await screen.findByText('知识库只读数据暂时不可用')).toBeInTheDocument();

    const shell = screen.getByLabelText('机构知识库只读列表');
    ['上传', '导出', '解析', '训练', '归档', '删除'].forEach((label) => {
      expect(within(shell).queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
  });

  it('检索片段区域明确展示 hybrid / rerank / 不做训练队列文案', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    expect(searchSection.textContent).toContain('支持 keyword / vector / hybrid');
    expect(searchSection.textContent).toContain('deterministic rerank');
    expect(searchSection.textContent).toContain('OCR 成功文本可进入 chunk / embedding / retrieval');
  });

  it('检索为空时不展示敏感字段', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/retrieval')) {
          return Response.json({
            requestId: 'institution-knowledge-hybrid-search',
            readonly: true,
            dataSource: 'repository',
            records: [],
            pageInfo: { ...pageInfo, total: 0, pageCount: 0 },
            emptyState: {
              title: '暂无检索命中',
              description: '当前范围没有命中已解析知识片段。',
            },
          });
        }
        return Response.json({ records: [], pageInfo });
      }),
    );

    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索内容'), {
      target: { value: '不存在的关键词' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('暂无匹配片段')).toBeInTheDocument();
    ['api_key', 'DATABASE_URL', 'storageKey', 'bucket', 'signedUrl', 'embeddingVectorJson', 'Bearer', 'Authorization'].forEach(
      (fragment) => {
        expect(searchSection.textContent).not.toContain(fragment);
      },
    );
  });

  it('检索 API 错误展示受控文案，不泄露内部信息', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/retrieval')) {
          return new Response(
            JSON.stringify({ code: 'service_unavailable', error: '知识库检索暂时不可用' }),
            { status: 503 },
          );
        }
        return Response.json({ records: [], pageInfo });
      }),
    );

    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索内容'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('知识库检索暂时不可用')).toBeInTheDocument();
    ['DATABASE_URL', 'postgres://', 'secret', 'stack', 'SQL', 'Bearer', '/Users/'].forEach((fragment) => {
      expect(searchSection.textContent).not.toContain(fragment);
    });
  });

  it('检索结果中不展示敏感字段', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    // The default mock already returns a result with "机构端 hybrid rerank 引用片段"
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索内容'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('机构端 hybrid rerank 引用片段')).toBeInTheDocument();
    ['api_key', 'DATABASE_URL', 'storageKey', 'bucket', 'signedUrl', 'embeddingVectorJson', 'Bearer', 'Authorization', '/Users/', 'stack', 'SQL'].forEach(
      (fragment) => {
        expect(searchSection.textContent).not.toContain(fragment);
      },
    );
  });

  describe('AI 试问 RAG 知识库引用展示', () => {
    beforeEach(() => {
      vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
        ok: true,
        records: [
          {
            knowledgeId: 'knowledge-ui-a',
            title: '授权可见术后护理',
            category: '术后护理',
            status: 'ready',
            readonlyStatus: 'readonly',
            sourceKind: 'demo',
            descriptionPreview: '低敏摘要，不包含正文。',
            chunkCount: 3,
            visibility: 'platform_authorized',
            updatedAt: '2026-06-13T08:00:00.000Z',
            createdAt: '2026-06-13T08:00:00.000Z',
          },
        ],
        pageInfo,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          if (url.includes('/api/institution/knowledge-management/ai-call') && init?.method === 'POST') {
            return Response.json({
              answer: '根据知识库参考资料，冷敷后应保持创面清洁干燥，避免剧烈热刺激。',
              record: {
                id: 'rec-rag', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                actorUserId: 'demo-user-admin', serviceName: '平台 AI 服务',
                promptTokens: 150, completionTokens: 60, totalTokens: 210, latencyMs: 800,
                status: 'succeeded', errorCode: null, createdAt: new Date().toISOString(),
              },
              knowledgeContext: {
                used: true,
                query: '冷敷后怎么护理？',
                sources: [
                  {
                    knowledgeId: 'kb-rag-1', knowledgeTitle: '术后护理指南',
                    fileId: 'file-rag-1', fileName: '术后护理规范.pdf',
                    chunkId: 'chunk-rag-1', chunkIndex: 0,
                    textPreview: '冷敷后建议保持创面清洁，避免剧烈热刺激，可使用医用冷敷贴。',
                    matchReason: '片段包含关键词"冷敷"',
                  },
                  {
                    knowledgeId: 'kb-rag-2', knowledgeTitle: '皮肤护理基础知识',
                    fileId: 'file-rag-2', fileName: '术后康复指南.pdf',
                    chunkId: 'chunk-rag-2', chunkIndex: 2,
                    textPreview: '术后72小时内建议冷敷，每次15-20分钟，间隔1小时。',
                    matchReason: '片段包含关键词"冷敷"',
                  },
                ],
              },
            });
          }
          if (url.includes('/api/institution/knowledge-management/ai-call/usage')) {
            return Response.json({ requestId: 'institution-ai-call-usage', readonly: true, dataSource: 'repository', records: [], emptyState: { title: '暂无', description: '暂无' } });
          }
          return Response.json({ records: [{
            knowledgeId: 'knowledge-ui-a', knowledgeTitle: '授权可见术后护理',
            knowledgeDescription: '低敏摘要：术后护理常识', status: 'ready', sourceKind: 'demo',
            knowledgeDocuments: [],
          }], pageInfo });
        }),
      );
    });

    it('有 knowledgeContext 时渲染引用来源卡片', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      const input = within(aiSection).getByLabelText('输入 AI 问题');
      const button = within(aiSection).getByRole('button', { name: 'AI 试问' });

      fireEvent.change(input, { target: { value: '冷敷后怎么护理？' } });
      fireEvent.click(button);

      // 引用来源卡片应出现
      expect(await screen.findByText(/术后护理规范\.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/术后康复指南\.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/冷敷后建议保持创面清洁/)).toBeInTheDocument();
      // matchReason 有两条，用 getAllByText
      expect(screen.getAllByText(/片段包含关键词"冷敷"/).length).toBeGreaterThanOrEqual(1);
    });

    it('显示免责声明', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      const input = within(aiSection).getByLabelText('输入 AI 问题');
      const button = within(aiSection).getByRole('button', { name: 'AI 试问' });

      fireEvent.change(input, { target: { value: '冷敷后怎么护理？' } });
      fireEvent.click(button);

      // AI 生成内容免责声明始终可见
      expect(await screen.findByText('AI 生成内容仅供参考，不构成专业建议。')).toBeInTheDocument();
      expect(screen.getByText(/AI 回答参考本机构知识库片段，仍需人工确认/)).toBeInTheDocument();
      expect(screen.getByText('以上引用的知识库片段仅供参考，可能包含过时或不完整信息，不构成权威依据。')).toBeInTheDocument();
    });

    it('AI 试问描述文案已更新为含知识库片段参考的说明', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      // 等待页面加载完成，描述出现在 AI 试问区域的 <p> 标签中 + aiMessage div 中
      // 使用 findAllByText 处理多个匹配
      const matches = await screen.findAllByText(/AI 试问将自动参考本机构知识库中的匹配片段/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('AI 试问区域不显示模型选择和具体厂商模型名', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      expect(within(aiSection).queryByLabelText('选择 AI 模型')).not.toBeInTheDocument();
      expect(within(aiSection).getByText('平台 AI 服务')).toBeInTheDocument();
      expect(aiSection.textContent).not.toMatch(/DeepSeek|deepseek|智谱|Kimi|Claude|豆包|通义千问|qwen|doubao/i);
    });

    it('不展示敏感字段', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      const input = within(aiSection).getByLabelText('输入 AI 问题');
      const button = within(aiSection).getByRole('button', { name: 'AI 试问' });

      fireEvent.change(input, { target: { value: '冷敷后怎么护理？' } });
      fireEvent.click(button);

      expect(await screen.findByText(/术后护理规范/)).toBeInTheDocument();

      ['api_key', 'DATABASE_URL', 'storageKey', 'bucket', 'signedUrl', 'Bearer', 'Authorization', 'postgres://', 'secret', 'password', 'Agent', '自动运营', '自动触达'].forEach(
        (fragment) => {
          expect(aiSection.textContent).not.toContain(fragment);
        },
      );
    });

    it('不出现超范围自动化/Agent 文案', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      const input = within(aiSection).getByLabelText('输入 AI 问题');
      const button = within(aiSection).getByRole('button', { name: 'AI 试问' });

      fireEvent.change(input, { target: { value: '冷敷后怎么护理？' } });
      fireEvent.click(button);

      expect(await screen.findByText(/术后护理规范/)).toBeInTheDocument();

      ['自动运营', '自动触达', 'Agent', 'embedding', '向量库', '模型切换'].forEach(
        (text) => {
          expect(aiSection.textContent).not.toContain(text);
        },
      );
    });
  });

  describe('AI 调用记录 RAG metadata 展示', () => {
    beforeEach(() => {
      vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
        ok: true,
        records: [
          {
            knowledgeId: 'knowledge-ui-a',
            title: '授权可见术后护理',
            category: '术后护理',
            status: 'ready',
            readonlyStatus: 'readonly',
            sourceKind: 'demo',
            descriptionPreview: '低敏摘要。',
            chunkCount: 1,
            visibility: 'platform_authorized',
            updatedAt: '2026-06-13T08:00:00.000Z',
            createdAt: '2026-06-13T08:00:00.000Z',
          },
        ],
        pageInfo,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('/api/institution/entitlement-usage')) {
            return Response.json({
              tenantId: 'demo-tenant-001',
              institutionId: 'demo-inst-001',
              planCode: 'starter-care',
              planName: '成长版',
              readable: true,
              source: 'mixed',
              items: [
                { resource: 'ai_calls', label: 'AI 调用（本月）', used: 12, limit: 100, remaining: 88, status: 'normal' },
              ],
            });
          }
          if (url.includes('/api/institution/knowledge-management/ai-call/usage')) {
            return Response.json({
              requestId: 'institution-ai-call-usage',
              readonly: true,
              dataSource: 'repository',
              records: [
                {
                  id: 'rec-rag-used', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 150, completionTokens: 60, totalTokens: 210, latencyMs: 800,
                  status: 'succeeded', errorCode: null,
                  metadata: {
                    knowledgeContext: {
                      used: true,
                      sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '术后护理规范.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁干燥。', matchReason: '包含"冷敷"' }],
                    },
                  },
                  createdAt: '2026-06-28T08:00:00.000Z',
                },
                {
                  id: 'rec-rag-unused', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 20, completionTokens: 10, totalTokens: 30, latencyMs: 200,
                  status: 'succeeded', errorCode: null,
                  metadata: { knowledgeContext: { used: false, sources: [] } },
                  createdAt: '2026-06-28T07:00:00.000Z',
                },
                {
                  id: 'rec-old-null', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 10, completionTokens: 5, totalTokens: 15, latencyMs: 100,
                  status: 'succeeded', errorCode: null, metadata: null,
                  createdAt: '2026-06-27T07:00:00.000Z',
                },
                {
                  id: 'rec-rejected', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null,
                  status: 'rejected', errorCode: 'quota_exceeded_ai_calls', metadata: null,
                  createdAt: '2026-06-27T06:00:00.000Z',
                },
                {
                  id: 'rec-sensitive', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null,
                  status: 'sensitive_input_rejected', errorCode: 'SENSITIVE_INPUT_REJECTED', metadata: null,
                  createdAt: '2026-06-27T05:00:00.000Z',
                },
                {
                  id: 'rec-rate-limited', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 10, completionTokens: null, totalTokens: null, latencyMs: 100,
                  status: 'rate_limited', errorCode: 'RATE_LIMITED', metadata: null,
                  createdAt: '2026-06-27T04:00:00.000Z',
                },
                {
                  id: 'rec-provider-unavailable', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 10, completionTokens: null, totalTokens: null, latencyMs: 100,
                  status: 'provider_unavailable', errorCode: 'HTTP_503', metadata: null,
                  createdAt: '2026-06-27T03:00:00.000Z',
                },
                {
                  id: 'rec-failed', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', serviceName: '平台 AI 服务',
                  promptTokens: 10, completionTokens: null, totalTokens: null, latencyMs: 100,
                  status: 'failed', errorCode: 'NETWORK_ERROR', metadata: null,
                  createdAt: '2026-06-27T02:00:00.000Z',
                },
              ],
              emptyState: { title: '暂无', description: '暂无' },
            });
          }
          return Response.json({ records: [], pageInfo });
        }),
      );
    });

    it('AI 调用记录显示平台 AI 服务且不展示 raw provider/model', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      expect(await within(usageSection).findAllByText('平台 AI 服务')).not.toHaveLength(0);
      expect(usageSection.textContent).not.toMatch(/deepseek|deepseek-v4-flash|DeepSeek|智谱|Kimi|Claude|豆包|通义千问|qwen|doubao/i);
    });

    it('AI 调用记录按成功/非成功状态展示额度文案且隐藏 token 计量字段', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      expect(await within(usageSection).findAllByText('已计入本月 AI 调用额度')).toHaveLength(3);
      expect(within(usageSection).getAllByText('已记录，未计入成功调用额度')).toHaveLength(5);
      expect(usageSection.textContent).not.toMatch(/\btoken\b|\btokens\b|promptTokens|completionTokens|totalTokens/i);
      expect(usageSection.textContent).not.toContain('210 tokens');
      expect(usageSection.textContent).not.toContain('30 tokens');
      expect(usageSection.textContent).not.toContain('15 tokens');

      const sensitiveRecord = screen.getByText('敏感输入已拒绝').closest('article') as HTMLElement;
      expect(within(sensitiveRecord).queryByText('已计入本月 AI 调用额度')).not.toBeInTheDocument();
      expect(within(sensitiveRecord).getByText('已记录，未计入成功调用额度')).toBeInTheDocument();

      const quotaRecord = screen.getByText('AI 调用额度已用尽').closest('article') as HTMLElement;
      expect(within(quotaRecord).queryByText('已计入本月 AI 调用额度')).not.toBeInTheDocument();
      expect(within(quotaRecord).getByText('已记录，未计入成功调用额度')).toBeInTheDocument();

      ['调用失败', '供应商限流', '服务暂不可用'].forEach((statusLabel) => {
        const record = screen.getByText(statusLabel).closest('article') as HTMLElement;
        expect(within(record).queryByText('已计入本月 AI 调用额度')).not.toBeInTheDocument();
        expect(within(record).getByText('已记录，未计入成功调用额度')).toBeInTheDocument();
      });
    });

    it('AI 调用记录说明文案移除“模型”字样', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      expect(usageSection.textContent).toContain('查看本机构最近 AI 调用的额度、状态和知识库引用情况');
      expect(usageSection.textContent).not.toContain('模型');
    });

    it('展示 AI 调用额度 used / limit / remaining', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      expect(await within(aiSection).findByText('本月 AI 调用额度')).toBeInTheDocument();
      expect(within(aiSection).getByText('已用 12')).toBeInTheDocument();
      expect(within(aiSection).getByText('上限 100')).toBeInTheDocument();
      expect(within(aiSection).getByText('剩余 88')).toBeInTheDocument();
    });

    it('remaining=0 时展示额度用尽提示', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('/api/institution/entitlement-usage')) {
            return Response.json({
              items: [
                { resource: 'ai_calls', label: 'AI 调用（本月）', used: 100, limit: 100, remaining: 0, status: 'exceeded' },
              ],
            });
          }
          return Response.json({ records: [], pageInfo });
        }),
      );

      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      expect(await within(aiSection).findByText('剩余 0')).toBeInTheDocument();
      expect(within(aiSection).getByText('本月 AI 调用额度已用尽，请联系平台管理员调整套餐。')).toBeInTheDocument();
    });

    it('AI 调用记录细分状态文案', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      expect(await screen.findByText('AI 调用额度已用尽')).toBeInTheDocument();
      expect(screen.getByText('敏感输入已拒绝')).toBeInTheDocument();
      expect(screen.getByText('供应商限流')).toBeInTheDocument();
      expect(screen.getByText('服务暂不可用')).toBeInTheDocument();
      expect(screen.getByText('调用失败')).toBeInTheDocument();
    });

    it('metadata=null 旧成功记录显示受控说明', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      expect(await screen.findByText('旧记录未记录知识库上下文')).toBeInTheDocument();
      expect(usageSection.textContent).not.toContain('searchKeyword');
      expect(usageSection.textContent).not.toContain('query');
      expect(usageSection.textContent).not.toContain('原始 question');
      expect(usageSection.textContent).not.toContain('provider raw response');
    });

    it('调用结果和记录区提示 AI 需人工确认', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const aiSection = screen.getByLabelText('机构端 AI 真实调用');
      expect(within(aiSection).getByText(/结果需人工确认/)).toBeInTheDocument();
      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      expect(within(usageSection).getByText(/AI 结果需人工确认/)).toBeInTheDocument();
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));
      expect(await within(usageSection).findByText('AI 参考片段仍需人工确认，不可直接作为诊疗结论。')).toBeInTheDocument();
    });

    it('不展示 prompt / question / answer / provider raw response 敏感字段', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));
      await screen.findByText('已使用知识库');

      expect(usageSection.textContent).not.toContain('prompt');
      expect(usageSection.textContent).not.toContain('question');
      expect(usageSection.textContent).not.toContain('answer');
      expect(usageSection.textContent).not.toContain('provider raw response');
    });

    it('展示"已使用知识库"徽标和 sources 摘要', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      const refreshButton = within(usageSection).getByRole('button', { name: '刷新记录' });
      fireEvent.click(refreshButton);

      expect(await screen.findByText('已使用知识库')).toBeInTheDocument();
      expect(screen.getByText(/术后护理规范\.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/冷敷后保持清洁干燥/)).toBeInTheDocument();
      // usage 记录区不展示原始用户问题 / query
      expect(usageSection.textContent).not.toContain('query');
    });

    it('展示"未使用知识库参考"徽标', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      expect(await screen.findByText('未使用知识库参考')).toBeInTheDocument();
    });

    it('metadata=null 旧记录和 rejected 记录不误显示 RAG 徽标', async () => {
      render(<InstitutionKnowledgeReadonlyShell />);
      expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

      const usageSection = screen.getByLabelText('机构端 AI 调用记录');
      fireEvent.click(within(usageSection).getByRole('button', { name: '刷新记录' }));

      await screen.findByText('已使用知识库');
      // 旧成功记录（metadata=null）和 rejected / failed 类记录都不展示 RAG 徽标
      // 只应有 1 个"已使用知识库"和 1 个"未使用知识库参考"
      expect(screen.getAllByText('已使用知识库')).toHaveLength(1);
      expect(screen.getAllByText('未使用知识库参考')).toHaveLength(1);
    });
  });

  it('indexing root GET/POST 固定 capability disabled，且 route 初始化和调用均无副作用', async () => {
    vi.resetModules();
    const initialized: string[] = [];
    const rejectInitialization = (modulePath: string, label: string) => {
      vi.doMock(modulePath, () => {
        initialized.push(label);
        throw new Error(`${label} must not initialize`);
      });
    };
    rejectInitialization('@/modules/security/server/access-context', 'auth');
    rejectInitialization('@/server/db/client', 'db');
    rejectInitialization('@/modules/open-platform/server/platform-knowledge-management-repository', 'repository');
    rejectInitialization('@/modules/open-platform/server/platform-knowledge-file-storage', 'storage');
    rejectInitialization('@/modules/open-platform/server/platform-knowledge-indexing-job-service', 'job-service');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('fetch must not run');
    });

    const route = (await import('@/app/api/institution/knowledge-management/indexing-jobs/route')) as IndexingJobsRoute;
    expect(Object.keys(route).sort()).toEqual(['GET', 'POST']);
    expect(initialized).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    const hostileRequest = () => {
      const counts = { get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 };
      const trap = <T extends keyof typeof counts>(name: T): never => {
        counts[name] += 1;
        throw new Error(`${name} must not run`);
      };
      const request = new Proxy({}, {
        get: () => trap('get'), set: () => trap('set'), has: () => trap('has'), ownKeys: () => trap('ownKeys'),
        getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'), getPrototypeOf: () => trap('getPrototypeOf'),
      }) as Request;
      return { request, counts };
    };

    for (const [method, request] of [
      ['GET', undefined],
      ['GET', new Request('http://localhost/api/institution/knowledge-management/indexing-jobs?limit=999', {
        headers: { authorization: 'Bearer forged', 'x-institution-id': 'forged' },
      })],
      ['POST', new Request('http://localhost/api/institution/knowledge-management/indexing-jobs', {
        method: 'POST', body: JSON.stringify({ jobType: 'ocr_file', knowledgeId: 'forged', fileId: 'forged' }),
      })],
    ] as const) {
      const response = await route[method](request);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(indexingCapabilityDisabledPayload);
      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    }

    for (const method of ['GET', 'POST'] as const) {
      const { request, counts } = hostileRequest();
      const response = await route[method](request);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(indexingCapabilityDisabledPayload);
      expect(counts).toEqual({ get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 });
      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    }

    fetchSpy.mockRestore();
    indexingRouteModulePaths.forEach((modulePath) => vi.doUnmock(modulePath));
    vi.resetModules();
  });
});
