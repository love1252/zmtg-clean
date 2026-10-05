import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });
const states = ['pending', 'in_progress', 'waiting_customer', 'escalated', 'completed', 'cancelled'];
const record = (index: number, state = 'pending') => ({
  taskId: `task-${index}`, customer: { customerId: `customer-${index}`, displayName: `客户${index}`, maskedReference: `KH-${index}` },
  state, dueAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-05T01:00:00Z', riskLevel: 'none',
  assignment: { kind: 'role_pool', role: 'customer_service' },
});
function result(page = 1, pageSize = 20, total = 155, state = 'pending', withTime = true) {
  const records = Array.from({ length: Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize)) }, (_, i) => record((page - 1) * pageSize + i + 1, state));
  const hasMore = page < Math.ceil(total / pageSize);
  return {
    kind: 'ready', records, canCreate: true, hasMore,
    pageInfo: { page, pageSize, total, pageCount: Math.ceil(total / pageSize), hasMore },
    summary: { total, stateCounts: Object.fromEntries(states.map(key => [key, key === state ? total : 0])), dueBucketCounts: withTime ? { overdue: state === 'completed' || state === 'cancelled' ? 0 : total, due_today: 0, not_due: 0 } : null },
    observedAt: '2026-10-05T01:00:00Z', timeZone: withTime ? 'Asia/Shanghai' : null, operatingContextVersion: withTime ? 'v1' : null,
  };
}
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function mount(fetcher = vi.fn(async (url: string) => {
  const q = new URL(url, 'http://localhost').searchParams;
  return response(result(Number(q.get('page')), Number(q.get('pageSize')), 155, q.get('state') || 'pending'));
})) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!; doc.body.innerHTML = '<div id="page"></div>';
  const state = { route: '/followups', dateSelection: {} };
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = {};
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  const toast = vi.fn(); const drawer = vi.fn();
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'openDrawer', 'btn', script)(
    doc, state, fetcher, bridge, Observer,
    (title: string, description: string, actions: string) => `<header><h1>${title}</h1><p>${description}</p>${actions}</header>`,
    () => '', esc, (value: string) => `<span>${esc(value)}</span>`, toast, drawer, () => '',
  );
  doc.addEventListener('click', event => { const button = (event.target as Element).closest<HTMLElement>('[data-action]'); if (button) bridge.__institutionV11RefinementAction?.(button.dataset.action!, button); });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  return { doc, state, fetcher, toast, drawer, query: within(doc.body),
    changeRoute(route: string) { state.route = route; doc.querySelector('#page')!.innerHTML = '<p>切换页面</p>'; },
  };
}
const loaded = async (view: ReturnType<typeof mount>, label = '当前筛选 155 条') => waitFor(() => expect(view.doc.querySelector('.preview-customer-page-status')).toHaveTextContent(label));
const page = (view: ReturnType<typeof mount>, label: string) => fireEvent.click(view.query.getByRole('button', { name: label }));

describe('Approved 随访服务端列表交互', () => {
  it('155条任务可翻至第6页，完整统计保留且当前页不再二次切片', async () => {
    const view = mount(); await loaded(view);
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(view.query.getByLabelText('当前筛选统计')).toHaveTextContent('当前筛选总数155');
    for (let i = 2; i <= 6; i++) { page(view, '下一页'); await loaded(view, `第 ${i} / 8 页`); }
    expect(view.query.getByRole('button', { name: '客户101' })).toBeVisible();
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(view.fetcher).toHaveBeenLastCalledWith('/api/v1/institution/followups?page=6&pageSize=20', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }));
    page(view, '随访第 8 页'); await loaded(view, '本页 15 条');
    expect(view.query.getByRole('button', { name: '下一页' })).toBeDisabled();
    page(view, '客户141'); expect(view.drawer).toHaveBeenCalledWith('客户141', expect.stringContaining('客户141'), '', true);
  });

  it('组合筛选使用URL编码，重置第一页，页容量变更保留筛选', async () => {
    const view = mount(); await loaded(view); page(view, '下一页'); await loaded(view, '第 2 / 8 页');
    fireEvent.change(view.query.getByLabelText('客户'), { target: { value: '张 & 100%' } });
    fireEvent.change(view.query.getByLabelText('到期范围'), { target: { value: 'overdue' } });
    page(view, '查询'); await loaded(view, '第 1 / 8 页');
    let url = new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '20', dueBucket: 'overdue', q: '张 & 100%' });
    page(view, '进行中'); await loaded(view);
    url = new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost');
    expect(url.searchParams.get('state')).toBe('in_progress');
    expect(view.query.getByRole('button', { name: '待执行' })).toBeEnabled();
    fireEvent.change(view.query.getByLabelText('随访每页显示条数'), { target: { value: '50' } }); await loaded(view, '第 1 / 4 页');
    url = new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '50', state: 'in_progress', dueBucket: 'overdue', q: '张 & 100%' });
    page(view, '清除筛选'); await loaded(view);
    expect(view.fetcher.mock.calls.at(-1)![0]).toBe('/api/v1/institution/followups?page=1&pageSize=50');
  });

  it('Enter可查询，超长或含控制字符关键词不发请求', async () => {
    const view = mount(); await loaded(view);
    const input = view.query.getByLabelText('客户') as HTMLInputElement;
    input.value = '客户155'; fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(view.fetcher).toHaveBeenCalledTimes(2)); await loaded(view);
    const calls = view.fetcher.mock.calls.length;
    (view.query.getByLabelText('客户') as HTMLInputElement).value = 'a'.repeat(81); page(view, '查询');
    expect(view.fetcher).toHaveBeenCalledTimes(calls); expect(view.toast).toHaveBeenCalled();
    (view.query.getByLabelText('客户') as HTMLInputElement).value = '客户\u007f'; page(view, '查询');
    expect(view.fetcher).toHaveBeenCalledTimes(calls);
  });

  it.each([401, 403, 503])('加载失败%s显示错误和重试，清除旧行与统计且不自动循环请求', async status => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(result())).mockResolvedValueOnce(response({ kind: 'unavailable' }, status)).mockResolvedValue(response(result(2)));
    const view = mount(fetcher); await loaded(view); page(view, '下一页');
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent(status === 503 ? '暂不可用' : '权限'));
    expect(view.doc.querySelector('tbody')).toBeNull();
    expect(view.query.getByLabelText('当前筛选统计')).toHaveTextContent('当前筛选总数—');
    expect(view.query.getByRole('button', { name: /新建随访/ })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(call => !call[1]?.method || call[1].method === 'GET')).toBe(true);
    page(view, '重新加载'); await loaded(view, '第 2 / 8 页');
  });

  it('加载中不把旧页标为新页，并丢弃过期的成功与失败响应', async () => {
    const old = deferred<ReturnType<typeof response>>(); const newer = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockResolvedValueOnce(response(result())).mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise).mockResolvedValue(response(result(1, 20, 2, 'completed')));
    const view = mount(fetcher); await loaded(view); page(view, '下一页');
    expect(view.query.getByRole('status')).toHaveTextContent('正在加载'); expect(view.doc.querySelector('tbody')).toBeNull();
    page(view, '已完成'); await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    newer.resolve(response(result(1, 20, 2, 'completed'))); await loaded(view, '当前筛选 2 条');
    old.resolve(response(result(2))); await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.doc.querySelector('.preview-customer-page-status')).toHaveTextContent('当前筛选 2 条');
    const stale = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValueOnce(stale.promise);
    page(view, '待执行'); page(view, '已完成'); await loaded(view, '当前筛选 2 条');
    stale.resolve(response({}, 503)); await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.query.queryByRole('alert')).toBeNull();
  });

  it('到期统计缺失显示未知而非零，普通筛选仍可用', async () => {
    const view = mount(vi.fn().mockResolvedValue(response(result(1, 20, 155, 'pending', false)))); await loaded(view);
    expect(view.query.getByLabelText('当前筛选统计')).toHaveTextContent('已逾期—');
    expect(view.query.getByLabelText('到期范围')).toBeDisabled();
    expect(view.query.getByRole('button', { name: '待执行' })).toBeEnabled();
    expect(view.doc.body).toHaveTextContent('到期信息暂不可用');
  });

  it('空集与超末页分别呈现，超末页保留总数且可返回有效页面', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(result())).mockResolvedValueOnce(response(result(2, 20, 5))).mockResolvedValueOnce(response(result(1, 20, 5))).mockResolvedValue(response(result(1, 20, 0)));
    const view = mount(fetcher); await loaded(view); page(view, '下一页'); await loaded(view, '当前筛选 5 条');
    expect(view.doc.body).toHaveTextContent('当前页已超出结果范围'); page(view, '返回最后一页'); await loaded(view, '本页 5 条');
    page(view, '已取消'); await loaded(view, '第 0 / 0 页');
    expect(view.doc.body).toHaveTextContent('当前筛选暂无随访任务');
    expect(view.query.getByRole('button', { name: '上一页' })).toBeDisabled();
  });

  it.each(['page', 'total', 'rows', 'summary'])('损坏%s响应不被当成正常结果', async field => {
    const body = result();
    if (field === 'page') body.pageInfo.page = 2;
    if (field === 'total') body.summary.total = 20;
    if (field === 'rows') body.records.pop();
    if (field === 'summary') body.summary.stateCounts.pending = 20;
    const view = mount(vi.fn().mockResolvedValue(response(body)));
    await waitFor(() => expect(view.query.getByRole('alert')).toBeVisible());
    expect(view.doc.querySelector('tbody')).toBeNull();
  });

  it('网络异常允许重试，离开页面后的响应不污染重新进入的列表', async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('private-internal-detail')).mockReturnValueOnce(old.promise).mockResolvedValue(response(result(1, 20, 1)));
    const view = mount(fetcher);
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('网络连接异常'));
    expect(view.doc.body).not.toHaveTextContent('private-internal-detail'); page(view, '重新加载');
    view.changeRoute('/outside'); await waitFor(() => expect(view.doc.body).toHaveTextContent('切换页面'));
    await new Promise(resolve => setTimeout(resolve, 0)); view.changeRoute('/followups'); await loaded(view, '当前筛选 1 条');
    old.resolve(response(result())); await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.doc.body).toHaveTextContent('当前筛选 1 条'); expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
