import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenConnectionRoadmapPanel } from '@/modules/open-platform/components/OpenConnectionRoadmapPanel';

describe('开放连接路线面板', () => {
  it('渲染只读开放连接路线视图且不暴露敏感信息', () => {
    render(<OpenConnectionRoadmapPanel />);

    expect(screen.getByRole('heading', { name: '开放连接路线' })).toBeInTheDocument();
    expect(screen.getByText('连接器路线一览')).toBeInTheDocument();

    expect(screen.getByText('Phase 1 已就绪')).toBeInTheDocument();
    expect(screen.getByText('Phase 2 词汇预留')).toBeInTheDocument();
    expect(screen.getByText('Phase 3 长期路线')).toBeInTheDocument();

    expect(screen.getByText('企业微信')).toBeInTheDocument();
    expect(screen.getByText('HIS 系统')).toBeInTheDocument();
    expect(screen.getByText('CRM 系统')).toBeInTheDocument();
    expect(screen.getByText('第三方平台')).toBeInTheDocument();

    expect(screen.getAllByText('长期路线').length).toBeGreaterThanOrEqual(6);

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('不生成真实密钥');
    expect(serialized).not.toContain('callback_url');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
    expect(serialized).not.toContain('webhook_secret');
  });
});
