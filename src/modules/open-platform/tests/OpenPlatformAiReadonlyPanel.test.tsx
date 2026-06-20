import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenPlatformAiReadonlyPanel } from '@/modules/open-platform/components/OpenPlatformAiReadonlyPanel';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

const forbiddenText = [
  '同步模型',
  '测试调用',
  '导出账单',
  '账单金额',
  '应收',
  '发票',
  'CSV',
  'PDF',
  'Excel',
  'runtime-auth-redacted-value',
  'DATABASE_URL',
  'postgres://',
  '/Users/',
  'stack',
  'token',
  'secret',
  'credential',
  '测试调用用户 prompt',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'provider-test-key-never-return',
  'vendor-test-key-never-return',
  'test-api-key-for-ui-save',
];

function stubFetch(fetchMock = vi.fn()) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function expectNoForbiddenAiReadonlyContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  forbiddenText.forEach((fragment) => {
    expect(text).not.toContain(fragment);
  });
}

function expectNoMutationFetch(fetchMock: ReturnType<typeof vi.fn>) {
  const mutatingCall = fetchMock.mock.calls.find(([, init]) => {
    const method = String((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  });

  expect(mutatingCall).toBeUndefined();
}

function expectNoProviderConfigFetch(fetchMock: ReturnType<typeof vi.fn>) {
  const providerConfigCall = fetchMock.mock.calls.find(([input]) => (
    String(input).includes('/api/v1/open-platform/provider-configs')
  ));

  expect(providerConfigCall).toBeUndefined();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('平台端 AI 模型与用量只读面板', () => {
  it('展示旧系统用量费用、模型目录与低敏边界，且不展示 Runtime 与 Key 配置卡', () => {
    const fetchMock = stubFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.queryByText('平台端 AI 模型与用量低敏只读基础')).not.toBeInTheDocument();
    expect(screen.queryByText('平台端只读展示 AI 模型目录、能力分组、场景关系和用量费用信息架构；当前不接入真实模型服务，不读取真实机构日志。')).not.toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'AI 模型目录' })).not.toBeInTheDocument();
    expect(screen.queryByText('厂商列表')).not.toBeInTheDocument();
    expect(screen.queryByText('场景默认模型关系')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent 继承关系')).not.toBeInTheDocument();
    expect(screen.queryByText('模型启用状态说明')).not.toBeInTheDocument();
    expect(screen.queryByText('Registry 状态：当前为受控只读示例，不代表生产启用。')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.getByText('用量口径：当前为受控示例用量，费用为估算，不是正式账单。')).toBeInTheDocument();
    expect(screen.getAllByText('AI 用量账单').length).toBeGreaterThan(0);
    expect(screen.getByText('2026年05月用量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出' })).toBeInTheDocument();
    expect(screen.getByText('消耗金额')).toBeInTheDocument();
    expect(screen.getAllByText('¥0.0499').length).toBeGreaterThan(0);
    expect(screen.getAllByText('调用次数').length).toBeGreaterThan(0);
    expect(screen.getByText('49')).toBeInTheDocument();
    expect(screen.getAllByText('Token').length).toBeGreaterThan(0);
    expect(screen.getAllByText('14,959').length).toBeGreaterThan(0);
    expect(screen.getAllByText('成功率').length).toBeGreaterThan(0);
    expect(screen.getAllByText('79.6%').length).toBeGreaterThan(0);
    expect(screen.getByText('峰值日')).toBeInTheDocument();
    expect(screen.getByText('¥0.040')).toBeInTheDocument();
    expect(screen.getByText('每日消耗')).toBeInTheDocument();
    expect(screen.getByText('按模型费用占比堆叠，点击查看单日构成')).toBeInTheDocument();
    expect(screen.getByText('2026-05-19')).toBeInTheDocument();
    expect(screen.getByText('单日模型费用构成')).toBeInTheDocument();
    expect(screen.getByText('Qwen Plus')).toBeInTheDocument();
    expect(screen.getByText('调用 16 次 · Token 10,597')).toBeInTheDocument();
    expect(screen.getByText('Qwen3.6 Plus')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek V4 Flash')).toBeInTheDocument();
    expect(screen.getByText('厂商与模型消耗明细')).toBeInTheDocument();
    expect(screen.getByText('选择上方厂商后查看模型消耗明细')).toBeInTheDocument();
    expect(screen.getByText('总金额 ¥0.0499')).toBeInTheDocument();
    expect(screen.getByText('业务场景消耗')).toBeInTheDocument();
    expect(screen.getByText('统一业务口径，技术来源保留在标签中。')).toBeInTheDocument();
    expect(screen.getByText('机构用量排行')).toBeInTheDocument();
    expect(screen.getByText('点击机构查看场景明细')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '厂商 通义千问' }));
    expect(screen.getByText('通义千问 模型明细')).toBeInTheDocument();
    expect(screen.getByText('输入 Token')).toBeInTheDocument();
    expect(screen.getByText('输出 Token')).toBeInTheDocument();
    expect(screen.getByText('总 Token')).toBeInTheDocument();
    expect(screen.getByText('厂商占比')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /机构 智美天工医美智能运营系统/ }));
    expect(screen.getByText('智美天工医美智能运营系统 场景明细')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Runtime 状态' })).not.toBeInTheDocument();
    expect(screen.queryByText('env-only')).not.toBeInTheDocument();
    expect(screen.queryByText('真实调用已禁用。dry-run readiness 检查厂商配置完整性，不解密 Key、不外呼厂商 API。')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dry-run readiness' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '厂商 Key 配置' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '能力覆盖矩阵' })).not.toBeInTheDocument();
    expect(screen.queryByText('只读覆盖关系')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /覆盖：文本生成/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /覆盖：推理判断/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /覆盖：视觉理解/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /覆盖：向量模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '安全边界清单' })).not.toBeInTheDocument();
    expect(screen.queryByText('全部未启用')).not.toBeInTheDocument();
    expect(screen.queryByText('API Key 管理')).not.toBeInTheDocument();
    expect(screen.queryByText('厂商模型同步')).not.toBeInTheDocument();

    expectNoProviderConfigFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('厂商与模型明细区月份入口也打开旧系统月份弹层', () => {
    render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('button', { name: '选择厂商模型消耗月份 2026年05月' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择厂商模型消耗月份 2026年05月' }));

    expect(screen.getByRole('dialog', { name: '选择 AI 用量月份' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本月' })).toBeInTheDocument();
  });

  it('页面不展示 encryptedApiKey/ciphertext/authTag/iv，也不展示 Key 配置入口', () => {
    const { container } = render(<OpenPlatformAiReadonlyPanel />);
    expect(container.textContent).not.toContain('encryptedApiKey');
    expect(container.textContent).not.toContain('ciphertext');
    expect(container.textContent).not.toContain('authTag');
    expect(container.textContent).not.toContain('iv');
    expect(screen.queryByRole('heading', { name: '厂商 Key 配置' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
  });

  it('月份选择弹层按旧系统样式展示并支持受控月份切换到空状态', () => {
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('button', { name: '选择 AI 用量月份 2026年05月' })).toBeInTheDocument();
    expect(screen.getByText('2026年05月用量')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择 AI 用量月份 2026年05月' }));
    expect(screen.getByRole('dialog', { name: '选择 AI 用量月份' })).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本月' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '6月' }));

    expect(screen.getByText('暂无受控示例用量')).toBeInTheDocument();
    expect(screen.getByText('2026年06月为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥0.0000').length).toBeGreaterThan(0);
    expect(screen.queryByText('智美天工医美智能运营系统')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Runtime 状态' })).not.toBeInTheDocument();
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('平台导航可进入 人工智能示例用量面板，且不触发 mutation 或高风险入口', async () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    expect(screen.getByRole('button', { name: '人工智能模型配置' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '人工智能示例用量' }));

    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.queryByText('平台端 AI 模型与用量低敏只读基础')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：人工智能示例用量' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /测试调用/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /显示 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动扣费/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Runtime 状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dry-run readiness' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '厂商 Key 配置' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('AI 用量账单')).toBeInTheDocument();
    });
    expectNoProviderConfigFetch(fetchMock);
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
