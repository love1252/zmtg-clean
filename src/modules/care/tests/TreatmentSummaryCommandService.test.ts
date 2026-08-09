import { describe, expect, it, vi } from 'vitest';

import {
  createTreatmentSummaryCommandService,
  TreatmentSummaryCommandInputError,
  type TreatmentSummaryCommandRepository,
} from '@/modules/care/application/treatment-summary-command-service';

function repositoryMock(): TreatmentSummaryCommandRepository {
  return {
    create: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    update: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    void: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
  };
}

const attribution = { tenantId: 'tenant-a', institutionId: 'institution-a' };

describe('TreatmentSummaryCommandService', () => {
  it('create 传入 server-side tenant + institution attribution', async () => {
    const repository = repositoryMock();
    const service = createTreatmentSummaryCommandService(repository);
    const tags = ['D7'];
    const treatmentDate = new Date('2026-08-09T03:00:00.000Z');

    await service.createTreatmentSummary({
      attribution,
      treatmentSummary: {
        id: 'summary-a',
        customerId: 'customer-a',
        appointmentId: 'appointment-a',
        treatmentDate,
        treatmentProject: 'project',
        treatmentCategory: 'category',
        treatmentStage: 'D7',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'operator-a',
        summary: 'low-sensitive-summary',
        nextCareAction: 'manual',
        tags,
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        id: 'summary-a',
        customerId: 'customer-a',
        appointmentId: 'appointment-a',
      }),
    );
    const passed = vi.mocked(repository.create).mock.calls[0]?.[0];
    expect(passed?.tags).not.toBe(tags);
    expect(passed?.treatmentDate).not.toBe(treatmentDate);
  });

  it.each([
    ['', 'institution-a'],
    [' tenant-a', 'institution-a'],
    ['tenant-a ', 'institution-a'],
    ['tenant-a', ''],
    ['tenant-a', ' institution-a'],
    ['tenant-a', 'institution-a '],
  ])('invalid attribution fail-closed: %j / %j', async (tenantId, institutionId) => {
    const repository = repositoryMock();
    const service = createTreatmentSummaryCommandService(repository);

    await expect(
      service.createTreatmentSummary({
        attribution: { tenantId, institutionId },
        treatmentSummary: {
          id: 'summary-a',
          customerId: 'customer-a',
          appointmentId: null,
          treatmentDate: new Date(),
          treatmentProject: 'project',
          treatmentCategory: 'category',
          treatmentStage: 'stage',
          recoveryStage: 'recovery',
          riskLevel: 'normal',
          ownerUserId: 'operator-a',
          summary: 'summary',
          nextCareAction: 'manual',
          tags: [],
        },
      }),
    ).rejects.toBeInstanceOf(TreatmentSummaryCommandInputError);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('update 保留 tenant + institution scope 并复制 tags', async () => {
    const repository = repositoryMock();
    const service = createTreatmentSummaryCommandService(repository);
    const tags = ['updated'];

    await service.updateTreatmentSummary({
      attribution,
      summaryId: 'summary-a',
      changes: {
        appointmentId: 'appointment-b',
        treatmentProject: 'project-b',
        tags,
      },
    });

    expect(repository.update).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      summaryId: 'summary-a',
      changes: {
        appointmentId: 'appointment-b',
        treatmentProject: 'project-b',
        tags: ['updated'],
      },
    });
    expect(vi.mocked(repository.update).mock.calls[0]?.[0].changes.tags).not.toBe(tags);
  });

  it('void 传入 institution attribution 与人工操作者', async () => {
    const repository = repositoryMock();
    const service = createTreatmentSummaryCommandService(repository);

    await service.voidTreatmentSummary({
      attribution,
      summaryId: 'summary-a',
      voidedBy: 'operator-a',
      reasonCode: 'manual_governance_review',
      reasonText: 'manual review',
    });

    expect(repository.void).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      summaryId: 'summary-a',
      voidedBy: 'operator-a',
      reasonCode: 'manual_governance_review',
      reasonText: 'manual review',
    });
  });
});
