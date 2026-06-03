import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenPlatformGovernancePanel } from '@/modules/open-platform/components/OpenPlatformGovernancePanel';

describe('开放平台治理面板', () => {
  it('渲染治理基线且不暴露真实集成能力', () => {
    render(<OpenPlatformGovernancePanel />);

    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('长期路线治理词汇')).toBeInTheDocument();
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
    expect(screen.getByText('读取租户聚合态势')).toBeInTheDocument();
    expect(screen.getAllByText('事件编号').length).toBeGreaterThan(0);
    expect(screen.getAllByText('租户范围').length).toBeGreaterThan(0);

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('不代表真实生产能力已完成');
    expect(serialized).toContain('第一阶段不生成真实密钥');
    expect(serialized).not.toContain('phase 1 governance baseline');
    expect(serialized).not.toContain('webhook 已接入');
    expect(serialized).not.toContain('oauth 已接入');
    expect(serialized).not.toContain('tenant.aggregate.read');
    expect(serialized).not.toContain('eventid');
    expect(serialized).not.toContain('tenantscope');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
    expect(serialized).not.toContain(['access', '_token'].join(''));
    expect(serialized).not.toContain(['webhook', '_secret'].join(''));
  });
});
