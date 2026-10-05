import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CareFollowUpControlledShell } from '@/modules/care/components/CareFollowUpControlledShell';
import { CareFollowUpListControls } from '@/modules/care/components/CareFollowUpListControls';
import { parseFormalFollowUpPageQueryV1, type FormalFollowUpListPageV1 } from '@/modules/care/application/formal-follow-up-list-navigation';
import type { FormalFollowUpDtoV1 } from '@/modules/care/application/formal-follow-up-view';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function list(page = 1, total = 155, extra: Partial<FormalFollowUpListPageV1['query']> = {}): FormalFollowUpListPageV1 {
  const query = { ...parseFormalFollowUpPageQueryV1({})!, page, ...extra };
  return {
    query, pageInfo: { page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize), hasMore: page * query.pageSize < total },
    summary: { total, stateCounts: { pending: total, in_progress: 0, waiting_customer: 0, escalated: 0, completed: 0, cancelled: 0 }, dueBucketCounts: { overdue: total, due_today: 0, not_due: 0 } },
  };
}
function record(index: number): FormalFollowUpDtoV1 {
  return {
    taskId: `task-${index}`, customer: { customerId: `customer-${index}`, displayName: `验收客户${index}`, maskedReference: null },
    stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: '2026-10-01T00:00:00.000Z', state: 'pending', revision: 3,
    riskLevel: 'none', riskKind: null, completionCode: null, cancellationReason: null, assignment: { kind: 'role_pool', role: 'customer_service' },
    permissions: { canClaim: true, canOperate: false, canReassign: false, canUnclaim: false, canCancel: false },
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
}
function latestQuery() { return Object.fromEntries(new URL(push.mock.calls.at(-1)![0], 'http://localhost').searchParams); }
beforeEach(() => push.mockReset());

describe('正式随访列表交互', () => {
  it('155条第6页直接显示101至120，不再二次切片，详情链接保留', () => {
    render(<CareFollowUpControlledShell list={list(6)} canCreate={false} records={Array.from({ length: 20 }, (_, i) => record(i + 101))} />);
    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(screen.getByText('验收客户101')).toBeInTheDocument();
    expect(screen.getByText('验收客户120')).toBeInTheDocument();
    expect(screen.getByText('当前筛选 155 条 · 第 6 / 8 页')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '当前筛选统计' })).getAllByText('155')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(latestQuery()).toEqual({ page: '7', pageSize: '20' });
  });
  it('翻页保留组合条件，状态和页容量重置第一页，清除保留页容量', () => {
    render(<CareFollowUpListControls list={list(6, 155, { keyword: '客户 & A', state: 'pending', dueBucket: 'overdue' })}>记录</CareFollowUpListControls>);
    fireEvent.click(screen.getByRole('button', { name: '随访第 8 页' }));
    expect(latestQuery()).toEqual({ page: '8', pageSize: '20', state: 'pending', dueBucket: 'overdue', q: '客户 & A' });
    fireEvent.click(screen.getByRole('button', { name: '进行中' }));
    expect(latestQuery()).toMatchObject({ page: '1', state: 'in_progress', q: '客户 & A', dueBucket: 'overdue' });
    fireEvent.change(screen.getByLabelText('每页显示'), { target: { value: '50' } });
    expect(latestQuery()).toMatchObject({ page: '1', pageSize: '50', q: '客户 & A' });
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(latestQuery()).toEqual({ page: '1', pageSize: '20' });
    expect(screen.getByLabelText('客户')).toHaveValue('');
  });
  it('查询提交客户和到期条件，非法关键词不导航', () => {
    render(<CareFollowUpListControls list={list(6)}>记录</CareFollowUpListControls>);
    fireEvent.change(screen.getByLabelText('客户'), { target: { value: ' 客户+1 ' } });
    fireEvent.change(screen.getByLabelText('到期范围'), { target: { value: 'due_today' } });
    fireEvent.submit(screen.getByRole('button', { name: '查询' }).closest('form')!);
    expect(latestQuery()).toEqual({ page: '1', pageSize: '20', dueBucket: 'due_today', q: '客户+1' });
    push.mockClear();
    fireEvent.change(screen.getByLabelText('客户'), { target: { value: 'a'.repeat(81) } });
    fireEvent.submit(screen.getByRole('button', { name: '查询' }).closest('form')!);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('最多 80');
  });
  it('新页URL更新后重置查询草稿，详情不出现列表控制', () => {
    const view = render(<CareFollowUpControlledShell list={list()} records={[record(1)]} canCreate />);
    fireEvent.change(screen.getByLabelText('客户'), { target: { value: '未提交草稿' } });
    view.rerender(<CareFollowUpControlledShell list={list(2, 155, { keyword: '正式条件' })} records={[record(21)]} canCreate={false} />);
    expect(screen.getByLabelText('客户')).toHaveValue('正式条件');
    expect(screen.queryByText('验收客户1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();
    view.rerender(<CareFollowUpControlledShell records={[record(21)]} canCreate selectedTaskId="task-21" />);
    expect(screen.queryByRole('region', { name: '随访查询结果' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '认领' })).toBeInTheDocument();
  });
  it('加载期间隐藏旧任务、写操作和统计，禁止重复翻页', async () => {
    let finish!: () => void;
    push.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    render(<CareFollowUpControlledShell list={list()} records={[record(1)]} canCreate />);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByRole('status')).toHaveTextContent('正在加载');
    expect(screen.queryByText('验收客户1')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '当前筛选统计' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
  it('空集和超末页分开提示，超末页保留统计并可恢复', () => {
    const view = render(<CareFollowUpControlledShell list={list(1, 0)} records={[]} canCreate={false} />);
    expect(screen.getByText('当前筛选下没有随访任务。')).toBeInTheDocument();
    expect(screen.getByText('当前筛选 0 条 · 第 0 / 0 页')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
    view.rerender(<CareFollowUpControlledShell list={list(9)} records={[]} canCreate={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('符合筛选的任务共 155 条');
    expect(screen.queryByText('当前筛选下没有随访任务。')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回最后一页' }));
    expect(latestQuery().page).toBe('8');
  });
  it('缺少到期信息显示未知，保留客户和状态查询', () => {
    const data = list();
    render(<CareFollowUpListControls list={{ ...data, summary: { ...data.summary, dueBucketCounts: null } }}>记录</CareFollowUpListControls>);
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByLabelText('到期范围')).toBeDisabled();
    expect(screen.getByLabelText('客户')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '已完成' }));
    expect(latestQuery().state).toBe('completed');
  });
});
