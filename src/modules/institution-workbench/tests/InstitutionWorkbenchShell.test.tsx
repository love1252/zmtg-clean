import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionWorkbenchShell } from '@/modules/institution-workbench/components/InstitutionWorkbenchShell';
import type { WorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-view-models';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import type { WorkbenchLifecycleProjection } from '@/modules/institution-workbench/domain/workbench-lifecycle-view-models';

const readyActionProjection: WorkbenchActionProjection = {
  status: 'projected',
  filter: 'all',
  sourceReadiness: { care: 'ready', conversation: 'ready' },
  cards: [
    {
      key: 'pending_confirmation_appointments',
      title: '待确认预约',
      status: 'ready',
      count: 2,
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
      status: 'ready',
      count: 1,
      observedAt: '2026-07-18T01:00:00.000Z',
      canonicalHref: '/hospital/care/followups?bucket=overdue',
    },
    {
      key: 'today_due_followups',
      title: '今日到期随访',
      status: 'ready',
      count: 3,
      observedAt: '2026-07-18T01:00:00.000Z',
      canonicalHref: '/hospital/care/followups?bucket=today',
    },
  ],
  desktopActions: [
    {
      key: 'appointment:appointment-1',
      kind: 'appointment',
      subject: { kind: 'customer', displayName: '客户甲', maskedReference: '客户-**01' },
      sortSignals: ['urgent'],
      priority: 'high',
      slaAt: '2026-07-18T02:00:00.000Z',
      safeSummary: '预约需要确认。',
      businessState: 'pending_confirmation',
      cardKeys: ['pending_confirmation_appointments'],
      appointmentAt: '2026-07-18T03:00:00.000Z',
      riskLevel: 'urgent',
      owner: { kind: 'user', displayName: '咨询师甲' },
      detailHref: '/hospital/care/appointments/appointment-1',
    },
    {
      key: 'followup:followup-1',
      kind: 'followup',
      subject: { kind: 'customer', displayName: '客户乙', maskedReference: null },
      sortSignals: ['overdue'],
      priority: 'high',
      slaAt: null,
      safeSummary: '随访已逾期。',
      businessState: 'pending',
      cardKeys: ['overdue_followups'],
      dueAt: '2026-07-18T04:00:00.000Z',
      riskLevel: 'watch',
      owner: null,
      detailHref: '/hospital/care/followups/followup-1',
    },
    {
      key: 'conversation:conversation-1',
      kind: 'conversation',
      subject: { kind: 'unmatched_contact', label: '待匹配联系人' },
      sortSignals: ['sla_due'],
      priority: 'high',
      slaAt: '2026-07-18T05:00:00.000Z',
      safeSummary: '需要人工处理。',
      conversationState: 'awaiting_human',
      riskState: 'none',
      partitions: ['waiting_human'],
      lastCustomerMessageAt: '2026-07-18T04:30:00.000Z',
      assignee: { displayName: '客服甲' },
      detailHref: '/hospital/conversations/conversation-1',
    },
    {
      key: 'appointment:appointment-2',
      kind: 'appointment',
      subject: { kind: 'customer', displayName: '客户丙', maskedReference: null },
      sortSignals: ['today'],
      priority: 'normal',
      slaAt: null,
      safeSummary: null,
      businessState: 'confirmed',
      cardKeys: ['reschedule_requested_appointments'],
      appointmentAt: '2026-07-18T06:00:00.000Z',
      riskLevel: 'normal',
      owner: { kind: 'role_pool', role: 'consultant' },
      detailHref: '/hospital/care/appointments/appointment-2',
    },
    {
      key: 'followup:followup-2',
      kind: 'followup',
      subject: { kind: 'customer', displayName: '客户丁', maskedReference: null },
      sortSignals: ['high_priority'],
      priority: 'high',
      slaAt: null,
      safeSummary: null,
      businessState: 'in_progress',
      cardKeys: ['today_due_followups'],
      dueAt: '2026-07-18T07:00:00.000Z',
      riskLevel: 'normal',
      owner: null,
      detailHref: '/hospital/care/followups/followup-2',
    },
    {
      key: 'conversation:conversation-2',
      kind: 'conversation',
      subject: { kind: 'customer', displayName: '客户戊', maskedReference: '客户-**05' },
      sortSignals: [],
      priority: 'normal',
      slaAt: null,
      safeSummary: null,
      conversationState: 'human_handling',
      riskState: 'confirmed',
      partitions: ['unresolved_risk'],
      lastCustomerMessageAt: '2026-07-18T08:00:00.000Z',
      assignee: null,
      detailHref: '/hospital/conversations/conversation-2',
    },
  ],
  mobileActions: [],
};

const readyLifecycleProjection: WorkbenchLifecycleProjection = {
  status: 'projected',
  sourceReadiness: 'ready',
  items: [
    {
      key: 'repurchase_window',
      label: '复购窗口',
      status: 'ready',
      count: 4,
      canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
    },
    {
      key: 'consulting',
      label: '咨询中',
      status: 'ready',
      count: 1,
      canonicalHref: '/hospital/customers?lifecycle=consulting',
    },
    {
      key: 'post_care',
      label: '术后关怀',
      status: 'ready',
      count: 3,
      canonicalHref: '/hospital/customers?lifecycle=post_care',
    },
    {
      key: 'scheduled',
      label: '已预约',
      status: 'ready',
      count: 2,
      canonicalHref: '/hospital/customers?lifecycle=scheduled',
    },
  ],
};

const readyCapabilityProjection: WorkbenchCapabilityProjection = {
  status: 'projected',
  sourceReadiness: 'ready',
  summaries: [
    {
      key: 'page_workbench',
      kind: 'page',
      label: '工作台',
      decision: 'read_only',
      safeSummary: '当前仅展示已授权的低敏摘要。',
      diagnosticTarget: null,
      dataStatus: 'current',
      observedAt: null,
    },
  ],
  quickCreateMenu: {
    label: '新建',
    items: [
      {
        key: 'action_customer_create',
        label: '新建客户',
        href: '/hospital/customers?create=1',
      },
    ],
  },
};

describe('InstitutionWorkbenchShell', () => {
  it('仅渲染既有投影：四张 Care 卡、四类生命周期和安全行动链接', () => {
    render(
      <InstitutionWorkbenchShell
        actionProjection={readyActionProjection}
        lifecycleProjection={readyLifecycleProjection}
        capabilityProjection={readyCapabilityProjection}
      />,
    );

    expect(screen.getByRole('heading', { name: '工作台', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '工作台' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '待确认预约详情' })).toHaveAttribute(
      'href',
      '/hospital/care/appointments?status=pending_confirmation',
    );
    expect(screen.getByRole('link', { name: '改约申请详情' })).toHaveAttribute(
      'href',
      '/hospital/care/appointments?status=reschedule_requested',
    );

    const queue = screen.getByRole('list', { name: '行动队列' });
    expect(within(queue).getAllByRole('listitem')).toHaveLength(6);
    expect(within(queue).getAllByRole('link', { name: /查看.+详情/ })).toHaveLength(6);
    expect(
      within(queue)
        .getAllByRole('link', { name: /查看.+详情/ })
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual([
      '查看客户甲的预约详情',
      '查看客户乙的随访详情',
      '查看待匹配联系人的会话详情',
      '查看客户丙的预约详情',
      '查看客户丁的随访详情',
      '查看客户戊的会话详情',
    ]);
    expect(within(queue).getAllByTestId('mobile-action')).toHaveLength(4);
    expect(within(queue).getAllByTestId('mobile-action').map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('客户甲'),
        expect.stringContaining('客户乙'),
        expect.stringContaining('待匹配联系人'),
        expect.stringContaining('客户丙'),
      ]),
    );
    expect(within(queue).getByRole('link', { name: '查看客户甲的预约详情' })).toHaveAttribute(
      'href',
      '/hospital/care/appointments/appointment-1',
    );

    const lifecycle = screen.getByRole('list', { name: '客户旅程' });
    expect(within(lifecycle).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('咨询中'),
      expect.stringContaining('已预约'),
      expect.stringContaining('术后关怀'),
      expect.stringContaining('复购窗口'),
    ]);
    expect(screen.queryByText('silent_reactivation')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新建客户' })).toHaveAttribute(
      'href',
      '/hospital/customers?create=1',
    );
  });

  it('按现有投影展示 partial、stale、unavailable，且不合成无 HIS 的预约卡', () => {
    const partialActions: WorkbenchActionProjection = {
      status: 'projected',
      filter: 'all',
      sourceReadiness: { care: 'partial', conversation: 'unavailable' },
      cards: [
        {
          key: 'overdue_followups',
          title: '逾期随访',
          status: 'stale',
          count: 8,
          observedAt: '2026-07-18T01:00:00.000Z',
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
    const degradedLifecycle: WorkbenchLifecycleProjection = {
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
          count: null,
          observedAt: null,
          canonicalHref: null,
        },
        {
          key: 'post_care',
          label: '术后关怀',
          status: 'unavailable',
          count: null,
          canonicalHref: null,
        },
        {
          key: 'repurchase_window',
          label: '复购窗口',
          status: 'stale',
          count: 1,
          observedAt: '2026-07-18T01:00:00.000Z',
          canonicalHref: '/hospital/customers?lifecycle=repurchase_window',
        },
      ],
    };

    render(
      <InstitutionWorkbenchShell
        actionProjection={partialActions}
        lifecycleProjection={degradedLifecycle}
        capabilityProjection={{
          status: 'projected',
          sourceReadiness: 'stale',
          summaries: readyCapabilityProjection.summaries,
          quickCreateMenu: readyCapabilityProjection.quickCreateMenu,
        }}
      />,
    );

    expect(screen.queryByText('待确认预约')).not.toBeInTheDocument();
    expect(screen.queryByText('改约申请')).not.toBeInTheDocument();
    expect(screen.getAllByText('截至 2026-07-18T01:00:00.000Z')).toHaveLength(2);
    expect(screen.getAllByText('--')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: '逾期随访详情' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '今日到期随访详情' })).not.toBeInTheDocument();
    expect(screen.getByText('当前筛选暂无行动')).toBeInTheDocument();
  });

  it('在 denied 或 disabled 已被投影阻断时不展示业务数据或受控创建入口', () => {
    render(
      <InstitutionWorkbenchShell
        actionProjection={{
          status: 'blocked',
          filter: 'all',
          cards: [],
          desktopActions: [],
          mobileActions: [],
        }}
        lifecycleProjection={{ status: 'blocked', items: [] }}
        capabilityProjection={{ status: 'blocked', summaries: [], quickCreateMenu: null }}
      />,
    );

    expect(screen.getByText('工作台当前不可用')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '行动队列' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '客户旅程' })).not.toBeInTheDocument();
    expect(screen.queryByText('新建')).not.toBeInTheDocument();
  });
});
