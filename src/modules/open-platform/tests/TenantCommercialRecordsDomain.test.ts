import { describe, expect, it } from 'vitest';
import {
  buildTenantCommercialRecordOverview,
  mapTenantCommercialRecordToDto,
} from '@/modules/open-platform/domain/tenant-commercial-records';

const record = {
  id: 'commercial-record-order-001',
  tenantId: 'demo-tenant-001',
  recordType: 'order',
  status: 'pending',
  displayCode: 'ORD-2026-0001',
  displayAmount: '¥2999/月',
  periodLabel: '2026-06',
  relatedPlanChangeId: 'tenant-plan-change-demo-001',
  note: '内部备注，不应进入 DTO。payment_token=payment_token_should_not_return',
  occurredAt: new Date('2026-06-23T06:00:00.000Z'),
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  createdAt: new Date('2026-06-23T06:00:00.000Z'),
  updatedAt: new Date('2026-06-23T06:10:00.000Z'),
  contract_body: '完整合同正文',
  webhook_secret: 'webhook_secret_should_not_return',
};

describe('租户商业化预留记录 domain', () => {
  it('映射只读展示 DTO 并过滤备注、合同正文和外部支付字段', () => {
    const dto = mapTenantCommercialRecordToDto(record);

    expect(dto).toEqual({
      recordId: 'commercial-record-order-001',
      tenantId: 'demo-tenant-001',
      recordType: 'order',
      recordTypeLabel: '订单',
      status: 'pending',
      statusLabel: '待人工确认',
      displayCode: 'ORD-2026-0001',
      displayAmount: '¥2999/月',
      periodLabel: '2026-06',
      relatedPlanChangeId: 'tenant-plan-change-demo-001',
      occurredAt: '2026-06-23T06:00:00.000Z',
      createdAt: '2026-06-23T06:00:00.000Z',
      updatedAt: '2026-06-23T06:10:00.000Z',
    });
    expect(JSON.stringify(dto)).not.toMatch(
      /note|payment_token|webhook_secret|contract_body|完整合同正文/i,
    );
  });

  it('按订单、合同、发票、支付汇总人工预留状态', () => {
    const overview = buildTenantCommercialRecordOverview([
      mapTenantCommercialRecordToDto(record),
      mapTenantCommercialRecordToDto({
        ...record,
        id: 'commercial-record-payment-001',
        recordType: 'payment',
        status: 'manual_review',
        displayCode: 'PAY-2026-0001',
      }),
    ]);

    expect(overview.total).toBe(2);
    expect(overview.byType.order).toBe(1);
    expect(overview.byType.contract).toBe(0);
    expect(overview.byType.invoice).toBe(0);
    expect(overview.byType.payment).toBe(1);
    expect(overview.byStatus.pending).toBe(1);
    expect(overview.byStatus.manual_review).toBe(1);
  });
});
