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

import { canCurrentInstitutionCreateFormalFollowUpV1 } from '@/server/orchestration/institution-care-create-availability';

function capabilityStatus(
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
        key: 'action_care_followup_create',
        readiness: 'ready',
        freshness: null,
        failureCode: null,
      },
    ],
    data: {
      capabilities: [
        {
          key: 'action_care_followup_create',
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
    observedAt:
      '2026-08-17T15:30:00.000Z',
  });
  mocks.resolveCapability.mockResolvedValue(
    capabilityStatus(),
  );
});

describe('Care Workbench create availability', () => {
  it('allows only a formal management actor plus exact released create capability', async () => {
    await expect(
      canCurrentInstitutionCreateFormalFollowUpV1(),
    ).resolves.toBe(true);
  });

  it('does not expose Workbench create to consultant/customer_service', async () => {
    for (const role of [
      'consultant',
      'customer_service',
    ] as const) {
      mocks.consumeWrite.mockReturnValueOnce({
        accountId: 'staff-1',
        displayName: '员工',
        role,
        tenantId: 'tenant-1',
        institutionId: 'institution-1',
        observedAt:
          '2026-08-17T15:30:00.000Z',
      });
      await expect(
        canCurrentInstitutionCreateFormalFollowUpV1(),
      ).resolves.toBe(false);
    }
  });

  it('fails closed on scope mismatch or unreleased action', async () => {
    mocks.resolveCapability.mockResolvedValueOnce({
      ...capabilityStatus(),
      scope: {
        tenantId: 'tenant-1',
        institutionId: 'institution-other',
      },
    });
    await expect(
      canCurrentInstitutionCreateFormalFollowUpV1(),
    ).resolves.toBe(false);

    mocks.resolveCapability.mockResolvedValueOnce(
      capabilityStatus('hidden'),
    );
    await expect(
      canCurrentInstitutionCreateFormalFollowUpV1(),
    ).resolves.toBe(false);
  });
});
