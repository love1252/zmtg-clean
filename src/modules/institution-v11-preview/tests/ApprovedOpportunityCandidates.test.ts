import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const definitions = [
  ['revisit', 'post_care', '复诊机会', '客户主档生命周期 = 术后关怀'],
  ['repurchase', 'repurchase_window', '复购机会', '客户主档生命周期 = 复购窗口'],
  ['reactivation', 'silent_reactivation', '沉默唤醒', '客户主档生命周期 = 沉默唤醒'],
];
function result(url: string, total = 155) {
  const q = new URL(url, 'http://localhost').searchParams;
  const page = Number(q.get('page') || 1); const pageSize = Number(q.get('pageSize') || 20);
  const type = q.get('type') || 'all'; const priority = q.get('priority') || 'high';
  const offset = (page - 1) * pageSize;
  const pageCount = total ? Math.min(100, Math.ceil(total / pageSize)) : 0;
  return { kind: 'ready', contractVersion: 'opportunity-candidates.v1',
    records: Array.from({ length: Math.min(pageSize, Math.max(0, total - offset)) }, (_, i) => {
      const def = type === 'all' ? definitions[i % 3] : definitions.find(item => item[0] === type)!;
      return { contractVersion: 'v1', customerId: 'candidate-' + (offset + i + 1), displayName: '候选' + (offset + i + 1),
        lifecycle: def[1], priority, updatedAt: '2026-10-06T00:00:00.000Z', opportunityType: def[0], opportunityLabel: def[2], basis: def[3],
        sourceKind: 'customer_lifecycle', ruleVersion: 'customer-lifecycle.v1', sourceVersion: 'opp-src-v1:' + 'a'.repeat(64) };
    }), pageInfo: { page, pageSize, total, pageCount, hasMore: page < pageCount } };
}
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); });
function mount(fetcher = vi.fn(async (url: string, _options?: RequestInit) => response(result(url)))) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!; doc.body.innerHTML = '<div id="page"></div><div id="drawer"></div>';
  const state = { route: '/customers/opportunities', dateSelection: {} };
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = {};
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const drawer = (title: string, body: string) => { doc.querySelector('#drawer')!.innerHTML = '<h2>' + esc(title) + '</h2>' + body; };
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'openDrawer', 'btn', script)(
    doc, state, fetcher, bridge, Observer, (title: string) => '<h1>' + esc(title) + '</h1>', () => '', esc, (text: string) => '<span>' + esc(text) + '</span>', vi.fn(), drawer, () => '',
  );
  const action = (name: string, data: Record<string, string> = {}) => { const button = doc.createElement('button'); Object.assign(button.dataset, data); bridge.__institutionV11RefinementAction?.(name, button); };
  doc.addEventListener('click', event => { const button = (event.target as Element).closest<HTMLElement>('[data-action]'); if (button) bridge.__institutionV11RefinementAction?.(button.dataset.action!, button); });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  return { doc, state, action, fetcher, query: within(doc.body) };
}
const ready = (view: ReturnType<typeof mount>, text = '共 155 条只读候选') => waitFor(() => expect(view.doc.querySelector('.preview-customer-page-status')).toHaveTextContent(text));
const click = (view: ReturnType<typeof mount>, text: string) => fireEvent.click(view.query.getByRole('button', { name: text }));
const settle = () => new Promise(done => setTimeout(done, 0));

describe('经营机会服务端候选交互', () => {
  it('155条候选逐页读取，第6页从101开始，没有浏览器聚合或旧接口请求', async () => {
    const view = mount(); await ready(view);
    for (let p = 2; p <= 6; p++) { click(view, '下一页'); await ready(view, `第 ${p} / 8 页`); }
    expect(view.query.getByRole('button', { name: '候选101' })).toBeVisible();
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(view.fetcher).toHaveBeenCalledTimes(6);
    expect(view.fetcher.mock.calls.every(([url, init]) => url.startsWith('/api/v1/institution/opportunities?') && init?.method === 'GET' && init?.cache === 'no-store')).toBe(true);
    expect(view.doc.body).toHaveTextContent('只读候选');
    view.action('preview-opportunity-record', { opportunityIndex: '0' });
    expect(view.doc.querySelector('#drawer')).toHaveTextContent('客户主档生命周期 = 术后关怀');
  });
  it('类型、优先级和页容量由同一请求处理，筛选从第一页开始', async () => {
    const view = mount(); await ready(view); click(view, '下一页'); await ready(view, '第 2 / 8 页');
    fireEvent.change(view.doc.querySelector('[data-opportunity-type]')!, { target: { value: 'repurchase' } });
    fireEvent.change(view.doc.querySelector('[data-opportunity-priority]')!, { target: { value: 'observe' } });
    click(view, '查询'); await ready(view, '第 1 / 8 页');
    expect(Object.fromEntries(new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost').searchParams)).toEqual({ page: '1', pageSize: '20', type: 'repurchase', priority: 'observe' });
    fireEvent.change(view.query.getByLabelText('经营机会每页显示条数'), { target: { value: '50' } }); await ready(view, '第 1 / 4 页');
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(view.doc.querySelector('tbody')).not.toHaveTextContent('复诊机会');
  });
  it.each([401, 403, 503])('失败%s清空旧行，不自动循环请求，可显式重试', async status => {
    const fetcher = vi.fn().mockImplementationOnce(async url => response(result(url))).mockResolvedValueOnce(response({ message: 'private-error' }, status)).mockImplementation(async url => response(result(url)));
    const view = mount(fetcher); await ready(view); click(view, '下一页');
    expect(view.doc.querySelector('tbody')).toBeNull();
    await waitFor(() => expect(view.query.getByRole('button', { name: '重新加载' })).toBeVisible()); await settle();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(view.doc.body).not.toHaveTextContent('private-error');
    click(view, '重新加载'); await ready(view, '第 2 / 8 页');
  });
  it('空集、超末页和超过100页浏览限制均保留真实语义', async () => {
    const source = vi.fn(async (url: string) => response(result(url, 0)));
    const view = mount(source); await ready(view, '共 0 条只读候选');
    expect(view.query.getByRole('button', { name: '下一页' })).toBeDisabled();
    source.mockImplementation(async url => response(result(url, 1)));
    view.action('preview-opportunity-page', { page: '5' }); await ready(view, '第 1 / 1 页');
    expect(view.doc.body).toHaveTextContent('共 1 条只读候选');
    expect(view.query.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(view.query.getByRole('button', { name: '候选1' })).toBeVisible();
    expect(new URL(source.mock.calls.at(-1)![0], 'http://localhost').searchParams.get('page')).toBe('1');
    source.mockImplementation(async url => response(result(url, 2500)));
    view.action('preview-opportunity-page', { page: '1' }); await ready(view, '共 2500 条只读候选');
    expect(view.doc.body).toHaveTextContent('当前最多浏览前 100 页');
  });
  it('高页码数据清空后归一到第一页空态', async () => {
    const source = vi.fn(async (url: string) => response(result(url)));
    const view = mount(source); await ready(view);
    view.action('preview-opportunity-page', { page: '5' }); await ready(view, '第 5 / 8 页');
    source.mockImplementation(async url => response(result(url, 0)));
    view.action('preview-opportunity-retry'); await ready(view, '共 0 条只读候选');
    expect(new URL(source.mock.calls.at(-1)![0], 'http://localhost').searchParams.get('page')).toBe('1');
    expect(view.query.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(source).toHaveBeenCalledTimes(4);
  });
  it('末页回退期间切换筛选，旧回退响应不能覆盖新结果', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const source = vi.fn().mockImplementationOnce(async url => response(result(url)))
      .mockImplementationOnce(async url => response(result(url, 1)))
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async url => response(result(url, 1)));
    const view = mount(source); await ready(view);
    view.action('preview-opportunity-page', { page: '5' });
    await waitFor(() => expect(source).toHaveBeenCalledTimes(3));
    fireEvent.change(view.doc.querySelector('[data-opportunity-type]')!, { target: { value: 'reactivation' } }); click(view, '查询');
    await ready(view, '共 1 条只读候选');
    pending.resolve(response(result('/?page=1&pageSize=20', 1))); await settle();
    expect(view.doc.querySelector('tbody')).toHaveTextContent('沉默唤醒');
    expect(view.doc.querySelector('tbody')).not.toHaveTextContent('复诊机会');
    expect(source).toHaveBeenCalledTimes(4);
  });
  it.each(['total', 'time', 'source', 'type', 'duplicate'])('损坏%s响应不展示部分数据', async kind => {
    const fetcher = vi.fn(async (url: string) => {
      const data = result(url);
      if (kind === 'total') data.pageInfo.total = -1;
      if (kind === 'time') data.records[0].updatedAt = '2026-02-31T00:00:00.000Z';
      if (kind === 'source') data.records[0].sourceVersion = 'fake';
      if (kind === 'type') data.records[0].opportunityType = 'other';
      if (kind === 'duplicate') data.records[1] = data.records[0];
      return response(data);
    });
    const view = mount(fetcher);
    await waitFor(() => expect(view.query.getByRole('button', { name: '重新加载' })).toBeVisible());
    expect(view.doc.querySelector('tbody')).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([200, 503])('旧%s不能覆盖新筛选结果', async status => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockReturnValueOnce(pending.promise).mockImplementation(async url => response(result(url, 1)));
    const view = mount(fetcher);
    fireEvent.change(view.doc.querySelector('[data-opportunity-type]')!, { target: { value: 'reactivation' } }); click(view, '查询');
    await ready(view, '共 1 条只读候选');
    pending.resolve(response(result('/?page=1&pageSize=20'), status)); await settle();
    expect(view.doc.querySelector('tbody')).toHaveTextContent('沉默唤醒');
    expect(view.doc.querySelector('tbody')).not.toHaveTextContent('复诊机会');
    expect(view.query.queryByRole('button', { name: '重新加载' })).toBeNull();
  });
  it('离页再返回会发起新请求，旧响应不能复活', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockReturnValueOnce(pending.promise).mockImplementation(async url => response(result(url, 1)));
    const view = mount(fetcher); view.state.route = '/outside'; view.doc.querySelector('#page')!.innerHTML = '<p>其他页面</p>'; await settle();
    view.state.route = '/customers/opportunities'; view.doc.querySelector('#page')!.innerHTML = ''; await ready(view, '共 1 条只读候选');
    pending.resolve(response(result('/?page=1&pageSize=20'))); await settle();
    expect(view.doc.body).toHaveTextContent('共 1 条只读候选'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
