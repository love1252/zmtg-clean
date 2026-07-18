import { describe, expect, it } from 'vitest';
import { proposeAnalyticsReportInput } from '@/modules/institution-analytics/domain/analytics-report-input-proposal';

const evidence = `evref_${'b'.repeat(64)}`;
function validInput() { return { direction: 'overall_operations', snapshotVersion: 'snapshot:1', timeZone: 'Asia/Shanghai', period: { startDate: '2026-07-01', endDateExclusive: '2026-07-02' }, metrics: [] as Array<{ key: string; value: number; currency: string | null; evidenceReferences: string[] }>, missing: [] as Array<{ severity: string; code: string; evidenceReferences: string[] }> }; }
function blocked(value: unknown) { expect(proposeAnalyticsReportInput(value)).toMatchObject({ outcome: 'blocked', reasonCodes: ['invalid_input'] }); }

describe('经营报告输入候选边界', () => {
  it('拒绝非透明 evidence、跨机构语义 claim、非法日期与 hostile trusted context 字段', () => {
    const semantic = validInput(); semantic.metrics = [{ key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: ['customer:john'] }];
    const date = validInput(); date.period = { startDate: '2026-02-30', endDateExclusive: '2026-03-01' };
    const hostileContext = { ...validInput(), trustedOwnerContext: { institutionId: 'other' } };
    blocked(semantic); blocked(date); blocked(hostileContext);
  });

  it('按固定指标语义拒绝金额/计数/重复冲突 claim', () => {
    const cases = [
      { key: 'paid_customer_count', value: -1, currency: null },
      { key: 'paid_customer_count', value: 1.5, currency: null },
      { key: 'paid_minor', value: 1, currency: null },
      { key: 'paid_minor', value: 1, currency: 'ZZZ' },
      { key: 'paid_customer_count', value: 1, currency: 'CNY' },
    ];
    for (const metric of cases) { const value = validInput(); value.metrics = [{ ...metric, evidenceReferences: [evidence] }]; blocked(value); }
    const validCurrency = validInput(); validCurrency.metrics = [{ key: 'paid_minor', value: 1, currency: 'CNY', evidenceReferences: [evidence] }];
    expect(proposeAnalyticsReportInput(validCurrency)).toMatchObject({ outcome: 'frozen_non_authorizing_candidate' });
    const duplicate = validInput(); duplicate.metrics = [
      { key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [evidence] },
      { key: 'net_minor', value: 2, currency: 'CNY', evidenceReferences: [evidence] },
    ]; blocked(duplicate);
  });

  it('对超长、超量、Proxy、accessor、symbol/hidden/extra、null-prototype 与稀疏输入 fail-closed', () => {
    const long = validInput(); long.snapshotVersion = 'x'.repeat(65);
    const oversized = validInput(); oversized.metrics = Array.from({ length: 33 }, () => ({ key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [evidence] }));
    const accessor = {}; Object.defineProperty(accessor, 'direction', { enumerable: true, get: () => 'overall_operations' });
    const proxy = new Proxy(validInput(), {}); const symbol = { ...validInput(), [Symbol('x')]: true };
    const hidden = validInput(); Object.defineProperty(hidden, 'hidden', { value: true });
    const extra = { ...validInput(), extra: true }; const nil = Object.assign(Object.create(null), validInput());
    const sparse = validInput(); sparse.metrics = []; sparse.metrics[1] = { key: 'net_minor', value: 1, currency: 'CNY', evidenceReferences: [evidence] };
    for (const value of [long, oversized, accessor, proxy, symbol, hidden, extra, nil, sparse]) blocked(value);
  });
});
