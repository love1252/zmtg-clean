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
  scheduledAt: '2026-08-16T08:30:00.000Z',
  status: 'pending_confirmation' as const,
  updatedAt: '2026-08-16T08:00:00.000Z',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

function createReader(rows: readonly unknown[] = [baseRow]) {
  const list = vi.fn(async () => rows);
  const source = Object.freeze({ list }) as unknown as AppointmentListSourceV1;
  return { reader: createAppointmentListReaderV1({ source }), list };
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
  it('只发布 exact 5-field v1 DTO，attribution pair 仅下推 source', async () => {
    const { reader, list } = createReader();
    const result = await read(reader);

    expect(result).toEqual({
      kind: 'ready',
      records: [
        {
          contractVersion: 'v1',
          appointmentId: 'appointment-001',
          scheduledAt: '2026-08-16T08:30:00.000Z',
          status: 'pending_confirmation',
          updatedAt: '2026-08-16T08:00:00.000Z',
        },
      ],
      pageInfo: { page: 1, pageSize: 20, hasMore: false },
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: null,
      limit: 21,
      offset: 0,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /tenantId|institutionId|customer|project|consultant|note|phone|email|medical|external/iu,
    );
  });

  it('page 1 / 100、limit+1 和 hasMore 严格受限', async () => {
    const first = createReader();
    await read(first.reader, 'page=1');
    expect(first.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 21, offset: 0 }),
    );

    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...baseRow,
      appointmentId: `appointment-${String(index).padStart(3, '0')}`,
    }));
    const last = createReader(rows);
    const result = await read(last.reader, 'page=100');
    expect(result).toMatchObject({
      kind: 'ready',
      pageInfo: { page: APPOINTMENT_LIST_MAX_PAGE_V1, hasMore: true },
    });
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.records).toHaveLength(APPOINTMENT_LIST_PAGE_SIZE_V1);
    expect(last.list).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: APPOINTMENT_LIST_PAGE_SIZE_V1 + 1,
        offset: APPOINTMENT_LIST_MAX_OFFSET_V1,
      }),
    );
  });

  it.each(['pending_confirmation', 'reschedule_requested', 'completed'] as const)(
    '把 exact status=%s filter 下推',
    async (status) => {
      const { reader, list } = createReader();
      await expect(read(reader, `status=${status}`)).resolves.toMatchObject({
        kind: 'ready',
      });
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
    },
  );

  it.each([
    'page=101',
    'page=0',
    'page=01',
    'page=1.5',
    'status=unknown',
    'page=1&page=2',
    'status=confirmed&status=cancelled',
    'q=appointment',
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
  });
});
