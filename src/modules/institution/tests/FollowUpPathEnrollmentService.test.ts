import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelFollowUpPathEnrollment,
  createEnrollmentFromTreatmentSummary,
  getFollowUpPathEnrollment,
  listFollowUpPathEnrollments,
} from '@/modules/institution/server/followup-path-enrollment-service';
import type {
  FollowUpPathEnrollment,
  FollowUpPathStageInstance,
} from '@/modules/institution/domain/followup-path-enrollment';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';
import type { AccessContext } from '@/modules/security/domain/access-control';

const context: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const treatmentSummary = {
  id: 'summary-1',
  tenantId: 'tenant-a',
  customerId: 'customer-1',
  appointmentId: null,
  treatmentDate: '2026-07-01T00:00:00.000Z',
  treatmentProject: '水光针补水护理',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D0 治疗完成',
  recoveryStage: 'D1',
  riskLevel: 'normal',
  ownerUserId: 'owner-1',
  summary: '治疗摘要正文不应进入路径实例 API',
  nextCareAction: '人工确认补水护理执行情况',
  tags: ['水光', '注射护理'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
} satisfies TreatmentSummaryRecord;

const baseEnrollment: FollowUpPathEnrollment = {
  id: 'enrollment-1',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  customerId: 'customer-1',
  customerDisplayName: '陈女士',
  treatmentSummaryId: 'summary-1',
  sourceType: 'treatment_summary',
  sourceId: 'summary-1',
  templateKey: 'hydro_injection_care',
  templateVersion: 'v0.6-static',
  status: 'active',
  startedAt: '2026-07-01T01:00:00.000Z',
  completedAt: null,
  safeReasonCode: 'treatment_summary_path_enrolled',
  metadataJson: {},
  stageCount: 0,
  taskCount: 0,
  dueAt: null,
  safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
  taskIds: [],
  stages: [],
  createdAt: '2026-07-01T01:00:00.000Z',
  updatedAt: '2026-07-01T01:00:00.000Z',
};

function createRepositories() {
  const treatmentSummaryRepository = {
    getTreatmentSummaryByTenant: vi.fn(async () => treatmentSummary),
  };
  const tenantBusinessRepository = {
    getCustomerByTenant: vi.fn(async () => ({
      id: 'customer-1',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      displayName: '陈女士',
      lifecycle: 'post_care' as const,
      priority: 'high' as const,
      ownerUserId: 'owner-1',
      projectInterest: '水光',
      maskedPhone: '138****0000',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '治疗后护理',
      nextAction: '人工随访',
      tags: ['术后'],
      gender: '未指定',
      birthDate: '未指定',
      referralSource: '未指定',
      notes: '未指定',
    })),
    createFollowUpPathEnrollment: vi.fn(async (): Promise<
      | { kind: 'created'; enrollment: FollowUpPathEnrollment }
      | { kind: 'conflict'; resourceId: string; reason: 'active_follow_up_path_enrollment_exists' }
    > => ({
      kind: 'created' as const,
      enrollment: baseEnrollment,
    })),
    createFollowUpTaskFromTreatmentSummarySuggestion: vi.fn(async (input) => ({
      kind: 'created' as const,
      task: {
        id: `task-${input.sourceSuggestionKey.split(':').at(-1)}`,
        tenantId: input.tenantId,
        customerId: input.customerId,
        customerDisplayName: input.customerDisplayName,
        journeyId: input.journeyId,
        stage: input.stage,
        status: input.status ?? 'scheduled',
        dueAt: input.dueAt,
        suggestedAction: input.suggestedAction,
        riskLevel: input.riskLevel,
        updatedBy: null,
        updatedAt: null,
        source: 'treatment_summary' as const,
        sourceTreatmentSummaryId: input.sourceTreatmentSummaryId,
        sourceSuggestionKey: input.sourceSuggestionKey,
        requiresHumanHandling: true as const,
        forbidAutoReachOut: true as const,
      },
    })),
    createFollowUpPathStages: vi.fn(async (stages: FollowUpPathStageInstance[]) =>
      stages.map((stage) => ({
        ...stage,
        createdAt: stage.createdAt,
        updatedAt: stage.updatedAt,
      })),
    ),
    listFollowUpPathEnrollmentsByTenant: vi.fn(async () => [baseEnrollment]),
    getFollowUpPathEnrollmentByTenant: vi.fn(async () => baseEnrollment),
    cancelFollowUpPathEnrollment: vi.fn(async () => ({
      kind: 'cancelled' as const,
      enrollment: { ...baseEnrollment, status: 'cancelled' as const },
    })),
    recordFollowUpCustomerTimelineEvent: vi.fn(async (input) => ({
      kind: 'created' as const,
      event: {
        id: input.id,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: input.customerId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventType: input.eventType,
        eventTitle: input.eventTitle,
        safeSummary: input.safeSummary,
        riskLevel: input.riskLevel,
        occurredAt: input.occurredAt,
        safeActorRole: input.safeActorRole,
        safeReasonCode: input.safeReasonCode,
        metadataJson: input.metadataJson,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
    })),
  };

  return { treatmentSummaryRepository, tenantBusinessRepository };
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-id');
});

describe('follow-up path enrollment service', () => {
  it('从治疗摘要创建 enrollment、阶段和人工 follow-up tasks', async () => {
    const repositories = createRepositories();

    const result = await createEnrollmentFromTreatmentSummary({
      context,
      sourceId: 'summary-1',
      treatmentSummaryRepository: repositories.treatmentSummaryRepository,
      tenantBusinessRepository: repositories.tenantBusinessRepository,
      occurredAt: '2026-07-01T01:00:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'created',
        enrollment: expect.objectContaining({
          enrollmentId: 'enrollment-1',
          templateKey: 'hydro_injection_care',
          stageCount: 3,
          taskCount: 3,
        }),
      }),
    );
    expect(repositories.tenantBusinessRepository.createFollowUpPathEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        sourceType: 'treatment_summary',
        sourceId: 'summary-1',
        templateKey: 'hydro_injection_care',
      }),
    );
    expect(repositories.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).toHaveBeenCalledTimes(3);
    expect(repositories.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        skipActiveSourceConflict: true,
        suggestedAction: expect.stringContaining('需人工处理，禁止自动触达客户'),
      }),
    );
    expect(repositories.tenantBusinessRepository.createFollowUpPathStages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ stageKey: 'D1', followUpTaskId: 'task-hydro_injection_d1_check' }),
        expect.objectContaining({ stageKey: 'D3', followUpTaskId: 'task-hydro_injection_d3_care' }),
        expect.objectContaining({ stageKey: 'D7', followUpTaskId: 'task-hydro_injection_d7_revisit' }),
      ]),
    );
    expect(repositories.tenantBusinessRepository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'path_enrollment',
        sourceId: 'enrollment-1',
        eventType: 'followup_path_enrolled',
      }),
    );
    expect(repositories.tenantBusinessRepository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'path_enrollment',
        sourceId: 'enrollment-1:tasks_generated',
        eventType: 'followup_tasks_generated',
      }),
    );
  });

  it('重复 active enrollment 返回 conflict 且不重复创建任务或阶段', async () => {
    const repositories = createRepositories();
    repositories.tenantBusinessRepository.createFollowUpPathEnrollment.mockResolvedValueOnce({
      kind: 'conflict',
      resourceId: 'enrollment-existing',
      reason: 'active_follow_up_path_enrollment_exists',
    });

    const result = await createEnrollmentFromTreatmentSummary({
      context,
      sourceId: 'summary-1',
      treatmentSummaryRepository: repositories.treatmentSummaryRepository,
      tenantBusinessRepository: repositories.tenantBusinessRepository,
      occurredAt: '2026-07-01T01:00:00.000Z',
    });

    expect(result).toEqual({
      kind: 'conflict',
      resourceId: 'enrollment-existing',
      reason: 'active_follow_up_path_enrollment_exists',
    });
    expect(repositories.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(repositories.tenantBusinessRepository.createFollowUpPathStages).not.toHaveBeenCalled();
  });

  it('列表、详情和取消都带 tenantId 与 institutionId 做隔离', async () => {
    const repositories = createRepositories();

    await listFollowUpPathEnrollments({
      context,
      tenantBusinessRepository: repositories.tenantBusinessRepository,
    });
    await getFollowUpPathEnrollment({
      context,
      enrollmentId: 'enrollment-1',
      tenantBusinessRepository: repositories.tenantBusinessRepository,
    });
    await cancelFollowUpPathEnrollment({
      context,
      enrollmentId: 'enrollment-1',
      tenantBusinessRepository: repositories.tenantBusinessRepository,
    });

    expect(repositories.tenantBusinessRepository.listFollowUpPathEnrollmentsByTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
    });
    expect(repositories.tenantBusinessRepository.getFollowUpPathEnrollmentByTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      enrollmentId: 'enrollment-1',
    });
    expect(repositories.tenantBusinessRepository.cancelFollowUpPathEnrollment).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      enrollmentId: 'enrollment-1',
    });
    expect(repositories.tenantBusinessRepository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'path_enrollment',
        sourceId: 'enrollment-1',
        eventType: 'followup_path_cancelled',
      }),
    );
  });
});
