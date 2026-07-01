import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function stubFetch(fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 404 }))) {
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
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-22T09:30:00+08:00'));
}

beforeEach(() => {
  freezeUsageDate();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('平台端 AI 模型与用量只读面板', () => {
  it('默认展示 AI 用量账单空态', async () => {
    const fetchMock = stubFetch(vi.fn(async () => new Response(JSON.stringify({
      requestId: 'platform-ai-usage-credits',
      readonly: true,
      dataSource: 'repository',
      summary: {
        totalCalls: 0,
        succeededCalls: 0,
        failedCalls: 0,
        meteredCalls: 0,
        pendingCalls: 0,
        notBillableCalls: 0,
        totalAiCreditsConsumed: 0,
      },
      aggregations: {
        byModel: [],
        byTenant: [],
        byMeteringStatus: [],
        byDate: [],
        byDateProvider: [],
        byDateProviderModel: [],
      },
      filterOptions: {
        providers: [],
        models: [],
        tenants: [],
        statuses: ['succeeded', 'failed'],
        meteringStatuses: ['metered', 'pending', 'not_billable', 'legacy', 'empty'],
      },
      records: [],
      emptyState: {
        title: '暂无 AI 用量明细',
        description: '当前过滤条件下没有 AI 调用记录。',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByText('AI 用量账单')).toBeInTheDocument();
    expect(screen.getByText(/当前以 AI 积分消耗替代费用主指标/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '总览' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('暂无厂商 / 模型消耗卡片数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '明细记录' }));
    expect(screen.getByText('暂无 AI 用量明细')).toBeInTheDocument();
    expect(screen.getByText('当前过滤条件下没有 AI 调用记录。')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '明细记录' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('厂商 Key 配置')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/ai-usage-credits?dateFrom=2026-05-31T16%3A00%3A00.000Z&dateTo=2026-06-30T15%3A59%3A00.000Z&limit=50', { cache: 'no-store' });
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('刷新仍保持只读且不触发 mutation', async () => {
    const fetchMock = stubFetch(vi.fn(async () => new Response(JSON.stringify({
      requestId: 'platform-ai-usage-credits',
      readonly: true,
      dataSource: 'repository',
      summary: {
        totalCalls: 0,
        succeededCalls: 0,
        failedCalls: 0,
        meteredCalls: 0,
        pendingCalls: 0,
        notBillableCalls: 0,
        totalAiCreditsConsumed: 0,
      },
      aggregations: {
        byModel: [],
        byTenant: [],
        byMeteringStatus: [],
        byDate: [],
        byDateProvider: [],
        byDateProviderModel: [],
      },
      filterOptions: {
        providers: [],
        models: [],
        tenants: [],
        statuses: ['succeeded', 'failed'],
        meteringStatuses: ['metered', 'pending', 'not_billable', 'legacy', 'empty'],
      },
      records: [],
      emptyState: {
        title: '暂无 AI 用量明细',
        description: '当前过滤条件下没有 AI 调用记录。',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('暂无厂商 / 模型消耗卡片数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '明细记录' }));
    expect(screen.getByText('暂无 AI 用量明细')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expectNoMutationFetch(fetchMock);
    expectNoProviderConfigFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('页面不展示 Key 配置入口，也不触发 provider 配置读取', async () => {
    const fetchMock = stubFetch();

    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('明细列表暂不可用。')).toBeInTheDocument();
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
    expect(screen.queryByText(/当前未接入真实 AI 调用日志/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：AI用量与费用' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /测试调用/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /显示 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动扣费/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Runtime 状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dry-run readiness' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('明细列表暂不可用。')).toBeInTheDocument();
    });
    expectNoProviderConfigFetch(fetchMock);
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
