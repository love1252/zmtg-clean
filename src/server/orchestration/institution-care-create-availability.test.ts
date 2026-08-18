
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveWrite: vi.fn(),
  consumeWrite: vi.fn(),
  resolveCapability: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-care-write-authorization',
  () => ({
    resolveInstitutionCareWriteAuthorizationV1:
      mocks.resolveWrite,
    consumeInstitutionCareWriteAuthorizationV1:
      mocks.consumeWrite,
  }),
);

vi.mock(
  '@/server/orchestration/institution-capability-authority',
  () => ({
    resolveInstitutionCapabilityAuthorityStatusV1:
      mocks.resolveCapability,
  }),
);

import {
  canCurrentInstitutionCreateFormalAppointmentV1,
  canCurrentInstitutionCreateFormalFollowUpV1,
} from '@/server/orchestration/institution-care-create-availability';

function capabilityStatus(
  key:
    | 'action_care_appointment_create'
    | 'action_care_followup_create',
  decision: 'operational' | 'hidden' = 'operational',
) {
  return {
    contractVersion: 'v1',
    scope: {
      tenantId: 'tenant-1',
      institutionId: 'institution-1',
    },
    readiness: 'ready',
    freshness: null,
    partitions: [
      {
        key,
        readiness: 'ready',
        freshness: null,
        failureCode: null,
      },
    ],
    data: {
      capabilities: [
        {
          key,
          decision,
          dimensions: {
            codeMaturity:
              decision === 'operational'
                ? 'verified'
                : 'unverified',
            institutionAuthorization: 'authorized',
            connectionAvailability: 'not_required',
            dataReadiness:
              decision === 'operational'
                ? 'ready'
                : 'not_required',
            productionRelease:
              decision === 'operational'
                ? 'pilot_released'
                : 'not_released',
          },
          safeSummary: null,
          diagnosticTargetKey: null,
        },
      ],
    },
    failureCode: null,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach(
    (mock) => mock.mockReset(),
  );
  mocks.resolveWrite.mockResolvedValue({
    kind: 'allowed',
    authorization: Object.freeze({}),
  });
  mocks.consumeWrite.mockReturnValue({
    accountId: 'admin-1',
    displayName: '管理员',
    role: 'tenant_admin',
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    observedAt: '2026-08-17T15:30:00.000Z',
  });
});

describe('Care Workbench create availability', () => {
  it.each([
    [
      'action_care_appointment_create',
      canCurrentInstitutionCreateFormalAppointmentV1,
    ],
    [
      'action_care_followup_create',
      canCurrentInstitutionCreateFormalFollowUpV1,
    ],
  ] as const)(
    'allows management actor plus exact %s release',
    async (key, fn) => {
      mocks.resolveCapability.mockResolvedValue(
        capabilityStatus(key),
      );
      await expect(fn()).resolves.toBe(true);
    },
  );

  it('does not expose either create action to consultant/customer_service', async () => {
    for (const role of [
      'consultant',
      'customer_service',
    ] as const) {
      mocks.consumeWrite.mockReturnValue({
        accountId: 'staff-1',
        displayName: '员工',
        role,
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
        observedAt: '2026-08-17T15:30:00.000Z',
      });
      mocks.resolveCapability.mockResolvedValue(
        capabilityStatus(
          'action_care_appointment_create',
        ),
      );
      await expect(
        canCurrentInstitutionCreateFormalAppointmentV1(),
      ).resolves.toBe(false);
    }
  });

  it('fails closed on scope mismatch or unreleased action', async () => {
    mocks.resolveCapability.mockResolvedValueOnce({
      ...capabilityStatus(
        'action_care_appointment_create',
      ),
      scope: {
        tenantId: 'tenant-1',
        institutionId: 'institution-other',
      },
    });
    await expect(
      canCurrentInstitutionCreateFormalAppointmentV1(),
    ).resolves.toBe(false);

    mocks.resolveCapability.mockResolvedValueOnce(
      capabilityStatus(
        'action_care_appointment_create',
        'hidden',
      ),
    );
    await expect(
      canCurrentInstitutionCreateFormalAppointmentV1(),
    ).resolves.toBe(false);
  });
});
