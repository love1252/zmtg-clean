import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('支持受控月份切换并展示无用量空状态', () => {
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
    expect(screen.queryByRole('button', { name: /保存 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /显示 Key/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自动扣费/ })).not.toBeInTheDocument();
    expectNoMutationFetch(fetchMock);
    expectNoForbiddenAiReadonlyContent(container);
  });
});
