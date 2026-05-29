import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';

describe('workspace entry pages', () => {
  it('renders the institution dashboard shell', () => {
    render(<HospitalPage />);

    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getAllByText('智美天工').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '智能体中心' })).toBeInTheDocument();
    expect(screen.getByText('AI经营副驾驶建议')).toBeInTheDocument();
    expect(screen.getByText('累计客户数')).toBeInTheDocument();
  });

  it('renders the platform console shell', () => {
    render(<OpenPlatformPage />);

    expect(screen.getAllByRole('heading', { name: '智美天工管理后台' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform Console').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByText('Agent调用总量')).toBeInTheDocument();
    expect(screen.getByText('系统健康状态')).toBeInTheDocument();
  });
});
