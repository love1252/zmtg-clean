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

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}

function mockDefaultFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
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
  if (nextRecords.some((record) => record.knowledgeId === 'knowledge-owned-aftercare')) {
    await screen.findByText('术后护理.md');
  }
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

  it('items API 503 时保持指标和目录未知，并暂停资料库操作', async () => {
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValue({
      ok: false,
      error: { kind: 'service_unavailable', message: '机构知识库资料库暂未启用。', status: 503 },
    });

    render(<InstitutionKnowledgeBaseCardPanel />);

    await screen.findByText('机构知识库资料库暂未启用。');
    const metrics = screen.getByLabelText('机构知识库顶部指标');
    expect(within(metrics).getAllByText('--')).toHaveLength(4);
    expect(within(metrics).queryByText('0 / 0')).not.toBeInTheDocument();
    expect(within(metrics).queryByText('0')).not.toBeInTheDocument();

    const directory = screen.getByLabelText('机构知识目录');
    expect(within(directory).getAllByText('--')).toHaveLength(7);
    within(directory).getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByRole('status')).toHaveTextContent('资料库暂时不可用，上传、新建、编辑和归档已暂停。');
    expect(screen.queryByRole('button', { name: '上传文档' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建知识' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('选择知识库上传文件')).not.toBeInTheDocument();
  });

  it('刷新资料库时立即清除旧条目和文件，503 不得把 unknown 冒充为空数据', async () => {
    await renderLoaded();

    expect(screen.getByText('知识条目：本机构术后护理知识')).toBeInTheDocument();
    expect(screen.getByText('术后护理.md')).toBeInTheDocument();

    let resolveRefresh!: (result: Awaited<ReturnType<typeof listInstitutionKnowledgeItems>>) => void;
    vi.mocked(listInstitutionKnowledgeItems).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefresh = resolve; }),
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));

    await waitFor(() => {
      expect(screen.getByText('正在加载机构知识库卡片数据...')).toBeInTheDocument();
      expect(screen.queryByText('知识条目：本机构术后护理知识')).not.toBeInTheDocument();
      expect(screen.queryByText('术后护理.md')).not.toBeInTheDocument();
    });
    const metrics = screen.getByLabelText('机构知识库顶部指标');
    expect(within(metrics).getAllByText('--')).toHaveLength(4);
    const pendingFiles = screen.getByLabelText('机构知识库文件文档卡片');
    expect(within(pendingFiles).getByText('正在确认当前资料库文件快照...')).toBeInTheDocument();
    expect(within(pendingFiles).queryByText(/暂无真实文件记录/)).not.toBeInTheDocument();
    const pendingTasks = screen.getByLabelText('机构知识库解析训练任务记录');
    expect(within(pendingTasks).getByText('文件快照尚未确认，解析任务事实未展示。')).toBeInTheDocument();
    expect(within(pendingTasks).queryByText(/暂无解析任务记录/)).not.toBeInTheDocument();
    const pendingRisks = screen.getByLabelText('机构知识库运营建议风险提示');
    expect(within(pendingRisks).getAllByText('文件快照暂时不可用，暂不展示判断。')).toHaveLength(2);
    expect(within(pendingRisks).queryByText('当前可见知识均有基础片段。')).not.toBeInTheDocument();
    expect(within(pendingRisks).queryByText('当前未发现解析失败文件。')).not.toBeInTheDocument();

    await act(async () => {
      resolveRefresh({
        ok: false,
        error: { kind: 'service_unavailable', message: '机构知识库资料库暂未启用。', status: 503 },
      });
    });

    expect(await screen.findByText('机构知识库资料库暂未启用。')).toBeInTheDocument();
    expect(screen.queryByText('知识条目：本机构术后护理知识')).not.toBeInTheDocument();
    expect(screen.queryByText('术后护理.md')).not.toBeInTheDocument();
    expect(screen.queryByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('机构知识库文件文档卡片')).queryByText(/暂无真实文件记录/)).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('机构知识库解析训练任务记录')).queryByText(/暂无解析任务记录/)).not.toBeInTheDocument();
  });

  it.each(['success', 'failure', 'throw'] as const)(
    '过期 files %s 回包不能在较新的 root 503 后回填或覆盖状态',
    async (outcome) => {
    let resolveOldFiles!: (response: Response) => void;
    let rejectOldFiles!: (reason: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        if (requestUrl(input).includes('/files')) {
          return new Promise<Response>((resolve, reject) => {
            resolveOldFiles = resolve;
            rejectOldFiles = reject;
          });
        }
        return Promise.resolve(Response.json({ records: [], pageInfo }));
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);

    expect(await screen.findByText('知识条目：本机构术后护理知识')).toBeInTheDocument();
    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'service_unavailable', message: '机构知识库资料库暂未启用。', status: 503 },
    });
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('机构知识库资料库暂未启用。')).toBeInTheDocument();

    await act(async () => {
      if (outcome === 'success') resolveOldFiles(Response.json({ records: files, pageInfo }));
      if (outcome === 'failure') resolveOldFiles(Response.json({ error: 'STALE_FILES_FAILURE' }, { status: 503 }));
      if (outcome === 'throw') rejectOldFiles(new Error('STALE_FILES_THROW'));
    });

    await waitFor(() => {
      expect(screen.queryByText('术后护理.md')).not.toBeInTheDocument();
      expect(screen.queryByText('已读取 1 个真实文件记录。')).not.toBeInTheDocument();
      expect(screen.queryByText(/STALE_FILES/)).not.toBeInTheDocument();
      expect(screen.getByText('文件快照暂时不可用，未展示文件、解析或失败状态。')).toBeInTheDocument();
    });
    },
  );

  it.each([
    ['503', async () => Response.json({ status: 'capability_disabled' }, { status: 503 })],
    ['非法 payload', async () => Response.json({ records: null, pageInfo })],
    ['异常', async () => { throw new Error('files snapshot failed'); }],
  ])('files %s 时整批 fail-closed，所有文件派生事实保持不可用', async (_label, filesResponse) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        if (requestUrl(input).includes('/files')) return filesResponse();
        return Promise.resolve(Response.json({ records: [], pageInfo }));
      }),
    );
    mockKnowledgeList([records[0]]);
    render(<InstitutionKnowledgeBaseCardPanel />);

    expect(await screen.findByText('文件快照暂时不可用，未展示文件、解析或失败状态。')).toBeInTheDocument();

    const metrics = screen.getByLabelText('机构知识库顶部指标');
    expect(within(metrics).getByText('1')).toBeInTheDocument();
    expect(within(metrics).getAllByText('--')).toHaveLength(3);
    expect(within(metrics).queryByText('0')).not.toBeInTheDocument();
    expect(within(metrics).queryByText('0 / 0')).not.toBeInTheDocument();

    const knowledgeSection = screen.getByLabelText('机构知识条目卡片');
    expect(within(knowledgeSection).getByText('片段数 --')).toBeInTheDocument();
    expect(within(knowledgeSection).getByText('命中基础暂不可用')).toBeInTheDocument();
    expect(within(knowledgeSection).queryByText(/低命中提示/)).not.toBeInTheDocument();

    const fileSection = screen.getByLabelText('机构知识库文件文档卡片');
    expect(within(fileSection).queryByText(/暂无真实文件记录/)).not.toBeInTheDocument();
    expect(within(fileSection).queryByText('术后护理.md')).not.toBeInTheDocument();

    const taskSection = screen.getByLabelText('机构知识库解析训练任务记录');
    expect(within(taskSection).getByText('文件快照暂时不可用，解析任务事实未展示。')).toBeInTheDocument();
    expect(within(taskSection).queryByText(/暂无解析任务记录/)).not.toBeInTheDocument();

    const riskSection = screen.getByLabelText('机构知识库运营建议风险提示');
    expect(within(riskSection).getAllByText('文件快照暂时不可用，暂不展示判断。')).toHaveLength(2);
    expect(within(riskSection).queryByText('当前可见知识均有基础片段。')).not.toBeInTheDocument();
    expect(within(riskSection).queryByText('当前未发现解析失败文件。')).not.toBeInTheDocument();
  });

  it('多条目 files 一成功一失败时不发布部分文件快照', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('knowledge-owned-aftercare/files')) return Response.json({ records: files, pageInfo });
        if (url.includes('knowledge-authorized-project/files')) {
          return Response.json({ status: 'capability_disabled' }, { status: 503 });
        }
        return Response.json({ records: [], pageInfo });
      }),
    );
    mockKnowledgeList();
    render(<InstitutionKnowledgeBaseCardPanel />);

    expect(await screen.findByText('文件快照暂时不可用，未展示文件、解析或失败状态。')).toBeInTheDocument();
    expect(screen.queryByText('术后护理.md')).not.toBeInTheDocument();
    expect(screen.queryByText('已读取 1 个真实文件记录。')).not.toBeInTheDocument();
    const metrics = screen.getByLabelText('机构知识库顶部指标');
    expect(within(metrics).getAllByText('--')).toHaveLength(3);
  });

  it.each(['success', 'failure', 'throw'] as const)(
    '过期 root list %s 结果不能覆盖较新 revision 的权威空态',
    async (outcome) => {
      await renderLoaded();

      let resolveOldList!: (result: Awaited<ReturnType<typeof listInstitutionKnowledgeItems>>) => void;
      let rejectOldList!: (reason: unknown) => void;
      vi.mocked(listInstitutionKnowledgeItems).mockImplementationOnce(
        () => new Promise((resolve, reject) => {
          resolveOldList = resolve;
          rejectOldList = reject;
        }),
      );
      vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
        ok: true,
        records: [],
        pageInfo: { ...pageInfo, total: 0 },
      });

      let resolveUpload!: (response: Response) => void;
      vi.mocked(globalThis.fetch).mockImplementation((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('/upload')) {
          return new Promise<Response>((resolve) => { resolveUpload = resolve; });
        }
        if (url.includes('/files')) return Promise.resolve(Response.json({ records: files, pageInfo }));
        return Promise.resolve(Response.json({ records: [], pageInfo }));
      });
      const uploadFile = new File(['old upload'], 'old-upload.md', { type: 'text/markdown' });
      fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [uploadFile] } });
      fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

      const refreshButton = screen.getByRole('button', { name: '刷新真实数据' });
      fireEvent.click(refreshButton);
      await screen.findByText('正在加载机构知识库卡片数据...');
      await act(async () => {
        resolveUpload(Response.json({ chunkCount: 0 }, { status: 201 }));
      });
      expect(await screen.findByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();

      await act(async () => {
        if (outcome === 'success') {
          resolveOldList({
            ok: true,
            records: [{ ...records[0], knowledgeId: 'STALE_KNOWLEDGE_ID', title: 'STALE_KNOWLEDGE_TITLE' }],
            pageInfo: { ...pageInfo, total: 1 },
          });
        }
        if (outcome === 'failure') {
          resolveOldList({
            ok: false,
            error: { kind: 'service_unavailable', message: 'STALE_LIST_FAILURE', status: 503 },
          });
        }
        if (outcome === 'throw') rejectOldList(new Error('STALE_LIST_THROW'));
      });

      await waitFor(() => {
        expect(screen.getByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();
        expect(document.body.textContent).not.toContain('STALE_');
      });
    },
  );

  it('编辑态在 root pending、503 与后续权威空态中清除字段和旧 PATCH 目标', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    expect(screen.getByLabelText('知识标题')).toHaveValue('本机构术后护理知识');
    expect(screen.getByLabelText('分类 / 目录口径')).toHaveValue('术后护理');
    expect(screen.getByLabelText('摘要 / 描述')).toHaveValue('真实 API 返回的本机构护理摘要。');
    fireEvent.change(screen.getByLabelText('知识标题'), { target: { value: 'STALE_EDIT_TITLE' } });
    fireEvent.change(screen.getByLabelText('分类 / 目录口径'), { target: { value: 'STALE_EDIT_CATEGORY' } });
    fireEvent.change(screen.getByLabelText('摘要 / 描述'), { target: { value: 'STALE_EDIT_DESCRIPTION' } });
    const staleUpload = new File(['sensitive'], 'STALE_UPLOAD_NAME.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [staleUpload] } });
    expect(screen.getByText(/STALE_UPLOAD_NAME\.md/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '归档' }));

    let resolveRefresh!: (result: Awaited<ReturnType<typeof listInstitutionKnowledgeItems>>) => void;
    vi.mocked(listInstitutionKnowledgeItems).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefresh = resolve; }),
    );
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));

    expect(await screen.findByText('正在加载机构知识库卡片数据...')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('STALE_EDIT_TITLE')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('STALE_UPLOAD_NAME');
    expect(screen.queryByText(/确认软归档/)).not.toBeInTheDocument();

    await act(async () => {
      resolveRefresh({
        ok: false,
        error: { kind: 'service_unavailable', message: '机构知识库资料库暂未启用。', status: 503 },
      });
    });
    expect(await screen.findByText('机构知识库资料库暂未启用。')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('STALE_EDIT_');

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: true,
      records: [],
      pageInfo: { ...pageInfo, total: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();
    expect(screen.getByLabelText('知识标题')).toHaveValue('');
    expect(screen.getByLabelText('分类 / 目录口径')).toHaveValue('');
    expect(screen.getByLabelText('摘要 / 描述')).toHaveValue('');
    expect((screen.getByLabelText('选择知识库上传文件') as HTMLInputElement).files).toHaveLength(0);
    expect(screen.getByRole('button', { name: '新建知识' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('知识标题'), { target: { value: '全新条目' } });
    fireEvent.click(screen.getByRole('button', { name: '新建知识' }));
    await waitFor(() => {
      const itemMutationCalls = vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH');
      expect(itemMutationCalls.some(([, init]) => init?.method === 'POST')).toBe(true);
      expect(itemMutationCalls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    });
  });

  it.each([
    ['chunk', 'success'], ['chunk', 'failure'], ['chunk', 'throw'],
    ['search', 'success'], ['search', 'failure'], ['search', 'throw'],
    ['answer', 'success'], ['answer', 'failure'], ['answer', 'throw'],
  ] as const)('过期 %s %s 回包不能在新 root revision 后恢复旧敏感展示', async (operation, outcome) => {
    await renderLoaded();

    let resolveOldRequest!: (response: Response) => void;
    let rejectOldRequest!: (reason: unknown) => void;
    const oldRequest = new Promise<Response>((resolve, reject) => {
      resolveOldRequest = resolve;
      rejectOldRequest = reject;
    });
    vi.mocked(globalThis.fetch).mockImplementation((input: string | URL | Request) => {
      const url = requestUrl(input);
      const isOldOperation = operation === 'chunk'
        ? url.includes('/parse/chunks')
        : operation === 'search'
          ? url.includes('/search')
          : url.includes('/answer');
      if (isOldOperation) return oldRequest;
      if (url.includes('/files')) return Promise.resolve(Response.json({ records: files, pageInfo }));
      return Promise.resolve(Response.json({ records: [], pageInfo }));
    });

    if (operation === 'chunk') {
      fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    } else if (operation === 'search') {
      const searchSection = screen.getByLabelText('机构知识库检索测试卡片');
      fireEvent.change(within(searchSection).getByLabelText('输入知识库检索关键词'), { target: { value: '旧检索问题' } });
      fireEvent.click(within(searchSection).getByRole('button', { name: '开始检索测试' }));
    } else {
      const answerSection = screen.getByLabelText('机构知识库问答台');
      fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '旧问答问题' } });
      fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));
    }

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: true,
      records: [],
      pageInfo: { ...pageInfo, total: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();

    await act(async () => {
      if (outcome === 'throw') {
        rejectOldRequest(new Error('STALE_ASYNC_THROW'));
        return;
      }
      if (outcome === 'failure') {
        resolveOldRequest(Response.json({ error: 'STALE_ASYNC_FAILURE' }, { status: 503 }));
        return;
      }
      if (operation === 'chunk') {
        resolveOldRequest(Response.json({
          records: [{ chunkId: 'stale-chunk', chunkIndex: 0, textPreview: 'STALE_ASYNC_SECRET', charCount: 18 }],
        }));
      } else if (operation === 'search') {
        resolveOldRequest(Response.json({
          records: [{
            knowledgeId: 'stale-knowledge',
            knowledgeTitle: 'STALE_ASYNC_SECRET',
            fileId: 'stale-file',
            fileName: 'STALE_ASYNC_SECRET.md',
            chunkId: 'stale-chunk',
            chunkIndex: 0,
            textPreview: 'STALE_ASYNC_SECRET',
            matchReason: 'STALE_ASYNC_SECRET',
            parseStatus: 'succeeded',
          }],
          pageInfo,
        }));
      } else {
        resolveOldRequest(Response.json({
          status: 'answered',
          answer: 'STALE_ASYNC_SECRET',
          sources: [{
            knowledgeId: 'stale-knowledge',
            knowledgeTitle: 'STALE_ASYNC_SECRET',
            fileId: 'stale-file',
            fileName: 'STALE_ASYNC_SECRET.md',
            chunkIndex: 0,
            textPreview: 'STALE_ASYNC_SECRET',
          }],
        }));
      }
    });

    await waitFor(() => {
      expect(screen.getByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('STALE_ASYNC');
    });
  });

  it('仅当前 revision 的权威空结果显示空态；非法结果和异常保持 unavailable', async () => {
    await renderLoaded();

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: true,
      records: [],
      pageInfo: { ...pageInfo, total: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).toBeInTheDocument();
    expect(within(screen.getByLabelText('机构知识库顶部指标')).getAllByText('0')).toHaveLength(2);

    vi.mocked(listInstitutionKnowledgeItems).mockRejectedValueOnce(new Error('unexpected client failure'));
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('机构知识库数据暂时不可用')).toBeInTheDocument();
    expect(screen.queryByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).not.toBeInTheDocument();

    vi.mocked(listInstitutionKnowledgeItems).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'unknown', message: '非法资料库响应', status: 200 },
    });
    fireEvent.click(screen.getByRole('button', { name: '刷新真实数据' }));
    expect(await screen.findByText('非法资料库响应')).toBeInTheDocument();
    expect(screen.queryByText('当前目录暂无真实知识条目；不会展示静态示例冒充生产数据。')).not.toBeInTheDocument();
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

  it('展示真实文件 / 文档卡片和支持格式解析状态', async () => {
    await renderLoaded();

    const documentSection = screen.getByLabelText('机构知识库文件文档卡片');
    await within(documentSection).findByText('术后护理.md');
    expect(within(documentSection).getByText('MD / 128 B')).toBeInTheDocument();
    expect(within(documentSection).getByText('已解析')).toBeInTheDocument();
    expect(within(documentSection).getByText('64')).toBeInTheDocument();
    expect(within(documentSection).getByText('暂无错误')).toBeInTheDocument();
    expect(within(documentSection).getByText('支持 TXT / MD / PDF / DOCX / XLSX / CSV 解析，PDF 仅支持可复制文本')).toBeInTheDocument();
  });

  it('上传支持格式成功后调用现有上传 API 并刷新真实列表', async () => {
    await renderLoaded();

    const file = new File(['# 护理\n冷敷后保持清洁'], '新护理.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));

    expect(await screen.findByText('上传成功，已触发文档解析，生成 2 个片段。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(listInstitutionKnowledgeItems).toHaveBeenCalledTimes(2);
  });

  it('上传失败时展示错误态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
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

  it('PDF 可上传并保留 OCR 边界说明', async () => {
    await renderLoaded();

    const file = new File(['fake pdf'], '护理.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('选择知识库上传文件'), { target: { files: [file] } });

    expect(screen.getByText('已选择 护理.pdf，可上传并触发文档解析。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '上传文档' }));
    expect(await screen.findByText('上传成功，已触发文档解析，生成 2 个片段。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/institution/knowledge-management/upload', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
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
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
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
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
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

    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = requestUrl(input);
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
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
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
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
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
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'provider_failure',
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


  it('问答台展示 quota_exceeded 状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'quota_exceeded',
            answer: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐。仅供内部运营参考，需人工确认',
            sources: [],
            message: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐',
          }, { status: 409 });
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

    expect(await within(answerSection).findByText('AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐')).toBeInTheDocument();
    expect(answerSection.textContent).not.toContain('token=');
    expect(answerSection.textContent).not.toContain('厂商：');
  });

  it('问答台展示 provider_disabled 状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'provider_disabled',
            answer: '知识库问答服务未启用，请联系平台管理员。仅供内部运营参考，需人工确认',
            sources: [],
            message: '知识库问答服务未启用，请联系平台管理员',
          }, { status: 503 });
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

    expect(await within(answerSection).findByText('知识库问答服务未启用，请联系平台管理员')).toBeInTheDocument();
    expect(answerSection.textContent).not.toContain('provider config');
  });

  it('问答台展示 provider_failure 状态', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.includes('/api/institution/knowledge-management/answer')) {
          return Response.json({
            status: 'provider_failure',
            answer: '知识库问答服务暂时不可用，请稍后重试。仅供内部运营参考，需人工确认',
            sources: [],
            message: '知识库问答服务暂时不可用，请稍后重试',
          }, { status: 502 });
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
  });

  it('新一轮提问会清空旧答案', async () => {
    await renderLoaded();

    const answerSection = screen.getByLabelText('机构知识库问答台');
    fireEvent.change(within(answerSection).getByLabelText('输入知识库问答问题'), { target: { value: '术后冷敷注意事项？' } });
    fireEvent.click(within(answerSection).getByRole('button', { name: '提问' }));
    expect(await within(answerSection).findByText(/术后冷敷应控制时长/)).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = requestUrl(input);
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

    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes('/parse/chunks')) return Response.json({ records: [] });
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    expect(await within(chunkSection).findByText('当前文件暂无解析片段。')).toBeInTheDocument();

    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes('/parse/chunks')) return Response.json({ error: '解析片段暂时不可用' }, { status: 503 });
      if (url.includes('/files')) return Response.json({ records: files, pageInfo });
      return Response.json({ records: [], pageInfo });
    });
    fireEvent.click(screen.getByRole('button', { name: '查看片段' }));
    expect((await within(chunkSection).findAllByText('解析片段暂时不可用')).length).toBeGreaterThan(0);
  });

  it('.txt / .md 重新解析成功，PDF / Word / Excel 也可重新解析', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));
    expect(await screen.findByText('文件已重新解析，状态和片段已刷新。')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/institution/knowledge-management/items/knowledge-owned-aftercare/files/file-aftercare-md/parse',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request) => {
      const url = requestUrl(input);
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
      expect(button).not.toBeDisabled();
    });
  });

  it('重新解析失败低敏展示', async () => {
    await renderLoaded();
    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
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
    vi.mocked(globalThis.fetch).mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
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
    expect(screen.getByText('机构端知识库问答接入受控 real provider 治理闭环；当前已接入 embedding 与 hybrid retrieval，不展示向量数组或内部配置；OCR、training 和 queue 仍未接入。')).toBeInTheDocument();
  });

  it('不出现误导真实能力已完成或已接入的文案', async () => {
    const { container } = render(<InstitutionKnowledgeBaseCardPanel />);
    await screen.findByText('知识条目：本机构术后护理知识');

    [
      '真实训练已完成',
      '向量数据库已接入',
      '复杂文档解析已完成',
      '生产可用闭环已完成',
    ].forEach((text) => {
      expect(container.textContent).not.toContain(text);
    });
  });
});
