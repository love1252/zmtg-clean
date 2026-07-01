import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const hasRecords = records.length > 0;

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
    aggregations: {
      byModel: hasRecords ? [
        {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          totalCalls: 3,
          succeededCalls: 2,
          failedCalls: 1,
          meteredCalls: 2,
          totalTokens: 600,
          totalAiCreditsConsumed: 6,
        },
        {
          provider: 'moonshot',
          model: 'moonshot-v1-8k',
          totalCalls: 2,
          succeededCalls: 2,
          failedCalls: 0,
          meteredCalls: 2,
          totalTokens: 300,
          totalAiCreditsConsumed: 4,
        },
        {
          provider: 'unknown',
          model: 'pre_call_safety_check',
          totalCalls: 1,
          succeededCalls: 1,
          failedCalls: 0,
          meteredCalls: 0,
          totalTokens: 0,
          totalAiCreditsConsumed: 0,
        },
      ] : [],
      byTenant: hasRecords ? [{
        tenantId: 'tenant-001',
        tenantName: '星澜医美',
        totalCalls: 3,
        succeededCalls: 2,
        failedCalls: 1,
        meteredCalls: 2,
        pendingCalls: 1,
        notBillableCalls: 0,
        totalTokens: 600,
        totalAiCreditsConsumed: 6,
      }] : [],
      byMeteringStatus: hasRecords ? [
        { meteringStatus: 'metered', calls: 2, totalAiCreditsConsumed: 6 },
        { meteringStatus: 'empty', calls: 1, totalAiCreditsConsumed: 0 },
      ] : [],
      byDate: hasRecords ? [{
        date: '2026-06-30',
        totalCalls: 3,
        succeededCalls: 2,
        failedCalls: 1,
        totalAiCreditsConsumed: 6,
      }] : [],
      byDateProvider: hasRecords ? [
        {
          date: '2026-06-29',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          totalCalls: 1,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        },
        {
          date: '2026-06-30',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          totalCalls: 3,
          totalTokens: 600,
          totalAiCreditsConsumed: 6,
        },
        {
          date: '2026-06-30',
          provider: 'moonshot',
          providerDisplayName: 'Kimi',
          totalCalls: 2,
          totalTokens: 300,
          totalAiCreditsConsumed: 4,
        },
      ] : [],
      byDateProviderModel: hasRecords ? [
        {
          date: '2026-06-29',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          model: 'deepseek-v4-flash',
          modelDisplayName: 'DeepSeek V4 Flash',
          totalCalls: 1,
          succeededCalls: 1,
          failedCalls: 0,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        },
        {
          date: '2026-06-30',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          model: 'deepseek-v4-flash',
          modelDisplayName: 'DeepSeek V4 Flash',
          totalCalls: 3,
          succeededCalls: 2,
          failedCalls: 1,
          totalTokens: 600,
          totalAiCreditsConsumed: 6,
        },
        {
          date: '2026-06-30',
          provider: 'moonshot',
          providerDisplayName: 'Kimi',
          model: 'moonshot-v1-8k',
          modelDisplayName: 'Kimi 8K',
          totalCalls: 2,
          succeededCalls: 2,
          failedCalls: 0,
          totalTokens: 300,
          totalAiCreditsConsumed: 4,
        },
      ] : [],
      byServiceProject: hasRecords ? [
        {
          serviceCategory: 'ai_conversation',
          serviceName: 'AI 问答',
          serviceSource: 'platform_console',
          serviceAction: 'chat_completion',
          serviceVersion: 'v1',
          totalCalls: 8,
          succeededCalls: 6,
          failedCalls: 2,
          meteredCalls: 5,
          pendingCalls: 2,
          notBillableCalls: 1,
          totalTokens: 1200,
          totalAiCreditsConsumed: 18,
        },
        {
          serviceCategory: 'knowledge_base',
          serviceName: '知识库问答',
          serviceSource: 'rag_console',
          serviceAction: 'answer_with_context',
          serviceVersion: 'v2',
          totalCalls: 4,
          succeededCalls: 4,
          failedCalls: 0,
          meteredCalls: 4,
          pendingCalls: 0,
          notBillableCalls: 0,
          totalTokens: 900,
          totalAiCreditsConsumed: 10,
        },
        {
          serviceCategory: 'unknown',
          serviceName: '未归因服务',
          serviceSource: null,
          serviceAction: null,
          serviceVersion: null,
          totalCalls: 2,
          succeededCalls: 1,
          failedCalls: 1,
          meteredCalls: 0,
          pendingCalls: 1,
          notBillableCalls: 1,
          totalTokens: 100,
          totalAiCreditsConsumed: 0,
        },
      ] : [],
    },
    filterOptions: {
      providers: [
        {
          provider: 'deepseek',
          displayName: 'DeepSeek',
          logoUrl: '/ai-vendor-logos/deepseek.svg',
          logoText: 'D',
          logoClassName: 'bg-emerald-600',
          source: 'system',
        },
        {
          provider: 'moonshot',
          displayName: 'Kimi',
          logoUrl: '/ai-vendor-logos/kimi.svg',
          logoText: 'K',
          logoClassName: 'bg-slate-900',
          source: 'history',
        },
        {
          provider: 'unknown',
          displayName: null,
          logoUrl: null,
          logoText: 'U',
          logoClassName: 'bg-slate-500',
          source: 'history',
        },
      ],
      models: [
        {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          displayName: 'DeepSeek V4 Flash',
          providerDisplayName: 'DeepSeek',
          logoUrl: '/ai-vendor-logos/deepseek.svg',
          logoText: 'D',
          logoClassName: 'bg-emerald-600',
          source: 'system',
        },
        {
          provider: 'moonshot',
          model: 'moonshot-v1-8k',
          displayName: 'Kimi 8K',
          providerDisplayName: 'Kimi',
          logoUrl: '/ai-vendor-logos/kimi.svg',
          logoText: 'K',
          logoClassName: 'bg-slate-900',
          source: 'history',
        },
        {
          provider: 'unknown',
          model: 'pre_call_safety_check',
          displayName: null,
          providerDisplayName: null,
          logoUrl: null,
          logoText: 'U',
          logoClassName: 'bg-slate-500',
          source: 'history',
        },
      ],
      tenants: [
        { tenantId: 'tenant-001', tenantName: '星澜医美' },
        { tenantId: 'tenant-history', tenantName: null },
      ],
      statuses: ['succeeded', 'failed', 'provider_unavailable'],
      meteringStatuses: ['metered', 'pending', 'not_billable', 'legacy', 'empty'],
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
  expect(text).not.toMatch(/sk_test_should_not_render|apiKey|encryptedApiKey|ciphertext|authTag|baseUrl|Authorization|Cookie|用户 prompt|answer 不应展示|rawResponse|signedUrl|storageKey/i);
}

function selectAiUsageTab(label: string) {
  fireEvent.click(screen.getByRole('tab', { name: label }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-22T09:30:00+08:00'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('OpenPlatformAiReadonlyPanel AI usage credits details', () => {
  it('AI 用量与费用筛选区使用中文字段 label 且保留真实模型值', async () => {
    mockUsageFetch({
      records: [
        usageRecord,
        {
          ...usageRecord,
          id: 'usage-002',
          tenantName: '澜星医美',
          status: 'failed',
          errorCode: 'PROVIDER_TIMEOUT',
          aiCreditsConsumed: 0,
          meteringStatus: 'pending',
          meteringVersion: null,
          knowledgeContextUsed: false,
          sourceCount: 0,
        },
        {
          ...usageRecord,
          id: 'usage-003',
          tenantName: '青岚医美',
          status: 'provider_unavailable',
          errorCode: 'PROVIDER_UNAVAILABLE',
          aiCreditsConsumed: 0,
          meteringStatus: 'not_billable',
          meteringVersion: null,
          knowledgeContextUsed: false,
          sourceCount: 0,
        },
      ],
    });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '总览' })).toHaveAttribute('aria-selected', 'true');
    selectAiUsageTab('明细记录');
    ['租户', '调用状态', '计量状态', '模型厂商', '模型名称', '返回条数'].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    ['tenantId', 'status', 'meteringStatus', 'provider', 'model', 'limit'].forEach((label) => {
      expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek-v4-flash').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已计量').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待计量').length).toBeGreaterThan(0);
    expect(screen.getAllByText('不计费').length).toBeGreaterThan(0);
    expect(screen.getByText('已按当前规则计算 AI 积分。')).toBeInTheDocument();
    expect(screen.getByText('缺少有效规则或 Token 数据，暂待后续处理。')).toBeInTheDocument();
    expect(screen.getByText('调用未成功或不满足计费条件，AI 积分记为 0。')).toBeInTheDocument();
    expect(screen.queryByText('metered', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('pending', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('not_billable', { exact: true })).not.toBeInTheDocument();
  });

  it('展示 loading 状态', () => {
    mockUsageFetch({ pending: true });

    render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByText('正在加载 AI 用量与积分明细...')).toBeInTheDocument();
  });

  it('展示汇总卡片和明细表格低敏字段', async () => {
    const fetchMock = mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getAllByText('调用次数').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI 积分消耗').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek-v4-flash').length).toBeGreaterThan(0);
    selectAiUsageTab('明细记录');
    expect(screen.getAllByText('星澜医美').length).toBeGreaterThan(0);
    expect(screen.getByText('v06-ui-verify-test')).toBeInTheDocument();
    expect(screen.getByText('使用知识库 · 1 个来源')).toBeInTheDocument();
    expect(screen.getAllByText('已计量').length).toBeGreaterThan(0);
    expect(screen.getByText('已按当前规则计算 AI 积分。')).toBeInTheDocument();
    expectNoSensitiveContent(container);
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/ai-usage-credits?dateFrom=2026-05-31T16%3A00%3A00.000Z&dateTo=2026-06-30T15%3A59%3A00.000Z&limit=50', { cache: 'no-store' });
  });

  it('默认展示总览并可切换模型、租户、服务项目、计量状态和明细记录标签页', async () => {
    const fetchMock = mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '总览' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('账单摘要')).toBeInTheDocument();
    expect(screen.getByText('单日模型消耗构成')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '每日消耗' })).toBeInTheDocument();
    expect(screen.getByText('按日期查看 AI 用量趋势')).toBeInTheDocument();
    expect(screen.getAllByText('06-30').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '厂商 / 模型消耗' })).toBeInTheDocument();

    selectAiUsageTab('模型与厂商');
    expect(screen.getByRole('tab', { name: '模型与厂商' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '模型用量统计' })).toBeInTheDocument();
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek-v4-flash').length).toBeGreaterThan(0);

    selectAiUsageTab('租户用量');
    expect(screen.getByRole('tab', { name: '租户用量' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '机构 / 租户用量排行' })).toBeInTheDocument();
    expect(screen.getAllByText('Token 总量').length).toBeGreaterThan(0);
    expect(screen.getAllByText('600').length).toBeGreaterThan(0);
    expect(screen.getAllByText('星澜医美').length).toBeGreaterThan(0);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getAllByText('成功率').length).toBeGreaterThan(0);
    expect(screen.getByText('待计量 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '筛选租户 星澜医美' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('tenantId=tenant-001'))).toBe(true);
    });

    selectAiUsageTab('服务项目');
    expect(screen.getByRole('tab', { name: '服务项目' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '服务项目消耗排行' })).toBeInTheDocument();
    expect(screen.getAllByText('AI 问答').length).toBeGreaterThan(0);
    expect(screen.getAllByText('知识库问答').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未归因服务').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ai_conversation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('knowledge_base').length).toBeGreaterThan(0);
    expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('platform_console').length).toBeGreaterThan(0);
    expect(screen.getAllByText('chat_completion').length).toBeGreaterThan(0);
    expect(screen.getAllByText('v1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('调用 8')).toBeInTheDocument();
    expect(screen.getByText('Token 1,200')).toBeInTheDocument();
    expect(screen.getAllByText('AI 积分 18').length).toBeGreaterThan(0);
    expect(screen.getByText('成功率 75.0%')).toBeInTheDocument();
    expect(screen.getAllByText('已计量 5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待计量 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('不计费 1').length).toBeGreaterThan(0);
    expect(container.textContent ?? '').not.toMatch(/¥|RMB|人民币金额|真实成本|用户 prompt|answer 不应展示|rawResponse|metadata|meteringDetails/u);

    selectAiUsageTab('计量状态');
    expect(screen.getByRole('tab', { name: '计量状态' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '计量状态统计' })).toBeInTheDocument();
    expect(screen.getAllByText('未计量').length).toBeGreaterThan(0);

    selectAiUsageTab('明细记录');
    expect(screen.getByRole('tab', { name: '明细记录' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('明细列表')).toBeInTheDocument();
    expect(screen.getByLabelText('模型厂商')).toBeInTheDocument();
    expect(screen.queryByText('byModel')).not.toBeInTheDocument();
    expect(screen.queryByText('totalAiCreditsConsumed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出（后置）' })).toBeDisabled();
    expectNoSensitiveContent(container);
  });

  it('展示 empty 状态', async () => {
    mockUsageFetch({ records: [] });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByText('暂无厂商 / 模型消耗卡片数据')).toBeInTheDocument();
    expect(screen.getByText('暂无日期用量趋势数据')).toBeInTheDocument();
    selectAiUsageTab('服务项目');
    expect(screen.getByText('暂无服务项目消耗数据')).toBeInTheDocument();
    selectAiUsageTab('明细记录');
    expect(screen.getByText('暂无 AI 用量明细')).toBeInTheDocument();
    expect(screen.getByText('当前过滤条件下没有 AI 调用记录。')).toBeInTheDocument();
  });

  it('展示错误状态', async () => {
    mockUsageFetch({ status: 503 });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('明细列表暂不可用。')).toBeInTheDocument();
    expect(screen.getByText('AI 用量与积分明细服务暂不可用，请稍后重试。')).toBeInTheDocument();
  });

  it('筛选区使用自定义候选浮层、模型级联和手动输入能力', async () => {
    const fetchMock = mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    selectAiUsageTab('明细记录');
    const tenantInput = screen.getByLabelText('租户');
    const providerInput = screen.getByLabelText('模型厂商');
    const modelInput = screen.getByLabelText('模型名称');

    expect(tenantInput).not.toHaveAttribute('list');
    expect(providerInput).not.toHaveAttribute('list');
    expect(modelInput).not.toHaveAttribute('list');
    expect(container.querySelector('datalist')).toBeNull();
    expect(screen.getByText('可选择候选，也可手动输入历史租户ID。')).toBeInTheDocument();
    expect(screen.getByText('选择厂商后仅展示该厂商模型；仍可手动输入。')).toBeInTheDocument();

    fireEvent.focus(providerInput);
    expect(await screen.findByRole('listbox', { name: '模型厂商候选项' })).toBeInTheDocument();
    expect(screen.getAllByText('DeepSeek').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getByText('系统值')).toBeInTheDocument();

    fireEvent.change(providerInput, { target: { value: 'moon' } });
    expect(screen.getAllByText('Kimi').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('option', { name: /Kimi/ }));
    expect(providerInput).toHaveValue('Kimi');

    fireEvent.focus(modelInput);
    const modelListbox = await screen.findByRole('listbox', { name: '模型名称候选项' });
    expect(modelListbox).toBeInTheDocument();
    expect(within(modelListbox).getAllByText('Kimi 8K').length).toBeGreaterThan(0);
    expect(within(modelListbox).getAllByText(/moonshot-v1-8k/).length).toBeGreaterThan(0);
    expect(within(modelListbox).queryByText('DeepSeek V4 Flash')).not.toBeInTheDocument();

    fireEvent.keyDown(modelInput, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox', { name: '模型名称候选项' })).not.toBeInTheDocument());

    fireEvent.focus(tenantInput);
    expect(await screen.findByRole('listbox', { name: '租户候选项' })).toBeInTheDocument();
    expect(screen.getAllByText('星澜医美').length).toBeGreaterThan(0);
    expect(screen.getAllByText('tenant-001').length).toBeGreaterThan(0);
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('listbox', { name: '租户候选项' })).not.toBeInTheDocument());

    fireEvent.change(modelInput, { target: { value: 'legacy-manual-model' } });
    fireEvent.change(tenantInput, { target: { value: 'tenant-history' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('provider=moonshot'))).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('model=legacy-manual-model'))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('tenantId=tenant-history'))).toBe(true);
  });

  it('优化模型厂商和模型名称已选态并支持重新选择候选', async () => {
    mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    selectAiUsageTab('明细记录');
    const providerInput = screen.getByLabelText('模型厂商');
    const modelInput = screen.getByLabelText('模型名称');

    fireEvent.focus(providerInput);
    fireEvent.click(screen.getByRole('option', { name: /DeepSeek/ }));
    expect(providerInput).toHaveValue('DeepSeek');
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getByText('系统值')).toBeInTheDocument();

    fireEvent.focus(providerInput);
    expect(await screen.findByRole('listbox', { name: '模型厂商候选项' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Kimi/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Kimi/ }));
    expect(providerInput).toHaveValue('Kimi');
    expect(screen.getAllByText('moonshot').length).toBeGreaterThan(0);

    fireEvent.focus(modelInput);
    expect(await screen.findByRole('listbox', { name: '模型名称候选项' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Kimi 8K/ }));
    expect(modelInput).toHaveValue('Kimi 8K');
    expect(screen.getAllByText(/moonshot-v1-8k/).length).toBeGreaterThan(0);

    fireEvent.focus(modelInput);
    expect(await screen.findByRole('listbox', { name: '模型名称候选项' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Kimi 8K/ })).toBeInTheDocument();
    fireEvent.change(providerInput, { target: { value: '' } });
    fireEvent.focus(modelInput);
    expect(screen.getByRole('option', { name: /DeepSeek V4 Flash/ })).toBeInTheDocument();
  });

  it('日期趋势图支持指标切换、厂商分色图例、中文提示和厂商联动筛选', async () => {
    const fetchMock = mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '每日消耗' })).toBeInTheDocument();
    expect(screen.getByText('按日期查看 AI 用量趋势')).toBeInTheDocument();
    expect(screen.getByText('X 轴为日期，Y 轴为当前指标；柱体按厂商稳定分色堆叠，点击厂商分段可联动筛选。')).toBeInTheDocument();
    expect(screen.getByText('Y 轴：调用次数')).toBeInTheDocument();
    expect(screen.getAllByText('06-29').length).toBeGreaterThan(0);
    expect(screen.getAllByText('06-30').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '筛选趋势图厂商 DeepSeek' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '筛选趋势图厂商 Kimi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2026-06-30 · DeepSeek · 调用次数 3/ })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Token 总量' })[0]);
    expect(screen.getByText('Y 轴：Token 总量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2026-06-30 · Kimi · Token 总量 300/ })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'AI 积分消耗' })[0]);
    expect(screen.getByText('Y 轴：AI 积分消耗')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2026-06-30 · DeepSeek · AI 积分消耗 6/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2026-06-30 · Kimi · AI 积分消耗 4/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('provider=moonshot'))).toBe(true);
    });
    selectAiUsageTab('明细记录');
    expect(screen.getByLabelText('模型厂商')).toHaveValue('Kimi');
    expect(screen.queryByText(/人民币|费用金额|真实成本/)).not.toBeInTheDocument();
    expectNoSensitiveContent(container);
  });

  it('单日模型消耗构成默认选中高积分日期并支持点击趋势日期切换', async () => {
    mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '单日模型消耗构成' })).toBeInTheDocument();
    const composition = screen.getByRole('heading', { name: '单日模型消耗构成' }).closest('section');
    expect(composition).not.toBeNull();
    const compositionScope = within(composition as HTMLElement);

    expect(compositionScope.getByText('当前日期：')).toBeInTheDocument();
    expect(compositionScope.getByText('2026/06/30')).toBeInTheDocument();
    expect(compositionScope.getByText('DeepSeek V4 Flash')).toBeInTheDocument();
    expect(compositionScope.getByText('Kimi 8K')).toBeInTheDocument();
    expect(compositionScope.getAllByText(/AI 积分|积分/).length).toBeGreaterThan(0);
    expect(compositionScope.getByText('占比 60.0%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择日期 2026-06-29' }));

    expect(compositionScope.getByText('2026/06/29')).toBeInTheDocument();
    expect(compositionScope.getByText('DeepSeek V4 Flash')).toBeInTheDocument();
    expect(compositionScope.queryByText('Kimi 8K')).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/¥|RMB|人民币金额|真实成本/u);
    expectNoSensitiveContent(container);
  });

  it('全局时间范围变化后日期趋势图同步使用最新聚合数据', async () => {
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const path = fetchPath(input);
      const payload = usagePayload([usageRecord]);
      if (path.includes('dateFrom=2026-06-21T16%3A00%3A00.000Z')) {
        return jsonResponse({
          ...payload,
          aggregations: {
            ...payload.aggregations,
            byDateProvider: [{
              date: '2026-06-22',
              provider: 'moonshot',
              providerDisplayName: 'Kimi',
              totalCalls: 5,
              totalTokens: 900,
              totalAiCreditsConsumed: 8,
            }],
            byDateProviderModel: [{
              date: '2026-06-22',
              provider: 'moonshot',
              providerDisplayName: 'Kimi',
              model: 'moonshot-v1-8k',
              modelDisplayName: 'Kimi 8K',
              totalCalls: 5,
              succeededCalls: 5,
              failedCalls: 0,
              totalTokens: 900,
              totalAiCreditsConsumed: 8,
            }],
          },
        });
      }
      return jsonResponse(payload);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<OpenPlatformAiReadonlyPanel />);

    expect((await screen.findAllByText('06-30')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '今日' }));

    expect((await screen.findAllByText('06-22')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryAllByText('06-30')).toHaveLength(0));
    expect(screen.getByRole('button', { name: /2026-06-22 · Kimi · 调用次数 5/ })).toBeInTheDocument();
  });

  it('日期趋势图无数据时显示中文空状态', async () => {
    mockUsageFetch({ records: [] });
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '每日消耗' })).toBeInTheDocument();
    expect(screen.getByText('暂无日期用量趋势数据')).toBeInTheDocument();
  });

  it('厂商与模型卡片支持指标切换、点击联动和空状态', async () => {
    const fetchMock = mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '厂商 / 模型消耗' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '调用次数' })[1]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getAllByRole('button', { name: 'Token 总量' })[1]);
    expect(screen.getAllByRole('button', { name: 'Token 总量' })[1]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getAllByRole('button', { name: 'AI 积分消耗' })[1]);
    expect(screen.getAllByRole('button', { name: 'AI 积分消耗' })[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/调用 3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Token 600/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/积分 6/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '筛选厂商 Kimi' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('provider=moonshot'))).toBe(true);
    });
    selectAiUsageTab('明细记录');
    expect(screen.getByLabelText('模型厂商')).toHaveValue('Kimi');
    selectAiUsageTab('总览');

    fireEvent.click(screen.getByRole('button', { name: '筛选模型 DeepSeek V4 Flash' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('provider=deepseek'))).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('model=deepseek-v4-flash'))).toBe(true);
    selectAiUsageTab('明细记录');
    expect(screen.getByLabelText('模型名称')).toHaveValue('DeepSeek V4 Flash');
  });

  it('选中厂商后展示该厂商模型明细表且不出现费用字段', async () => {
    mockUsageFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '厂商 / 模型消耗' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '筛选厂商 DeepSeek' }));

    const detailsTable = await screen.findByRole('table', { name: '选中厂商模型明细表' });
    expect(screen.getByRole('heading', { name: 'DeepSeek 模型明细' })).toBeInTheDocument();
    expect(within(detailsTable).getByText('厂商名称')).toBeInTheDocument();
    expect(within(detailsTable).getByText('模型名称')).toBeInTheDocument();
    expect(within(detailsTable).getByText('model code')).toBeInTheDocument();
    expect(within(detailsTable).getByText('调用次数')).toBeInTheDocument();
    expect(within(detailsTable).getByText('Token 总量')).toBeInTheDocument();
    expect(within(detailsTable).getByText('AI 积分消耗')).toBeInTheDocument();
    expect(within(detailsTable).getByText('成功率')).toBeInTheDocument();
    expect(within(detailsTable).getByText('AI 积分占比')).toBeInTheDocument();
    expect(within(detailsTable).getByText('DeepSeek V4 Flash')).toBeInTheDocument();
    expect(within(detailsTable).getByText('deepseek-v4-flash')).toBeInTheDocument();
    expect(screen.getByText('当前展示选中厂商下模型的低敏用量字段，不包含费用金额或原始内容。')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/¥|RMB|人民币金额|真实成本/u);
    expectNoSensitiveContent(container);
  });

  it('默认本月并支持全局时间范围切换影响全部栏目', async () => {
    const fetchMock = mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本月' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchPath(fetchMock.mock.calls[0]?.[0] ?? '')).toContain('dateFrom=2026-05-31T16%3A00%3A00.000Z');
    expect(fetchPath(fetchMock.mock.calls[0]?.[0] ?? '')).toContain('dateTo=2026-06-30T15%3A59%3A00.000Z');

    fireEvent.click(screen.getByRole('button', { name: '今日' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('dateFrom=2026-06-21T16%3A00%3A00.000Z'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: '近7天' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('dateFrom=2026-06-15T16%3A00%3A00.000Z'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: '上月' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('dateFrom=2026-04-30T16%3A00%3A00.000Z'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: '本月' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '本月' })).toHaveAttribute('aria-pressed', 'true'));
    ['总览', '模型与厂商', '租户用量', '服务项目', '计量状态', '明细记录'].forEach((tab) => {
      selectAiUsageTab(tab);
      expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('自定义全局时间范围可用且返回条数只影响明细记录请求参数', async () => {
    const fetchMock = mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '自定义时间范围' }));
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-06-10T00:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-06-20T23:59' } });
    fireEvent.click(screen.getByRole('button', { name: '应用时间范围' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('dateFrom=2026-06-09T16%3A00%3A00.000Z'))).toBe(true));
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('dateTo=2026-06-20T15%3A59%3A00.000Z'))).toBe(true);

    selectAiUsageTab('明细记录');
    fireEvent.change(screen.getByLabelText('返回条数'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('limit=25'))).toBe(true));
    const limitCallPath = fetchMock.mock.calls.map(([input]) => fetchPath(input)).find((path) => path.includes('limit=25')) ?? '';
    expect(limitCallPath).toContain('dateFrom=2026-06-09T16%3A00%3A00.000Z');
    expect(screen.getByText(/返回条数仅影响明细记录/)).toBeInTheDocument();
  });

  it('单厂商单模型时保留厂商卡片和模型联动', async () => {
    const fetchMock = mockUsageFetch({ records: [usageRecord] });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      ...usagePayload([usageRecord]),
      aggregations: {
        ...usagePayload([usageRecord]).aggregations,
        byModel: [{
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          totalCalls: 1,
          succeededCalls: 1,
          failedCalls: 0,
          meteredCalls: 1,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }],
      },
    }));
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '厂商 / 模型消耗' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '筛选厂商 DeepSeek' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '筛选模型 DeepSeek V4 Flash' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('model=deepseek-v4-flash'))).toBe(true));
  });

  it('中文说明文案无非必要英文且保留真实 provider / model code', async () => {
    mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByText('卡片复用当前 AI 用量聚合数据，展示厂商标识、模型数量、AI 积分占比、调用、Token 与成功率；选择厂商后在下方查看模型明细表。')).toBeInTheDocument();
    expect(screen.queryByText(/AI usage credits 聚合数据/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('deepseek').length).toBeGreaterThan(0);
    expect(screen.getAllByText('deepseek-v4-flash').length).toBeGreaterThan(0);
  });

  it('支持筛选和刷新且不触发 mutation', async () => {
    const fetchMock = mockUsageFetch();
    render(<OpenPlatformAiReadonlyPanel />);

    expect(await screen.findByRole('heading', { name: '2026年06月用量' })).toBeInTheDocument();
    selectAiUsageTab('明细记录');
    fireEvent.change(screen.getByLabelText('租户'), { target: { value: 'tenant-001' } });
    fireEvent.change(screen.getByLabelText('调用状态'), { target: { value: 'succeeded' } });
    fireEvent.change(screen.getByLabelText('计量状态'), { target: { value: 'metered' } });
    fireEvent.change(screen.getByLabelText('模型厂商'), { target: { value: 'deepseek' } });
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'deepseek-v4-flash' } });
    fireEvent.change(screen.getByLabelText('返回条数'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('tenantId=tenant-001'))).toBe(true);
    });
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('meteringStatus=metered'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(fetchMock.mock.calls.some((call) => {
      const init = (call as [Parameters<typeof fetch>[0], RequestInit?])[1];
      return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(init?.method ?? 'GET').toUpperCase());
    })).toBe(false);
    expect(fetchMock.mock.calls.some(([input]) => /provider-config|smoke|ai-runtime/u.test(fetchPath(input)))).toBe(false);
  });
});
