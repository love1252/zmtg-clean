import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ readAppointments: vi.fn() }));
vi.mock('@/server/orchestration/institution-appointment-list-reader', () => ({
  readCurrentInstitutionAppointmentsV1: mocks.readAppointments,
}));

import { GET } from '@/app/api/v1/institution/appointments/route';

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([
    Object.freeze({
      contractVersion: 'v1' as const,
      appointmentId: 'appointment-001',
      scheduledAt: '2026-08-16T08:30:00.000Z',
      status: 'pending_confirmation' as const,
      updatedAt: '2026-08-16T08:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({ page: 1, pageSize: 20 as const, hasMore: false }),
});

beforeEach(() => {
  mocks.readAppointments.mockReset();
  mocks.readAppointments.mockResolvedValue(ready);
});

describe('GET /api/v1/institution/appointments', () => {
  it('返回 exact low-sensitive wire contract 与 no-store', async () => {
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
    });
    const params = mocks.readAppointments.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.get('status')).toBe('pending_confirmation');
  });

  it.each([
    [
      { kind: 'invalid_query', code: 'invalid_appointment_query' },
      400,
      { code: 'invalid_appointment_query' },
    ],
    [
      { kind: 'forbidden' },
      403,
      { code: 'institution_appointment_list_forbidden' },
    ],
    [
      { kind: 'unavailable' },
      503,
      { code: 'institution_appointment_list_unavailable' },
    ],
  ] as const)('把 %o 映射为 no-store HTTP %i', async (result, status, body) => {
    mocks.readAppointments.mockResolvedValueOnce(result);
    const response = await GET(
      new Request('http://localhost/api/v1/institution/appointments'),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(body);
  });

  it('versioned route 只连接 orchestration Reader 且 GET only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/v1/institution/appointments/route.ts'),
      'utf8',
    );
    expect(source).toContain('readCurrentInstitutionAppointmentsV1');
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain('createAppointmentListRepository');
    expect(source).not.toContain('createTenantBusinessRepository');
    expect(source).not.toContain('page_care_appointments');
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+(?:POST|PATCH|DELETE)/u);
  });

  it('legacy appointments route 保持原始 503 capability_disabled compatibility surface', () => {
    const legacy = readFileSync(
      resolve(process.cwd(), 'src/app/api/institution/appointments/route.ts'),
      'utf8',
    );
    expect(legacy).toContain("code: 'capability_disabled'");
    expect(legacy).toContain('status: 503');
    expect(legacy).not.toContain('readCurrentInstitutionAppointmentsV1');
  });
});
