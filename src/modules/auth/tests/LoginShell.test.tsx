import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginShell } from '@/modules/auth/components/LoginShell';

describe('LoginShell', () => {
  it('renders institution login copy', () => {
    render(<LoginShell variant="institution" />);

    expect(screen.getByRole('heading', { name: '机构工作台登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名 / 手机号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });

  it('renders platform login copy', () => {
    render(<LoginShell variant="platform" />);

    expect(screen.getByRole('heading', { name: '平台管理后台登录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '机构入口' })).toHaveAttribute('href', '/login');
  });
});
