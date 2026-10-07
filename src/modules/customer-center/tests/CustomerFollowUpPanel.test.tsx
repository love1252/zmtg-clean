import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerFollowUpPanel } from '@/modules/customer-center/components/CustomerFollowUpPanel';

const make = (page = 1, customerId = 'customer-a') => ({
  kind: 'ready', customerId,
  records: Array.from({ length: page < 8 ? 20 : 15 }, (_, index) => ({
    taskId: `task-${(page - 1) * 20 + index}`, customer: { customerId }, state: 'completed', dueAt: '2026-10-07T02:00:00.000Z',
    completionCode: 'contact_completed', completionFeedback: { kind: 'manual_low_sensitivity', summary: `第 ${(page - 1) * 20 + index} 条完成记录` }, updatedAt: '2026-10-07T03:00:00.000Z',
  })),
  pageInfo: { page, pageSize: 20, total: 155, pageCount: 8, hasMore: page < 8 },
  summary: { total: 155, stateCounts: { pending: 0, in_progress: 0, waiting_customer: 0, escalated: 0, completed: 155, cancelled: 0 }, dueBucketCounts: { overdue: 0, due_today: 0, not_due: 0 } },
});
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('客户随访记录', () => {
  it('第 101 条之后继续分页，统计不截断且任务链接返回当前客户', async () => {
    const fetchMock = vi.fn(async (url: string) => response(make(Number(new URL(url, 'http://localhost').searchParams.get('page')))));
    vi.stubGlobal('fetch', fetchMock);
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    await screen.findByText('低敏摘要：第 0 条完成记录');
    for (let page = 2; page <= 8; page++) {
      fireEvent.click(screen.getByRole('button', { name: '下一页随访' }));
      await screen.findByText(`低敏摘要：第 ${(page - 1) * 20} 条完成记录`);
    }
    expect(screen.getByText(/当前筛选共 155 条/)).toBeInTheDocument();
    expect(screen.getByText('低敏摘要：第 154 条完成记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页随访' })).toBeDisabled();
    expect(screen.getAllByRole('link', { name: '查看任务详情' })[0]).toHaveAttribute('href', '/hospital/care/followups/task-140?returnTo=%2Fhospital%2Fcustomers%2Fcustomer-a%3Ftab%3Dfollowups');
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('/api/v1/institution/customers/customer-a/followups?'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('page=6'))).toBe(true);
  });
  it.each([401, 403, 503])('加载失败 %s 禁用筛选、不显示伪零值、只读且能重试', async status => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ secret: 'apiKey-private' }, status)).mockResolvedValueOnce(response(make()));
    vi.stubGlobal('fetch', fetchMock);
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    await screen.findByRole('alert');
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.queryByText(/当前筛选共/)).not.toBeInTheDocument();
    expect(screen.queryByText(/apiKey-private/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every((call: unknown[]) => !((call[1] as RequestInit).method))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '重新加载随访' }));
    await screen.findByText('低敏摘要：第 0 条完成记录');
    expect(screen.getByRole('combobox')).toBeEnabled();
  });
  it('翻页失败清除旧记录，重试同页而不是悄悄返回首页', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(make())).mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response(make(2)));
    vi.stubGlobal('fetch', fetchMock);
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    await screen.findByText('低敏摘要：第 0 条完成记录');
    fireEvent.click(screen.getByRole('button', { name: '下一页随访' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('低敏摘要：第 0 条完成记录')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载随访' }));
    await screen.findByText('低敏摘要：第 20 条完成记录');
    expect(fetchMock.mock.calls[2]?.[0]).toContain('page=2');
  });
  it('筛选重置首页且只向精确客户地址发送白名单参数', async () => {
    const fetchMock = vi.fn(async (url: string) => response(make(Number(new URL(url, 'http://localhost').searchParams.get('page')))));
    vi.stubGlobal('fetch', fetchMock);
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    await screen.findByText('低敏摘要：第 0 条完成记录');
    fireEvent.click(screen.getByRole('button', { name: '下一页随访' }));
    await screen.findByText('低敏摘要：第 20 条完成记录');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/institution/customers/customer-a/followups?page=1&pageSize=20&state=completed', expect.objectContaining({ cache: 'no-store' })));
    await screen.findByText('低敏摘要：第 0 条完成记录');
  });
  it('另一客户或损坏响应失败关闭', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(make(1, 'customer-b'))));
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    await screen.findByRole('alert');
    expect(screen.queryAllByRole('link', { name: '查看任务详情' })).toHaveLength(0);
  });
  it('切换客户后的旧响应不能污染新客户结果', async () => {
    let release!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; })).mockResolvedValueOnce(response(make(1, 'customer-b')));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<CustomerFollowUpPanel customerId="customer-a" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    view.rerender(<CustomerFollowUpPanel customerId="customer-b" />);
    await screen.findByText('低敏摘要：第 0 条完成记录');
    release(response(make(1, 'customer-a')));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('link', { name: '查看任务详情' })[0]).toHaveAttribute('href', expect.stringContaining('customer-b'));
  });
  it('权威空结果明确显示为空', async () => {
    const value = make();
    vi.stubGlobal('fetch', vi.fn(async () => response({ ...value, records: [], pageInfo: { ...value.pageInfo, total: 0, pageCount: 0, hasMore: false }, summary: { ...value.summary, total: 0, stateCounts: { ...value.summary.stateCounts, completed: 0 } } })));
    render(<CustomerFollowUpPanel customerId="customer-a" />);
    expect(await screen.findByText('当前筛选下暂无随访记录。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页随访' })).toBeDisabled();
  });
});
