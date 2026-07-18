import { describe, expect, it } from 'vitest';

import {
  proposeAnalyticsReportInput,
  type AnalyticsReportDirection,
} from '@/modules/institution-analytics/domain/analytics-report-input-proposal';

function input(direction: AnalyticsReportDirection) {
  return {
    direction,
    snapshotVersion: 'snapshot:20260718:1',
    timeZone: 'Asia/Shanghai',
    period: { startDate: '2026-07-01', endDateExclusive: '2026-07-18' },
    metrics: [
      {
        key: 'net_minor',
        value: 12345,
        currency: 'CNY',
        evidenceReferences: ['metric:net:current'],
      },
    ],
    missing: [] as Array<{
      severity: 'critical' | 'non_critical';
      code: string;
      evidenceReferences: string[];
    }>,
  };
}

describe('经营报告输入候选', () => {
  it.each([
    'overall_operations',
    'consumption_trend',
    'project_structure',
    'customer_repurchase',
    'appointment_followup_effectiveness',
  ] as const)('%s 只产出冻结的非授权候选', (direction) => {
    const result = proposeAnalyticsReportInput(input(direction));
    expect(result).toMatchObject({
      outcome: 'frozen_non_authorizing_candidate',
      candidate: {
        direction,
        manualConfirmationRequired: false,
        ownerRequirements: [
          'central_contract_owner_must_declare_report_input',
          'server_scope_allow_must_be_verified',
          'approved_report_provider_adapter_required',
          'manual_generation_authorization_required',
        ],
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('关键缺失硬阻断，非关键缺失仅要求人工确认', () => {
    const critical = input('overall_operations');
    critical.missing = [
      {
        severity: 'critical',
        code: 'financial_coverage_missing',
        evidenceReferences: ['coverage:financial'],
      },
    ];
    expect(proposeAnalyticsReportInput(critical)).toEqual({
      outcome: 'blocked',
      reasonCodes: ['critical_missing'],
      ownerRequirements: [
        'central_contract_owner_must_declare_report_input',
        'server_scope_allow_must_be_verified',
        'approved_report_provider_adapter_required',
        'manual_generation_authorization_required',
      ],
    });

    const nonCritical = input('project_structure');
    nonCritical.missing = [
      {
        severity: 'non_critical',
        code: 'project_coverage_partial',
        evidenceReferences: ['coverage:projects'],
      },
    ];
    expect(proposeAnalyticsReportInput(nonCritical)).toMatchObject({
      outcome: 'frozen_non_authorizing_candidate',
      candidate: { manualConfirmationRequired: true },
    });
  });
});
