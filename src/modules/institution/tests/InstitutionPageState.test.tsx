import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import type { TenantBusinessClientError } from '@/modules/institution/client/tenant-business-client';

function clientError(input: Partial<TenantBusinessClientError>): TenantBusinessClientError {
  return {
    kind: input.kind ?? 'unknown',
    message: input.message ?? '请求失败',
    status: input.status ?? 500,
  };
}

describe('机构页面共享状态组件', () => {
  it('展示统一加载态', () => {
    render(<InstitutionPageState kind="loading" title="正在加载客户数据..." />);

    expect(screen.getByRole('status')).toHaveTextContent('正在加载客户数据...');
  });

  it('展示统一空状态', () => {
    render(
      <InstitutionPageState
        kind="empty"
        title="暂无客户摘要"
        description="可以先创建一条只包含脱敏展示字段的客户摘要。"
      />,
    );

    expect(screen.getByText('暂无客户摘要')).toBeInTheDocument();
    expect(
      screen.getByText('可以先创建一条只包含脱敏展示字段的客户摘要。'),
    ).toBeInTheDocument();
  });

  it.each([
    [clientError({ kind: 'unauthorized', message: '请先登录', status: 401 }), '登录状态已失效，请重新登录'],
    [clientError({ kind: 'forbidden', message: '没有访问权限', status: 403 }), '当前账号没有访问客户数据的权限'],
    [clientError({ kind: 'service_unavailable', message: 'DATABASE_URL 连接失败', status: 503 }), '数据服务暂时不可用'],
  ])('将 %s 映射为稳定中文错误文案', (error, visibleMessage) => {
    const state = getInstitutionPageStateFromClientError(error, {
      forbiddenMessage: '当前账号没有访问客户数据的权限',
      fallbackMessage: '客户数据请求失败',
    });

    render(<InstitutionPageState {...state} />);

    expect(screen.getByText(visibleMessage)).toBeInTheDocument();
    expect(screen.queryByText(/DATABASE_URL/i)).not.toBeInTheDocument();
  });

  it('未知错误不透出敏感服务端细节', () => {
    const state = getInstitutionPageStateFromClientError(
      clientError({
        kind: 'unknown',
        message: 'SQL failed with DATABASE_URL=postgres://secret',
        status: 500,
      }),
      {
        forbiddenMessage: '当前账号没有访问客户数据的权限',
        fallbackMessage: '客户数据请求失败',
      },
    );

    expect(state).toMatchObject({ kind: 'error', title: '客户数据请求失败' });
    expect(JSON.stringify(state)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(state)).not.toContain('postgres://secret');
  });

  it('展示统一页面标题和操作区', () => {
    render(
      <InstitutionSectionHeader
        eyebrow="客户运营"
        title="客户中心"
        description="从机构客户 API 加载脱敏客户摘要。"
        action={<button type="button">筛选客户</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('客户运营')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '筛选客户' })).toBeInTheDocument();
  });
});
