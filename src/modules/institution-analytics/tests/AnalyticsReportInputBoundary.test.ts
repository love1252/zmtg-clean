import { describe, expect, it } from 'vitest';

import { proposeAnalyticsReportInput } from '@/modules/institution-analytics/domain/analytics-report-input-proposal';

function validInput() {
  return {
    direction: 'overall_operations',
    snapshotVersion: 'snapshot:1',
    timeZone: 'Asia/Shanghai',
    period: { startDate: '2026-07-01', endDateExclusive: '2026-07-02' },
    metrics: [] as Array<{
      key: string;
      value: number;
      currency: string | null;
      evidenceReferences: string[];
    }>,
    missing: [] as Array<{
      severity: string;
      code: string;
      evidenceReferences: string[];
    }>,
  };
}

describe('经营报告输入候选边界', () => {
  it('对超量、超长、Proxy、accessor、symbol/hidden/extra、null-prototype 与稀疏输入 fail-closed', () => {
    const oversized = validInput();
    oversized.metrics = Array.from({ length: 33 }, () => ({
      key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [],
    }));
    const overlong = validInput();
    overlong.snapshotVersion = 'x'.repeat(65);
    const missingEvidence = validInput();
    missingEvidence.metrics = [
      { key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [] },
    ];
    const accessor = {};
    Object.defineProperty(accessor, 'direction', { enumerable: true, get: () => 'overall_operations' });
    const proxy = new Proxy(validInput(), {});
    const symbol = { ...validInput(), [Symbol('extra')]: true };
    const hidden = validInput();
    Object.defineProperty(hidden, 'hidden', { value: true });
    const extra = { ...validInput(), extra: true };
    const nullPrototype = Object.assign(Object.create(null), validInput());
    const sparse = validInput();
    sparse.metrics = [];
    sparse.metrics[1] = { key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [] };

    for (const candidate of [oversized, overlong, missingEvidence, accessor, proxy, symbol, hidden, extra, nullPrototype, sparse]) {
      expect(proposeAnalyticsReportInput(candidate)).toMatchObject({
        outcome: 'blocked',
        reasonCodes: ['invalid_input'],
      });
    }
  });
});
