import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';
import PlatformLoginPage from '@/app/(auth)/platform-login/page';

describe('LoginShell', () => {
  it('renders institution login copy', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: '机构工作台登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名 / 手机号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '平台管理员入口' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/platform-login');
    });
  });

  it('renders platform login copy', () => {
    render(<PlatformLoginPage />);

    expect(screen.getByRole('heading', { name: '平台管理员登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('管理员账号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '机构工作台入口' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
  });
});
