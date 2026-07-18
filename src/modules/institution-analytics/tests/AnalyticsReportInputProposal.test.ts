import { describe, expect, it } from 'vitest';

import {
  proposeAnalyticsReportInput,
  type AnalyticsReportDirection,
} from '@/modules/institution-analytics/domain/analytics-report-input-proposal';

const evidence = `evref_${'a'.repeat(64)}`;
function input(direction: AnalyticsReportDirection) {
  return { direction, snapshotVersion: 'snapshot:1', timeZone: 'Asia/Shanghai',
    period: { startDate: '2026-07-01', endDateExclusive: '2026-07-02' },
    metrics: [{ key: 'net_minor', value: -1, currency: 'CNY', evidenceReferences: [evidence] }], missing: [] as Array<{ severity: string; code: string; evidenceReferences: string[] }> };
}

describe('经营报告输入候选', () => {
  it.each(['overall_operations','consumption_trend','project_structure','customer_repurchase','appointment_followup_effectiveness'] as const)(
    '%s 永远只产生需要 owner 确认的冻结候选', (direction) => {
      const result = proposeAnalyticsReportInput(input(direction));
      expect(result).toMatchObject({ outcome: 'frozen_non_authorizing_candidate', candidate: {
        direction, manualConfirmationRequired: true, untrustedMetricClaims: [expect.objectContaining({ key: 'net_minor' })], untrustedMissingClaims: [] } });
      expect(Object.isFrozen(result)).toBe(true);
    });

  it('空 metrics 与 missing 以及自报 critical 都不构成完整或权威阻断语义', () => {
    const empty = input('overall_operations'); empty.metrics = [];
    const critical = input('project_structure'); critical.missing = [{ severity: 'critical', code: 'claimed_critical_missing', evidenceReferences: [evidence] }];
    for (const candidate of [empty, critical]) {
      expect(proposeAnalyticsReportInput(candidate)).toMatchObject({ outcome: 'frozen_non_authorizing_candidate', candidate: { manualConfirmationRequired: true } });
    }
  });

  it('opaque evidence 仅是 claim，固定要求 owner registry 以可信机构/快照/方向上下文重验', () => {
    const result = proposeAnalyticsReportInput(input('consumption_trend'));
    expect(result).toMatchObject({ outcome: 'frozen_non_authorizing_candidate', candidate: { ownerRequirements: expect.arrayContaining([
      'trusted_evidence_registry_scope_validation_required', 'owner_authoritative_snapshot_projection_required',
      'owner_readiness_and_freshness_required', 'owner_direction_required_metrics_required',
      'owner_missing_classification_revalidation_required']) } });
  });
});
