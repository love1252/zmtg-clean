import { describe, expect, it } from 'vitest';
import { buildTreatmentFollowUpSuggestions } from '@/modules/institution/domain/treatment-followup-suggestions';
import { buildV1OpportunityReadonlySummary } from '@/modules/workspace/domain/v1-opportunity-readonly-view-models';

const readonlyPolicy = {
  featureEnabled: true,
  canReadOpportunities: true,
  tenantScopeMatched: true,
};

const forbiddenClosedLoopTerms = [
  'allowedActions',
  'selectedAction',
  'executableAction',
  'actionToken',
  'mutationPayload',
  'phoneRaw',
  'idCard',
  'identityCard',
  'medicalRecordRaw',
  'diagnosisRaw',
  'treatmentRaw',
  'hisRawPayload',
  'credential',
  'credentials',
  'token',
  'secret',
  'password',
  'DATABASE_URL',
  'DB_URL',
  'SQL',
  'stack',
  'payment',
  'contract',
  'invoice',
  '真实 HIS 已接通',
  '真实客户数据',
  '自动营销',
  '自动触达',
  '成交',
  '支付成功',
  '合同',
  '发票',
];

const treatmentSummaryFixture = {
  id: 'demo-treatment-summary-001',
  customerId: 'demo-customer-001',
  appointmentId: 'demo-appointment-001',
  treatmentDate: '2026-06-11T10:00:00+08:00',
  treatmentProject: '低敏术后护理项目',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊观察',
  recoveryStage: 'D7',
  riskLevel: 'watch' as const,
  nextCareAction: '内部人员人工确认恢复状态，并决定是否转内部随访。',
  tags: ['mock', 'demo', '低敏闭环'],
};

function expectNoForbiddenClosedLoopTerms(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenClosedLoopTerms.forEach((term) => {
    expect(serialized).not.toContain(term);
  });
}

describe('V1 主业务闭环 readonly 边界', () => {
  it('低敏内部闭环验收边界只组合 mock 数据且不产生 mutation action', () => {
    const followUpSuggestions = buildTreatmentFollowUpSuggestions(treatmentSummaryFixture);
    const opportunitySummary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'revisit_reminder',
            sourceType: 'treatment_summary',
            sourceSummary: 'demo 治疗摘要 · D7 复诊观察窗口',
            triggerReason: 'mock 复诊窗口进入内部人工确认范围',
            suggestedAction: '内部人员人工确认是否转内部随访',
            priority: 'medium',
            dueDateWindow: 'D7',
            mockSeedDemoFlag: 'demo',
          },
          {
            opportunityType: 'repurchase',
            sourceType: 'customer_lifecycle',
            sourceSummary: 'seed 项目周期进入复购观察窗口',
            triggerReason: 'mock 复购机会仅用于内部低敏验收',
            suggestedAction: '内部人员人工判断是否继续观察',
            priority: 'high',
            status: 'already_handled',
            mockSeedDemoFlag: 'seed',
            selectedAction: 'convert_to_followup',
            actionToken: 'mutation-token-should-not-render',
          },
          {
            opportunityType: 'dormant_customer',
            sourceType: 'last_interaction',
            sourceSummary: 'mock 60 天未互动观察层级',
            triggerReason: 'demo 沉睡客户机会仅用于内部判断',
            suggestedAction: '内部人员人工判断是否进入观察',
            priority: 'low',
            status: 'invalid_transition',
            mockSeedDemoFlag: 'mock',
            executableAction: 'wake_customer',
            mutationPayload: { action: 'wake_customer' },
          },
        ],
      },
      readonlyPolicy,
    );

    const closedLoopSummary = {
      boundary: 'internal_low_sensitive_mock_demo_readonly',
      assurance: '仅证明治疗后客户运营状态可以被低敏表达，不证明可试点或可上线',
      customer: {
        tenantId: 'demo-tenant-001',
        customerId: 'demo-customer-001',
        displayName: '脱敏客户 A',
        maskedPhone: '138****0001',
        maskedMedicalRecordNo: 'MR-DEMO-001',
      },
      appointment: {
        id: 'demo-appointment-001',
        status: 'pending_confirmation',
        boundary: 'mock appointment only',
      },
      treatmentSummary: {
        id: treatmentSummaryFixture.id,
        customerId: treatmentSummaryFixture.customerId,
        appointmentId: treatmentSummaryFixture.appointmentId,
        treatmentProject: treatmentSummaryFixture.treatmentProject,
        treatmentStage: treatmentSummaryFixture.treatmentStage,
        recoveryStage: treatmentSummaryFixture.recoveryStage,
        boundary: 'structured low-sensitive demo summary',
      },
      followUp: {
        boundary: 'internal follow-up suggestion only',
        suggestions: followUpSuggestions.map((suggestion) => ({
          suggestionKey: suggestion.suggestionKey,
          title: suggestion.title,
          priority: suggestion.priority,
          sourceTreatmentSummaryId: suggestion.sourceTreatmentSummaryId,
        })),
      },
      opportunities: opportunitySummary,
    };

    expect(followUpSuggestions.length).toBeGreaterThan(0);
    expect(closedLoopSummary.boundary).toContain('internal');
    expect(closedLoopSummary.boundary).toContain('mock');
    expect(closedLoopSummary.boundary).toContain('readonly');
    expect(closedLoopSummary.assurance).toContain('低敏表达');
    expect(opportunitySummary).toMatchObject({
      status: 'ready',
      reasonCode: 'candidate_ready',
      resultCode: 'readonly',
    });
    expect(opportunitySummary.opportunities).toHaveLength(3);
    expect(opportunitySummary.opportunities.map((opportunity) => opportunity.opportunityType)).toEqual([
      'revisit_reminder',
      'repurchase',
      'dormant_customer',
    ]);
    expect(
      opportunitySummary.opportunities.every((opportunity) =>
        opportunity.resultCode === 'readonly' || opportunity.resultCode === 'blocked',
      ),
    ).toBe(true);
    expect(opportunitySummary.opportunities.map((opportunity) => opportunity.resultCode)).toEqual([
      'readonly',
      'blocked',
      'blocked',
    ]);
    expect(
      opportunitySummary.opportunities
        .filter((opportunity) => opportunity.resultCode === 'blocked')
        .every((opportunity) => opportunity.suggestedAction === '当前状态不可执行，请刷新后重新判断'),
    ).toBe(true);
    expectNoForbiddenClosedLoopTerms(closedLoopSummary);
  });

  it('feature disabled / tenant mismatch / RBAC denied 时不泄露候选详情', () => {
    const guardedInput = {
      candidates: [
        {
          opportunityType: 'revisit_reminder' as const,
          sourceType: 'treatment_summary',
          sourceSummary: 'demo 治疗摘要 · D7 复诊观察窗口',
          triggerReason: 'mock 复诊窗口进入内部人工确认范围',
          suggestedAction: '内部人员人工确认是否转内部随访',
          priority: 'medium' as const,
          mockSeedDemoFlag: 'demo' as const,
          phoneRaw: '13800000001',
          medicalRecordRaw: 'MR-RAW-SHOULD-NOT-RENDER',
          hisRawPayload: 'raw HIS payload should not render',
          credential: 'credential_should_not_render',
          token: 'token_should_not_render',
          secret: 'secret_should_not_render',
        },
      ],
    };
    const guardedSummaries = [
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...readonlyPolicy,
        featureEnabled: false,
      }),
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...readonlyPolicy,
        tenantScopeMatched: false,
      }),
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...readonlyPolicy,
        canReadOpportunities: false,
      }),
    ];

    expect(guardedSummaries.map((summary) => summary.opportunities)).toEqual([[], [], []]);
    expect(guardedSummaries.map((summary) => summary.resultCode)).toEqual([
      'skipped',
      'denied',
      'denied',
    ]);
    guardedSummaries.forEach((summary) => {
      expectNoForbiddenClosedLoopTerms(summary);
      expect(JSON.stringify(summary)).not.toContain('demo 治疗摘要');
      expect(JSON.stringify(summary)).not.toContain('复诊窗口进入内部人工确认范围');
    });
  });
});
