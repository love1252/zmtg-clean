import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); vi.restoreAllMocks(); });
const statuses = ['pending_confirmation', 'confirmed', 'arrived', 'completed', 'reschedule_requested', 'cancelled'];
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
function result(url: string) {
  const query = new URL(url, 'http://localhost').searchParams;
  const page = Number(query.get('page') || 1), pageSize = Number(query.get('pageSize') || 20);
  const status = query.get('status') || 'pending_confirmation';
  const total = 45;
  return {
    records: Array.from({ length: Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize)) }, (_, i) => ({
      contractVersion: 'v1', appointmentId: `appointment-${(page - 1) * pageSize + i}`, customerDisplayName: '未来预约客户',
      project: '复诊', scheduledAt: `${query.get('startDate') || '2026-10-06'}T02:00:00.000Z`, status, updatedAt: '2026-10-06T01:00:00.000Z',
    })),
    pageInfo: { page, pageSize, total, pageCount: Math.ceil(total / pageSize), hasMore: page * pageSize < total },
    summary: { total, statusCounts: Object.fromEntries(statuses.map(key => [key, key === status ? total : 0])) },
  };
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function mount(fetcher = vi.fn(async (url: string) => response(result(url)))) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!; doc.body.innerHTML = '<div id="page"></div><div id="popover"></div><div id="drawer"></div>';
  const state = { route: '/appointments', dateSelection: {} as Record<string, string> };
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = {};
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  const toast = vi.fn();
  const closeAll = () => { doc.querySelector('#popover')!.innerHTML = ''; };
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'btn', 'openSmall', 'closeAll', 'render', script)(
    doc, state, fetcher, bridge, Observer,
    (title: string, description: string, actions: string) => `<header><h1>${title}</h1><p>${description}</p>${actions}</header>`,
    () => '', esc, (value: string) => `<span>${esc(value)}</span>`, toast,
    (label: string, options: { action: string }) => `<button data-action="${options.action}">${label}</button>`,
    (markup: string) => { doc.querySelector('#popover')!.innerHTML = markup; }, closeAll, () => {},
  );
  doc.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'close-overlays') closeAll();
    else bridge.__institutionV11RefinementAction?.(button.dataset.action!, button);
  });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  return { doc, state, fetcher, toast, query: within(doc.body), bridge };
}
type View = ReturnType<typeof mount>;
const loaded = (view: View, page = 1) => waitFor(() => expect(view.doc.querySelector('.preview-customer-page-status')).toHaveTextContent(`第 ${page} / 3 页`));
const click = (view: View, selector: string) => { const button = view.doc.querySelector<HTMLButtonElement>(selector)!; expect(button).not.toBeNull(); expect(button).toBeEnabled(); fireEvent.click(button); };
const open = (view: View) => click(view, '[data-target="appointment-range"]');
const select = (view: View, date: string) => click(view, `[data-action="preview-date-day"][data-date="${date}"]:not(.outside)`);
const apply = (view: View) => click(view, '[data-action="preview-date-apply"]');
const params = (view: View) => new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost').searchParams;
function clock(value = '2026-10-06T04:00:00.000Z') { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(value)); }

describe('Approved 预约未来日期查询', () => {
  it('明天可选择，应用回第一页；重开、重绘、分页与状态切换都保留日期，清除恢复无日期查询', async () => {
    clock(); const view = mount(); await loaded(view);
    click(view, '[data-action="preview-appointment-page"][aria-label="下一页"]'); await loaded(view, 2);
    open(view); select(view, '2026-10-07'); apply(view); await loaded(view);
    expect(Object.fromEntries(params(view))).toMatchObject({ page: '1', startDate: '2026-10-07', endDate: '2026-10-07' });
    expect(view.doc.querySelector('tbody')).toHaveTextContent('未来预约客户');
    expect(view.doc.querySelector('tbody')).toHaveTextContent('2026/10/07 10:00');
    expect(view.doc.querySelector('[data-target="appointment-range"]')).toHaveTextContent('2026-10-07');
    open(view);
    expect(view.doc.querySelector('[data-date="2026-11-07"].outside')).toHaveAttribute('aria-label', '2026年11月7日');
    expect(view.doc.querySelector('[data-date="2026-10-07"].is-start')).toHaveAttribute('aria-pressed', 'true');
    expect(view.query.getByRole('dialog')).toHaveTextContent('可选择未来日期');
    click(view, '[data-action="close-overlays"]');
    click(view, '[data-action="preview-appointment-page"][aria-label="下一页"]'); await loaded(view, 2);
    expect(params(view).get('startDate')).toBe('2026-10-07');
    click(view, '[data-action="preview-appointment-status"][data-status="confirmed"]'); await loaded(view);
    expect(Object.fromEntries(params(view))).toMatchObject({ page: '1', status: 'confirmed', startDate: '2026-10-07', endDate: '2026-10-07' });
    click(view, '[data-action="preview-appointment-date-clear"]'); await loaded(view);
    expect(params(view).has('startDate')).toBe(false); expect(params(view).has('endDate')).toBe(false);
    expect(view.state.dateSelection['appointment-range']).toBeUndefined();
    expect(view.fetcher.mock.calls.every(call => !((call as unknown[])[1] as { method?: string })?.method)).toBe(true);
  });

  it.each([
    ['2026-10-31', '2026-11-02'],
    ['2026-12-31', '2027-01-02'],
  ])('跨月或跨年 %s 至 %s 使用完整日期查询', async (start, end) => {
    clock(); const view = mount(); await loaded(view); open(view);
    if (start.startsWith('2026-12')) {
      click(view, '[data-action="preview-date-next-month"]'); click(view, '[data-action="preview-date-next-month"]');
    }
    select(view, start); select(view, end); apply(view); await loaded(view);
    expect(Object.fromEntries(params(view))).toMatchObject({ startDate: start, endDate: end });
    expect(view.state.dateSelection['appointment-range']).toBe(`${start} 至 ${end}`);
  });

  it.each(['customer-created-range', 'analytics-period', 'workbench-period'])('只放开预约，%s 保持未来日期禁用且不清除预约选择', async target => {
    clock(); const view = mount(); await loaded(view);
    open(view); select(view, '2026-10-07'); apply(view); await loaded(view);
    const trigger = view.doc.createElement('button'); trigger.dataset.target = target; view.doc.body.append(trigger);
    view.bridge.__institutionV11RefinementAction?.('date-picker', trigger);
    expect(view.doc.querySelector('[data-preview-month="2026-10"] [aria-label="2026年10月7日，尚未到达，不可选择"]')).toBeDisabled();
    expect(view.query.getByRole('dialog')).toHaveTextContent('尚未到达的日期已禁用');
    const forged = view.doc.createElement('button'); forged.dataset.date = '2026-10-07';
    view.bridge.__institutionV11RefinementAction?.('preview-date-day', forged);
    expect(view.toast).toHaveBeenLastCalledWith('尚未到达的日期不可选择');
    expect(view.state.dateSelection['appointment-range']).toBe('2026-10-07');
    expect(view.state.dateSelection[target]).toBeUndefined();
  });

  it.each([
    ['2026-10-06T15:59:59.999Z', '2026-10-06'],
    ['2026-10-06T16:00:00.000Z', '2026-10-07'],
  ])('预约“今天”按上海午夜切换：%s', async (now, day) => {
    clock(now); const view = mount(); await loaded(view); open(view);
    click(view, '[data-action="preview-date-quick"][data-range="today"]'); apply(view); await loaded(view);
    expect(Object.fromEntries(params(view))).toMatchObject({ startDate: day, endDate: day });
  });

  it.each([401, 403, 503])('更换未来范围时丢弃旧请求，失败 %s 后等待手动重试', async status => {
    clock(); const old = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn(async (url: string) => response(result(url)));
    const view = mount(fetcher); await loaded(view);
    fetcher.mockImplementationOnce(() => old.promise);
    open(view); select(view, '2026-10-07'); apply(view);
    open(view); select(view, '2026-10-08'); apply(view); await loaded(view);
    old.resolve(response({}, 503)); await new Promise(resolve => setTimeout(resolve, 0));
    expect(params(view).get('startDate')).toBe('2026-10-08');
    expect(view.doc.querySelector('tbody')).toHaveTextContent('未来预约客户');
    fetcher.mockResolvedValueOnce(response({}, status));
    open(view); select(view, '2026-10-09'); apply(view);
    await waitFor(() => expect(view.doc.body).toHaveTextContent('真实预约暂不可用'));
    expect(view.doc.querySelector('tbody')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(4);
    click(view, '[data-action="preview-appointment-retry"]'); await loaded(view);
    expect(params(view).get('startDate')).toBe('2026-10-09');
  });
});
