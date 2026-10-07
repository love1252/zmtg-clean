import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentListReadonlyShell } from '../components/AppointmentListReadonlyShell';
import type { AppointmentListReaderResultV1 } from '../application/appointment-list-pagination-contract';
import AppointmentLoading from '@/app/hospital/care/appointments/loading';
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
const records = [
  { contractVersion: 'v1' as const, appointmentId: 'early', customerDisplayName: '凌晨客户', project: '合成项目', status: 'confirmed' as const, scheduledAt: '2026-10-06T16:30:00.000Z', updatedAt: '2026-10-06T15:00:00.000Z' },
  { contractVersion: 'v1' as const, appointmentId: 'late', customerDisplayName: '深夜客户', project: '合成项目', status: 'confirmed' as const, scheduledAt: '2026-10-07T15:30:00.000Z', updatedAt: '2026-10-06T15:00:00.000Z' },
];
const result: Extract<AppointmentListReaderResultV1, { kind: 'ready' }> = { kind: 'ready', records, pageInfo: { page: 3, pageSize: 20, total: 80, hasMore: true, pageCount: 4 }, summary: { total: 80, statusCounts: { pending_confirmation: 0, confirmed: 80, arrived: 0, completed: 0, cancelled: 0, reschedule_requested: 0 } } };
beforeEach(() => { mocks.push.mockReset(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('正式预约筛选与完整日历交互', () => {
  it('日期/状态提交一次导航，重置页码，保留日期/关键词/容量', () => {
    render(<AppointmentListReadonlyShell result={result} status="confirmed" operational={false} today="2026-10-07" startDate="2026-10-07" endDate="2026-10-08" keyword="复诊" pageSize="50" />);
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-12-30' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2027-01-03' } });
    fireEvent.change(screen.getByLabelText('预约状态'), { target: { value: 'arrived' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/hospital/care/appointments?startDate=2026-12-30&endDate=2027-01-03&pageSize=50&status=arrived&q=%E5%A4%8D%E8%AF%8A');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('不完整/倒置日期保留输入并提示错误，不发起导航或 mutation', () => {
    render(<AppointmentListReadonlyShell result={result} status={null} operational={false} today="2026-10-07" />);
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-10-08' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-10-07' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(screen.getByRole('alert')).toHaveTextContent('结束日期不得早于开始日期');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('没有日期也可按状态查询，空字段不会送入严格 Reader', () => {
    render(<AppointmentListReadonlyShell result={result} status={null} operational={false} today="2026-10-07" />);
    fireEvent.change(screen.getByLabelText('预约状态'), { target: { value: 'pending_confirmation' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/hospital/care/appointments?status=pending_confirmation');
  });

  it('日历完整展示 151 条，00:30 和 23:30 均落到上海日期的正确小时', () => {
    const many = [...records, ...Array.from({ length: 149 }, (_, index) => ({ ...records[0], appointmentId: `extra-${index}`, customerDisplayName: `合成客户${index}` }))];
    render(<AppointmentListReadonlyShell result={{ kind: 'ready', records: many, range: { startDate: '2026-10-07', endDate: '2026-10-07' } }} status={null} operational={false} view="day" date="2026-10-07" today="2026-10-07" />);
    expect(screen.getByRole('status')).toHaveTextContent('共 151 条预约，已完整展示');
    expect(within(screen.getByRole('cell', { name: '2026-10-07 00:00' })).getByText('凌晨客户 · 合成项目')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: '2026-10-07 23:00' })).getByText('深夜客户 · 合成项目')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: '2026-10-07 09:00' })).queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(151);
    expect(screen.queryByRole('navigation', { name: '预约列表分页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看 / 操作' })).not.toBeInTheDocument();
  });

  it('跨年周前后/今天/日视图保留筛选并使用所选日期，不取记录首条日期', () => {
    render(<AppointmentListReadonlyShell result={{ kind: 'ready', records: [], range: { startDate: '2026-12-28', endDate: '2027-01-03' } }} status="confirmed" operational={false} view="week" date="2027-01-01" today="2026-10-07" keyword="复诊" />);
    const params = (name: string) => Object.fromEntries(new URL(screen.getByRole('link', { name }).getAttribute('href')!, 'http://localhost').searchParams);
    expect(params('前一周')).toEqual({ status: 'confirmed', q: '复诊', view: 'week', date: '2026-12-25' });
    expect(params('后一周').date).toBe('2027-01-08');
    expect(params('今天').date).toBe('2026-10-07');
    expect(params('日视图')).toEqual({ status: 'confirmed', q: '复诊', view: 'day', date: '2027-01-01' });
    expect(params('列表视图')).toEqual({ status: 'confirmed', q: '复诊', startDate: '2026-12-28', endDate: '2027-01-03' });
    expect(screen.getByRole('status')).toHaveTextContent('当前日期范围暂无预约');
  });

  it('超过上限显示明确错误和可调整筛选，不展示假空日历', () => {
    render(<AppointmentListReadonlyShell result={{ kind: 'too_many', limit: 2000 }} status={null} operational={false} view="week" date="2026-10-07" today="2026-10-07" />);
    expect(screen.getByRole('alert')).toHaveTextContent('未展示不完整日历');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('当前日期范围暂无预约。')).not.toBeInTheDocument();
    expect(screen.getByLabelText('预约状态')).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('路由导航等待中禁用表单并显示忙碌，loading 边界有明确状态', async () => {
    let finish!: () => void;
    mocks.push.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const rendered = render(<AppointmentLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('正在查询预约');
    expect(screen.getByRole('status').closest('section')).toHaveAttribute('aria-busy', 'true');
    rendered.unmount();
    render(<AppointmentListReadonlyShell result={result} status={null} operational={false} today="2026-10-07" />);
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('开始日期')).toBeDisabled();
    expect(screen.getByLabelText('结束日期')).toBeDisabled();
    expect(screen.getByLabelText('预约状态')).toBeDisabled();
    expect(screen.getByLabelText('客户或项目')).toBeDisabled();
    expect(screen.getByRole('button', { name: '正在查询…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('正在查询预约');
    await act(async () => finish());
    expect(fetch).not.toHaveBeenCalled();
  });
});
