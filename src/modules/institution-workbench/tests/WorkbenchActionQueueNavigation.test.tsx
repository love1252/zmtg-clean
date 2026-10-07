import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchActionQueue } from '../components/WorkbenchActionQueue';
import type { WorkbenchActionProjection, WorkbenchActionRowViewModel } from '../domain/workbench-action-view-models';

const shared = {
  subject: { kind: 'customer' as const, displayName: '合成客户', maskedReference: null },
  sortSignals: [], priority: 'normal' as const, slaAt: null, safeSummary: null,
};
const actions: WorkbenchActionRowViewModel[] = [
  { ...shared, key: 'followup:task-1', kind: 'followup', businessState: 'pending', cardKeys: ['overdue_followups'], priority: 'high',
    dueAt: '2026-10-06T16:30:00.000Z', riskLevel: 'watch', owner: null, detailHref: '/hospital/care/followups/task-1' },
  { ...shared, key: 'appointment:appointment-1', kind: 'appointment', businessState: 'pending_confirmation', cardKeys: ['pending_confirmation_appointments'],
    appointmentAt: '2026-10-07T15:45:00.000Z', riskLevel: 'normal', owner: null, detailHref: '/hospital/care/appointments/appointment-1' },
  { ...shared, key: 'conversation:conversation-1', kind: 'conversation', conversationState: 'awaiting_human', riskState: 'none', partitions: ['waiting_human'],
    lastCustomerMessageAt: '2026-10-06T15:59:00.000Z', assignee: null, detailHref: '/hospital/conversations/conversation-1' },
];
const projection: WorkbenchActionProjection = {
  status: 'projected', filter: 'all', sourceReadiness: { care: 'ready', conversation: 'ready' },
  cards: [], desktopActions: actions, mobileActions: actions,
};

describe('工作台行动队列正式下钻', () => {
  it('类型链接进入各自正式列表，移除错误的泛化入口与未实现机会标签', () => {
    render(<WorkbenchActionQueue projection={projection} />);
    const navigation = within(screen.getByRole('navigation', { name: '按类型查看全部' }));
    expect(navigation.getByRole('link', { name: '会话' })).toHaveAttribute('href', '/hospital/conversations');
    expect(navigation.getByRole('link', { name: '预约' })).toHaveAttribute('href', '/hospital/care/appointments');
    expect(navigation.getByRole('link', { name: '随访' })).toHaveAttribute('href', '/hospital/care/followups');
    expect(screen.queryByRole('link', { name: '查看全部' })).not.toBeInTheDocument();
    expect(navigation.queryByText('机会')).not.toBeInTheDocument();
  });

  it('保留投影顺序与优先级，仅随访详情附加固定工作台返回路径', () => {
    render(<WorkbenchActionQueue projection={projection} />);
    const queue = within(screen.getByRole('list', { name: '行动队列' }));
    expect(queue.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/hospital/care/followups/task-1?returnTo=%2Fhospital',
      '/hospital/care/appointments/appointment-1',
      '/hospital/conversations/conversation-1',
    ]);
    expect(within(queue.getAllByRole('listitem')[0]).getByText('高优先级')).toBeInTheDocument();
    expect(actions[0].detailHref).toBe('/hospital/care/followups/task-1');
  });

  it('三类时间独立于浏览器时区显示上海日期，保留 machine-readable instant', () => {
    render(<WorkbenchActionQueue projection={projection} />);
    expect(screen.getByText('2026-10-07 00:30')).toHaveAttribute('datetime', '2026-10-06T16:30:00.000Z');
    expect(screen.getByText('2026-10-07 23:45')).toHaveAttribute('datetime', '2026-10-07T15:45:00.000Z');
    expect(screen.getByText('2026-10-06 23:59')).toHaveAttribute('datetime', '2026-10-06T15:59:00.000Z');
    expect(screen.getAllByTitle('上海时区')).toHaveLength(3);
    expect(screen.queryByText(/T\d\d:\d\d:.*Z/u)).not.toBeInTheDocument();
  });

  it('禁止投影时不暴露任何行动或下钻入口', () => {
    render(<WorkbenchActionQueue projection={{ status: 'blocked', filter: 'all', cards: [], desktopActions: [], mobileActions: [] }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
