import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  InstitutionLoginClient,
  PlatformLoginClient,
} from '@/modules/auth/components/ConfiguredLoginPages';
import {
  cloneHomepageBrandConfig,
  defaultHomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

describe('登录页外壳', () => {
  it('渲染机构登录文案', () => {
    render(<InstitutionLoginClient config={defaultHomepageBrandConfig} />);

    expect(screen.getByRole('heading', { name: '机构工作台登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名 / 手机号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '平台管理员入口' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/platform-login');
    });
  });

  it('渲染平台登录文案', () => {
    render(<PlatformLoginClient config={defaultHomepageBrandConfig} />);

    expect(screen.getByRole('heading', { name: '平台管理员登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('管理员账号')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    screen.getAllByRole('link', { name: '机构工作台入口' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  it('登录页使用首页与品牌中的登录页配置', () => {
    const config = cloneHomepageBrandConfig(defaultHomepageBrandConfig);
    config.login.institution.title = '机构入口新版';
    config.login.institution.accentTitle = '统一品牌视觉';
    config.login.institution.formTitle = '机构统一登录';
    config.login.institution.submitLabel = '进入新版机构后台';
    config.login.institution.metrics[0] = {
      value: '48%',
      label: '自定义转化指标',
      detail: '来自平台端登录页管理配置',
    };
    config.login.platform.formTitle = '平台统一登录';
    config.login.platform.submitLabel = '安全进入平台';

    render(<InstitutionLoginClient config={config} />);

    expect(screen.getByRole('heading', { name: /机构入口新版\s*统一品牌视觉/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '机构统一登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入新版机构后台/ })).toBeInTheDocument();
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByText('自定义转化指标')).toBeInTheDocument();

    render(<PlatformLoginClient config={config} />);

    expect(screen.getByRole('heading', { name: '平台统一登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /安全进入平台/ })).toBeInTheDocument();
  });
});
