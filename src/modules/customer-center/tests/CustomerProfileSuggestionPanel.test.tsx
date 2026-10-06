import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerProfileSuggestionPanel } from '../components/CustomerProfileSuggestionPanel';

const time = '2026-10-06T00:00:00.000Z';
const record = { id: 'suggestion-a', customerId: 'customer-a', fieldName: 'projectInterest', beforeValue: '', proposedValue: '皮肤护理', state: 'pending', revision: 1, ruleVersion: 'appointment-project.v1', createdAt: time, expiresAt: '2026-10-13T00:00:00.000Z', decidedAt: null, reasonCode: null,
  source: { appointmentId: 'appointment-a', project: '皮肤护理', status: 'confirmed', scheduledAt: time, updatedAt: time } };
const data = { kind: 'ready', customerId: 'customer-a', projectInterest: '', customerUpdatedAt: time, records: [record], sources: [{ appointmentId: 'appointment-a', project: '皮肤护理', scheduledAt: time, updatedAt: time }], suggestionPage: 1, sourcePage: 1, hasMoreSuggestions: false, hasMoreSources: false };
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const deferred = () => { let resolve!: (value: ReturnType<typeof response>) => void; const promise = new Promise<ReturnType<typeof response>>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('画像建议真实组件交互', () => {
  it('展示来源与前后值，接受时提交明确决定并刷新主档', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({ kind: 'ready', record: { ...record, state: 'applied', revision: 2, decidedAt: time, reasonCode: 'accept' } }));
    vi.stubGlobal('fetch', fetcher); const onApplied = vi.fn(); render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={onApplied} />);
    fireEvent.click(await screen.findByRole('button', { name: '接受并更新意向' })); await waitFor(() => expect(onApplied).toHaveBeenCalledOnce());
    expect(screen.getByText(/未填写 → 皮肤护理/)).toBeVisible();
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ suggestionId: 'suggestion-a', command: 'accept', expectedRevision: 1 });
  });
  it('从预约生成建议时提交两个来源版本，生成后不自动应用', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...data, records: [] })).mockResolvedValueOnce(response({ kind: 'ready', record })).mockResolvedValueOnce(response(data));
    vi.stubGlobal('fetch', fetcher); const onApplied = vi.fn(); render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={onApplied} />);
    fireEvent.change(await screen.findByLabelText('选择已确认预约'), { target: { value: 'appointment-a' } }); fireEvent.click(screen.getByRole('button', { name: '生成待核对建议' }));
    expect(await screen.findByRole('button', { name: '拒绝建议' })).toBeVisible(); expect(onApplied).not.toHaveBeenCalled();
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ appointmentId: 'appointment-a', expectedSourceUpdatedAt: time, expectedCustomerUpdatedAt: time });
  });
  it('拒绝后加载终态，失败则清空决定入口并允许重新读取', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response({ ...data, records: [{ ...record, state: 'rejected', revision: 2, decidedAt: time }] }));
    vi.stubGlobal('fetch', fetcher); render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '拒绝建议' })); expect(await screen.findByRole('alert')).toHaveTextContent('重新加载核对结果');
    expect(screen.queryByRole('button', { name: '接受并更新意向' })).toBeNull(); fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByText(/已拒绝 · 规则生成/)).toBeVisible();
  });
  it.each([{ records: [{}] }, { records: [{ ...record, source: null }] }, { sources: [{}] }, { records: [{ ...record, state: 'unknown' }] }, { sourcePage: 2 }, { records: [{ ...record, expiresAt: '2026-02-31T00:00:00.000Z' }] }])('损坏响应进入错误态 %j', async patch => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...data, ...patch })));
    render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={vi.fn()} />); expect(await screen.findByRole('alert')).toHaveTextContent('建议暂不可用'); expect(screen.queryByRole('button', { name: '接受并更新意向' })).toBeNull();
  });
  it('切换客户后旧加载响应不能显示到新客户', async () => {
    const old = deferred(); const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response({ ...data, customerId: 'customer-b', records: [], sources: [] })); vi.stubGlobal('fetch', fetcher);
    const view = render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={vi.fn()} />); await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    view.rerender(<CustomerProfileSuggestionPanel customerId="customer-b" onApplied={vi.fn()} />); expect(await screen.findByText('本页暂无画像建议。')).toBeVisible();
    old.resolve(response(data)); await waitFor(() => expect(screen.queryByText(/未填写 → 皮肤护理/)).toBeNull());
  });
  it('卸载后迟到的接受响应不会调用主档刷新', async () => {
    const old = deferred(); const fetcher = vi.fn().mockResolvedValueOnce(response(data)).mockReturnValueOnce(old.promise); vi.stubGlobal('fetch', fetcher);
    const onApplied = vi.fn(); const view = render(<CustomerProfileSuggestionPanel customerId="customer-a" onApplied={onApplied} />);
    fireEvent.click(await screen.findByRole('button', { name: '接受并更新意向' })); view.unmount(); old.resolve(response({ kind: 'ready', record: { ...record, state: 'applied', revision: 2, decidedAt: time } }));
    await new Promise(done => setTimeout(done, 0)); expect(onApplied).not.toHaveBeenCalled();
  });
});
