import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPlanPanel } from '@/modules/open-platform/components/ProductPlanPanel';

describe('产品与套餐面板', () => {
  it('渲染只读产品套餐视图且不暴露敏感信息', () => {
    render(<ProductPlanPanel />);

    expect(screen.getByRole('heading', { name: '产品与套餐' })).toBeInTheDocument();
    expect(screen.getByText(/套餐权益对照表作为长期路线词汇预留/)).toBeInTheDocument();

    expect(screen.getByText('Starter 基础版')).toBeInTheDocument();
    expect(screen.getByText('Professional 专业版')).toBeInTheDocument();
    expect(screen.getByText('Enterprise 集团版')).toBeInTheDocument();

    expect(screen.getAllByText('Agent 数量').length).toBe(3);
    expect(screen.getAllByText('员工席位').length).toBe(3);
    expect(screen.getAllByText('连接器').length).toBeGreaterThanOrEqual(3);

    expect(screen.getAllByText('参考价（未定价）').length).toBe(3);
    expect(screen.getByText(/套餐权益对比为长期路线只读词汇/)).toBeInTheDocument();

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('定价、下单、续费');
    expect(serialized).not.toContain('演示环境权益词汇');
    expect(serialized).not.toContain('stripe');
    expect(serialized).not.toContain('payment');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
  });
});
