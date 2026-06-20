import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';
import { getPlatformAiModelConfigResponse } from '@/modules/open-platform/server/platformAiModelConfigContract';

const forbiddenFragments = [
  'AI 配额边界',
  'Quota Denied 占位',
  'DATABASE_URL',
  'apiKey',
  'API Key 原文',
  'encryptedKey',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'iv',
  'secret',
  'sk-',
  'PR1',
  'PR2',
  'PR3',
  'PR4',
  'PR5',
];

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function stubPersistenceFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/open-platform/provider-configs') && method === 'POST') {
      return new Response(JSON.stringify({
        vendor: 'doubao',
        configured: true,
        model: 'doubao-seed-1-8-251228',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        lastCheckStatus: 'not_checked',
      }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'GET') {
      return new Response(JSON.stringify({
        ...getPlatformAiModelConfigResponse(),
        dataSource: 'persisted_boundary',
        operationMode: 'persisted_dry_run',
        persistenceMode: 'database',
        dryRunResults: [],
      }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'PUT') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config/sync') && method === 'POST') {
      return new Response(JSON.stringify({ ok: true, status: 'success', vendor: 'doubao', syncedModels: [], errorCode: null }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config/test') && method === 'POST') {
      return new Response(JSON.stringify({ ok: true, status: 'success', vendor: 'doubao', modelId: 'doubao-seed-2-0-pro-260215', errorCode: null }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function stubLogoPersistenceFailureFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'GET') {
      return new Response(JSON.stringify({
        ...getPlatformAiModelConfigResponse(),
        dataSource: 'persisted_boundary',
        operationMode: 'persisted_dry_run',
        persistenceMode: 'database',
        dryRunResults: [],
      }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'PUT') {
      return new Response(JSON.stringify({ ok: false, errorCode: 'AI_MODEL_CONFIG_UNAVAILABLE' }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function stubProviderConfigUnavailableFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'GET') {
      return new Response(JSON.stringify({
        ...getPlatformAiModelConfigResponse(),
        dataSource: 'persisted_boundary',
        operationMode: 'persisted_dry_run',
        persistenceMode: 'database',
        dryRunResults: [],
      }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/provider-configs') && method === 'POST') {
      return new Response(JSON.stringify({ ok: false, errorCode: 'PROVIDER_CONFIG_UNAVAILABLE' }), { status: 200 });
    }

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'PUT') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function stubSyncedModelPersistenceFetch() {
  const persistedView = getPlatformAiModelConfigResponse();
  persistedView.providers = persistedView.providers.map((provider) => (
    provider.providerId === 'qwen'
      ? {
          ...provider,
          models: [
            ...provider.models,
            {
              modelId: 'qwen-max-latest',
              displayName: 'Qwen Max Latest',
              description: '通义千问官方模型列表实时拉取模型',
              pricingLabel: '按量计费',
              contextWindowLabel: '-',
              capabilityIds: ['text'],
              enabled: false,
              testStatus: 'dry_run',
            },
          ],
        }
      : provider
  ));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'GET') {
      return new Response(JSON.stringify({
        ...persistedView,
        dataSource: 'persisted_boundary',
        operationMode: 'persisted_dry_run',
        persistenceMode: 'database',
        dryRunResults: [],
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function stubPersistedKeyAndModelStateFetch() {
  const persistedView = getPlatformAiModelConfigResponse();
  persistedView.providers = persistedView.providers.map((provider) => (
    provider.providerId === 'doubao'
      ? {
          ...provider,
          keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****80d4' },
          models: provider.models.map((model) => (
            model.modelId === 'doubao-seed-2-0-pro-260215'
              ? { ...model, enabled: false }
              : model
          )),
        }
      : provider
  ));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/open-platform/ai-model-config') && method === 'GET') {
      return new Response(JSON.stringify({
        ...persistedView,
        dataSource: 'persisted_boundary',
        operationMode: 'persisted_dry_run',
        persistenceMode: 'database',
        dryRunResults: [],
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function expectNoMutationFetch(fetchMock: ReturnType<typeof vi.fn>) {
  const mutatingCall = fetchMock.mock.calls.find(([input, init]) => {
    if (String(input).includes('/api/v1/open-platform/ai-model-config')) return false;
    if (String(input).includes('/api/v1/open-platform/provider-configs')) return false;

    const method = String((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  });

  expect(mutatingCall).toBeUndefined();
}

function expectNoForbiddenContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  forbiddenFragments.forEach((fragment) => {
    expect(text).not.toContain(fragment);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('平台端 AI 模型配置旧系统视觉只读还原', () => {
  it('导航进入 AI模型配置后展示旧系统信息结构，不再展示 quota 占位', () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));

    expect(screen.getByRole('heading', { name: 'AI模型' })).toBeInTheDocument();
    expect(screen.getByText('配置平台AI模型提供商，支持豆包、DeepSeek、千问、Kimi')).toBeInTheDocument();
    expect(screen.getByText('已启用模型')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('已配置厂商')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('默认场景')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'AI 应用默认配置' })).toBeInTheDocument();
    const scenarioInheritanceSummary = screen.getByText('展开业务场景与 Agent 继承配置');
    const scenarioInheritanceDetails = scenarioInheritanceSummary.closest('details');
    expect(scenarioInheritanceSummary).toBeInTheDocument();
    expect(scenarioInheritanceDetails).not.toHaveAttribute('open');

    fireEvent.click(scenarioInheritanceSummary);
    expect(scenarioInheritanceDetails).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: '业务场景默认模型' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent 智能体继承关系' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '场景预设' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '保存应用配置' })).toBeEnabled();

    expect(screen.getByRole('heading', { name: '模型厂商配置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存全部配置' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^厂商 / })).toHaveLength(5);
    expect(screen.getByRole('button', { name: '厂商 豆包' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '厂商 DeepSeek' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '厂商 通义千问' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '厂商 智谱GLM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '厂商 Kimi' })).toBeInTheDocument();

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('厂商展开后展示低敏 Key 状态、能力分组和模型行，同步测试按钮为受控执行', () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    expect(screen.getByText('上传 Logo')).toBeInTheDocument();
    expect(screen.getAllByText('Key 已配置 ****9821').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('豆包 API Key')).toHaveValue('已保存 ****9821');
    expect(screen.getByLabelText('豆包 API Key')).toHaveAttribute('placeholder', '输入新 Key');
    expect(screen.getByLabelText('豆包 API Key')).toBeEnabled();
    expect(screen.getByLabelText('上传 Logo 豆包')).toBeEnabled();
    expect(screen.getByRole('button', { name: '显示' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '保存 Key' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '同步模型 可执行' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 豆包 文本生成' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 豆包 视觉理解' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 豆包 向量模型' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveTextContent('2/2 已启用');
    expect(screen.queryByText('doubao-seed-2-0-pro-260215')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '厂商 通义千问' }));
    expect(screen.getAllByText('Qwen Plus').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '能力分组 通义千问 文本生成' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 通义千问 视觉理解' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '能力分组 通义千问 向量模型' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('qwen3-vl-plus')).not.toBeInTheDocument();
    expect(screen.queryByText('text-embedding-v4')).not.toBeInTheDocument();

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('同步模型与模型测试按钮只调用本栏目受控接口', async () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));
    await waitFor(() => expect(screen.getAllByText('Key 已配置 ****9821').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));

    expect(screen.getByRole('button', { name: '同步模型 可执行' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^测试 .* 可执行$/ })[0]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: '测试 Seed Pro 2.0 可执行' })[0]).toHaveTextContent('测试 可执行');

    fireEvent.click(screen.getByRole('button', { name: '同步模型 可执行' }));
    fireEvent.click(screen.getAllByRole('button', { name: '测试 Seed Pro 2.0 可执行' })[0]);

    expect(screen.getByText('同步请求已提交：豆包')).toBeInTheDocument();
    expect(screen.getByText('测试请求已提交：Seed Pro 2.0')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => (
        String(url).includes('/api/v1/open-platform/ai-model-config/sync')
        && String((init as RequestInit | undefined)?.method).toUpperCase() === 'POST'
      ))).toBe(true);
      expect(fetchMock.mock.calls.some(([url, init]) => (
        String(url).includes('/api/v1/open-platform/ai-model-config/test')
        && String((init as RequestInit | undefined)?.method).toUpperCase() === 'POST'
      ))).toBe(true);
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('ark.cn-beijing');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('api.deepseek.com');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('dashscope');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('moonshot');
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('同步模型与模型测试展示后端低敏成功状态', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));
    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));

    fireEvent.click(screen.getByRole('button', { name: '同步模型 可执行' }));
    fireEvent.click(screen.getAllByRole('button', { name: '测试 Seed Pro 2.0 可执行' })[0]);

    await waitFor(() => {
      expect(screen.getByText('同步已完成：豆包')).toBeInTheDocument();
      expect(screen.getByText('测试已完成：Seed Pro 2.0')).toBeInTheDocument();
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('provider-key-value');
    expectNoForbiddenContent(container);
  });

  it('页面刷新后使用持久化 providers 渲染同步出来的新模型', async () => {
    const fetchMock = stubSyncedModelPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));

    fireEvent.click(screen.getByRole('button', { name: '厂商 通义千问' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '厂商 通义千问' })).toHaveTextContent('8 个模型'));
    fireEvent.click(screen.getByRole('button', { name: '能力分组 通义千问 文本生成' }));

    expect(screen.getByText('Qwen Max Latest')).toBeInTheDocument();
    expect(screen.getByText('qwen-max-latest')).toBeInTheDocument();
    expect(screen.getByText('通义千问官方模型列表实时拉取模型')).toBeInTheDocument();
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('能力分组可独立展开和收起，并保持厂商展开状态', () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const reasoningGroup = screen.getByRole('button', { name: '能力分组 豆包 深度思考' });
    const textGroup = screen.getByRole('button', { name: '能力分组 豆包 文本生成' });

    expect(screen.getByRole('button', { name: '厂商 豆包' })).toHaveAttribute('aria-expanded', 'true');
    expect(reasoningGroup).toHaveAttribute('aria-expanded', 'false');
    expect(textGroup).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('doubao-seed-2-0-pro-260215')).not.toBeInTheDocument();

    fireEvent.click(reasoningGroup);

    expect(screen.getByRole('button', { name: '厂商 豆包' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '能力分组 豆包 文本生成' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('doubao-seed-2-0-pro-260215')).toBeInTheDocument();
    expect(screen.getAllByText('256K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('按量计费').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^测试 / })[0]).toBeEnabled();
    expect(screen.getAllByRole('checkbox', { name: /^启用 / })[0]).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));

    expect(screen.getByRole('button', { name: '厂商 豆包' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('doubao-seed-2-0-pro-260215')).not.toBeInTheDocument();

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('应用默认配置支持场景模型选择、场景预设与保存失败提示', async () => {
    stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));

    const customerServiceSelect = screen.getByLabelText('AI 客服 默认模型');
    expect(customerServiceSelect).toBeEnabled();
    expect(customerServiceSelect).toHaveValue('qwen-plus-latest');

    fireEvent.change(customerServiceSelect, { target: { value: 'deepseek-v4-flash' } });
    expect(screen.getByLabelText('AI 客服 默认模型')).toHaveValue('deepseek-v4-flash');
    expect(screen.getByText('AI 客服 已选择 DeepSeek V4 Flash')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '场景预设' }));
    expect(screen.getAllByText('场景预设').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '应用预设：智能随访' }));
    expect(screen.getByText('场景预设保存中...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('场景预设保存失败：持久化服务不可用')).toBeInTheDocument());
    expect(screen.getByLabelText('AI 客服 默认模型')).toHaveValue('doubao-seed-2-0-lite-260215');
    expect(screen.getByText('AI 客服 已选择 Seed Lite 2.0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存应用配置' }));
    expect(screen.getByText('应用配置保存中...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('应用配置保存失败：持久化服务不可用')).toBeInTheDocument());
    expect(screen.queryByText('应用配置 dry-run 已保存')).not.toBeInTheDocument();

    expectNoForbiddenContent(container);
  });

  it('Key 输入保存后保留输入痕迹，并支持显示和关闭显示', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const keyInput = screen.getByLabelText('豆包 API Key') as HTMLInputElement;
    const rawDraft = 'provider-key-value-123456';

    expect(keyInput).toHaveAttribute('type', 'text');

    fireEvent.change(keyInput, { target: { value: rawDraft } });
    expect(keyInput).toHaveValue('新 Key ****3456');
    expect(container.textContent).not.toContain(rawDraft);

    fireEvent.click(screen.getByRole('button', { name: '显示' }));
    expect(keyInput).toHaveValue(rawDraft);
    expect(keyInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '关闭显示' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '关闭显示' }));
    expect(keyInput).toHaveAttribute('type', 'text');
    expect(keyInput).toHaveValue('新 Key ****3456');
    expect(container.textContent).not.toContain(rawDraft);

    fireEvent.click(screen.getByRole('button', { name: '保存 Key' }));
    await waitFor(() => {
      expect(screen.getByText('Key 已保存：豆包')).toBeInTheDocument();
      expect(screen.getAllByText('Key 已配置 ****3456').length).toBeGreaterThan(0);
    });
    expect(keyInput).toHaveValue('已保存 ****3456');
    fireEvent.click(screen.getByRole('button', { name: '显示' }));
    expect(keyInput).toHaveValue(rawDraft);
    fireEvent.click(screen.getByRole('button', { name: '关闭显示' }));
    expect(keyInput).toHaveValue('已保存 ****3456');
    expect(container.textContent).not.toContain(rawDraft);

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('厂商 Key 真实保存返回低敏失败时不写入页面配置状态', async () => {
    const fetchMock = stubProviderConfigUnavailableFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    fireEvent.change(screen.getByLabelText('豆包 API Key'), { target: { value: 'provider-key-value-123456' } });
    fireEvent.click(screen.getByRole('button', { name: '保存 Key' }));

    await waitFor(() => expect(screen.getByText('Key 保存失败：豆包 凭证存储不可用，未保存。')).toBeInTheDocument());
    expect(screen.queryByText('Key 已保存：豆包')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).includes('/api/v1/open-platform/ai-model-config')
      && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
    ))).toBe(false);
    expectNoForbiddenContent(container);
  });

  it('刷新后从持久化响应恢复低敏 Key 痕迹和模型启用状态', async () => {
    const fetchMock = stubPersistedKeyAndModelStateFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const keyInput = screen.getByLabelText('豆包 API Key') as HTMLInputElement;
    expect(keyInput).toHaveValue('已保存 ****80d4');
    expect(keyInput).toHaveAttribute('placeholder', '输入新 Key');
    expect(screen.getAllByText('Key 已配置 ****80d4').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '显示' }));
    expect(keyInput).toHaveValue('已保存 ****80d4');
    expect(screen.getByText('刷新后仅保留低敏 Key 状态，需重新输入才可查看原文。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));
    const seedProToggle = screen.getAllByRole('checkbox', { name: '启用 Seed Pro 2.0' })[0];
    expect(seedProToggle).not.toBeChecked();
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveTextContent('1/2 已启用');

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('保存应用配置和 Key 状态时调用持久化 API，Key 原文只发送到凭证保存边界', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));

    fireEvent.change(screen.getByLabelText('AI 客服 默认模型'), { target: { value: 'deepseek-v4-flash' } });
    fireEvent.click(screen.getByRole('button', { name: '保存应用配置' }));

    await waitFor(() => expect(screen.getByText('应用配置 dry-run 已保存')).toBeInTheDocument());
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => (
        String(url).includes('/api/v1/open-platform/ai-model-config')
        && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
        && String((init as RequestInit | undefined)?.body).includes('deepseek-v4-flash')
      ))).toBe(true);
    });

    const rawDraft = 'provider-key-value-123456';
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));
    fireEvent.change(screen.getByLabelText('豆包 API Key'), { target: { value: rawDraft } });
    fireEvent.click(screen.getByRole('button', { name: '保存 Key' }));

    await waitFor(() => {
      const serializedCalls = JSON.stringify(fetchMock.mock.calls);
      expect(serializedCalls).toContain('Key 已配置 ****3456');
      expect(fetchMock.mock.calls.some(([url, init]) => (
        String(url).includes('/api/v1/open-platform/provider-configs')
        && String((init as RequestInit | undefined)?.method).toUpperCase() === 'POST'
        && String((init as RequestInit | undefined)?.body).includes(rawDraft)
      ))).toBe(true);
      expect(fetchMock.mock.calls.some(([url, init]) => (
        String(url).includes('/api/v1/open-platform/ai-model-config')
        && String((init as RequestInit | undefined)?.body).includes(rawDraft)
      ))).toBe(false);
    });
    expectNoForbiddenContent(container);
  });

  it('Logo 上传后立即替换厂商图标，并保存可恢复的图片引用', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const logoFile = new File(['logo'], 'doubao-logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('上传 Logo 豆包'), { target: { files: [logoFile] } });

    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: '豆包 Logo' }).length).toBeGreaterThan(0);
      expect(screen.getByText('Logo 已保存：doubao-logo.png')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('img', { name: '豆包 Logo' })[0]).toHaveAttribute('src', 'data:image/png;base64,bG9nbw==');

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        String(url).includes('/api/v1/open-platform/ai-model-config')
        && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
        && String((init as RequestInit | undefined)?.body).includes('data:image/png;base64,bG9nbw==')
      ));
      expect(putCall).toBeDefined();
    });
    expect(container.textContent).not.toContain('data:image/png;base64');
    expectNoForbiddenContent(container);
  });

  it('Logo 已保存时支持恢复默认并持久化空引用', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const logoFile = new File(['logo'], 'doubao-logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('上传 Logo 豆包'), { target: { files: [logoFile] } });
    await waitFor(() => expect(screen.getByText('Logo 已保存：doubao-logo.png')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '恢复默认 Logo 豆包' }));

    await waitFor(() => expect(screen.getByText('Logo 已恢复默认：豆包')).toBeInTheDocument());
    expect(screen.getByText('默认 Logo')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).includes('/api/v1/open-platform/ai-model-config')
      && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
      && String((init as RequestInit | undefined)?.body).includes('"logoRef":null')
    ))).toBe(true);
    expect(container.textContent).not.toContain('data:image/png;base64');
    expectNoForbiddenContent(container);
  });

  it('场景预设应用后自动保存到持久化边界', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));

    fireEvent.click(screen.getByRole('button', { name: '场景预设' }));
    expect(screen.getAllByText('场景预设').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '应用预设：智能随访' }));

    expect(screen.getByText('场景预设保存中...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('场景预设已保存：智能随访')).toBeInTheDocument());
    expect(screen.getByLabelText('AI 客服 默认模型')).toHaveValue('doubao-seed-2-0-lite-260215');
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).includes('/api/v1/open-platform/ai-model-config')
      && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
      && String((init as RequestInit | undefined)?.body).includes('doubao-seed-2-0-lite-260215')
      && String((init as RequestInit | undefined)?.body).includes('场景预设已保存：智能随访')
    ))).toBe(true);
    expectNoForbiddenContent(container);
  });

  it('Logo 上传持久化失败时提示刷新后不会保留', async () => {
    const fetchMock = stubLogoPersistenceFailureFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const logoFile = new File(['logo'], 'doubao-logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('上传 Logo 豆包'), { target: { files: [logoFile] } });

    await waitFor(() => {
      expect(screen.getByText('Logo 保存失败：豆包 持久化服务不可用，刷新后不会保留。')).toBeInTheDocument();
    });
    expect(screen.queryByText('Logo 已保存：doubao-logo.png')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('data:image/png;base64');
    expectNoForbiddenContent(container);
  });

  it('厂商配置支持 Logo 本地预览、Key dry-run、模型启用和保存全部配置 dry-run', async () => {
    const fetchMock = stubFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));

    const logoFile = new File(['logo'], 'doubao-logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('上传 Logo 豆包'), { target: { files: [logoFile] } });
    await waitFor(() => expect(screen.getByText('本地预览：doubao-logo.png')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('豆包 API Key'), { target: { value: 'new-provider-key-value' } });
    expect(screen.getByText('新 Key 已输入，保存后会写入服务端凭证配置。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '显示' }));
    expect(screen.getByRole('button', { name: '关闭显示' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '保存 Key' }));
    await waitFor(() => expect(screen.getByText('Key 保存失败：豆包 服务不可用，未保存。')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '同步模型 可执行' }));
    expect(screen.getByText('Key 保存失败：豆包 服务不可用，未保存。')).toBeInTheDocument();
    expect(screen.getByText('同步请求已提交：豆包')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('同步失败：豆包 服务不可用')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));
    const seedProToggle = screen.getAllByRole('checkbox', { name: '启用 Seed Pro 2.0' })[0];
    expect(seedProToggle).toBeChecked();
    fireEvent.click(seedProToggle);
    expect(seedProToggle).not.toBeChecked();
    expect(screen.getByRole('button', { name: '能力分组 豆包 深度思考' })).toHaveTextContent('1/2 已启用');

    fireEvent.click(screen.getByRole('button', { name: '保存全部配置' }));
    expect(screen.getByText('全部配置保存中...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('全部配置保存失败：持久化服务不可用')).toBeInTheDocument());
    expect(screen.queryByText('全部配置 dry-run 已保存')).not.toBeInTheDocument();

    expectNoMutationFetch(fetchMock);
    expectNoForbiddenContent(container);
  });

  it('保存全部配置成功时显示成功并提交当前模型启用状态', async () => {
    const fetchMock = stubPersistenceFetch();
    const { container } = render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'AI模型配置' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/open-platform/ai-model-config',
      expect.objectContaining({ method: 'GET' }),
    ));
    fireEvent.click(screen.getByRole('button', { name: '厂商 豆包' }));
    fireEvent.click(screen.getByRole('button', { name: '能力分组 豆包 深度思考' }));

    const seedProToggle = screen.getAllByRole('checkbox', { name: '启用 Seed Pro 2.0' })[0];
    fireEvent.click(seedProToggle);
    expect(seedProToggle).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '保存全部配置' }));

    expect(screen.getByText('全部配置保存中...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('全部配置已保存')).toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url, init]) => (
      String(url).includes('/api/v1/open-platform/ai-model-config')
      && String((init as RequestInit | undefined)?.method).toUpperCase() === 'PUT'
      && String((init as RequestInit | undefined)?.body).includes('"modelId":"doubao-seed-2-0-pro-260215","enabled":false')
    ))).toBe(true);
    expectNoForbiddenContent(container);
  });
});
