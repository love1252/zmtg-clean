import { describe, expect, it } from 'vitest';
import {
  createFollowUpPathStageDraft,
  createFollowUpPathTaskDraft,
  dueAtForTreatmentPathNode,
  mapFollowUpPathEnrollmentToDto,
  matchFollowUpPathTemplateForTreatmentEvent,
  normalizeTreatmentEventFromTreatmentSummary,
} from '@/modules/institution/domain/followup-path-enrollment';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';

const baseSummary = {
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
  summary: '这里是治疗摘要正文，不应进入路径 DTO',
  nextCareAction: 'D1 人工确认补水和泛红情况',
  tags: ['水光', '注射护理'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
} satisfies TreatmentSummaryRecord;

describe('follow-up path enrollment domain', () => {
  it('标准化治疗摘要为最小治疗事件且不保留完整治疗正文', () => {
    const event = normalizeTreatmentEventFromTreatmentSummary(baseSummary);

    expect(event).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        customerId: 'customer-1',
        treatmentSummaryId: 'summary-1',
        sourceType: 'treatment_summary',
        sourceId: 'summary-1',
        treatmentProject: '水光针补水护理',
        safeReasonCode: 'treatment_summary_normalized',
      }),
    );
    expect(JSON.stringify(event)).not.toContain(baseSummary.summary);
  });

  it('水光、光子、双眼皮手术能匹配对应路径模板', () => {
    expect(
      matchFollowUpPathTemplateForTreatmentEvent(
        normalizeTreatmentEventFromTreatmentSummary(baseSummary),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'matched',
        match: expect.objectContaining({
          template: expect.objectContaining({ templateKey: 'hydro_injection_care' }),
        }),
      }),
    );

    expect(
      matchFollowUpPathTemplateForTreatmentEvent(
        normalizeTreatmentEventFromTreatmentSummary({
          ...baseSummary,
          id: 'summary-2',
          treatmentProject: '光子嫩肤',
          treatmentCategory: 'laser_repair',
          tags: ['光电'],
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'matched',
        match: expect.objectContaining({
          template: expect.objectContaining({ templateKey: 'photoelectric_care' }),
        }),
      }),
    );

    expect(
      matchFollowUpPathTemplateForTreatmentEvent(
        normalizeTreatmentEventFromTreatmentSummary({
          ...baseSummary,
          id: 'summary-3',
          treatmentProject: '双眼皮手术术后修复',
          treatmentCategory: 'surgery_repair',
          riskLevel: 'watch',
          tags: ['手术', '眼周修复'],
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'matched',
        match: expect.objectContaining({
          template: expect.objectContaining({ templateKey: 'post_surgery_repair' }),
        }),
      }),
    );
  });

  it('无匹配或手动指定不匹配模板时返回低敏 no_matching_template', () => {
    const event = normalizeTreatmentEventFromTreatmentSummary({
      ...baseSummary,
      treatmentProject: '未知护理',
      treatmentCategory: 'unknown',
      treatmentStage: '常规观察',
      recoveryStage: '',
      tags: [],
    });

    expect(matchFollowUpPathTemplateForTreatmentEvent(event)).toEqual({
      kind: 'no_matching_template',
      safeReasonCode: 'no_matching_template',
    });
    expect(matchFollowUpPathTemplateForTreatmentEvent(event, 'photoelectric_care')).toEqual({
      kind: 'no_matching_template',
      safeReasonCode: 'no_matching_template',
    });
  });

  it('按节点生成 D1/D3/D7 到期时间、人工任务草稿和阶段草稿', () => {
    const event = normalizeTreatmentEventFromTreatmentSummary(baseSummary);
    const match = matchFollowUpPathTemplateForTreatmentEvent(event);
    expect(match.kind).toBe('matched');
    if (match.kind !== 'matched') return;

    const dueAts = match.match.nodes.map((node) => dueAtForTreatmentPathNode(event.treatmentDate, node));
    expect(dueAts).toContain('2026-07-02T00:00:00.000Z');
    expect(dueAts).toContain('2026-07-04T00:00:00.000Z');
    expect(dueAts).toContain('2026-07-08T00:00:00.000Z');

    const taskDraft = createFollowUpPathTaskDraft({
      event,
      templateKey: match.match.template.templateKey,
      node: match.match.nodes[0]!,
      customerDisplayName: '张三',
    });
    expect(taskDraft).toEqual(
      expect.objectContaining({
        status: 'scheduled',
        sourceTreatmentSummaryId: 'summary-1',
      }),
    );
    expect(taskDraft.suggestedAction).toContain('需人工处理，禁止自动触达客户');

    const stageDraft = createFollowUpPathStageDraft({
      id: 'stage-1',
      tenantId: 'tenant-a',
      institutionId: 'inst-1',
      enrollmentId: 'enrollment-1',
      node: match.match.nodes[0]!,
      dueAt: dueAts[0]!,
      followUpTaskId: 'task-1',
      riskLevel: event.riskLevel,
      occurredAt: '2026-07-01T01:00:00.000Z',
    });
    expect(stageDraft).toEqual(
      expect.objectContaining({
        status: 'scheduled',
        followUpTaskId: 'task-1',
        safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
      }),
    );
  });

  it('DTO 只返回路径实例白名单字段并隐藏租户、机构和原始摘要信息', () => {
    const dto = mapFollowUpPathEnrollmentToDto({
      id: 'enrollment-1',
      tenantId: 'tenant-a',
      institutionId: 'inst-1',
      customerId: 'customer-1',
      customerDisplayName: '张三',
      treatmentSummaryId: 'summary-1',
      sourceType: 'treatment_summary',
      sourceId: 'summary-1',
      templateKey: 'hydro_injection_care',
      templateVersion: 'v0.6-static',
      status: 'active',
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: null,
      safeReasonCode: 'treatment_summary_path_enrolled',
      metadataJson: { raw: '不应返回' },
      stageCount: 1,
      taskCount: 1,
      dueAt: '2026-07-02T00:00:00.000Z',
      safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
      taskIds: ['task-1'],
      stages: [
        {
          id: 'stage-1',
          tenantId: 'tenant-a',
          institutionId: 'inst-1',
          enrollmentId: 'enrollment-1',
          nodeKey: 'hydro_injection_d1_check',
          stageKey: 'D1',
          dueAt: '2026-07-02T00:00:00.000Z',
          status: 'scheduled',
          followUpTaskId: 'task-1',
          handlerRole: 'consultant',
          riskLevel: 'normal',
          safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(Object.keys(dto).sort()).toEqual(
      [
        'createdAt',
        'customerDisplayName',
        'customerId',
        'dueAt',
        'enrollmentId',
        'safeMessage',
        'stageCount',
        'stages',
        'status',
        'taskCount',
        'taskIds',
        'templateKey',
        'updatedAt',
      ].sort(),
    );
    expect(JSON.stringify(dto)).not.toContain('tenant-a');
    expect(JSON.stringify(dto)).not.toContain('inst-1');
    expect(JSON.stringify(dto)).not.toContain('不应返回');
  });
});
