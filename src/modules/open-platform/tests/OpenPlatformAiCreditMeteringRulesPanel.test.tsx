import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenPlatformAiCreditMeteringRulesPanel } from '@/modules/open-platform/components/OpenPlatformAiCreditMeteringRulesPanel';

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

const ruleRecord = {
  id: 'rule-001',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  meteringVersion: 'v06-stage-verify-ui',
  inputTokenWeight: 1,
  outputTokenWeight: 2,
  modelMultiplier: 1.5,
  ragCreditSurcharge: 0,
  creditsPerStandardTokenUnit: 1000,
  enabled: true,
  effectiveFrom: '2026-06-29T00:00:00.000Z',
  effectiveTo: '2026-06-30T00:00:00.000Z',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T01:00:00.000Z',
  apiKey: 'sk_test_should_not_render',
  baseUrl: 'https://provider.example.test',
  Authorization: 'Bearer secret',
  rawResponse: { unsafe: true },
};

function expectNoSensitiveContent(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/sk_test_should_not_render|apiKey|baseUrl|Authorization|rawResponse|signedUrl|storageKey/i);
}

function mockRulesFetch(options: {
  records?: unknown[];
  listStatus?: number;
  createStatus?: number;
  patchStatus?: number;
} = {}) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (path.startsWith('/api/open-platform/ai-credit-metering-rules') && method === 'GET') {
      if (options.listStatus && options.listStatus >= 400) {
        return jsonResponse({ errorCode: 'METERING_RULES_UNAVAILABLE' }, { status: options.listStatus });
      }
      return jsonResponse({ records: options.records ?? [ruleRecord] });
    }
    if (path === '/api/open-platform/ai-credit-metering-rules' && method === 'POST') {
      if (options.createStatus && options.createStatus >= 400) {
        return jsonResponse({ errorCode: 'VALIDATION_FAILED', errors: ['provider_required'] }, { status: options.createStatus });
      }
      return jsonResponse({ record: { ...ruleRecord, id: 'rule-created' } }, { status: 201 });
    }
    if (path === '/api/open-platform/ai-credit-metering-rules/rule-001' && method === 'PATCH') {
      if (options.patchStatus && options.patchStatus >= 400) {
        return jsonResponse({ errorCode: 'METERING_RULE_NOT_FOUND' }, { status: options.patchStatus });
      }
      return jsonResponse({ record: { ...ruleRecord, enabled: false } });
    }

    throw new Error(`没有为 ${method} ${path} 配置 fetch mock`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenPlatformAiCreditMeteringRulesPanel', () => {
  it('展示 loading 状态', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));

    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(screen.getByText('正在加载 AI Credits 计量规则...')).toBeInTheDocument();
  });

  it('渲染规则列表低敏字段', async () => {
    const fetchMock = mockRulesFetch();
    const { container } = render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByRole('heading', { name: 'AI Credits 计量规则' })).toBeInTheDocument();
    expect(await screen.findByText('deepseek')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument();
    expect(screen.getByText('v06-stage-verify-ui')).toBeInTheDocument();
    expect(screen.getAllByText('已启用').length).toBeGreaterThan(0);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    expectNoSensitiveContent(container);
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/ai-credit-metering-rules', { cache: 'no-store' });
  });

  it('展示 empty 状态', async () => {
    mockRulesFetch({ records: [] });
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('暂无 AI Credits 计量规则，请创建第一条规则。')).toBeInTheDocument();
  });

  it('展示错误状态', async () => {
    mockRulesFetch({ listStatus: 503 });
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('计量规则服务暂不可用，请稍后重试。')).toBeInTheDocument();
    expect(screen.getByText('规则列表暂不可用。')).toBeInTheDocument();
  });

  it('创建规则成功后调用 POST 并刷新列表', async () => {
    const fetchMock = mockRulesFetch();
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('v06-stage-verify-ui')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('创建 provider'), { target: { value: 'deepseek' } });
    fireEvent.change(screen.getByLabelText('创建 model'), { target: { value: 'deepseek-v4-flash' } });
    fireEvent.change(screen.getByLabelText('创建 meteringVersion'), { target: { value: 'v06-stage-verify-ui-new' } });
    fireEvent.change(screen.getByLabelText('创建 effectiveFrom'), { target: { value: '2026-06-29T00:00' } });
    fireEvent.change(screen.getByLabelText('创建 effectiveTo'), { target: { value: '2026-06-30T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: '创建规则' }));

    expect(await screen.findByText('计量规则已创建')).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find(([input, init]) => fetchPath(input) === '/api/open-platform/ai-credit-metering-rules' && init?.method === 'POST');
    expect(postCall).toBeDefined();
    const body = JSON.parse(String(postCall?.[1]?.body));
    expect(body).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      meteringVersion: 'v06-stage-verify-ui-new',
      inputTokenWeight: 1,
      outputTokenWeight: 1,
      modelMultiplier: 1,
      ragCreditSurcharge: 0,
      creditsPerStandardTokenUnit: 1000,
      enabled: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/apiKey|baseUrl|Authorization|rawResponse/i);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input, init]) => fetchPath(input).startsWith('/api/open-platform/ai-credit-metering-rules') && !init?.method)).toHaveLength(2));
  });

  it('创建规则 validation 错误可见且不调用 POST', async () => {
    const fetchMock = mockRulesFetch();
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('v06-stage-verify-ui')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '创建规则' }));

    expect(screen.getByText('provider、model 和 meteringVersion 必填。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('启用 / 停用调用 PATCH 并刷新列表', async () => {
    const fetchMock = mockRulesFetch();
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('v06-stage-verify-ui')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '停用' }));

    expect(await screen.findByText('计量规则已停用')).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(([input, init]) => fetchPath(input) === '/api/open-platform/ai-credit-metering-rules/rule-001' && init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ enabled: false });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input, init]) => fetchPath(input).startsWith('/api/open-platform/ai-credit-metering-rules') && !init?.method)).toHaveLength(2));
  });

  it('不会触发 provider 或 smoke endpoint', async () => {
    const fetchMock = mockRulesFetch();
    render(<OpenPlatformAiCreditMeteringRulesPanel />);

    expect(await screen.findByText('v06-stage-verify-ui')).toBeInTheDocument();
    const paths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(paths.some((path) => /provider-config|ai-model-config|smoke|ai-runtime/u.test(path))).toBe(false);
  });
});
