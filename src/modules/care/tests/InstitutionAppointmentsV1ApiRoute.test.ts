
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAppointments: vi.fn(),
  createAppointment: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-appointment-list-reader', () => ({
  readCurrentInstitutionAppointmentsV1: mocks.readAppointments,
}));
vi.mock(
  '@/server/orchestration/institution-appointment-controlled-write-runtime',
  () => ({
    createCurrentInstitutionAppointmentControlledV1:
      mocks.createAppointment,
  }),
);

import {
  GET,
  POST,
} from '@/app/api/v1/institution/appointments/route';

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([
    Object.freeze({
      contractVersion: 'v1' as const,
      appointmentId: 'appointment-001',
      customerDisplayName: '张女士',
      project: '光子嫩肤复诊',
      scheduledAt: '2026-08-16T08:30:00.000Z',
      status: 'pending_confirmation' as const,
      updatedAt: '2026-08-16T08:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({
    page: 1,
    pageSize: 20 as const,
    hasMore: false,
    total: 1,
    pageCount: 1,
  }),
  summary: Object.freeze({
    total: 1,
    statusCounts: Object.freeze({
      pending_confirmation: 1,
      confirmed: 0,
      arrived: 0,
      completed: 0,
      reschedule_requested: 0,
      cancelled: 0,
    }),
  }),
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.readAppointments.mockResolvedValue(ready);
  mocks.createAppointment.mockResolvedValue({
    kind: 'ready',
    record: {
      contractVersion: 'v1',
      appointmentId: 'appointment-new',
      scheduledAt: '2026-08-20T08:30:00.000Z',
      status: 'pending_confirmation',
      updatedAt: '2026-08-18T04:30:00.000Z',
      permissions: {
        canOperate: true,
        canReschedule: true,
        canCancel: true,
      },
    },
  });
});

describe('/api/v1/institution/appointments', () => {
  it('GET 返回当前机构预约列表所需的精确只读契约', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/institution/appointments?status=pending_confirmation',
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      records: ready.records,
      pageInfo: ready.pageInfo,
      summary: ready.summary,
    });
  });

  it('POST delegates controlled create and returns no-store 201', async () => {
    const body = {
      customerId: 'customer-1',
      project: '皮肤管理',
      scheduledAt: '2026-08-20T08:30:00.000Z',
      consultantUserId: 'consultant-1',
      note: '',
    };
    const response = await POST(
      new Request(
        'http://localhost/api/v1/institution/appointments',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      ),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createAppointment).toHaveBeenCalledWith(body);
  });

  it.each([
    [{ kind: 'invalid', code: 'invalid_appointment_create' }, 400],
    [{ kind: 'forbidden' }, 403],
    [{ kind: 'not_found' }, 404],
    [{ kind: 'conflict', code: 'appointment_conflict' }, 409],
    [{ kind: 'unavailable' }, 503],
  ] as const)('POST maps %o to HTTP %i', async (result, status) => {
    mocks.createAppointment.mockResolvedValueOnce(result);
    const response = await POST(
      new Request(
        'http://localhost/api/v1/institution/appointments',
        {
          method: 'POST',
          body: '{}',
        },
      ),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('versioned route stays orchestration-only and exposes GET/POST only', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/v1/institution/appointments/route.ts',
      ),
      'utf8',
    );
    expect(source).toContain(
      'readCurrentInstitutionAppointmentsV1',
    );
    expect(source).toContain(
      'createCurrentInstitutionAppointmentControlledV1',
    );
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain(
      'createAppointmentCommandRepository',
    );
    expect(source).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:PATCH|DELETE)/u,
    );
  });

  it('legacy appointments route remains capability_disabled', () => {
    const legacy = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/appointments/route.ts',
      ),
      'utf8',
    );
    expect(legacy).toContain("code: 'capability_disabled'");
    expect(legacy).toContain('status: 503');
  });
});
