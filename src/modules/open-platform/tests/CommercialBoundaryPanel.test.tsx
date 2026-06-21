import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommercialBoundaryPanel } from '@/modules/open-platform/components/CommercialBoundaryPanel';

describe('商业化边界面板', () => {
  it('渲染只读商业化词汇视图且不暴露敏感信息', () => {
    render(<CommercialBoundaryPanel />);

    expect(screen.getByRole('heading', { name: '商业化边界' })).toBeInTheDocument();
    expect(screen.getByText(/当前展示计费、订单、合同、发票的词汇预留/)).toBeInTheDocument();

    expect(screen.getAllByText('计费模式').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('订单管理').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('合同管理')).toBeInTheDocument();
    expect(screen.getByText('发票管理')).toBeInTheDocument();

    expect(screen.getByText('商业化健康信号')).toBeInTheDocument();
    expect(screen.getByText('缺少有效套餐')).toBeInTheDocument();
    expect(screen.getByText('缺少配额上限')).toBeInTheDocument();
    expect(screen.getByText('Quota denied 事件')).toBeInTheDocument();
    expect(screen.getByText('配额快照过期')).toBeInTheDocument();

    expect(screen.getAllByText('词汇预留').length).toBeGreaterThanOrEqual(4);

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('法务合规评估');
    expect(serialized).not.toContain('payment_provider');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
  });
});
