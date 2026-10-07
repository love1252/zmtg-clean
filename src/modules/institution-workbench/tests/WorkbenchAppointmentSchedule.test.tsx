import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchAppointmentSchedule } from '../components/WorkbenchAppointmentSchedule';
import type { WorkbenchAppointmentResultV1 } from '@/modules/care/application/workbench-appointment-view';

const result: Extract<WorkbenchAppointmentResultV1, { kind: 'ready' }> = {
  kind: 'ready', businessDate: '2026-10-07', timeZone: 'Asia/Shanghai', observedAt: '2026-10-07T01:00:00.000Z',
  today: { total: 151, records: [{ contractVersion: 'v1', appointmentId: 'a-151', customerDisplayName: '合成客户', project: '复诊', status: 'confirmed', scheduledAt: '2026-10-07T01:00:00.000Z', updatedAt: '2026-10-01T01:00:00.000Z' }] },
  pending: { total: 0, records: [] }, rescheduled: { total: 0, records: [] },
};
describe('工作台预约安排', () => {
  it('展示全量计数、上海时间、明确的子集提示和一致的下钻条件', () => {
    render(<WorkbenchAppointmentSchedule result={result} canOpenDetails />);
    const today = screen.getByRole('region', { name: '今日安排' });
    expect(within(today).getByText('151 项')).toBeInTheDocument();
    expect(within(today).getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/hospital/care/appointments?startDate=2026-10-07&endDate=2026-10-07');
    expect(within(today).getByRole('link', { name: /合成客户/ })).toHaveAttribute('href', '/hospital/care/appointments/a-151');
    expect(within(today).getByText(/10\/07 09:00/)).toBeInTheDocument();
    expect(within(today).getByText(/显示最早的 1 项，共 151 项/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '改期申请' })).getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/hospital/care/appointments?status=reschedule_requested');
  });
  it('只读能力仍展示事实和列表入口，不引导进入受控操作详情', () => {
    render(<WorkbenchAppointmentSchedule result={result} />);
    expect(screen.getByText('合成客户 · 复诊')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /合成客户/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '查看全部' })).toHaveLength(3);
  });
  it.each(['unavailable', 'forbidden'] as const)('%s 不呈现零条或虚假空日程', kind => {
    render(<WorkbenchAppointmentSchedule result={{ kind }} />);
    expect(screen.getByText('预约安排暂不可用')).toBeInTheDocument();
    expect(screen.queryByText('今日暂无预约记录')).not.toBeInTheDocument();
    expect(screen.queryByText('0 项')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
