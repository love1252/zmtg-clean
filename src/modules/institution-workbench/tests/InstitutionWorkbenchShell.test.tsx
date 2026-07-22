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
    expect(screen.getByRole('link', { name: '待确认预约，数据可用，2项，查看详情' })).toHaveAttribute(
      'href',
      '/hospital/care/appointments?status=pending_confirmation',
    );
    expect(screen.getByRole('link', { name: '改约申请，已确认暂无待办，查看详情' })).toHaveAttribute(
      'href',
      '/hospital/care/appointments?status=reschedule_requested',
    );

    const queue = screen.getByRole('list', { name: '行动队列' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    const queue = screen.getByRole('region', { name: '行动队列' });
    expect(within(queue).getByText('部分行动数据当前不可用；仅显示可验证行动')).toBeInTheDocument();
    expect(within(queue).queryByText('当前筛选暂无行动')).not.toBeInTheDocument();
    expect(within(queue).queryByRole('list', { name: '行动队列' })).not.toBeInTheDocument();
    expect(within(queue).queryAllByRole('link', { name: /查看.+详情/ })).toHaveLength(0);
    expect(within(queue).queryAllByTestId('mobile-action')).toHaveLength(0);
  });

  it.each([
    { care: 'stale', conversation: 'ready' },
    { care: 'ready', conversation: 'unavailable' },
    { care: 'denied', conversation: 'ready' },
    { care: 'ready', conversation: 'disabled' },
  ] as const)(
    '在任一行动来源为 $care/$conversation 且无行动时，桌面与移动端均保持未知值语义',
    (sourceReadiness) => {
      render(
        <InstitutionWorkbenchShell
          actionProjection={{
            status: 'projected',
            filter: 'all',
            sourceReadiness,
            cards: [],
            desktopActions: [],
            mobileActions: [],
          }}
          lifecycleProjection={readyLifecycleProjection}
          capabilityProjection={readyCapabilityProjection}
        />,
      );

      const queue = screen.getByRole('region', { name: '行动队列' });
      expect(within(queue).getByText('部分行动数据当前不可用；仅显示可验证行动')).toBeInTheDocument();
      expect(within(queue).queryByText('当前筛选暂无行动')).not.toBeInTheDocument();
      expect(within(queue).queryByRole('list', { name: '行动队列' })).not.toBeInTheDocument();
      expect(within(queue).queryAllByRole('link', { name: /查看.+详情/ })).toHaveLength(0);
      expect(within(queue).queryAllByTestId('mobile-action')).toHaveLength(0);
    },
  );

  it('在来源部分可用且仍有已验证行动时保留行动，并提示队列不是完整视图', () => {
    const action = readyActionProjection.desktopActions[0];
    if (action === undefined) {
      throw new Error('expected ready action fixture');
    }

    render(
      <InstitutionWorkbenchShell
        actionProjection={{
          ...readyActionProjection,
          sourceReadiness: { care: 'partial', conversation: 'ready' },
          desktopActions: [action],
          mobileActions: [action],
        }}
        lifecycleProjection={readyLifecycleProjection}
        capabilityProjection={readyCapabilityProjection}
      />,
    );

    const queue = screen.getByRole('region', { name: '行动队列' });
    expect(within(queue).getByRole('status')).toHaveTextContent(
      '部分行动数据当前不可用；仅显示可验证行动',
    );
    expect(within(queue).getByRole('list', { name: '行动队列' })).toBeInTheDocument();
    expect(within(queue).getByRole('link', { name: '查看客户甲的预约详情' })).toBeInTheDocument();
  });

  it.each([
    { care: 'ready', conversation: 'ready' },
    { care: 'ready', conversation: 'empty' },
    { care: 'empty', conversation: 'ready' },
    { care: 'empty', conversation: 'empty' },
  ] as const)(
    '仅在 Care 与会话均为 ready 或 empty（$care/$conversation）且无行动时显示确认空态',
    (sourceReadiness) => {
      render(
        <InstitutionWorkbenchShell
          actionProjection={{
            status: 'projected',
            filter: 'all',
            sourceReadiness,
            cards: [],
            desktopActions: [],
            mobileActions: [],
          }}
          lifecycleProjection={readyLifecycleProjection}
          capabilityProjection={readyCapabilityProjection}
        />,
      );

      const queue = screen.getByRole('region', { name: '行动队列' });
      expect(within(queue).getByText('当前筛选暂无行动')).toBeInTheDocument();
      expect(within(queue).queryByText('部分行动数据当前不可用；仅显示可验证行动')).not.toBeInTheDocument();
      expect(within(queue).queryByRole('list', { name: '行动队列' })).not.toBeInTheDocument();
      expect(within(queue).queryAllByRole('link', { name: /查看.+详情/ })).toHaveLength(0);
      expect(within(queue).queryAllByTestId('mobile-action')).toHaveLength(0);
    },
  );

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

    expect(
      screen.getByRole('region', { name: '数据服务/能力尚未安全开放' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前仅展示安全阻断状态；业务数据和业务入口保持隐藏。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('聚合已授权的预约、随访与会话信息，帮助团队优先处理需要关注的事项。'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '工作台行动数据暂未开放', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('待确认预约、改约申请、逾期随访、今日到期随访和行动队列当前保持隐藏。')).toBeInTheDocument();
    expect(screen.getByText('只有可验证来源、机构隔离、服务端成员与对象权限完成后，才会显示低敏投影。')).toBeInTheDocument();
    expect(screen.getByText('这不是“零数据”状态，因此未知值不会显示为 0。')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '行动队列' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '客户旅程' })).not.toBeInTheDocument();
    expect(screen.queryByText('新建')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /查看|新建/u })).toHaveLength(0);
  });

  it('任一 projection 已投影时不展示全局行动阻断说明', () => {
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
        capabilityProjection={readyCapabilityProjection}
      />,
    );

    expect(screen.queryByRole('heading', { name: '工作台行动数据暂未开放', level: 3 })).not.toBeInTheDocument();
    expect(
      screen.getByText('聚合已授权的预约、随访与会话信息，帮助团队优先处理需要关注的事项。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('当前仅展示安全阻断状态；业务数据和业务入口保持隐藏。'),
    ).not.toBeInTheDocument();
  });
});
