import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionWorkbenchShell } from '@/modules/institution-workbench/components/InstitutionWorkbenchShell';
import type { WorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import type { WorkbenchLifecycleProjection } from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const blockedActionProjection: WorkbenchActionProjection = {
  status: 'blocked',
  filter: 'all',
  cards: [],
  desktopActions: [],
  mobileActions: [],
};

const blockedCapabilityProjection: WorkbenchCapabilityProjection = {
  status: 'blocked',
  summaries: [],
  quickCreateMenu: null,
};

function renderLifecycle(lifecycleProjection: WorkbenchLifecycleProjection) {
  return render(
    <InstitutionWorkbenchShell
      actionProjection={blockedActionProjection}
      lifecycleProjection={lifecycleProjection}
      capabilityProjection={blockedCapabilityProjection}
    />,
  );
}

describe('InstitutionWorkbenchShell customer lifecycle status', () => {
  it('在 partial 下为桌面与移动共用的旅程列表明确状态、未知值与安全链接', () => {
    renderLifecycle({
      status: 'projected',
      sourceReadiness: 'partial',
      items: [
        {
          key: 'consulting',
          label: '咨询中',
          status: 'empty',
          count: 0,
          canonicalHref: '/hospital/customers?lifecycle=consulting',
        },
        {
          key: 'scheduled',
          label: '已预约',
          status: 'stale',
          count: 3,
          observedAt: '2026-07-18T01:00:00.000Z',
          canonicalHref: '/hospital/customers?lifecycle=scheduled',
        },
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'stale',
          count: null,
          observedAt: null,
          canonicalHref: null,
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'unavailable',
          count: null,
          canonicalHref: null,
        },
      ],
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      '客户旅程仅部分可验证；其余数据当前不可用',
    );

    const lifecycle = screen.getByRole('list', { name: '客户旅程' });
    expect(within(lifecycle).getAllByRole('listitem')).toHaveLength(4);
    expect(within(lifecycle).getByText('暂无客户')).toBeInTheDocument();
    expect(within(lifecycle).getAllByText('数据已过期')).toHaveLength(2);
    expect(within(lifecycle).getByText('数据未知')).toBeInTheDocument();
    expect(within(lifecycle).getAllByText('--')).toHaveLength(2);
    expect(within(lifecycle).getByText('截至 2026-07-18T01:00:00.000Z')).toBeInTheDocument();
    expect(within(lifecycle).getByRole('link', { name: '查看咨询中客户' })).toHaveAttribute(
      'href',
      '/hospital/customers?lifecycle=consulting',
    );
    expect(within(lifecycle).getByRole('link', { name: '查看已预约客户' })).toHaveAttribute(
      'href',
      '/hospital/customers?lifecycle=scheduled',
    );
    expect(within(lifecycle).queryByRole('link', { name: '查看术后关怀客户' })).not.toBeInTheDocument();
    expect(within(lifecycle).queryByRole('link', { name: '查看复购窗口客户' })).not.toBeInTheDocument();
  });

  it('将 ready 与 empty 区分为当前可用和权威确认空态', () => {
    renderLifecycle({
      status: 'projected',
      sourceReadiness: 'ready',
      items: [
        {
          key: 'consulting',
          label: '咨询中',
          status: 'ready',
          count: 2,
          canonicalHref: '/hospital/customers?lifecycle=consulting',
        },
        {
          key: 'scheduled',
          label: '已预约',
          status: 'empty',
          count: 0,
          canonicalHref: '/hospital/customers?lifecycle=scheduled',
        },
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'ready',
          count: 1,
          canonicalHref: '/hospital/customers?lifecycle=post_care',
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'ready',
          count: 4,
          canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
        },
      ],
    });

    const lifecycle = screen.getByRole('list', { name: '客户旅程' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(lifecycle).getAllByText('数据可用')).toHaveLength(3);
    expect(within(lifecycle).getByText('暂无客户')).toBeInTheDocument();
    expect(within(lifecycle).getByText('0')).toBeInTheDocument();
  });

  it.each(['denied', 'disabled'] as const)('在 %s 被投影阻断时不输出客户旅程业务项', () => {
    renderLifecycle({ status: 'blocked', items: [] });

    expect(
      screen.getByRole('region', { name: '数据服务/能力尚未安全开放' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '客户旅程' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
