import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpportunityConfirmationPanel } from '../components/OpportunityConfirmationPanel';
const time = '2026-10-06T00:00:00.000Z';
const data = { kind: 'ready', customerId: 'customer-a', canConfirm: true, candidate: { opportunityType: 'revisit', label: '复诊机会', basis: '客户主档生命周期 = 术后关怀', sourceVersion: `opp-src-v1:${'a'.repeat(64)}`, sourceUpdatedAt: time }, records: [] };
const record = { id: 'confirmation-a', customerId: 'customer-a', opportunityType: 'revisit', label: '复诊机会', confirmedAt: time, sourceUpdatedAt: time, ruleVersion: 'customer-lifecycle.v1', task: { taskId: 'task-a', state: 'pending', revision: 1, dueAt: time, updatedAt: time, completionCode: null, cancellationReason: null } };
const response = (value: unknown, status = 200) => ({ ok: status === 200, status, json: async () => value });
const deferred = () => { let resolve!: (value: ReturnType<typeof response>) => void; const promise = new Promise<ReturnType<typeof response>>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function fill() { fireEvent.change(await screen.findByLabelText('随访截止时间'), { target: { value: '2026-10-08T10:00' } }); fireEvent.click(screen.getByRole('checkbox')); }
describe('机会人工确认组件', () => {
  it('必须选择截止时间并人工核对，提交来源版本和分配后显示正式任务链接', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({ kind: 'ready', record })).mockResolvedValueOnce(response({ ...data, candidate: null, records: [record] })); vi.stubGlobal('fetch', fetcher);
    render(<OpportunityConfirmationPanel customerId="customer-a" />);
    expect(await screen.findByRole('button', { name: '确认并创建人工随访' })).toBeDisabled(); await fill(); fireEvent.click(screen.getByRole('button', { name: '确认并创建人工随访' }));
    expect(await screen.findByRole('link', { name: '查看并处理随访' })).toHaveAttribute('href', '/hospital/care/followups/task-a');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ customerId: 'customer-a', opportunityType: 'revisit', expectedSourceVersion: data.candidate.sourceVersion, assignment: { kind: 'role_pool', role: 'customer_service' } });
  });
  it('提交结果未知时冻结表单，重试沿用完全相同请求与幂等键', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response({ kind: 'ready', record })).mockResolvedValueOnce(response({ ...data, candidate: null, records: [record] })); vi.stubGlobal('fetch', fetcher);
    render(<OpportunityConfirmationPanel customerId="customer-a" />); await fill(); fireEvent.click(screen.getByRole('button', { name: '确认并创建人工随访' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('提交结果尚未确认'); expect(screen.getByLabelText('随访截止时间')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '重试本次确认' })); expect(await screen.findByRole('link', { name: '查看并处理随访' })).toBeVisible();
    expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[2][1].body);
  });
  it('409清空旧入口，刷新新证据后必须重新勾选', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response({ ...data, candidate: { ...data.candidate, sourceVersion: `opp-src-v1:${'b'.repeat(64)}` } })); vi.stubGlobal('fetch', fetcher);
    render(<OpportunityConfirmationPanel customerId="customer-a" />); await fill(); fireEvent.click(screen.getByRole('button', { name: '确认并创建人工随访' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('重新加载后核对'); expect(screen.queryByRole('button', { name: '重试本次确认' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' })); expect(await screen.findByRole('checkbox')).not.toBeChecked(); expect(screen.getByRole('button', { name: '确认并创建人工随访' })).toBeDisabled();
  });
  it('已提交但丢失响应，重新加载确认历史后关闭未知重试入口', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response({ ...data, candidate: null, records: [record] })); vi.stubGlobal('fetch', fetcher);
    render(<OpportunityConfirmationPanel customerId="customer-a" />); await fill(); fireEvent.click(screen.getByRole('button', { name: '确认并创建人工随访' })); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '重新加载' })); await screen.findByRole('link', { name: '查看并处理随访' }); expect(screen.queryByRole('button', { name: '重试本次确认' })).toBeNull();
  });
  it('只读用户不出现确认表单，完成状态与结果按服务端展示', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...data, canConfirm: false, records: [{ ...record, task: { ...record.task, state: 'completed', completionCode: 'contact_completed' } }] })));
    render(<OpportunityConfirmationPanel customerId="customer-a" />); expect(await screen.findByText('复诊机会 · 已完成')).toBeVisible(); expect(screen.getByText('处理结果：已完成联系')).toBeVisible(); expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it.each([{ customerId: 'other' }, { records: [{}] }, { candidate: { ...data.candidate, sourceUpdatedAt: '2026-02-31T00:00:00.000Z' } }, { records: [record, record] }])('损坏读取响应失败关闭 %j', async patch => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...data, ...patch }))); render(<OpportunityConfirmationPanel customerId="customer-a" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('暂不可用'); expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('切换客户时迟到的旧读取不污染新客户', async () => {
    const old = deferred(); const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response({ ...data, customerId: 'customer-b', candidate: null })); vi.stubGlobal('fetch', fetcher);
    const view = render(<OpportunityConfirmationPanel customerId="customer-a" />); await waitFor(() => expect(fetcher).toHaveBeenCalledOnce()); view.rerender(<OpportunityConfirmationPanel customerId="customer-b" />);
    await screen.findByText(/当前没有可新建的机会/); old.resolve(response(data)); await waitFor(() => expect(screen.queryByText('复诊机会 · 待人工核对')).toBeNull());
  });
  it('卸载后迟到的写响应不再发起历史查询', async () => {
    const old = deferred(); const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockReturnValueOnce(old.promise); vi.stubGlobal('fetch', fetcher);
    const view = render(<OpportunityConfirmationPanel customerId="customer-a" />); await fill(); fireEvent.click(screen.getByRole('button', { name: '确认并创建人工随访' })); view.unmount(); old.resolve(response({ kind: 'ready', record }));
    await new Promise(done => setTimeout(done, 0)); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
