import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenPlatformAiReadonlyPanel } from '@/modules/open-platform/components/OpenPlatformAiReadonlyPanel';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const usageRecord = {
  id: 'usage-001',
  tenantId: 'tenant-001',
  tenantName: '星澜医美',
  status: 'succeeded',
  errorCode: null,
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  promptTokens: 120,
  completionTokens: 80,
  totalTokens: 200,
  aiCreditsConsumed: 2,
  meteringStatus: 'metered',
  meteringVersion: 'v06-ui-verify-test',
  createdAt: '2026-06-30T08:00:00.000Z',
  knowledgeContextUsed: true,
  sourceCount: 1,
  apiKey: 'sk_test_should_not_render',
  baseUrl: 'https://provider.example.test',
  Authorization: 'Bearer should-not-render',
  prompt: '用户 prompt 不应展示',
  answer: 'answer 不应展示',
  rawResponse: { unsafe: true },
  signedUrl: 'https://signed.example.test',
  storageKey: 'storage/raw/key',
};

function usagePayload(records: unknown[] = [usageRecord]) {
  return {
    requestId: 'platform-ai-usage-credits',
    readonly: true,
    dataSource: 'repository',
    summary: {
      totalCalls: records.length,
      succeededCalls: records.length,
      failedCalls: 0,
      meteredCalls: records.length,
      pendingCalls: 0,
      notBillableCalls: 0,
      totalAiCreditsConsumed: records.length * 2,
    },
    records,
    emptyState: {
      title: '暂无 AI 用量明细',
      description: '当前过滤条件下没有 AI 调用记录。',
    },
  };
}

function mockUsageFetch(options: { records?: unknown[]; status?: number; pending?: boolean } = {}) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const path = fetchPath(input);
    if (!path.startsWith('/api/open-platform/ai-usage-credits')) {
      throw new Error(`没有为 ${path} 配置 fetch mock`);
    }
    if (options.pending) return new Promise<Response>(() => {});
    if (options.status && options.status >= 400) {
      return jsonResponse({ errorCode: 'AI_USAGE_CREDITS_UNAVAILABLE' }, { status: options.status });
    }
    const records = options.records ?? [usageRecord];
    return jsonResponse(usagePayload(records));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectNoSensitiveContent(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/sk_test_should_not_render|apiKey|baseUrl|Authorization|Cookie|用户 prompt|answer 不应展示|rawResponse|signedUrl|storageKey/i);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenPlatformAiReadonlyPanel AI usage credits details', () => {
  it('展示 loading 状态', () => {
    mockUsageFetch({ pending: true });

    render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByText('正在加载 AI 用量与 Credits 明细...')).toBeInTheDocument();
  });

  it('展示汇总卡片和明细表格低敏字段', async () => {
    const fetchMock = mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: 'AI 用量与 Credits 明细' })).toBeInTheDocument();
    expect(screen.getByText('总调用')).toBeInTheDocument();
    expect(screen.getByText('Credits 消耗')).toBeInTheDocument();
    expect(screen.getByText('星澜医美')).toBeInTheDocument();
    expect(screen.getByText('deepseek')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument();
    expect(screen.getByText('v06-ui-verify-test')).toBeInTheDocument();
    expect(screen.getByText('使用知识库 · 1 个来源')).toBeInTheDocument();
    expect(screen.getAllByText('已计量').length).toBeGreaterThan(0);
    expect(screen.getByText('已按当前规则计算 AI Credits。')).toBeInTheDocument();
    expectNoSensitiveContent(container);
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/ai-usage-credits?limit=50', { cache: 'no-store' });
  });

  it('展示 empty 状态', async () => {
    mockUsageFetch({ records: [] });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('暂无 AI 用量明细')).toBeInTheDocument();
    expect(screen.getByText('当前过滤条件下没有 AI 调用记录。')).toBeInTheDocument();
  });

  it('展示错误状态', async () => {
    mockUsageFetch({ status: 503 });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('明细列表暂不可用。')).toBeInTheDocument();
    expect(screen.getByText('AI 用量与 Credits 明细服务暂不可用，请稍后重试。')).toBeInTheDocument();
  });

  it('支持筛选和刷新且不触发 mutation', async () => {
    const fetchMock = mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('星澜医美')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('tenantId'), { target: { value: 'tenant-001' } });
    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'succeeded' } });
    fireEvent.change(screen.getByLabelText('meteringStatus'), { target: { value: 'metered' } });
    fireEvent.change(screen.getByLabelText('provider'), { target: { value: 'deepseek' } });
    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'deepseek-v4-flash' } });
    fireEvent.change(screen.getByLabelText('dateFrom'), { target: { value: '2026-06-30T00:00' } });
    fireEvent.change(screen.getByLabelText('dateTo'), { target: { value: '2026-06-30T23:59' } });
    fireEvent.change(screen.getByLabelText('limit'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('tenantId=tenant-001'))).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('meteringStatus=metered'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(fetchMock.mock.calls.some(([, init]) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(init?.method ?? 'GET').toUpperCase()))).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => /provider-config|smoke|ai-runtime/u.test(fetchPath(input)))).toBe(false);
  });
});
