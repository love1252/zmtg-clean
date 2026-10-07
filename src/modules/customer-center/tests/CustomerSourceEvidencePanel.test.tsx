import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerSourceEvidencePanel } from '../components/CustomerSourceEvidencePanel';

const fetchMock = vi.fn();
const dto = (customerId = 'customer-a') => ({ kind: 'ready', contractVersion: 'customer-source-evidence.v1', customerId, customerUpdatedAt: '2026-10-01T00:00:00Z', observedAt: '2026-10-07T00:00:00Z', evidence: { status: 'recorded', importRecord: { batchId: `imp-b-${'a'.repeat(48)}`, sheetKind: 'customer', rowNumber: 7, completedAt: '2026-10-01T00:00:00Z' } } });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });
describe('正式客户来源面板', () => {
  it('展示当前客户的已记录来源，固定上海时间且仅发只读请求', async () => {
    fetchMock.mockResolvedValue(response(dto()));
    render(<CustomerSourceEvidencePanel customerId="customer-a" />);
    expect(await screen.findByText(`imp-b-${'a'.repeat(48)}`)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/08:00/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/institution/customers/customer-a/source-evidence', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
    expect(fetchMock.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });
  it.each([401, 403, 503])('%s 显示低敏错误且可手动恢复', async status => {
    fetchMock.mockResolvedValueOnce(response({ error: 'private-token-value' }, status)).mockResolvedValueOnce(response(dto()));
    render(<CustomerSourceEvidencePanel customerId="customer-a" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('资料来源暂不可用');
    expect(screen.queryByText('private-token-value')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '重新加载来源' }));
    expect(await screen.findByText(`imp-b-${'a'.repeat(48)}`)).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });
  it.each(['not_recorded', 'ambiguous'])('%s 与读取失败区分', async status => {
    fetchMock.mockResolvedValue(response({ ...dto(), evidence: { status, importRecord: null } }));
    render(<CustomerSourceEvidencePanel customerId="customer-a" />);
    expect(await screen.findByText(status === 'not_recorded' ? /暂无已记录来源/ : /存在多条来源关联/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('客户切换后的迟到响应与错误客户载荷不得显示', async () => {
    let release!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve; })).mockResolvedValueOnce(response({ ...dto('customer-b'), evidence: { status: 'not_recorded', importRecord: null } }));
    const { rerender } = render(<CustomerSourceEvidencePanel customerId="customer-a" />);
    rerender(<CustomerSourceEvidencePanel customerId="customer-b" />);
    expect(await screen.findByText(/暂无已记录来源/)).toBeInTheDocument();
    release(response(dto()));
    await waitFor(() => expect(screen.queryByText(`imp-b-${'a'.repeat(48)}`)).not.toBeInTheDocument());
    fetchMock.mockResolvedValueOnce(response(dto('customer-b')));
    rerender(<CustomerSourceEvidencePanel customerId="customer-c" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
  it('损坏证据不作为无来源', async () => {
    fetchMock.mockResolvedValue(response({ ...dto(), evidence: { status: 'recorded', importRecord: null } }));
    render(<CustomerSourceEvidencePanel customerId="customer-a" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/暂无已记录来源/)).not.toBeInTheDocument();
  });
});
