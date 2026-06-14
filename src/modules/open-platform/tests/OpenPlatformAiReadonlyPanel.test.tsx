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
];

const runtimeStatusMissing = {
  readonly: true,
  dataSource: 'env_only',
  enabled: false,
  configured: false,
  provider: null,
  model: null,
  baseUrlConfigured: false,
  missingKeys: [
    'ZMTG_AI_RUNTIME_ENABLED',
    'ZMTG_AI_PROVIDER',
    'ZMTG_AI_BASE_URL',
    'ZMTG_AI_API_KEY',
    'ZMTG_AI_MODEL',
  ],
  safety: {
    title: 'AI Runtime env-only 可用性',
    keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
    smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
  },
};

const providerConfigMissing = {
  configured: false,
  provider: null,
  model: null,
  baseUrlConfigured: false,
  lastCheckStatus: 'not_checked',
  lastCheckedAt: null,
  updatedAt: null,
};

const providerConfigSaved = {
  configured: true,
  provider: 'openai_compatible',
  model: 'gpt-provider-config',
  baseUrlConfigured: true,
  lastCheckStatus: 'not_checked',
  lastCheckedAt: null,
  updatedAt: '2026-06-15T00:00:00.000Z',
};

function mockRuntimeStatusFetch(fetchMock = vi.fn()) {
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (url === '/api/v1/open-platform/ai-runtime/status') {
      return Promise.resolve(new Response(JSON.stringify(runtimeStatusMissing), { status: 200 }));
    }
    if (url === '/api/v1/open-platform/ai-runtime/provider-config' && method === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(providerConfigMissing), { status: 200 }));
    }
    if (url === '/api/v1/open-platform/ai-runtime/provider-config' && method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify(providerConfigSaved), { status: 200 }));
    }
    if (url === '/api/v1/open-platform/ai-runtime/smoke' && method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({
        ok: false,
        status: 'skipped',
        latencyMs: 0,
        provider: null,
        model: null,
        checkedAt: '2026-06-15T00:00:00.000Z',
        errorCode: 'RUNTIME_NOT_CONFIGURED',
      }), { status: 200 }));
    }

    return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 404 }));
  });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('平台端 AI 模型与用量只读面板', () => {
  it('展示 AI 模型目录、场景关系、Agent 继承、用量费用和 runtime env-only 状态', async () => {
    mockRuntimeStatusFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('heading', { name: 'AI 模型与用量' })).toBeInTheDocument();
    expect(screen.getByText('当前为受控示例数据')).toBeInTheDocument();
    expect(screen.getByText(/估算费用不是正式账单/)).toBeInTheDocument();
    expect(screen.getByText('真实 AI 未启用，API Key 管理、模型同步和自动扣费均未启用。')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'AI 模型目录' })).toBeInTheDocument();
    expect(screen.getByText('厂商列表')).toBeInTheDocument();
    expect(screen.getByText('能力分组')).toBeInTheDocument();
    expect(screen.getByText('推荐业务场景')).toBeInTheDocument();
    expect(screen.getByText('场景默认模型关系')).toBeInTheDocument();
    expect(screen.getByText('Agent 继承关系')).toBeInTheDocument();
    expect(screen.getByText('模型启用状态说明')).toBeInTheDocument();
    expect(screen.getByText('Registry 状态：当前为受控只读示例，不代表生产启用。')).toBeInTheDocument();
    expect(screen.getAllByText('真实凭据未接入').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Key 管理未启用').length).toBeGreaterThan(0);

    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.getByText('用量口径：当前为受控示例用量，费用为估算，不是正式账单。')).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.getByText('总调用数')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('成功率')).toBeInTheDocument();
    expect(screen.getByText('平均延迟')).toBeInTheDocument();
    expect(screen.getByText('估算费用 / 运营参考')).toBeInTheDocument();
    expect(screen.getByText('厂商 / 模型维度')).toBeInTheDocument();
    expect(screen.getByText('业务场景维度')).toBeInTheDocument();
    expect(screen.getByText('示例机构排行')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Runtime 状态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '厂商 Key 配置' })).toBeInTheDocument();
    expect(screen.getAllByText('未配置').length).toBeGreaterThan(0);
    expect(screen.getByText('env-only')).toBeInTheDocument();
    expect(screen.getByText('API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。')).toBeInTheDocument();
    expect(screen.getByText('真实调用仅用于固定 smoke test，不接收用户 prompt。')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('未启用')).toBeInTheDocument();
      expect(screen.getByText('配置不完整')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '运行 smoke test' })).toBeDisabled();
    });
    expect(screen.getByRole('heading', { name: '能力覆盖矩阵' })).toBeInTheDocument();
    expect(screen.getByText('文本生成')).toBeInTheDocument();
    expect(screen.getByText('推理判断')).toBeInTheDocument();
    expect(screen.getByText('视觉理解')).toBeInTheDocument();
    expect(screen.getAllByText('OCR 未启用').length).toBeGreaterThan(0);
    expect(screen.getByText('向量模型')).toBeInTheDocument();
    expect(screen.getAllByText('真实向量库未启用').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '安全边界清单' })).toBeInTheDocument();
    expect(screen.getByText('真实 AI')).toBeInTheDocument();
    expect(screen.getByText('厂商模型同步')).toBeInTheDocument();
    expect(screen.getByText('正式账单')).toBeInTheDocument();

    expectNoForbiddenAiReadonlyContent(container);
  });

  it('支持保存厂商 Key 配置，成功后清空 Key 输入且不回显敏感内容', async () => {
    const fetchMock = mockRuntimeStatusFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '厂商 Key 配置' })).toBeInTheDocument();
    });

    const providerInput = screen.getByLabelText('Provider') as HTMLInputElement;
    const baseUrlInput = screen.getByLabelText('Base URL') as HTMLInputElement;
    const modelInput = screen.getByLabelText('Model') as HTMLInputElement;
    const keyInput = screen.getByLabelText('API Key') as HTMLInputElement;

    expect(keyInput.type).toBe('password');
    fireEvent.change(providerInput, { target: { value: 'openai_compatible' } });
    fireEvent.change(baseUrlInput, { target: { value: 'https://provider.example.test/v1' } });
    fireEvent.change(modelInput, { target: { value: 'gpt-provider-config' } });
    fireEvent.change(keyInput, { target: { value: 'provider-test-key-never-return' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/open-platform/ai-runtime/provider-config', expect.objectContaining({
        method: 'POST',
      }));
      expect(keyInput.value).toBe('');
      expect(screen.getAllByText('已配置').length).toBeGreaterThan(0);
    });
    expect(container.textContent).not.toContain('provider-test-key-never-return');
    expect(screen.queryByRole('button', { name: /显示|隐藏/ })).not.toBeInTheDocument();
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('支持受控月份切换并展示无用量空状态', async () => {
    mockRuntimeStatusFetch();
    const { container } = render(<OpenPlatformAiReadonlyPanel />);

    expect(screen.getByRole('button', { name: '2026年06月 有示例用量' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026年05月 空状态示例' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026年05月 空状态示例' }));

    expect(screen.getByText('暂无受控示例用量')).toBeInTheDocument();
    expect(screen.getByText('2026年05月为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('¥0.00')).toBeInTheDocument();
    expect(screen.queryByText('示例机构 A')).not.toBeInTheDocument();
    expect(screen.queryByText('通义千问')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('未启用')).toBeInTheDocument();
    });
    expectNoForbiddenAiReadonlyContent(container);
  });

  it('平台导航可进入 AI 模型与用量面板，且不触发 mutation 或高风险入口', async () => {
    const fetchMock = mockRuntimeStatusFetch();
    const { container } = render(<PlatformConsole />);

    expect(screen.getByRole('button', { name: 'AI 配额边界' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI 模型与用量' }));

    expect(screen.getByRole('heading', { name: 'AI 模型与用量' })).toBeInTheDocument();
    expect(screen.getByText('当前为受控示例数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：AI 模型与用量' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /测试调用/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /显示 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动扣费/ })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('配置不完整')).toBeInTheDocument();
    });
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
