import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiQuotaBoundaryPanel } from '@/modules/open-platform/components/AiQuotaBoundaryPanel';

describe('AI 配额边界面板', () => {
  it('渲染只读配额治理视图且不暴露敏感信息', () => {
    render(<AiQuotaBoundaryPanel />);

    expect(screen.getByRole('heading', { name: 'AI 配额边界' })).toBeInTheDocument();
    expect(screen.getByText(/当前未启用真实配额管控/)).toBeInTheDocument();
    expect(screen.getByText('配额维度概览')).toBeInTheDocument();
    expect(screen.getByText('Quota Denied 占位')).toBeInTheDocument();

    expect(screen.getByText('客户')).toBeInTheDocument();
    expect(screen.getByText('预约')).toBeInTheDocument();
    expect(screen.getByText('随访')).toBeInTheDocument();
    expect(screen.getByText('AI 调用')).toBeInTheDocument();

    expect(screen.getAllByText('未启用真实配额').length).toBeGreaterThanOrEqual(4);

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('不反映');
    expect(serialized).toContain('不执行真实');
    expect(serialized).not.toContain('演示租户示例');
    expect(serialized).not.toContain('演示环境');
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
    expect(serialized).not.toContain('access_token');
  });
});
