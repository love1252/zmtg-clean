import { fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { prepareApprovedPrototypeHtml } from '@/modules/institution-v11-preview/server/approved-prototype-assets';

const batchId = 'imp-b-' + 'a'.repeat(48);
const completedAt = '2026-08-30T10:00:00Z';
const summary = { customers: 155, appointments: 1, treatments: 1, consumptions: 1, totalRows: 158 };
const counts = { customer: 155, appointment: 1, treatment: 1, consumption: 1 };
function detail(sheet: keyof typeof counts = 'customer', page = 1, pageSize = 20, total = counts[sheet]) {
  const pageCount = Math.ceil(total / pageSize);
  const rowCount = Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize));
  const currentSummary = { ...summary, [({ customer: 'customers', appointment: 'appointments', treatment: 'treatments', consumption: 'consumptions' } as const)[sheet]]: total, totalRows: summary.totalRows - counts[sheet] + total };
  return { kind: 'ready', batchId, completedAt, sheet, summary: currentSummary,
    pageInfo: { page, pageSize, total, pageCount, hasPrevious: page > 1, hasNext: page < pageCount },
    records: Array.from({ length: rowCount }, (_, i) => ({
      rowNumber: (page - 1) * pageSize + i + 5, canonicalReference: '***abcd',
      displayName: '客户' + ((page - 1) * pageSize + i + 1), maskedPhone: '138****5678', gender: '女', source: 'Excel',
      owner: '顾问甲', customerReference: '***0001', occurredAt: completedAt, project: '测试项目',
      practitioner: '医生乙', resource: '资源甲', department: '科室甲', status: 'confirmed',
      amountMinor: 12345, currency: 'CNY', eventType: 'payment_succeeded',
    })),
  };
}
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const history = () => response({ kind: 'ready', records: [{ batchId, completedAt, summary }] });
function defaultResponse(url: string) {
  const query = new URL(url, 'http://localhost').searchParams;
  return query.size ? response(detail(query.get('sheet') as keyof typeof counts, Number(query.get('page')), Number(query.get('pageSize')))) : history();
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });
function mount(fetcher = vi.fn(async (url: string, _options?: RequestInit) => defaultResponse(url))) {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div id="page"></div><div id="popover">旧菜单</div><div id="drawer"></div>';
  const state = { route: '/test-import', dateSelection: {} };
  const previous = vi.fn((action: string) => {
    if (action === 'close-overlays') { doc.querySelector('#drawer')!.innerHTML = ''; return true; }
    return false;
  });
  const bridge: { __institutionV11RefinementAction?: (action: string, element: HTMLElement) => boolean } = { __institutionV11RefinementAction: previous };
  const observers: MutationObserver[] = [];
  class Observer extends MutationObserver { constructor(callback: MutationCallback) { super(callback); observers.push(this); } }
  const esc = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const drawer = vi.fn((title: string, body: string) => {
    doc.querySelector('#drawer')!.innerHTML = '<aside class="drawer"><h2>' + esc(title) + '</h2><button data-action="close-overlays" aria-label="关闭">关闭</button><div class="drawer-body">' + body + '</div></aside>';
  });
  const html = prepareApprovedPrototypeHtml('<html><head></head><body></body></html>');
  const script = html.match(/<script id="institution-v11-interaction-completion-runtime">([\s\S]*?)<\/script>/)![1];
  new Function('document', 'state', 'fetch', 'globalThis', 'MutationObserver', 'ph', 'ico', 'esc', 'tag', 'toast', 'openDrawer', 'btn', script)(
    doc, state, fetcher, bridge, Observer, () => '', () => '', esc, (text: string) => '<span>' + esc(text) + '</span>', vi.fn(), drawer, () => '',
  );
  const action = (name: string, attributes: Record<string, string> = {}) => {
    const button = doc.createElement('button'); Object.assign(button.dataset, attributes);
    bridge.__institutionV11RefinementAction?.(name, button);
  };
  doc.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (button) bridge.__institutionV11RefinementAction?.(button.dataset.action!, button);
  });
  cleanups.push(() => { observers.forEach(observer => observer.disconnect()); frame.remove(); });
  action('import-log');
  return { doc, state, action, previous, fetcher, drawer, query: within(doc.body) };
}
const loadedHistory = async (view: ReturnType<typeof mount>) => waitFor(() => expect(view.query.getByRole('button', { name: /查看明细/ })).toBeVisible());
const loadedDetail = async (view: ReturnType<typeof mount>, text = '共 155 条') => waitFor(() => expect(view.doc.querySelector('.preview-import-detail-status')).toHaveTextContent(text));
async function openDetail(view: ReturnType<typeof mount>) { await loadedHistory(view); fireEvent.click(view.query.getByRole('button', { name: /查看明细/ })); }
const click = (view: ReturnType<typeof mount>, label: string) => fireEvent.click(view.query.getByRole('button', { name: label }));

describe('Approved 导入批次明细真实脚本交互', () => {
  it('选择批次、翻到第101条、切四类Sheet并改变页容量，始终只发送GET', async () => {
    const view = mount(); await openDetail(view); await loadedDetail(view);
    expect(view.doc.querySelector('#popover')).toBeEmptyDOMElement();
    for (let page = 2; page <= 6; page++) { click(view, '下一页'); await loadedDetail(view, `第 ${page} / 8 页`); }
    expect(view.doc.body).toHaveTextContent('客户101');
    expect(view.doc.querySelectorAll('tbody tr')).toHaveLength(20);
    expect(new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost').searchParams.get('page')).toBe('6');
    fireEvent.change(view.query.getByLabelText('导入明细每页显示条数'), { target: { value: '50' } });
    await loadedDetail(view, '第 1 / 4 页');
    for (const [label, sheet] of [['预约 1', 'appointment'], ['治疗 1', 'treatment'], ['消费 1', 'consumption'], ['客户 155', 'customer']]) {
      fireEvent.click(view.query.getByRole('tab', { name: label }));
      await waitFor(() => expect(view.query.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true'));
      await loadedDetail(view, sheet === 'customer' ? '共 155 条' : '共 1 条');
      const query = new URL(view.fetcher.mock.calls.at(-1)![0], 'http://localhost').searchParams;
      expect(Object.fromEntries(query)).toMatchObject({ batchId, sheet, page: '1', pageSize: '50' });
    }
    expect(view.fetcher.mock.calls.every(call => call[1]?.method === 'GET' && call[1]?.cache === 'no-store')).toBe(true);
    for (const key of ['apiKey', 'encryptedApiKey', 'ciphertext', 'authTag', 'nationalId', 'protectedPayload']) expect(view.doc.body.innerHTML).not.toContain(key);
  });

  it.each([401, 403, 503])('明细加载失败%s清除旧行，显示低敏错误并允许重试', async status => {
    const fetcher = vi.fn().mockResolvedValueOnce(history()).mockResolvedValueOnce(response(detail()))
      .mockResolvedValueOnce(response({ kind: 'unavailable', message: 'private-error' }, status)).mockResolvedValue(response(detail('customer', 2)));
    const view = mount(fetcher); await openDetail(view); await loadedDetail(view); click(view, '下一页');
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent(status === 503 ? '暂不可用' : '无权'));
    expect(view.doc.querySelector('tbody')).toBeNull();
    expect(view.query.queryByLabelText('导入明细每页显示条数')).toBeNull();
    expect(view.query.queryByRole('button', { name: '下一页' })).toBeNull();
    expect(view.doc.body).not.toHaveTextContent('private-error');
    expect(fetcher.mock.calls.every(call => call[1]?.method === 'GET')).toBe(true);
    click(view, '重新加载'); await loadedDetail(view, '第 2 / 8 页');
  });

  it('空Sheet和超末页保留真实总数，翻页按钮准确禁用', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(history()).mockResolvedValueOnce(response(detail()))
      .mockResolvedValueOnce(response(detail('customer', 2, 20, 1))).mockResolvedValue(response(detail('appointment', 1, 20, 0)));
    const view = mount(fetcher); await openDetail(view); await loadedDetail(view); click(view, '下一页');
    await loadedDetail(view, '共 1 条 · 第 2 / 1 页');
    expect(view.query.getByRole('button', { name: '下一页' })).toBeDisabled();
    expect(view.query.getByRole('button', { name: /上一页/ })).toBeEnabled();
    fireEvent.click(view.query.getByRole('tab', { name: '预约 1' })); await loadedDetail(view, '共 0 条 · 第 0 / 0 页');
    expect(view.doc.body).toHaveTextContent('该 Sheet 暂无导入行');
    expect(view.query.getByRole('button', { name: /上一页/ })).toBeDisabled();
    expect(view.query.getByRole('button', { name: '下一页' })).toBeDisabled();
  });

  it('快速切Sheet丢弃旧成功响应及旧错误响应', async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockResolvedValueOnce(history()).mockReturnValueOnce(old.promise).mockResolvedValue(response(detail('appointment')));
    const view = mount(fetcher); await openDetail(view);
    expect(view.query.getByRole('status')).toHaveTextContent('正在读取');
    fireEvent.click(view.query.getByRole('tab', { name: '预约 1' })); await loadedDetail(view, '共 1 条');
    old.resolve(response(detail())); await new Promise(done => setTimeout(done, 0));
    expect(view.query.getByRole('tab', { name: '预约 1' })).toHaveAttribute('aria-selected', 'true');
    const olderFailure = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValueOnce(olderFailure.promise);
    fireEvent.click(view.query.getByRole('tab', { name: '客户 155' }));
    fireEvent.click(view.query.getByRole('tab', { name: '预约 1' })); await loadedDetail(view, '共 1 条');
    olderFailure.resolve(response({}, 503)); await new Promise(done => setTimeout(done, 0));
    expect(view.query.queryByRole('alert')).toBeNull();
  });

  it('关闭动作即使由前置处理器接管，慢响应也不能重开抽屉', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const view = mount(vi.fn().mockResolvedValueOnce(history()).mockReturnValueOnce(pending.promise));
    await openDetail(view); click(view, '关闭');
    expect(view.previous).toHaveBeenCalledWith('close-overlays', expect.anything());
    expect(view.doc.querySelector('#drawer')).toBeEmptyDOMElement();
    pending.resolve(response(detail())); await new Promise(done => setTimeout(done, 0));
    expect(view.doc.querySelector('#drawer')).toBeEmptyDOMElement();
  });

  it('同路由替换抽屉或离开后返回，不让旧响应覆盖新的界面', async () => {
    const first = deferred<ReturnType<typeof response>>(); const second = deferred<ReturnType<typeof response>>();
    const view = mount(vi.fn().mockResolvedValueOnce(history()).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    await openDetail(view); view.doc.querySelector('#drawer')!.innerHTML = '<div class="drawer-body">其他抽屉</div>';
    first.resolve(response(detail())); await new Promise(done => setTimeout(done, 0));
    expect(view.doc.body).toHaveTextContent('其他抽屉');
    view.action('import-log'); view.state.route = '/outside'; view.doc.querySelector('#drawer')!.innerHTML = '';
    view.state.route = '/test-import'; second.resolve(history()); await new Promise(done => setTimeout(done, 0));
    expect(view.doc.querySelector('#drawer')).toBeEmptyDOMElement();
  });

  it('空历史和网络错误可见且无虚构记录，返回历史丢弃旧明细', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetcher = vi.fn().mockResolvedValueOnce(history()).mockReturnValueOnce(pending.promise)
      .mockRejectedValueOnce(new Error('private-network-error')).mockResolvedValue(response({ kind: 'ready', records: [] }));
    const view = mount(fetcher); await openDetail(view); click(view, '返回导入记录');
    await waitFor(() => expect(view.query.getByRole('alert')).toHaveTextContent('暂不可用'));
    pending.resolve(response(detail())); await new Promise(done => setTimeout(done, 0));
    expect(view.query.getByRole('alert')).toBeVisible();
    expect(view.doc.body).not.toHaveTextContent('private-network-error');
    click(view, '重新加载'); await waitFor(() => expect(view.doc.body).toHaveTextContent('暂无真实导入记录'));
    expect(view.query.queryByRole('button', { name: /查看明细/ })).toBeNull();
  });

  it('动态字段按文本展示，不执行HTML；损坏响应失败关闭', async () => {
    const body = detail(); body.records[0].displayName = '<img src=x onerror="private-xss">';
    const fetcher = vi.fn().mockResolvedValueOnce(history()).mockResolvedValueOnce(response(body)).mockResolvedValue(response({ ...detail('customer', 2), batchId: 'foreign-batch' }));
    const view = mount(fetcher); await openDetail(view); await loadedDetail(view);
    expect(view.doc.body).toHaveTextContent('<img src=x onerror="private-xss">');
    expect(view.doc.querySelector('img')).toBeNull();
    click(view, '下一页'); await waitFor(() => expect(view.query.getByRole('alert')).toBeVisible());
    expect(view.doc.querySelector('tbody')).toBeNull();
  });
});
