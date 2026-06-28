import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionKnowledgeReadonlyShell } from '@/modules/institution/components/InstitutionKnowledgeReadonlyShell';
import { listInstitutionKnowledgeItems } from '@/modules/institution/client/tenant-business-client';

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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
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
                matchReason: 'mock embedding 相似度 0.765',
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
              safeFailureMessage: null,
              chunkCount: 1,
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

    fireEvent.click(screen.getByRole('button', { name: '查看文件' }));
    expect(await screen.findByText('机构文件.pdf')).toBeInTheDocument();
    expect(screen.getByText('解析成功 · 1 片段')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看解析片段' }));
    expect(await screen.findByText('机构端授权可见解析片段')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/parse/chunks',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(screen.getByRole('button', { name: '下载文件' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下载文件' }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-ui-a/files/institution-file-a/download',
      expect.objectContaining({ method: 'GET' }),
    );

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

  it('机构端新增检索片段区域，只读展示授权引用片段', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);

    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();
    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索关键词'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('机构端冷敷引用片段')).toBeInTheDocument();
    expect(screen.getByText('片段包含关键词“冷敷”')).toBeInTheDocument();
    expect(screen.getByText('授权可见术后护理 · 机构文件.pdf · 片段 1')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(searchSection.textContent).not.toContain('embedding');
    expect(searchSection.textContent).not.toContain('训练');
    expect(searchSection.textContent).not.toContain('问答');
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
    expect(screen.getByText('mock embedding 相似度 0.765')).toBeInTheDocument();
    expect(screen.getByText('相似度 0.765')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/vector-search?query=%E5%86%B7%E6%95%B7%E6%8A%A4%E7%90%86',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(within(vectorSection).queryByRole('button', { name: '生成向量索引' })).not.toBeInTheDocument();
    expect(vectorSection.textContent).not.toContain('OCR');
    expect(vectorSection.textContent).not.toContain('训练');
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

  it('检索片段区域明确展示"不会调用 AI / 不进入 AI prompt"文案', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    expect(searchSection.textContent).toContain('仅搜索已解析的机构知识库片段');
    expect(searchSection.textContent).toContain('不会调用 AI');
    expect(searchSection.textContent).toContain('不会进入 AI prompt');
  });

  it('检索为空时不展示敏感字段', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({
            requestId: 'institution-knowledge-keyword-search',
            readonly: true,
            dataSource: 'repository',
            records: [],
            pageInfo: { ...pageInfo, total: 0, pageCount: 0 },
            emptyState: {
              title: '暂无匹配片段',
              description: '当前范围没有命中关键词的已解析知识片段。',
            },
          });
        }
        return Response.json({ records: [], pageInfo });
      }),
    );

    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索关键词'), {
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
        if (url.includes('/api/institution/knowledge-management/search')) {
          return new Response(
            JSON.stringify({ code: 'service_unavailable', error: '知识库片段检索暂时不可用' }),
            { status: 503 },
          );
        }
        return Response.json({ records: [], pageInfo });
      }),
    );

    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索关键词'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('知识库片段检索暂时不可用')).toBeInTheDocument();
    ['DATABASE_URL', 'postgres://', 'secret', 'stack', 'SQL', 'Bearer', '/Users/'].forEach((fragment) => {
      expect(searchSection.textContent).not.toContain(fragment);
    });
  });

  it('检索结果中不展示敏感字段', async () => {
    render(<InstitutionKnowledgeReadonlyShell />);
    expect(await screen.findByRole('heading', { name: '授权可见术后护理' })).toBeInTheDocument();

    const searchSection = screen.getByLabelText('机构端知识片段检索');
    // The default mock already returns a result with "机构端冷敷引用片段"
    fireEvent.change(within(searchSection).getByLabelText('输入片段检索关键词'), {
      target: { value: '冷敷' },
    });
    fireEvent.click(within(searchSection).getByRole('button', { name: '检索片段' }));

    expect(await screen.findByText('机构端冷敷引用片段')).toBeInTheDocument();
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
                actorUserId: 'demo-user-admin', provider: 'deepseek', model: 'deepseek-v4-flash',
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
          if (url.includes('/api/institution/knowledge-management/ai-call/usage')) {
            return Response.json({
              requestId: 'institution-ai-call-usage',
              readonly: true,
              dataSource: 'repository',
              records: [
                {
                  id: 'rec-rag-used', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', provider: 'deepseek', model: 'deepseek-v4-flash',
                  promptTokens: 150, completionTokens: 60, totalTokens: 210, latencyMs: 800,
                  status: 'succeeded', errorCode: null,
                  metadata: {
                    knowledgeContext: {
                      used: true,
                      searchKeyword: '冷敷',
                      sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '术后护理规范.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁干燥。', matchReason: '包含"冷敷"' }],
                    },
                  },
                  createdAt: '2026-06-28T08:00:00.000Z',
                },
                {
                  id: 'rec-rag-unused', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', provider: 'deepseek', model: 'deepseek-v4-flash',
                  promptTokens: 20, completionTokens: 10, totalTokens: 30, latencyMs: 200,
                  status: 'succeeded', errorCode: null,
                  metadata: { knowledgeContext: { used: false, searchKeyword: '', sources: [] } },
                  createdAt: '2026-06-28T07:00:00.000Z',
                },
                {
                  id: 'rec-old-null', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', provider: 'deepseek', model: 'deepseek-v4-flash',
                  promptTokens: 10, completionTokens: 5, totalTokens: 15, latencyMs: 100,
                  status: 'succeeded', errorCode: null, metadata: null,
                  createdAt: '2026-06-27T07:00:00.000Z',
                },
                {
                  id: 'rec-rejected', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
                  actorUserId: 'u', provider: 'deepseek', model: 'unknown',
                  promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null,
                  status: 'rejected', errorCode: 'quota_exceeded_ai_calls', metadata: null,
                  createdAt: '2026-06-27T06:00:00.000Z',
                },
              ],
              emptyState: { title: '暂无', description: '暂无' },
            });
          }
          return Response.json({ records: [], pageInfo });
        }),
      );
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
      // 旧成功记录（metadata=null）和 rejected 记录都不展示 RAG 徽标
      // 只应有 1 个"已使用知识库"和 1 个"未使用知识库参考"
      expect(screen.getAllByText('已使用知识库')).toHaveLength(1);
      expect(screen.getAllByText('未使用知识库参考')).toHaveLength(1);
    });
  });
});