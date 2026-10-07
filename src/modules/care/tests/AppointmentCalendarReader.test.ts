import { describe, expect, it, vi } from 'vitest';
import { createAppointmentCalendarReaderV1 } from '../application/appointment-calendar-reader';
import { appointmentCalendarRange, appointmentShanghaiDate, appointmentShanghaiTime } from '../application/appointment-calendar-contract';
import { APPOINTMENT_CALENDAR_LIMIT_V1 } from '../ports/appointment-list-source';

const row = {
  appointmentId: 'appointment-1', customerDisplayName: '合成客户', project: '合成项目',
  scheduledAt: '2026-10-07T02:00:00.000Z', status: 'confirmed' as const,
  updatedAt: '2026-10-06T02:00:00.000Z', tenantId: 'tenant-test', institutionId: 'institution-test',
};
const input = { tenantId: 'tenant-test', institutionId: 'institution-test', searchParams: new URLSearchParams('startDate=2026-10-07&endDate=2026-10-07') };

describe('正式预约日历完整查询', () => {
  it('超过 100 条仍单次完整查询当前日期，不拼接列表页', async () => {
    const listCalendar = vi.fn().mockResolvedValue(Array.from({ length: 151 }, (_, index) => ({ ...row, appointmentId: `appointment-${index}` })));
    const result = await createAppointmentCalendarReaderV1({ source: { listCalendar } }).read(input);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw new Error('日历未就绪');
    expect(result.records).toHaveLength(151);
    expect(result.records[150].appointmentId).toBe('appointment-150');
    expect(listCalendar).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-test', institutionId: 'institution-test', status: null, keyword: null,
      scheduledFrom: '2026-10-06T16:00:00.000Z', scheduledBefore: '2026-10-07T16:00:00.000Z', limit: 2001, offset: 0 });
    expect(JSON.stringify(result)).not.toMatch(/tenantId|institutionId|phone|apiKey|encryptedApiKey|ciphertext|authTag/);
  });

  it('超过保护上限不返回部分日历，明确 too_many', async () => {
    const source = { listCalendar: vi.fn().mockResolvedValue(Array.from({ length: APPOINTMENT_CALENDAR_LIMIT_V1 + 1 }, (_, index) => ({ ...row, appointmentId: `appointment-${index}` }))) };
    expect(await createAppointmentCalendarReaderV1({ source }).read(input)).toEqual({ kind: 'too_many', limit: 2000 });
  });

  it.each([
    'startDate=2026-02-30&endDate=2026-03-01', 'startDate=2026-10-07',
    'startDate=2026-10-07&endDate=2026-10-06', 'startDate=2026-10-01&endDate=2026-10-08',
    'startDate=2026-10-07&endDate=2026-10-07&page=2',
    'startDate=2026-10-07&endDate=2026-10-07&pageSize=100',
    'startDate=2026-10-07&endDate=2026-10-07&institutionId=other',
    'startDate=2026-10-07&startDate=2026-10-08&endDate=2026-10-07',
  ])('无效、分页、越权查询在 source 前拒绝：%s', async (query) => {
    const source = { listCalendar: vi.fn() };
    expect(await createAppointmentCalendarReaderV1({ source }).read({ ...input, searchParams: new URLSearchParams(query) })).toEqual({ kind: 'invalid_query', code: 'invalid_appointment_query' });
    expect(source.listCalendar).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [{ ...row, tenantId: 'other' }] }, { rows: [{ ...row, institutionId: 'other' }] },
    { rows: [{ ...row, scheduledAt: '2026-10-06T15:59:59.999Z' }] }, { rows: [{ ...row, scheduledAt: '2026-10-07T16:00:00.000Z' }] },
    { rows: [row, row] }, { rows: [{ ...row, status: 'unknown' }] }, { rows: [{ ...row, phone: 'private' }] },
  ])('跨机构、范围外、重复或敏感额外字段 fail-closed', async ({ rows }) => {
    const source = { listCalendar: vi.fn().mockResolvedValue(rows) };
    expect(await createAppointmentCalendarReaderV1({ source }).read(input)).toEqual({ kind: 'unavailable' });
  });

  it('上海日期零点、前一天深夜和跨年周范围正确', () => {
    expect(appointmentShanghaiDate(new Date('2026-10-06T15:59:59.999Z'))).toBe('2026-10-06');
    expect(appointmentShanghaiDate(new Date('2026-10-06T16:00:00.000Z'))).toBe('2026-10-07');
    expect(appointmentShanghaiTime('2026-10-06T16:30:00.000Z')).toBe('2026-10-07 00:30');
    expect(appointmentShanghaiTime('2026-10-07T15:30:00.000Z')).toBe('2026-10-07 23:30');
    expect(appointmentCalendarRange('2027-01-01', 'week')).toEqual({ startDate: '2026-12-28', endDate: '2027-01-03' });
    expect(appointmentCalendarRange('2028-02-29', 'day')).toEqual({ startDate: '2028-02-29', endDate: '2028-02-29' });
    expect(appointmentCalendarRange('9999-12-31', 'week')).toBeNull();
  });

  it('跨年未来周和状态采用统一上海闭开边界', async () => {
    const source = { listCalendar: vi.fn().mockResolvedValue([]) };
    await createAppointmentCalendarReaderV1({ source }).read({ ...input, searchParams: new URLSearchParams('startDate=2026-12-28&endDate=2027-01-03&status=confirmed&q=复诊') });
    expect(source.listCalendar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 'confirmed', keyword: '复诊', scheduledFrom: '2026-12-27T16:00:00.000Z', scheduledBefore: '2027-01-03T16:00:00.000Z' }));
  });

  it('source 错误不泄露信息，状态不符不展示', async () => {
    const source = { listCalendar: vi.fn().mockRejectedValueOnce(new Error('secret')).mockResolvedValueOnce([row]) };
    const reader = createAppointmentCalendarReaderV1({ source });
    expect(await reader.read(input)).toEqual({ kind: 'unavailable' });
    expect(await reader.read({ ...input, searchParams: new URLSearchParams('startDate=2026-10-07&endDate=2026-10-07&status=cancelled') })).toEqual({ kind: 'unavailable' });
  });
});


describe('日历查询输入快照', () => {
  it('等待期间输入被修改不会改变机构或日期上下文', async () => {
    let finish!: (rows: typeof row[]) => void;
    const source = { listCalendar: vi.fn(() => new Promise<typeof row[]>((resolve) => { finish = resolve; })) };
    const mutable = { ...input, searchParams: new URLSearchParams(input.searchParams) };
    const pending = createAppointmentCalendarReaderV1({ source }).read(mutable);
    mutable.institutionId = 'other';
    mutable.searchParams.set('startDate', '2027-01-01');
    finish([row]);
    expect(await pending).toMatchObject({ kind: 'ready', range: { startDate: '2026-10-07', endDate: '2026-10-07' } });
  });
  it('getter/Proxy 输入不执行、不触达 source', async () => {
    const source = { listCalendar: vi.fn() };
    const getter = vi.fn(() => 'tenant-test');
    const forged = { ...input };
    Object.defineProperty(forged, 'tenantId', { get: getter, enumerable: true });
    const reader = createAppointmentCalendarReaderV1({ source });
    expect(await reader.read(forged)).toEqual({ kind: 'unavailable' });
    expect(await reader.read(new Proxy(input, {}))).toEqual({ kind: 'unavailable' });
    expect(getter).not.toHaveBeenCalled();
    expect(source.listCalendar).not.toHaveBeenCalled();
  });
});
