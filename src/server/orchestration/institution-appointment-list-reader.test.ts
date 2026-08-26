import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeAuthorization: vi.fn(),
  createReader: vi.fn(),
  createRepository: vi.fn(),
  getDatabase: vi.fn(),
  read: vi.fn(),
  resolveAuthorization: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-care-read-authorization', () => ({
  consumeInstitutionCareReadAuthorizationV1: mocks.consumeAuthorization,
  resolveInstitutionCareReadAuthorizationV1: mocks.resolveAuthorization,
}));
vi.mock('@/modules/care/server/appointment-list-repository', () => ({
  createAppointmentListRepository: mocks.createRepository,
}));
vi.mock('@/modules/care/application/appointment-list-reader', () => ({
  createAppointmentListReaderV1: mocks.createReader,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.getDatabase }));

import { readCurrentInstitutionAppointmentsV1 } from '@/server/orchestration/institution-appointment-list-reader';

const authorization = Object.freeze({ opaque: 'authorization' });
const pair = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  observedAt: '2026-08-16T08:00:00.000Z',
});
const database = Object.freeze({ database: 'db' });
const source = Object.freeze({ list: vi.fn(), summarize: vi.fn() });

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.resolveAuthorization.mockResolvedValue({ kind: 'allowed', authorization });
  mocks.consumeAuthorization.mockReturnValue(pair);
  mocks.getDatabase.mockReturnValue(database);
  mocks.createRepository.mockReturnValue(source);
  mocks.createReader.mockReturnValue(Object.freeze({ read: mocks.read }));
  mocks.read.mockResolvedValue(
    Object.freeze({
      kind: 'ready',
      records: Object.freeze([]),
      pageInfo: Object.freeze({
        page: 1,
        pageSize: 20,
        hasMore: false,
        total: 0,
        pageCount: 0,
      }),
      summary: Object.freeze({
        total: 0,
        statusCounts: Object.freeze({
          pending_confirmation: 0,
          confirmed: 0,
          arrived: 0,
          completed: 0,
          reschedule_requested: 0,
          cancelled: 0,
        }),
      }),
    }),
  );
});

describe('Care appointment orchestration Reader', () => {
  it('authorization → one-shot pair → repository → application Reader 顺序闭合', async () => {
    const searchParams = new URLSearchParams('status=pending_confirmation');
    await expect(readCurrentInstitutionAppointmentsV1(searchParams)).resolves.toMatchObject({
      kind: 'ready',
    });

    expect(mocks.consumeAuthorization).toHaveBeenCalledOnce();
    expect(mocks.consumeAuthorization).toHaveBeenCalledWith(authorization);
    expect(mocks.getDatabase).toHaveBeenCalledOnce();
    expect(mocks.createRepository).toHaveBeenCalledWith(database);
    expect(mocks.createReader).toHaveBeenCalledWith({ source });
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledWith({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
      searchParams,
    });
    expect(mocks.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.consumeAuthorization.mock.invocationCallOrder[0]!,
    );
    expect(mocks.consumeAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createRepository.mock.invocationCallOrder[0]!,
    );
  });

  it.each([
    [{ kind: 'forbidden' }, { kind: 'forbidden' }],
    [{ kind: 'unavailable' }, { kind: 'unavailable' }],
  ] as const)('authorization %o 时 repository=0', async (resolution, expected) => {
    mocks.resolveAuthorization.mockResolvedValueOnce(resolution);
    await expect(
      readCurrentInstitutionAppointmentsV1(new URLSearchParams()),
    ).resolves.toEqual(expected);
    expect(mocks.consumeAuthorization).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createRepository).not.toHaveBeenCalled();
  });

  it('one-shot pair consume failure 在 DB/repository 前停止', async () => {
    mocks.consumeAuthorization.mockReturnValueOnce(null);
    await expect(
      readCurrentInstitutionAppointmentsV1(new URLSearchParams()),
    ).resolves.toEqual({ kind: 'unavailable' });
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.createRepository).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'invalid_query', code: 'invalid_appointment_query' },
    { kind: 'unavailable' },
  ] as const)('精确透传 application result %o', async (result) => {
    mocks.read.mockResolvedValueOnce(result);
    await expect(
      readCurrentInstitutionAppointmentsV1(new URLSearchParams()),
    ).resolves.toEqual(result);
  });

  it('repository factory、Reader factory 或 source read exception 均 unavailable', async () => {
    for (const failing of [mocks.getDatabase, mocks.createRepository, mocks.createReader]) {
      failing.mockImplementationOnce(() => {
        throw new Error('secret');
      });
      await expect(
        readCurrentInstitutionAppointmentsV1(new URLSearchParams()),
      ).resolves.toEqual({ kind: 'unavailable' });
    }

    mocks.read.mockRejectedValueOnce(new Error('source secret'));
    await expect(
      readCurrentInstitutionAppointmentsV1(new URLSearchParams()),
    ).resolves.toEqual({ kind: 'unavailable' });
  });
});
