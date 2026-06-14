import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as viewLoader from '@/modules/open-platform/lib/platformKnowledgeManagementViewLoader';
import { OpenPlatformKnowledgeManagementPanel } from '@/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

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

describe('平台端知识库管理只读看板', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (url.includes('/api/v1/open-platform/knowledge-management/capabilities')) {
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
              stage: '10-4',
              status: '内部受控试用',
              baselineCommit: '1e41132cbfe23fc755c2426d271f889b40f41d27',
              summary: '知识库已进入内部受控试用，当前仅开放低敏、授权、mock/local 能力。',
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
        if (url.includes('/api/v1/open-platform/knowledge-management/qa/audits')) {
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
        if (url.includes('/api/v1/open-platform/knowledge-management/qa')) {
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
        if (url.includes('/api/v1/open-platform/knowledge-management/embeddings')) {
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
        if (url.includes('/api/v1/open-platform/knowledge-management/vector-search')) {
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
        if (url.includes('/api/v1/open-platform/knowledge-management/search')) {
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
        if (url.includes('/parse/chunks')) {
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
        if (url.includes('/parse') && method === 'POST') {
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
        if (url.includes('/download')) {
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

  it('可以从平台侧菜单进入知识库管理页面并展示只读运营模块', async () => {
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: '知识库管理' }));

    expect(await screen.findByText('平台知识运营中枢')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '机构概况' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识库管理' })).toBeInTheDocument();
    expect(screen.getByText('查看各机构知识解析、命中表现、导入概况和高频问题。')).toBeInTheDocument();
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

    expect(screen.getByText('接入机构')).toBeInTheDocument();
    expect(screen.getAllByText('知识条目')[0]).toBeInTheDocument();
    expect(screen.getAllByText('累计命中')[0]).toBeInTheDocument();
    expect(screen.getAllByText('解析覆盖')[0]).toBeInTheDocument();
    expect(screen.getByText('待优化')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '机构概况' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '运营信号' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '机构上传文件' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '分类表现' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '高频问题' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识条目' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '导入与解析任务' })).toBeInTheDocument();

    expectNoRawRuntimeError(container);
    expect(screen.getByRole('heading', { name: '文件管理操作' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传文件' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '下载文件' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '归档文件' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('真实下载');
    expect(container.textContent).not.toContain('开始训练');
    expect(container.textContent).not.toContain('CSV 导出');
    expect(screen.queryByRole('button', { name: /导出|训练|新增|编辑|删除/ })).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(container.querySelector('a[download]')).toBeNull();
  });

  it('平台端文件管理操作区支持上传、下载、解析、查看片段和归档 API 调用', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '文件管理操作' })).toBeInTheDocument();
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

  it('平台端新增检索片段区域，可按关键词查看引用片段', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

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

  it('平台端新增向量索引和语义检索区域，使用 mock embedding 引用片段', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '生成向量索引' })).toBeInTheDocument();
    const indexSection = screen.getByLabelText('平台端知识向量索引');
    fireEvent.click(within(indexSection).getByRole('button', { name: '生成向量索引' }));

    expect(await screen.findByText('已生成 1 个 mock embedding 索引')).toBeInTheDocument();
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
    expect(screen.getByText('mock embedding 相似度 0.877')).toBeInTheDocument();
    expect(screen.getByText('相似度 0.877')).toBeInTheDocument();
    expect(vectorSection.textContent).not.toContain('OCR');
    expect(vectorSection.textContent).not.toContain('训练');
    expect(vectorSection.textContent).not.toContain('问答');
    expect(vectorSection.textContent).not.toContain('第三方 AI');
  });

  it('平台端新增知识库问答区域，展示回答、引用来源和审计编号', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

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

  it('平台端新增生产能力状态区域，展示 disabled 原因和 QA 用量策略', async () => {
    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '生产能力状态' })).toBeInTheDocument();
    const capabilitySection = screen.getByLabelText('平台端知识库生产能力状态');

    expect(within(capabilitySection).getByText('文件管理')).toBeInTheDocument();
    expect(within(capabilitySection).getAllByText('mock/local QA').length).toBeGreaterThan(0);
    expect(within(capabilitySection).getAllByText('已启用').length).toBeGreaterThan(0);
    expect(within(capabilitySection).getByText('真实 AI provider')).toBeInTheDocument();
    expect(within(capabilitySection).getByText('AI provider 适配层已准备，真实 AI 未启用')).toBeInTheDocument();
    expect(within(capabilitySection).getByText('真实 AI 未启用，未接入真实第三方 AI')).toBeInTheDocument();
    expect(within(capabilitySection).getAllByText('OCR').length).toBeGreaterThan(0);
    expect(within(capabilitySection).getByText('未接入 OCR')).toBeInTheDocument();
    expect(within(capabilitySection).getAllByText('runtime ingestion').length).toBeGreaterThan(0);
    expect(within(capabilitySection).getByText('tenant 每日 100 次 · institution 每日 30 次')).toBeInTheDocument();
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/v1/open-platform/knowledge-management/capabilities',
        expect.objectContaining({ cache: 'no-store' }),
      ),
    );
    expect(capabilitySection.textContent).not.toContain('真实 AI 已可用');
    expect(capabilitySection.textContent).not.toContain('真实 AI 可用');
    expect(container.textContent).not.toContain('DATABASE_URL');
    expect(container.textContent).not.toContain('embeddingVectorJson');
    expect(container.textContent).not.toContain('storageKey');
    expect(container.textContent).not.toContain('token');
    expect(container.textContent).not.toContain('secret');
  });

  it('平台端展示内部受控试用状态、支持格式、安全限制和禁用能力边界', async () => {
    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByRole('heading', { name: '生产能力状态' })).toBeInTheDocument();
    const trialSection = screen.getByLabelText('平台端知识库内部受控试用状态');

    expect(within(trialSection).getByText('内部受控试用')).toBeInTheDocument();
    expect(within(trialSection).getByText('知识库已进入内部受控试用，当前仅开放低敏、授权、mock/local 能力。')).toBeInTheDocument();
    [
      '文件上传',
      '真实文本文件解析',
      'chunk 查看',
      '关键词检索',
      'mock 向量检索',
      'mock/local QA',
      'citations',
      'QA audit',
      'quota',
      'capability',
    ].forEach((label) => {
      expect(within(trialSection).getByText(label)).toBeInTheDocument();
    });
    ['TXT', 'Markdown', 'CSV', '文本型 PDF', 'DOCX', 'XLSX'].forEach((label) => {
      expect(within(trialSection).getByText(label)).toBeInTheDocument();
    });
    ['20MB', '32000 字符', '5MB', '12MB', '8MB'].forEach((label) => {
      expect(within(trialSection).getByText(label)).toBeInTheDocument();
    });
    [
      'OCR',
      '扫描 PDF / 图片文字识别',
      '真实 AI',
      '真实凭据 / API 凭据',
      '外部网络服务',
      '真实向量数据库',
      'runtime ingestion',
      'worker / queue / scheduler',
      '训练系统',
      '计费系统',
      'dashboard 聚合',
      '首页编辑',
    ].forEach((label) => {
      expect(within(trialSection).getByText(label)).toBeInTheDocument();
    });
    expect(trialSection.textContent).toContain('仅展示低敏摘要、解析状态、chunk 预览、引用和审计摘要。');
    expect(trialSection.textContent).toContain('存储定位键');
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

    const scopeSummary = await screen.findByLabelText('当前知识库范围');
    expect(await within(scopeSummary).findByText('全部机构')).toBeInTheDocument();
    expect(await screen.findByText('星澜医美中心术后护理指南.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /低命中修复门诊/ }));

    expect(await within(scopeSummary).findByText('低命中修复门诊')).toBeInTheDocument();
    expect(await screen.findByText('低命中修复术后答疑.docx')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('星澜医美中心术后护理指南.pdf')).not.toBeInTheDocument());
    expect(screen.getAllByText('修复术后饮食要注意什么？')[0]).toBeInTheDocument();
    expect(screen.queryByText('水光针术后需要注意什么？')).not.toBeInTheDocument();
    expect(screen.getByText('低命中机构修复资料导入')).toBeInTheDocument();
    expect(viewLoader.loadOpenPlatformKnowledgeManagementView).toHaveBeenLastCalledWith({ tenantId: 'tenant-low-hit' });
  });

  it('支持按文件名搜索、选择本页、分页和同步 loading', async () => {
    render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByText('星澜医美中心术后护理指南.pdf')).toBeInTheDocument();
    const fileSection = await screen.findByLabelText('机构上传文件列表');
    const searchInput = within(fileSection).getByPlaceholderText('搜索文件名');
    fireEvent.change(searchInput, { target: { value: '星澜导入失败记录' } });

    expect(await screen.findByText('星澜导入失败记录.xlsx')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('星澜医美中心术后护理指南.pdf')).not.toBeInTheDocument());
    expect(viewLoader.loadOpenPlatformKnowledgeManagementFiles).toHaveBeenLastCalledWith({
      tenantId: null,
      keyword: '星澜导入失败记录',
      page: 1,
      pageSize: 6,
    });

    fireEvent.click(within(fileSection).getByRole('button', { name: '选择本页' }));
    expect(screen.getByText('已选择 1 个文件')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    expect(await screen.findByText('星澜医美中心术后护理指南.pdf')).toBeInTheDocument();
    await waitFor(() => expect(within(fileSection).getByRole('button', { name: '下一页' })).toBeEnabled());
    fireEvent.click(within(fileSection).getByRole('button', { name: '下一页' }));
    expect(await screen.findByText(/第 2\/2 页/)).toBeInTheDocument();

    const syncButton = screen.getByRole('button', { name: '同步数据' });
    fireEvent.click(syncButton);
    expect(screen.getByRole('button', { name: '同步中...' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: '同步数据' })).toBeInTheDocument();
  });

  it('展示中文安全错误文案、空状态和异常机构名称兜底', async () => {
    const { container } = render(<OpenPlatformKnowledgeManagementPanel />);

    expect(await screen.findByText('星澜医美中心术后护理指南.pdf')).toBeInTheDocument();
    const fileSection = await screen.findByLabelText('机构上传文件列表');
    const searchInput = within(fileSection).getByPlaceholderText('搜索文件名');
    fireEvent.change(searchInput, { target: { value: '星澜导入失败记录' } });

    expect(await screen.findByText('星澜导入失败记录.xlsx')).toBeInTheDocument();
    expect(screen.getByText('文件格式暂不支持')).toBeInTheDocument();
    expectNoRawRuntimeError(container);

    fireEvent.change(searchInput, { target: { value: '没有匹配的文件名' } });
    expect(await screen.findByText('暂无匹配的知识库运营数据')).toBeInTheDocument();
    expect(screen.getByText('请调整机构范围或文件名搜索条件后再查看。')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /机构名称异常/ }));

    const scopeSummary = screen.getByLabelText('当前知识库范围');
    expect(await within(scopeSummary).findByText('机构名称异常')).toBeInTheDocument();
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
      dataSource: 'mock',
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

    expect(await screen.findByText('暂无知识条目')).toBeInTheDocument();
    expect(container.textContent).not.toContain('fileContent');
    expect(container.textContent).not.toContain('downloadUrl');
    expect(container.textContent).not.toContain('uploadUrl');
    expect(container.textContent).not.toContain('exportUrl');
  });
});
