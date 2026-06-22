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
  '受控示例用量',
  '示例用量',
  '智美天工医美智能运营系统',
  'Qwen Plus',
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

function freezeUsageDate() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-22T09:30:00+08:00'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('平台端 AI 模型与用量只读面板', () => {
  it('默认按当前日期展示未接入 AI 用量空态', () => {
    freezeUsageDate();

    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.getByText('用量口径：当前未接入真实 AI 调用日志，费用为 0，不是正式账单。')).toBeInTheDocument();
    expect(screen.getByText('2026年06月22日用量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择 AI 用量日期 2026年06月22日' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出' })).toBeDisabled();
    expect(screen.getByText('暂无真实 AI 用量记录')).toBeInTheDocument();
    expect(screen.getByText('当前未接入真实 AI 调用日志；不会展示预置用量、机构排行或估算账单。')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥0.0000').length).toBeGreaterThan(0);
    expect(screen.queryByText('单日模型费用构成')).not.toBeInTheDocument();
    expect(screen.queryByText('厂商与模型消耗明细')).not.toBeInTheDocument();
    expect(screen.queryByText('机构用量排行')).not.toBeInTheDocument();
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('月份选择弹层保留，但切换月份后仍保持未接入空态', () => {
    freezeUsageDate();

    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    fireEvent.click(screen.getByRole('button', { name: '选择 AI 用量日期 2026年06月22日' }));

    expect(screen.getByRole('dialog', { name: '选择 AI 用量月份' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本月' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '5月' }));

    expect(screen.getByText('2026年05月用量')).toBeInTheDocument();
    expect(screen.getByText('暂无真实 AI 用量记录')).toBeInTheDocument();
    expect(screen.queryByText('Qwen Plus')).not.toBeInTheDocument();
    expect(screen.queryByText('智美天工医美智能运营系统')).not.toBeInTheDocument();
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('页面不展示 Key 配置入口，也不触发 provider 配置读取', () => {
    freezeUsageDate();
    const fetchMock = stubFetch();

    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.queryByRole('heading', { name: '厂商 Key 配置' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument();
    expectNoProviderConfigFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('平台导航可进入 AI用量与费用面板，且不触发 mutation 或高风险入口', async () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    expect(screen.getByRole('button', { name: 'AI模型配置' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI用量与费用' }));

    const bannerHeading = screen.getByRole('heading', { name: 'AI用量与费用' });
    const banner = bannerHeading.closest('[data-platform-banner="true"]');
    expect(banner).not.toBeNull();
    expect(screen.getAllByText(/当前未接入真实 AI 调用日志/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：AI用量与费用' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /测试调用/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /显示 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动扣费/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Runtime 状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dry-run readiness' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('AI 用量账单')).toBeInTheDocument();
    });
    expectNoProviderConfigFetch(fetchMock);
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
