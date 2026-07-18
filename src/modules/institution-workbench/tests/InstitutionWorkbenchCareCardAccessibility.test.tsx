import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionWorkbenchShell } from '@/modules/institution-workbench/components/InstitutionWorkbenchShell';
import type { WorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import type { WorkbenchLifecycleProjection } from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const capabilityProjection: WorkbenchCapabilityProjection = {
  status: 'blocked',
  summaries: [],
  quickCreateMenu: null,
};

const lifecycleProjection: WorkbenchLifecycleProjection = { status: 'blocked', items: [] };

const actionProjection: WorkbenchActionProjection = {
  status: 'projected',
  filter: 'all',
  sourceReadiness: { care: 'partial', conversation: 'disabled' },
  cards: [
    {
      key: 'pending_confirmation_appointments',
      title: '待确认预约',
      status: 'ready',
      count: 3,
      observedAt: '2026-07-18T01:00:00.000Z',
      canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
    },
    {
      key: 'reschedule_requested_appointments',
      title: '改约申请',
      status: 'empty',
      count: 0,
      observedAt: '2026-07-18T01:00:00.000Z',
      canonicalHref: '/hospital/care/appointments?status=reschedule_requested',
    },
    {
      key: 'overdue_followups',
      title: '逾期随访',
      status: 'stale',
      count: null,
      observedAt: null,
    },
    {
      key: 'today_due_followups',
      title: '今日到期随访',
      status: 'unavailable',
      count: null,
    },
  ],
  desktopActions: [],
  mobileActions: [],
};

describe('InstitutionWorkbenchShell Care card accessibility', () => {
  it('仅为可导航的当前卡提供包含状态与真实计数的可访问名称', () => {
    render(
      <InstitutionWorkbenchShell
        actionProjection={actionProjection}
        lifecycleProjection={lifecycleProjection}
        capabilityProjection={capabilityProjection}
      />,
    );

    expect(
      screen.getByRole('link', { name: '待确认预约，数据可用，3项，查看详情' }),
    ).toHaveAttribute('href', '/hospital/care/appointments?status=pending_confirmation');
    expect(
      screen.getByRole('link', { name: '改约申请，已确认暂无待办，查看详情' }),
    ).toHaveAttribute('href', '/hospital/care/appointments?status=reschedule_requested');

    const staleCard = screen.getByText('逾期随访').closest('li');
    const unavailableCard = screen.getByText('今日到期随访').closest('li');
    expect(staleCard).not.toBeNull();
    expect(unavailableCard).not.toBeNull();
    expect(within(staleCard!).queryByRole('link')).not.toBeInTheDocument();
    expect(within(unavailableCard!).queryByRole('link')).not.toBeInTheDocument();
    expect(within(staleCard!).getByText('数据已过期')).toBeInTheDocument();
    expect(within(unavailableCard!).getByText('暂不可用')).toBeInTheDocument();
    expect(within(staleCard!).getByText('--')).toBeInTheDocument();
    expect(within(unavailableCard!).getByText('--')).toBeInTheDocument();
  });
});
