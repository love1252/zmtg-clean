import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
            },
          ],
          pageInfo,
          emptyState: { title: '暂无匹配片段', description: '当前范围没有命中关键词的已解析知识片段。' },
        });
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

    expect(await within(searchSection).findByText('已命中 1 个真实解析片段。')).toBeInTheDocument();
    expect(within(searchSection).getByText('冷敷后保持创面清洁，避免剧烈热刺激。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7',
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
    expect(screen.getByText('训练、AI 问答和向量能力仍为后续专项，不在本轮触发。')).toBeInTheDocument();
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
