import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomepageBrandPanel } from '@/modules/open-platform/components/HomepageBrandPanel';

describe('首页与品牌面板', () => {
  it('渲染只读品牌治理视图且不暴露敏感信息', () => {
    render(<HomepageBrandPanel />);

    expect(screen.getByRole('heading', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.getByText('品牌治理视图')).toBeInTheDocument();
    expect(screen.getByText('平台品牌标识')).toBeInTheDocument();
    expect(screen.getByText('首页模块布局')).toBeInTheDocument();

    expect(screen.getByText('智美天工管理后台')).toBeInTheDocument();
    expect(screen.getByText('智美天工')).toBeInTheDocument();

    expect(screen.getByText('Hero 横幅')).toBeInTheDocument();
    expect(screen.getByText('Features 特色')).toBeInTheDocument();
    expect(screen.getByText('Stats 数据')).toBeInTheDocument();
    expect(screen.getByText('Clients 案例')).toBeInTheDocument();
    expect(screen.getByText('Plans 套餐')).toBeInTheDocument();
    expect(screen.getByText('Footer 页脚')).toBeInTheDocument();

    expect(screen.getAllByText('占位词汇').length).toBe(6);

    const serialized = document.body.textContent?.toLowerCase() ?? '';
    expect(serialized).toContain('后续单独授权');
    expect(serialized).not.toContain('upload');
    expect(serialized).not.toContain(['client', '_secret'].join(''));
  });
});
