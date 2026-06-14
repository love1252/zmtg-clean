import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenPlatformAiReadonlyPanel } from '@/modules/open-platform/components/OpenPlatformAiReadonlyPanel';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

const forbiddenText = [
  '测试调用',
  '导出账单',
  '账单金额',
  '应收',
  '发票',
  'sk_test',
  'DATABASE_URL',
  'postgres://',
  '/Users/',
  'stack',
  'token',
  'secret',
  'credential',
];

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

describe('平台端 AI 模型与用量只读面板', () => {
  it('展示 AI 模型目录、场景关系、Agent 继承和用量费用只读结构', () => {
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
    expect(screen.getAllByText('真实凭据未接入').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Key 管理未启用').length).toBeGreaterThan(0);

    expect(screen.getByRole('heading', { name: 'AI 用量与费用' })).toBeInTheDocument();
    expect(screen.getByText('2026-06')).toBeInTheDocument();
    expect(screen.getByText('总调用数')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('成功率')).toBeInTheDocument();
    expect(screen.getByText('平均延迟')).toBeInTheDocument();
    expect(screen.getByText('估算费用 / 运营参考')).toBeInTheDocument();
    expect(screen.getByText('厂商 / 模型维度')).toBeInTheDocument();
    expect(screen.getByText('业务场景维度')).toBeInTheDocument();
    expect(screen.getByText('示例机构排行')).toBeInTheDocument();

    expectNoForbiddenAiReadonlyContent(container);
  });

  it('平台导航可进入 AI 模型与用量面板，且不触发 mutation 或高风险入口', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<PlatformConsole />);

    expect(screen.getByRole('button', { name: 'AI 配额边界' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI 模型与用量' }));

    expect(screen.getByRole('heading', { name: 'AI 模型与用量' })).toBeInTheDocument();
    expect(screen.getByText('当前为受控示例数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：AI 模型与用量' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步模型/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /测试调用/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出账单/ })).not.toBeInTheDocument();
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
