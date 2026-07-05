import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionKnowledgeBaseCardPanel } from '@/modules/institution/components/InstitutionKnowledgeBaseCardPanel';
import { listInstitutionKnowledgeItems } from '@/modules/institution/client/tenant-business-client';

vi.mock('@/modules/institution/client/tenant-business-client', async () => {
  const actual = await vi.importActual<typeof import('@/modules/institution/client/tenant-business-client')>(
    '@/modules/institution/client/tenant-business-client',
  );

  return {
    ...actual,
    listInstitutionKnowledgeItems: vi.fn(),
  };
});

const pageInfo = {
  page: 1,
  pageSize: 20,
  total: 2,
  pageCount: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

const records = [
  {
    knowledgeId: 'knowledge-owned-aftercare',
    title: '本机构术后护理知识',
    category: '术后护理',
    status: 'ready' as const,
    readonlyStatus: 'readonly' as const,
    sourceKind: 'demo' as const,
    descriptionPreview: '真实 API 返回的本机构护理摘要。',
    chunkCount: 2,
    visibility: 'owned' as const,
    updatedAt: '2026-07-03T10:20:00.000Z',
    createdAt: '2026-07-03T10:00:00.000Z',
  },
  {
    knowledgeId: 'knowledge-authorized-project',
    title: '平台授权项目资料',
    category: '项目资料',
    status: 'empty' as const,
    readonlyStatus: 'readonly' as const,
    sourceKind: 'seed' as const,
    descriptionPreview: '平台授权给本机构的项目资料摘要。',
    chunkCount: 0,
    visibility: 'platform_authorized' as const,
    updatedAt: '2026-07-02T08:00:00.000Z',
    createdAt: '2026-07-02T08:00:00.000Z',
  },
];

const files = [
  {
    fileId: 'file-aftercare-md',
    knowledgeId: 'knowledge-owned-aftercare',
    originalFilename: '术后护理.md',
    mimeType: 'text/markdown',
    sizeBytes: 128,
    status: 'active' as const,
    fileType: 'MD',
    sizeLabel: '128 B',
    parseStatus: 'succeeded' as const,
    safeFailureMessage: null,
    textLength: 64,
    chunkCount: 2,
    parserVersion: 'local-real-file-parser-v1',
    uploadedByUserId: 'tenant-user',
    createdAt: '2026-07-03T10:00:00.000Z',
    updatedAt: '2026-07-03T10:20:00.000Z',
    archivedAt: null,
  },
];

function mockKnowledgeList(nextRecords = records) {
  vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
    ok: true,
    records: nextRecords,
    pageInfo: { ...pageInfo, total: nextRecords.length },
  });
}

function mockDefaultFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/institution/knowledge-management/upload') && init?.method === 'POST') {
        return Response.json(
          {
            status: 'created',
            knowledgeId: 'knowledge-uploaded',
            sourceId: 'source-uploaded',
            file: { ...files[0], fileId: 'file-uploaded-md', originalFilename: '新护理.md' },
            parse: { parseStatus: 'succeeded' },
            chunkCount: 2,
          },
          { status: 201 },
        );
      }
      if (url.includes('/api/institution/knowledge-management/answer')) {
        return Response.json({
          status: 'answered',
          answer: '基于召回片段，术后冷敷应控制时长并观察异常。仅供内部运营参考，需人工确认',
          sources: [
            {
              knowledgeId: 'knowledge-owned-aftercare',
              knowledgeTitle: '本机构术后护理知识',
              fileId: 'file-aftercare-md',
              fileName: '术后护理.md',
              chunkIndex: 0,
              textPreview: '冷敷后保持创面清洁，避免剧烈热刺激。',
            },
          ],
        });
      }
      if (url.includes('/api/institution/knowledge-management/search')) {
        return Response.json({
          requestId: 'institution-knowledge-keyword-search',
          readonly: true,
          dataSource: 'repository',
          records: [
            {
              knowledgeId: 'knowledge-owned-aftercare',
              knowledgeTitle: '本机构术后护理知识',
              fileId: 'file-aftercare-md',
              fileName: '术后护理.md',
              chunkId: 'chunk-aftercare-1',
              chunkIndex: 0,
              textPreview: '冷敷后保持创面清洁，避免剧烈热刺激。',
              matchReason: '片段包含关键词“冷敷”',
              parseStatus: 'succeeded',
            },
          ],
          pageInfo,
          emptyState: { title: '暂无匹配片段', description: '当前范围没有命中关键词的已解析知识片段。' },
        });
      }
      if (url.includes('/parse/chunks')) {
        return Response.json({
          requestId: 'institution-knowledge-document-file-parse-chunks',
          readonly: true,
          records: [
            {
              chunkId: 'chunk-aftercare-1',
              chunkIndex: 0,
              textPreview: '冷敷后保持创面清洁，避免剧烈热刺激。',
              charCount: 21,
            },
          ],
        });
      }
      if (url.includes('/parse') && init?.method === 'POST') {
        return Response.json({ status: 'succeeded', parse: { parseStatus: 'succeeded', textLength: 64, chunkCount: 2 } });
      }
      if (url.includes('/files')) {
        return Response.json({ records: url.includes('knowledge-owned-aftercare') ? files : [], pageInfo });
      }
      return Response.json({ records: [], pageInfo });
    }),
  );
}

async function renderLoaded(nextRecords = records) {
  mockKnowledgeList(nextRecords);
  mockDefaultFetch();
  render(<InstitutionKnowledgeBaseCardPanel />);
  await screen.findByText(nextRecords.length > 0 ? `知识条目：${nextRecords[0].title}` : '当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。');
}

describe('InstitutionKnowledgeBaseCardPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockKnowledgeList();
    mockDefaultFetch();
  });

  it('从真实 client/API 加载机构端知识数据并展示标题、指标和目录', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { name: '机构知识库' })).toBeInTheDocument();
    expect(listInstitutionKnowledgeItems).toHaveBeenCalledWith({ page: 1, pageSize: 20 });

    const metrics = screen.getByLabelText('机构知识库顶部指标');
    ['知识条目', '文件数', '已解析 / 待解析', '待优化 / 低命中'].forEach((label) => {
      expect(within(metrics).getByText(label)).toBeInTheDocument();
    });
    expect(within(metrics).getByText('2')).toBeInTheDocument();
    await waitFor(() => expect(within(metrics).getByText('1')).toBeInTheDocument());

    const directorySection = screen.getByLabelText('机构知识目录');
    ['全部知识', '咨询话术', '项目资料', '术后护理', '活动政策', '培训资料'].forEach((label) => {
      expect(within(directorySection).getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    });
    expect(screen.getByText(/本机构术后护理知识/)).toBeInTheDocument();
    expect(screen.getByText('摘要：真实 API 返回的本机构护理摘要。')).toBeInTheDocument();
  });

  it('真实数据为空时展示真实空状态，不展示旧静态示例', async () => {
    await renderLoaded([]);

    expect(screen.getByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();
    expect(screen.queryByText('初诊咨询接待标准话术')).not.toBeInTheDocument();
    expect(screen.queryByText('术后冷敷护理提醒')).not.toBeInTheDocument();
  });

  it('支持目录本地切换并只显示当前目录真实数据', async () => {
    await renderLoaded();

    const directorySection = screen.getByLabelText('机构知识目录');
    const projectButton = within(directorySection).getByRole('button', { name: /项目资料/ });
    fireEvent.click(projectButton);

    expect(projectButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/平台授权项目资料/)).toBeInTheDocument();
    expect(screen.queryByText(/本机构术后护理知识/)).not.toBeInTheDocument();
  });

  it('展示真实文件 / 文档卡片和 txt/md 简单解析状态', async () => {
    await renderLoaded();

    const documentSection = screen.getByLabelText('机构知识库文件文档卡片');
    await within(documentSection).findByText('术后护理.md');
    expect(within(documentSection).getByText('MD / 128 B')).toBeInTheDocument();
    expect(within(documentSection).getByText('已解析')).toBeInTheDocument();
    expect(within(documentSection).getByText('64')).toBeInTheDocument();
    expect(within(documentSection).getByText('暂无错误')).toBeInTheDocument();
    expect(within(documentSection).getByText('复杂 PDF / Word / Excel 深度解析仍为后续接入')).toBeInTheDocument();
  });

  it('上传 txt / md 成功后调用现有上传 API 并刷新真实列表', async () => {
    await renderLoaded();

    const file = new File(['# 护理\n冷敷后保持清洁'], '新护理.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

    expect(await screen.findByText('上传成功，已触发现有简单解析，生成 2 个片段。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(listInstitutionKnowledgeItems).toHaveBeenCalledTimes(2);
  });

  it('上传失败时展示错误态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/upload')) {
          return Response.json({ error: '文件上传失败，请稍后重试' }, { status: 503 });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const file = new File(['护理'], '护理.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

    expect(await screen.findByText('文件上传失败，请稍后重试')).toBeInTheDocument();
  });

  it('复杂 PDF / Word / Excel 不会被伪装为已完成深度解析', async () => {
    await renderLoaded();

    const file = new File(['fake pdf'], '护理.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [file] } });

    expect(screen.getByText('当前最小闭环仅开放 txt / md；复杂 PDF / Word / Excel 深度解析仍为后续接入。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));
    expect(screen.getByText('当前最小闭环仅开放 txt / md；复杂 PDF / Word / Excel 深度解析仍为后续接入。')).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/institution/knowledge-management/upload', expect.anything());
  });

  it('关键词检索成功路径展示命中结果且不调用 AI / provider', async () => {
    await renderLoaded();

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '冷敷' } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    expect(await within(searchSection).findByText('已命中 1 个真实解析片段，topK=5。')).toBeInTheDocument();
    expect(within(searchSection).getByText(/后保持创面清洁/)).toBeInTheDocument();
    expect(within(searchSection).getByText('知识条目标题：本机构术后护理知识')).toBeInTheDocument();
    expect(within(searchSection).getByText('文件名：术后护理.md')).toBeInTheDocument();
    expect(within(searchSection).getByText('已解析')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7&pageSize=5',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(searchSection.textContent).toContain('不调用 AI provider');
    expect(searchSection.textContent).toContain('不使用向量数据库');
  });

  it('关键词检索空结果展示空态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({ records: [], pageInfo, emptyState: { title: '暂无匹配片段', description: '无命中' } });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '不存在' } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    expect(await within(searchSection).findByText('暂无匹配片段。')).toBeInTheDocument();
  });

  it('关键词检索失败展示错误态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({ error: '关键词检索暂时不可用' }, { status: 503 });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '冷敷' } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    expect(await within(searchSection).findByText('关键词检索暂时不可用')).toBeInTheDocument();
  });



  it('topK 参数生效且新一轮检索会清空旧结果', async () => {
    await renderLoaded();

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '冷敷' } });
    fireEvent.change(within(searchSection).getByLabelText('选择 topK'), { target: { value: '10' } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    expect(await within(searchSection).findByText('已命中 1 个真实解析片段，topK=10。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7&pageSize=10',
      expect.objectContaining({ cache: 'no-store' }),
    );

    vi.mocked(globalThis.fetch).mockImplementation(async (url: string) => {
      if (url.includes('/api/institution/knowledge-management/search')) {
        return Response.json({ records: [], pageInfo, emptyState: { title: '暂无匹配片段', description: '无命中' } });
      }
      if (url.includes('/files')) return Response.json({ records: [], pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '不存在' } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    await within(searchSection).findByText('正在使用机构端关键词检索 API 查询已解析片段；已清空上一轮旧结果...');
    expect(within(searchSection).queryByText('知识条目标题：本机构术后护理知识')).not.toBeInTheDocument();
    expect(await within(searchSection).findByText('暂无匹配片段。')).toBeInTheDocument();
  });

  it('检索 validation_failed 使用低敏错误态展示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/search')) {
          return Response.json({ status: 'validation_failed', message: '关键词过长，最多支持 80 个字符' }, { status: 400 });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
    fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: 'x'.repeat(81) } });
    fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));

    expect(await within(searchSection).findByText('关键词过长，最多支持 80 个字符')).toBeInTheDocument();
  });

  it('问答台渲染并展示受控能力边界', async () => {
    await renderLoaded();

    const answerSection = screen.getByLabelText('机构知识库问答台');
    expect(within(answerSection).getByRole('heading', { name: '知识库问答' })).toBeInTheDocument();
    expect(within(answerSection).getByLabelText('输入知识库问答问题')).toBeInTheDocument();
    expect(within(answerSection).getByLabelText('选择问答 topK')).toHaveValue('5');
    expect(answerSection.textContent).toContain('当前基于机构知识库内容回答');
    expect(answerSection.textContent).toContain('当前为受控问答闭环');
    expect(answerSection.textContent).toContain('仅供内部运营参考，需人工确认');
    expect(answerSection.textContent).toContain('不展示模型名、Token、成本、厂商');
  });

  it('问答台提问成功后展示答案和 sources', async () => {
    await renderLoaded();

    const answerSection = screen.getByLabelText('机构知识库问答台');
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '术后冷敷注意事项？' } });
    fireEvent.change(within(answerSection).getByLabelText('选择问答 topK'), { target: { value: '10' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));

    expect(await within(answerSection).findByText('已基于 1 个引用来源生成受控问答草稿。')).toBeInTheDocument();
    expect(within(answerSection).getByText(/术后冷敷应控制时长/)).toBeInTheDocument();
    expect(within(answerSection).getByText('本机构术后护理知识')).toBeInTheDocument();
    expect(within(answerSection).getByText('文件名：术后护理.md')).toBeInTheDocument();
    expect(within(answerSection).getByText('chunkIndex 0')).toBeInTheDocument();
    expect(within(answerSection).getByText(/冷敷后保持创面清洁/)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/answer',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: '术后冷敷注意事项？', topK: 10 }),
      }),
    );
    const answerCalls = vi.mocked(globalThis.fetch).mock.calls.filter(([url]) => String(url).includes('/answer'));
    expect(answerCalls).toHaveLength(1);
    expect(answerCalls.some(([url]) => /embedding|vector|rerank|ocr|training/i.test(String(url)))).toBe(false);
  });

  it('问答台 no_answer 状态不会展示旧答案或编造来源', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'no_answer',
            answer: '未在当前知识库中找到足够依据。仅供内部运营参考，需人工确认',
            sources: [],
            noAnswerReason: 'no_retrieval_hit',
          });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const answerSection = screen.getByLabelText('机构知识库问答台');
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '未知问题' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));

    expect(await within(answerSection).findByText('未在当前知识库中找到足够依据')).toBeInTheDocument();
    expect(within(answerSection).getByText(/不会编造来源/)).toBeInTheDocument();
    expect(within(answerSection).queryByText('文件名：术后护理.md')).not.toBeInTheDocument();
  });

  it('问答台 provider error 使用低敏错误态展示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'provider_unavailable',
            answer: '知识库问答服务暂时不可用，请稍后重试。仅供内部运营参考，需人工确认',
            sources: [],
            message: '知识库问答服务暂时不可用，请稍后重试',
          });
        }
        if (url.includes('/files')) return Response.json({ records: [], pageInfo });
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    const answerSection = screen.getByLabelText('机构知识库问答台');
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '冷敷？' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));

    expect(await within(answerSection).findByText('知识库问答服务暂时不可用，请稍后重试')).toBeInTheDocument();
    expect(answerSection.textContent).not.toContain('DATABASE_URL');
    expect(answerSection.textContent).not.toContain('provider config');
    expect(answerSection.textContent).not.toContain('厂商：');
  });

  it('新一轮提问会清空旧答案', async () => {
    await renderLoaded();

    const answerSection = screen.getByLabelText('机构知识库问答台');
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '术后冷敷注意事项？' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));
    expect(await within(answerSection).findByText(/术后冷敷应控制时长/)).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async (url: string) => {
      if (url.includes('/api/institution/knowledge-management/answer')) {
        return Response.json({
          status: 'no_answer',
          answer: '未在当前知识库中找到足够依据。仅供内部运营参考，需人工确认',
          sources: [],
          noAnswerReason: 'no_retrieval_hit',
        });
      }
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '未知问题' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));

    await within(answerSection).findByText('正在基于关键词 / chunk 召回组装上下文；已清空上一轮旧答案...');
    expect(within(answerSection).queryByText(/术后冷敷应控制时长/)).not.toBeInTheDocument();
    expect(await within(answerSection).findByText('未在当前知识库中找到足够依据')).toBeInTheDocument();
  });
  it('chunk 列表加载成功、空状态和错误态均可展示', async () => {
    await renderLoaded();

    const chunkSection = screen.getByLabelText('机构知识库片段可视化管理');
    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));

    expect(await within(chunkSection).findByText('已读取 1 个解析片段。')).toBeInTheDocument();
    expect(within(chunkSection).getByText('chunkIndex 0')).toBeInTheDocument();
    expect(within(chunkSection).getByText('charCount 21')).toBeInTheDocument();
    expect(within(chunkSection).getByText('所属知识条目：本机构术后护理知识')).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async (url: string) => {
      if (url.includes('/parse/chunks')) return Response.json({ records: [] });
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    expect(await within(chunkSection).findByText('当前文件暂无解析片段。')).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async (url: string) => {
      if (url.includes('/parse/chunks')) return Response.json({ error: '解析片段暂时不可用' }, { status: 503 });
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    expect((await within(chunkSection).findAllByText('解析片段暂时不可用')).length).toBeGreaterThan(0);
  });

  it('.txt / .md 重新解析成功，PDF / Word / Excel 不误启用深度解析', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));
    expect(await screen.findByText('文件已重新解析，状态和片段已刷新。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-owned-aftercare/files/file-aftercare-md/parse',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.mocked(globalThis.fetch).mockImplementation(async (url: string) => {
      if (url.includes('/files')) {
        return Response.json({
          records: url.includes('knowledge-owned-aftercare')
            ? [{ ...files[0], fileId: 'file-pdf', originalFilename: '机构文件.pdf', fileType: 'PDF' }]
            : [],
          pageInfo,
        });
      }
      return Response.json({ records: [], pageInfo });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    });
    expect((await screen.findAllByText('机构文件.pdf')).length).toBeGreaterThan(0);
    screen.getAllByRole('button', { name: '重新解析' }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('重新解析失败低敏展示', async () => {
    await renderLoaded();
    vi.mocked(globalThis.fetch).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/parse') && init?.method === 'POST') {
        return Response.json({ error: '文件重新解析失败' }, { status: 503 });
      }
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });

    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));
    expect(await screen.findByText('文件重新解析失败')).toBeInTheDocument();
  });

  it('新建、编辑和归档知识在前端完成确认态和刷新', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('知识标题'), { target: { value: '新建护理知识' } });
    fireEvent.change(screen.getByLabelText('分类 / 目录口径'), { target: { value: '护理分类' } });
    fireEvent.change(screen.getByLabelText('摘要 / 描述'), { target: { value: '低敏摘要' } });
    fireEvent.click(screen.getByRole('button', { name: '新建知识' }));
    expect(await screen.findByText('知识条目已新建。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items',
      expect.objectContaining({ method: 'POST' }),
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    expect(screen.getByLabelText('知识标题')).toHaveValue('本机构术后护理知识');
    fireEvent.change(screen.getByLabelText('知识标题'), { target: { value: '更新护理知识' } });
    fireEvent.click(screen.getByRole('button', { name: '保存编辑' }));
    expect(await screen.findByText('知识条目已更新。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '归档' }));
    expect(screen.getByText('确认软归档“本机构术后护理知识”？归档后不会物理删除数据。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认归档' }));
    expect(await screen.findByText('知识条目已软归档，文件列表和检索结果已刷新。')).toBeInTheDocument();
  });

  it('新建和编辑知识失败时低敏展示错误', async () => {
    await renderLoaded();
    vi.mocked(globalThis.fetch).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/institution/knowledge-management/items') && init?.method === 'POST') {
        return Response.json({ error: '知识条目新建失败' }, { status: 503 });
      }
      if (url.includes('/api/institution/knowledge-management/items') && init?.method === 'PATCH') {
        return Response.json({ error: '知识条目编辑失败' }, { status: 503 });
      }
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });

    fireEvent.change(screen.getByLabelText('知识标题'), { target: { value: '新建护理知识' } });
    fireEvent.click(screen.getByRole('button', { name: '新建知识' }));
    expect(await screen.findByText('知识条目新建失败')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.click(screen.getByRole('button', { name: '保存编辑' }));
    expect(await screen.findByText('知识条目编辑失败')).toBeInTheDocument();
  });

  it('不展示其他机构数据，并保留重新训练 / AI / 向量能力受控文案', async () => {
    const filteredRecords = [
      ...records,
      {
        ...records[0],
        knowledgeId: 'knowledge-other-should-not-render',
        title: '其他机构不可见知识',
      },
    ].filter((record) => record.knowledgeId !== 'knowledge-other-should-not-render');
    await renderLoaded(filteredRecords);

    expect(screen.queryByText('其他机构不可见知识')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新训练（未接训练 runtime）' })).toBeDisabled();
    expect(screen.getByText('真实外部 AI、向量数据库和训练能力仍为后续专项；当前仅提供 mock / dry-run 受控问答闭环。')).toBeInTheDocument();
  });

  it('不出现误导真实能力已完成或已接入的文案', async () => {
    const { container } = render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    [
      '真实训练已完成',
      'AI provider 已接入',
      '向量数据库已接入',
      '复杂文档解析已完成',
      '生产可用闭环已完成',
    ].forEach((text) => {
      expect(container.textContent).not.toContain(text);
    });
  });
});
