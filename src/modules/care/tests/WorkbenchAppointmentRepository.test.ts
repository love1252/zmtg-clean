import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentListSourceQueryV1, AppointmentListSourceRowV1, AppointmentListSourceSummaryQueryV1 } from '@/modules/care/ports/appointment-list-source';
import type { TenantDatabase } from '@/server/db/client';

const mocks = vi.hoisted(() => ({ list: vi.fn(), summarize: vi.fn(), factory: vi.fn() }));
vi.mock('@/modules/care/server/appointment-list-repository', () => ({ createAppointmentListRepository: mocks.factory }));
import { readWorkbenchAppointmentsV1 } from '@/modules/care/server/workbench-appointment-repository';

const input = { tenantId: 'tenant-a', institutionId: 'institution-a', referenceTime: '2026-10-06T16:10:00.000Z' };
const record = (id: string, scheduledAt = '2026-10-07T01:00:00.000Z', status: AppointmentListSourceRowV1['status'] = 'confirmed'): AppointmentListSourceRowV1 => ({
  appointmentId: id, tenantId: input.tenantId, institutionId: input.institutionId,
  customerDisplayName: '合成客户', project: '复诊', scheduledAt, status, updatedAt: '2026-10-01T00:00:00.000Z',
});
let rows: AppointmentListSourceRowV1[];
const transaction = vi.fn();
const database = { transaction } as unknown as TenantDatabase;
function filtered(query: AppointmentListSourceQueryV1 | AppointmentListSourceSummaryQueryV1) {
  return rows.filter(row => row.tenantId === query.tenantId && row.institutionId === query.institutionId
    && (!query.scheduledFrom || row.scheduledAt >= query.scheduledFrom)
    && (!query.scheduledBefore || row.scheduledAt < query.scheduledBefore)
    && (!('status' in query) || !query.status || row.status === query.status));
}
beforeEach(() => {
  vi.resetAllMocks(); rows = [];
  transaction.mockImplementation(callback => callback({ select: vi.fn() }));
  mocks.factory.mockReturnValue({ list: mocks.list, summarize: mocks.summarize });
  mocks.list.mockImplementation(async (query: AppointmentListSourceQueryV1) => filtered(query).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.appointmentId.localeCompare(b.appointmentId)).slice(query.offset, query.offset + query.limit));
  mocks.summarize.mockImplementation(async (query: AppointmentListSourceSummaryQueryV1) => {
    const counts = new Map<string, number>();
    filtered(query).forEach(row => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
    return [...counts].map(([status, total]) => ({ tenantId: query.tenantId, institutionId: query.institutionId, status, total }));
  });
});

describe('工作台完整预约范围', () => {
  it('先过滤全量再取六条，超过第100条的今日与待办仍出现且统计完整', async () => {
    rows = [
      ...Array.from({ length: 150 }, (_, i) => record(`past-${i}`, '2026-01-01T00:00:00.000Z')),
      ...Array.from({ length: 15 }, (_, i) => record(`today-${String(i).padStart(2, '0')}`, undefined, 'pending_confirmation')),
      record('reschedule', '2026-10-08T01:00:00.000Z', 'reschedule_requested'),
      { ...record('foreign'), institutionId: 'institution-b' },
    ];
    const result = await readWorkbenchAppointmentsV1(database, input);
    expect(result).toMatchObject({ kind: 'ready', businessDate: '2026-10-07', today: { total: 15 }, pending: { total: 15 }, rescheduled: { total: 1 } });
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.today.records.map(row => row.appointmentId)).toEqual(Array.from({ length: 6 }, (_, i) => `today-0${i}`));
    expect(result.rescheduled.records.map(row => row.appointmentId)).toEqual(['reschedule']);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ scheduledFrom: '2026-10-06T16:00:00.000Z', scheduledBefore: '2026-10-07T16:00:00.000Z' }));
  });
  it('上海午夜前后切换业务日，与宿主时区无关', async () => {
    expect(await readWorkbenchAppointmentsV1(database, { ...input, referenceTime: '2026-10-06T15:59:59.999Z' })).toMatchObject({ businessDate: '2026-10-06' });
    expect(await readWorkbenchAppointmentsV1(database, input)).toMatchObject({ businessDate: '2026-10-07' });
  });
  it('空数据确认后才返回零，查询失败和跨机构污染均返回不可用', async () => {
    expect(await readWorkbenchAppointmentsV1(database, input)).toMatchObject({ kind: 'ready', today: { total: 0, records: [] } });
    mocks.list.mockRejectedValueOnce(new Error('database-unavailable'));
    expect(await readWorkbenchAppointmentsV1(database, input)).toEqual({ kind: 'unavailable' });
    mocks.list.mockResolvedValueOnce([{ ...record('foreign'), tenantId: 'another' }]);
    expect(await readWorkbenchAppointmentsV1(database, input)).toEqual({ kind: 'unavailable' });
  });
  it('非法时间或机构标识不成为空结果', async () => {
    expect(await readWorkbenchAppointmentsV1(database, { ...input, referenceTime: 'invalid' })).toEqual({ kind: 'unavailable' });
    expect(transaction).not.toHaveBeenCalled();
    expect(await readWorkbenchAppointmentsV1(database, { ...input, institutionId: '../other' })).toEqual({ kind: 'unavailable' });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
