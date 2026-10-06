import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const batchId = 'imp-b-' + 'a'.repeat(48);
const evidence = (customerId = 'customer-a', status = 'recorded') => ({
  kind: 'ready', contractVersion: 'customer-source-evidence.v1', customerId,
  customerUpdatedAt: '2026-10-01T01:00:00.000Z', observedAt: '2026-10-06T02:00:00.000Z',
  evidence: { status, importRecord: status === 'recorded' ? { batchId, sheetKind: 'customer', rowNumber: 125, completedAt: '2025-01-01T03:00:00.000Z' } : null },
});
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

function mount(source = vi.fn(async (id: string) => response(evidence(id)))) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div id="page"><div class="toolbar"><span class="muted"></span></div><div class="preview-customer-runtime-card"></div></div><div id="drawer"></div>';
  const state = { route: '/customers/list', dateSelection: {} };
  const records = ['a', 'b'].map((key, index) => ({ contractVersion: 'v1', customerId: 'customer-' + key, displayName: '客户' + (index ? '乙' : '甲'), lifecycle: 'consulting', priority: 'high', updatedAt: '2026-10-01T01:00:00.000Z' }));
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) => url.includes('/source-evidence')
    ? source(decodeURIComponent(url.split('/').at(-2)!))
    : response({ records, pageInfo: { page: 1, pageSize: 20, total: 2, pageCount: 1, hasMore: false } }));
  const previous = vi.fn((action: string) => {
    if (action === 'close-overlays') { doc.querySelector('#drawer')!.innerHTML = ''; return true; }
    return false;
  });
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = { __institutionV11RefinementAction: previous };
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const drawer = (title: string, body: string) => {
    doc.querySelector('#drawer')!.innerHTML = '<aside><h2>' + esc(title) + '</h2><button data-action="close-overlays">关闭</button><div class="drawer-body">' + body + '</div></aside>';
  };
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'openDrawer', 'btn', script)(
    doc, state, fetcher, bridge, Observer, () => '', () => '', esc, (text: string) => '<span>' + esc(text) + '</span>', vi.fn(), drawer, () => '',
  );
  const action = (name: string, index = 0) => {
    const button = doc.createElement('button'); button.dataset.customerIndex = String(index);
    bridge.__institutionV11RefinementAction?.(name, button);
  };
  doc.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (button) bridge.__institutionV11RefinementAction?.(button.dataset.action!, button);
  });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  return { doc, state, source, fetcher, previous, action, query: within(doc.body) };
}

async function open(view: ReturnType<typeof mount>, index = 0) {
  await waitFor(() => expect(view.query.getByRole('button', { name: '客户甲' })).toBeVisible());
  view.action('preview-customer-record', index);
}
const clickSource = (view: ReturnType<typeof mount>) => fireEvent.click(view.query.getByRole('button', { name: /读取来源证据|查看来源证据/ }));
const settle = () => new Promise(done => setTimeout(done, 0));

describe('真实客户抽屉来源证据', () => {
  it('主动请求才读取真实客户来源，并区分三个时间与历史批次', async () => {
    const view = mount(); await open(view);
    expect(view.source).not.toHaveBeenCalled(); clickSource(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent('已找到 Excel 导入记录'));
    expect(view.source).toHaveBeenCalledWith('customer-a');
    expect(view.doc.body).toHaveTextContent(batchId); expect(view.doc.body).toHaveTextContent('125');
    for (const label of ['主档更新时间', '本次读取时间', '导入批次记录时间']) expect(view.doc.body).toHaveTextContent(label);
    for (const value of ['最近同步', 'c001', 'protectedPayload', 'ciphertext', 'apiKey', '完整度']) expect(view.doc.body).not.toHaveTextContent(value);
    expect(view.fetcher.mock.calls.filter(([url]) => url.includes('/source-evidence'))).toEqual([
      ['/api/v1/institution/customers/customer-a/source-evidence', { method: 'GET', cache: 'no-store', credentials: 'same-origin' }],
    ]);
  });
  it.each([['not_recorded', '未找到可核验的 Excel 导入记录'], ['ambiguous', '存在多条导入关联，待核对']])('明确%s且不选单条来源', async (status, text) => {
    const view = mount(vi.fn(async id => response(evidence(id, status)))); await open(view); clickSource(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent(text));
    expect(view.doc.body).not.toHaveTextContent(batchId);
    expect(view.doc.body).not.toHaveTextContent('已找到 Excel 导入记录');
  });
  it.each([401, 403, 404, 503])('失败%s清除旧证据，固定提示与同客户重试', async status => {
    const source = vi.fn().mockResolvedValueOnce(response(evidence())).mockResolvedValueOnce(response({ message: 'private-error' }, status)).mockResolvedValue(response(evidence()));
    const view = mount(source); await open(view); clickSource(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent(batchId)); clickSource(view);
    expect(view.doc.body).not.toHaveTextContent(batchId);
    await waitFor(() => expect(view.query.getByRole('alert')).toBeVisible());
    expect(view.doc.body).not.toHaveTextContent('private-error'); clickSource(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent(batchId));
    expect(view.fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });
  it.each(['wrong_customer', 'bad_time', 'bad_batch', 'network'])('无效响应%s不回退原型', async kind => {
    const value = evidence();
    if (kind === 'wrong_customer') value.customerId = 'customer-b';
    if (kind === 'bad_time') value.customerUpdatedAt = 'bad';
    if (kind === 'bad_batch') value.evidence.importRecord!.batchId = '<img src=x onerror=alert(1)>';
    const source = vi.fn(async () => { if (kind === 'network') throw new Error('private-error'); return response(value); });
    const view = mount(source); await open(view); clickSource(view);
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('暂不可用'));
    expect(view.doc.querySelector('#drawer img')).toBeNull();
    expect(view.doc.body).not.toHaveTextContent('private-error'); expect(view.doc.body).not.toHaveTextContent(batchId);
  });
  it.each(['customerUpdatedAt', 'observedAt', 'completedAt'])('拒绝%s非ISO和溢出日期', async field => {
    for (const invalid of ['1', '2026-02-31T00:00:00.000Z']) {
      const value = evidence();
      if (field === 'completedAt') value.evidence.importRecord!.completedAt = invalid;
      else if (field === 'observedAt') value.observedAt = invalid;
      else value.customerUpdatedAt = invalid;
      const view = mount(vi.fn(async () => response(value))); await open(view); clickSource(view);
      await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('暂不可用'));
      expect(view.doc.body).not.toHaveTextContent(batchId);
    }
  });
  it.each([200, 503])('切换客户后迟到%s不覆盖新客户', async status => {
    const old = deferred<ReturnType<typeof response>>();
    const source = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response(evidence('customer-b', 'not_recorded')));
    const view = mount(source); await open(view); clickSource(view); await open(view, 1); clickSource(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent('未找到可核验的 Excel 导入记录'));
    old.resolve(response(evidence(), status)); await settle();
    expect(view.doc.querySelector('#drawer')).toHaveTextContent('客户乙');
    expect(view.query.queryByRole('alert')).toBeNull(); expect(view.doc.body).not.toHaveTextContent(batchId);
  });
  it.each(['handled_close', 'escape', 'replace', 'leave_return'])('%s后慢响应不复活已关闭或离页来源', async mode => {
    const old = deferred<ReturnType<typeof response>>();
    const view = mount(vi.fn().mockReturnValue(old.promise)); await open(view); clickSource(view);
    if (mode === 'handled_close') fireEvent.click(view.query.getByRole('button', { name: '关闭' }));
    if (mode === 'escape') view.doc.querySelector('#drawer')!.replaceChildren();
    if (mode === 'replace') view.doc.querySelector('#drawer')!.innerHTML = '<p>另一个抽屉</p>';
    if (mode === 'leave_return') {
      view.state.route = '/outside'; view.doc.querySelector('#page')!.append(view.doc.createElement('i'));
      await settle(); view.state.route = '/customers/list'; view.doc.querySelector('#page')!.append(view.doc.createElement('i'));
      await settle();
    }
    old.resolve(response(evidence())); await settle();
    expect(view.doc.body).not.toHaveTextContent(batchId); expect(view.query.queryByRole('alert')).toBeNull();
    if (mode === 'handled_close') expect(view.previous).toHaveBeenCalledWith('close-overlays', expect.anything());
    if (mode === 'replace') expect(view.doc.querySelector('#drawer')).toHaveTextContent('另一个抽屉');
    if (mode === 'leave_return') expect(view.doc.querySelector('[data-customer-source-evidence]')).toBeEmptyDOMElement();
  });
  it('重复请求中旧失败不能清空新成功', async () => {
    const old = deferred<ReturnType<typeof response>>();
    const view = mount(vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response(evidence())));
    await open(view); clickSource(view); view.action('preview-customer-source-evidence');
    await waitFor(() => expect(view.doc.body).toHaveTextContent(batchId));
    old.resolve(response({}, 503)); await settle();
    expect(view.doc.body).toHaveTextContent(batchId); expect(view.query.queryByRole('alert')).toBeNull();
  });
});
