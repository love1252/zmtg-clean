import { describe, expect, it, vi } from 'vitest';

import {
  APPOINTMENT_LIST_MAX_OFFSET_V1,
  APPOINTMENT_LIST_MAX_PAGE_V1,
  APPOINTMENT_LIST_PAGE_SIZE_V1,
  createAppointmentListReaderV1,
} from '@/modules/care/application/appointment-list-reader';
import type { AppointmentListSourceV1 } from '@/modules/care/ports/appointment-list-source';

const baseRow = Object.freeze({
  appointmentId: 'appointment-001',
  customerDisplayName: '张女士',
  project: '光子嫩肤复诊',
  scheduledAt: '2026-08-16T08:30:00.000Z',
  status: 'pending_confirmation' as const,
  updatedAt: '2026-08-16T08:00:00.000Z',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const baseSummaryRow = Object.freeze({
  status: 'pending_confirmation' as const,
  total: 1,
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

function createReader(
  rows: readonly unknown[] = [baseRow],
  summaryRows: readonly unknown[] = [baseSummaryRow],
) {
  const list = vi.fn(async () => rows);
  const summarize = vi.fn(async () => summaryRows);
  const source = Object.freeze({ list, summarize }) as AppointmentListSourceV1;
  return {
    reader: createAppointmentListReaderV1({ source }),
    list,
    summarize,
  };
}

function read(
  reader: ReturnType<typeof createAppointmentListReaderV1>,
  query = '',
) {
  return reader.read({
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    searchParams: new URLSearchParams(query),
  });
}

describe('Care appointment formal list Reader', () => {
  it('发布预约列表所需 exact 7-field v1 DTO，attribution pair 仅下推 source', async () => {
    const { reader, list, summarize } = createReader();
    const result = await read(reader);

    expect(result).toEqual({
      kind: 'ready',
      records: [
        {
          contractVersion: 'v1',
          appointmentId: 'appointment-001',
          customerDisplayName: '张女士',
          project: '光子嫩肤复诊',
          scheduledAt: '2026-08-16T08:30:00.000Z',
          status: 'pending_confirmation',
          updatedAt: '2026-08-16T08:00:00.000Z',
        },
      ],
      pageInfo: {
        page: 1,
        pageSize: 20,
        hasMore: false,
        total: 1,
        pageCount: 1,
      },
      summary: {
        total: 1,
        statusCounts: {
          pending_confirmation: 1,
          confirmed: 0,
          arrived: 0,
          completed: 0,
          reschedule_requested: 0,
          cancelled: 0,
        },
      },
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: null,
      keyword: null,
      scheduledFrom: null,
      scheduledBefore: null,
      limit: 21,
      offset: 0,
    });
    expect(summarize).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      keyword: null,
      scheduledFrom: null,
      scheduledBefore: null,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /tenantId|institutionId|customerId|consultant|note|phone|email|medical|external/iu,
    );
  });

  it('page 1 / 100、白名单最大页容量、limit+1 和 hasMore 严格受限', async () => {
    const first = createReader();
    await read(first.reader, 'page=1');
    expect(first.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 21, offset: 0 }),
    );

    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...baseRow,
      appointmentId: `appointment-${String(index).padStart(3, '0')}`,
    }));
    const last = createReader(rows, [{ ...baseSummaryRow, total: 10_001 }]);
    const result = await read(last.reader, 'page=100&pageSize=100');
    expect(result).toMatchObject({
      kind: 'ready',
      pageInfo: { page: APPOINTMENT_LIST_MAX_PAGE_V1, hasMore: true },
    });
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.records).toHaveLength(100);
    expect(last.list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101,
        offset: APPOINTMENT_LIST_MAX_OFFSET_V1,
      }),
    );
  });

  it.each(['pending_confirmation', 'reschedule_requested', 'completed'] as const)(
    '把 exact status=%s filter 下推',
    async (status) => {
      const { reader, list } = createReader(
        [{ ...baseRow, status }],
        [{ ...baseSummaryRow, status }],
      );
      await expect(read(reader, `status=${status}`)).resolves.toMatchObject({
        kind: 'ready',
      });
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
    },
  );

  it('白名单 pageSize 与上海日期范围下推，并返回真实汇总分页', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      ...baseRow,
      appointmentId: `appointment-${index}`,
    }));
    const { reader, list, summarize } = createReader(rows, [
      { ...baseSummaryRow, total: 14 },
      { ...baseSummaryRow, status: 'confirmed', total: 3 },
    ]);
    const result = await read(
      reader,
      'page=1&pageSize=10&startDate=2026-08-15&endDate=2026-08-16',
    );

    expect(result).toMatchObject({
      kind: 'ready',
      pageInfo: {
        page: 1,
        pageSize: 10,
        hasMore: true,
        total: 17,
        pageCount: 2,
      },
      summary: {
        total: 17,
        statusCounts: { pending_confirmation: 14, confirmed: 3 },
      },
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: null,
      keyword: null,
      scheduledFrom: '2026-08-14T16:00:00.000Z',
      scheduledBefore: '2026-08-16T16:00:00.000Z',
      limit: 11,
      offset: 0,
    });
    expect(summarize).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      keyword: null,
      scheduledFrom: '2026-08-14T16:00:00.000Z',
      scheduledBefore: '2026-08-16T16:00:00.000Z',
    });
  });

  it('客户或项目关键词同时下推列表与汇总，且不在客户端推断', async () => {
    const { reader, list, summarize } = createReader();
    await expect(read(reader, 'q=光子嫩肤')).resolves.toMatchObject({
      kind: 'ready',
      records: [{ customerDisplayName: '张女士', project: '光子嫩肤复诊' }],
    });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '光子嫩肤' }),
    );
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '光子嫩肤' }),
    );
  });

  it.each([
    'page=101',
    'page=0',
    'page=01',
    'page=1.5',
    'status=unknown',
    'page=1&page=2',
    'status=confirmed&status=cancelled',
    'pageSize=25',
    'pageSize=10&pageSize=20',
    'startDate=2026-08-15',
    'endDate=2026-08-16',
    'startDate=2026-08-17&endDate=2026-08-16',
    'startDate=2026-02-30&endDate=2026-03-01',
    'startDate=2999-01-01&endDate=2999-01-02',
    'q=',
    'q=%20appointment',
    `q=${'a'.repeat(81)}`,
  ])('非法、duplicate 或 unknown query %s 在 source 前失败', async (query) => {
    const { reader, list } = createReader();
    await expect(read(reader, query)).resolves.toEqual({
      kind: 'invalid_query',
      code: 'invalid_appointment_query',
    });
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    { ...baseRow, tenantId: 'tenant-other' },
    { ...baseRow, institutionId: 'institution-other' },
  ])('任一 source row pair 漂移都整页 unavailable', async (row) => {
    await expect(read(createReader([baseRow, row]).reader)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('拒绝 extra field、非法枚举、非法时间、overflow 与 source failure', async () => {
    for (const rows of [
      [{ ...baseRow, customerId: 'customer-sensitive' }],
      [{ ...baseRow, status: 'unknown' }],
      [{ ...baseRow, scheduledAt: 'not-time' }],
      Array.from({ length: 22 }, (_, index) => ({
        ...baseRow,
        appointmentId: `appointment-${index}`,
      })),
    ]) {
      await expect(read(createReader(rows).reader)).resolves.toEqual({
        kind: 'unavailable',
      });
    }

    const source = Object.freeze({
      list: vi.fn(async () => {
        throw new Error('database secret');
      }),
      summarize: vi.fn(async () => []),
    });
    await expect(
      read(createAppointmentListReaderV1({ source })),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('ready result、records、row 与 pageInfo 全部冻结', async () => {
    const result = await read(createReader().reader);
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.records)).toBe(true);
    expect(Object.isFrozen(result.records[0])).toBe(true);
    expect(Object.isFrozen(result.pageInfo)).toBe(true);
    expect(Object.isFrozen(result.summary)).toBe(true);
    expect(Object.isFrozen(result.summary.statusCounts)).toBe(true);
  });

  it('汇总 attribution 漂移、重复状态或与列表数量矛盾时 fail-closed', async () => {
    for (const summaryRows of [
      [{ ...baseSummaryRow, institutionId: 'institution-other' }],
      [baseSummaryRow, baseSummaryRow],
      [{ ...baseSummaryRow, total: 0 }],
    ]) {
      await expect(
        read(createReader([baseRow], summaryRows).reader),
      ).resolves.toEqual({ kind: 'unavailable' });
    }
  });
});
