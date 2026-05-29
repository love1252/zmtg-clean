import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenPlatformGovernancePanel } from '@/modules/open-platform/components/OpenPlatformGovernancePanel';

describe('OpenPlatformGovernancePanel', () => {
  it('renders the governance baseline without exposing real integrations', () => {
    render(<OpenPlatformGovernancePanel />);

    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('租户隔离原则')).toBeInTheDocument();
    expect(screen.getByText('权限样例矩阵')).toBeInTheDocument();
    expect(screen.getByText('连接生命周期')).toBeInTheDocument();
    expect(screen.getByText('审计事件词汇')).toBeInTheDocument();

    expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
    expect(screen.getAllByText('平台超级管理员').length).toBeGreaterThan(0);
    expect(screen.getByText('API Key 生命周期')).toBeInTheDocument();
    expect(screen.getByText('OAuth 应用生命周期')).toBeInTheDocument();
    expect(screen.getByText('Webhook 生命周期')).toBeInTheDocument();
    expect(screen.getByText('租户边界事件')).toBeInTheDocument();

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('第一阶段不生成真实密钥');
    expect(serialized).not.toContain('client_secret');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('webhook_secret');
  });
});
