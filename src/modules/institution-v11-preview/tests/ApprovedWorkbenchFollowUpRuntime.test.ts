import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const states = ['pending', 'in_progress', 'waiting_customer', 'escalated', 'completed', 'cancelled'] as const;
type State = typeof states[number];
type Counts = Record<State, number>;
const defaultCounts: Counts = { pending: 20, in_progress: 15, waiting_customer: 10, escalated: 10, completed: 100, cancelled: 0 };
const emptyCounts: Counts = { pending: 0, in_progress: 0, waiting_customer: 0, escalated: 0, completed: 0, cancelled: 0 };
function followUps(counts = defaultCounts, page = 1, pageSize = 100, withTime = true, filter: State | null = null) {
  const stateCounts = filter ? { ...emptyCounts, [filter]: counts[filter] } : { ...counts };
  const total = Object.values(stateCounts).reduce((sum, count) => sum + count, 0);
  const ordered: State[] = ['completed', 'cancelled', 'pending', 'in_progress', 'waiting_customer', 'escalated'];
  const all = ordered.flatMap(state => Array.from({ length: stateCounts[state] }, (_, i) => ({
    taskId: `${state}-${i}`, state, customer: { customerId: `customer-${state}-${i}`, displayName: `合成客户${state}-${i}`, maskedReference: 'KH-***01' },
    dueAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-06T01:00:00Z', riskLevel: state === 'escalated' ? 'high' : 'none',
    assignment: { kind: 'role_pool', role: 'customer_service' },
  })));
  const hasMore = page < Math.ceil(total / pageSize);
  return { kind: 'ready', canCreate: true, records: all.slice((page - 1) * pageSize, page * pageSize), hasMore,
    pageInfo: { page, pageSize, total, pageCount: Math.ceil(total / pageSize), hasMore },
    summary: { total, stateCounts, dueBucketCounts: withTime ? { overdue: total - stateCounts.completed - stateCounts.cancelled, due_today: 0, not_due: 0 } : null },
    observedAt: '2026-10-06T01:00:00Z', timeZone: withTime ? 'Asia/Shanghai' : null, operatingContextVersion: withTime ? 'v1' : null,
  };
}
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function reader(followUpRequest: (url: string) => Promise<ReturnType<typeof response>> = async url => {
  const query = new URL(url, 'http://localhost').searchParams;
  return response(followUps(defaultCounts, Number(query.get('page') || 1), Number(query.get('pageSize') || 100), true, query.get('state') as State | null));
}) {
  return vi.fn(async (url: string, _options?: RequestInit) => {
    if (url.startsWith('/api/v1/institution/followups')) return followUpRequest(url);
    if (url.startsWith('/api/v1/institution/customers?')) return response({ records: [], pageInfo: { page: 1, pageSize: 10, total: 0, pageCount: 0, hasMore: false } });
    if (url === '/api/v1/institution/appointments?page=1&pageSize=100') return response({ records: [], pageInfo: { page: 1, pageSize: 100, total: 0 }, summary: { total: 0, statusCounts: { pending_confirmation: 0, confirmed: 0, arrived: 0, completed: 0, reschedule_requested: 0, cancelled: 0 } } });
    throw new Error(`Unexpected test URL: ${url}`);
  });
}
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });
function mount(fetcher = reader()) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!; doc.body.innerHTML = '<div id="page"></div>';
  const state = { route: '/workbench', dateSelection: {} };
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = {};
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'openDrawer', 'btn', script)(
    doc, state, fetcher, bridge, Observer,
    (title: string, description: string, actions: string) => `<header><h1>${title}</h1><p>${description}</p>${actions}</header>`,
    () => '', esc, (value: string) => `<span>${esc(value)}</span>`, vi.fn(), vi.fn(), () => '',
  );
  const changeRoute = (route: string) => { state.route = route; doc.querySelector('#page')!.innerHTML = '<p>切换页面</p>'; };
  const action = (name: string) => bridge.__institutionV11RefinementAction?.(name, doc.createElement('button'));
  doc.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-action],[data-route]');
    if (target?.dataset.action) bridge.__institutionV11RefinementAction?.(target.dataset.action, target);
    else if (target?.dataset.route) changeRoute(target.dataset.route);
  });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  return { doc, state, fetcher, query: within(doc.body), action, changeRoute };
}
type View = ReturnType<typeof mount>;
const metric = (view: View, label: string) => view.query.getByText(label, { selector: '.klabel' }).closest('article')!.querySelector('.kvalue');
const loaded = async (view: View, active = 55, risk = 10) => {
  await waitFor(() => expect(metric(view, '活跃随访')).toHaveTextContent(new RegExp(`^${active}$`)));
  expect(metric(view, '风险升级')).toHaveTextContent(new RegExp(`^${risk}$`));
  expect(view.query.getByText('风险升级随访').closest('.list-row')!.querySelector('b')).toHaveTextContent(new RegExp(`^${risk}$`));
};
const click = (view: View, label: string) => fireEvent.click(view.query.getByRole('button', { name: label }));

describe('Approved 工作台随访全量统计', () => {
  it('155条任务的前100条均已结束，仍展示全部55条活跃和10条升级，并明确有限待办', async () => {
    const view = mount(); await loaded(view);
    expect(view.doc.body).toHaveTextContent('当前可见全部随访任务');
    expect(view.doc.body).toHaveTextContent('随访待办仅从前 100 条任务中选取，最多展示 3 条');
    expect(view.doc.body).toHaveTextContent('当前预览未列出待办');
    expect(view.doc.body).not.toHaveTextContent('当前没有需要处理的已授权记录');
    expect(view.query.getByRole('button', { name: '查看随访' })).toBeEnabled();
    expect(view.fetcher).toHaveBeenCalledTimes(4);
    expect(view.fetcher.mock.calls.every(([, options]) => (!options?.method || options.method === 'GET') && options?.cache === 'no-store')).toBe(true);
  });

  it('待办仍有限展示，状态统计覆盖全部四种活跃状态并排除两种终态', async () => {
    const counts = { pending: 2, in_progress: 3, waiting_customer: 4, escalated: 5, completed: 6, cancelled: 7 };
    const view = mount(reader(async () => response(followUps(counts)))); await loaded(view, 14, 5);
    const pending = view.query.getByRole('heading', { name: '我的待处理' }).closest('section')!;
    expect(pending.querySelectorAll('.list-row')).toHaveLength(3);
    expect(pending).not.toHaveTextContent('前 100 条');
  });

  it('第一页记录未变但后续任务状态变化时，刷新两处风险数且不保留旧快照', async () => {
    let counts = defaultCounts;
    const view = mount(reader(async () => response(followUps(counts)))); await loaded(view);
    const before = followUps(counts).records;
    counts = { ...defaultCounts, pending: 0, escalated: 30 };
    expect(followUps(counts).records).toEqual(before);
    click(view, '刷新数据');
    expect(view.query.getByRole('status')).toHaveTextContent('正在加载');
    expect(view.doc.querySelector('.kpis')).toBeNull();
    await loaded(view, 55, 30);
    expect(view.fetcher).toHaveBeenCalledTimes(8);
  });

  it('真实空集显示0，缺时区时仍可使用完整状态统计', async () => {
    const request = vi.fn().mockResolvedValueOnce(response(followUps(emptyCounts))).mockResolvedValue(response(followUps(defaultCounts, 1, 100, false)));
    const view = mount(reader(request)); await loaded(view, 0, 0);
    expect(view.query.queryByRole('alert')).toBeNull();
    click(view, '刷新数据'); await loaded(view);
    expect(view.query.queryByRole('alert')).toBeNull();
  });

  it('从工作台进入完整随访列表，总数和风险筛选结果与统计一致', async () => {
    const view = mount(); await loaded(view); click(view, '查看随访');
    await waitFor(() => expect(view.query.getByLabelText('当前筛选统计')).toHaveTextContent('当前筛选总数155'));
    expect(view.query.getByLabelText('当前筛选统计')).toHaveTextContent('已逾期55');
    fireEvent.click(view.doc.querySelector('[data-followup-state][data-state="escalated"], [data-action="preview-followup-state"][data-state="escalated"]')!);
    await waitFor(() => expect(view.doc.querySelector('.preview-customer-page-status')).toHaveTextContent('当前筛选 10 条'));
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(10);
    view.changeRoute('/workbench'); await loaded(view);
  });

  it.each([401, 403, 503])('刷新遇到%s时清除旧指标、只展示低敏错误且允许重试', async status => {
    const request = vi.fn().mockResolvedValueOnce(response(followUps())).mockResolvedValueOnce(response({ apiKey: 'secret-test-value', ciphertext: 'private-payload' }, status)).mockResolvedValue(response(followUps()));
    const view = mount(reader(request)); await loaded(view); click(view, '刷新数据');
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent(status === 503 ? '暂不可用' : '权限'));
    expect(view.doc.querySelector('.kpis')).toBeNull();
    expect(view.doc.querySelector('input, select, textarea')).toBeNull();
    expect(view.doc.body).not.toHaveTextContent('secret-test-value');
    expect(view.doc.body).not.toHaveTextContent('private-payload');
    expect(request).toHaveBeenCalledTimes(2);
    expect(view.fetcher.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
    click(view, '重新加载'); await loaded(view);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each(['缺少汇总', '负数', '非整数', '错误总和', '错误页容量', '错误行数'])('损坏响应%s不能回退到第一页计数或旧数字', async defect => {
    const bad = followUps();
    if (defect === '缺少汇总') Object.assign(bad, { summary: null });
    if (defect === '负数') bad.summary.stateCounts.pending = -1;
    if (defect === '非整数') bad.summary.stateCounts.escalated = 1.5;
    if (defect === '错误总和') bad.summary.stateCounts.escalated = 9;
    if (defect === '错误页容量') bad.pageInfo.pageSize = 20;
    if (defect === '错误行数') bad.records.pop();
    const request = vi.fn().mockResolvedValueOnce(response(followUps())).mockResolvedValue(response(bad));
    const view = mount(reader(request)); await loaded(view); click(view, '刷新数据');
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('暂不可用'));
    expect(view.doc.querySelector('.kpis')).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('网络异常不泄露内部错误且不会自动循环请求', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('private-internal-detail')).mockResolvedValue(response(followUps()));
    const view = mount(reader(request));
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('暂不可用'));
    expect(view.doc.body).not.toHaveTextContent('private-internal-detail');
    expect(request).toHaveBeenCalledTimes(1);
    click(view, '重新加载'); await loaded(view);
  });

  it.each([200, 503])('旧%s响应晚于新请求时不能覆盖新的统计或制造错误', async status => {
    const old = deferred<ReturnType<typeof response>>();
    const request = vi.fn().mockResolvedValueOnce(response(followUps())).mockReturnValueOnce(old.promise).mockResolvedValue(response(followUps(emptyCounts)));
    const view = mount(reader(request)); await loaded(view); click(view, '刷新数据');
    view.action('preview-workbench-retry'); await loaded(view, 0, 0);
    old.resolve(response(followUps(), status)); await flush();
    await loaded(view, 0, 0);
    expect(view.query.queryByRole('alert')).toBeNull();
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([200, 503])('离页重入后丢弃旧%s响应，并重新读取最新范围', async status => {
    const old = deferred<ReturnType<typeof response>>();
    const request = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response(followUps(emptyCounts)));
    const view = mount(reader(request));
    view.changeRoute('/outside'); await flush();
    expect(view.doc.body).toHaveTextContent('切换页面');
    view.changeRoute('/workbench'); await loaded(view, 0, 0);
    old.resolve(response(followUps(), status)); await flush();
    await loaded(view, 0, 0); expect(view.query.queryByRole('alert')).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
