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
    expect(screen.getByText('查看各机构知识训练、命中表现、导入概况和高频问题。')).toBeInTheDocument();
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
    expect(screen.getAllByText('训练覆盖')[0]).toBeInTheDocument();
    expect(screen.getByText('待优化')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '机构概况' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '运营信号' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '机构上传文件' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '分类表现' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '高频问题' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识条目' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '导入与训练任务' })).toBeInTheDocument();

    expectNoRawRuntimeError(container);
    expect(container.textContent).not.toContain('上传新文件');
    expect(container.textContent).not.toContain('真实下载');
    expect(container.textContent).not.toContain('开始训练');
    expect(container.textContent).not.toContain('CSV 导出');
    expect(screen.queryByRole('button', { name: /上传|下载|导出|训练|新增|编辑|删除/ })).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('a[download]')).toBeNull();
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
