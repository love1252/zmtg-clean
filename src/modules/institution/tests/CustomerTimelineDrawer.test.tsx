import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerTimelineDrawer } from '@/modules/institution/components/CustomerTimelineDrawer';
import type { CustomerTimelineResponse } from '@/modules/institution/domain/customer-timeline';

const voidedTimeline: CustomerTimelineResponse = {
  customer: {
    id: 'cust_voided',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    projectInterest: '光电修复',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    ownerUserId: 'consultant-lin',
    tags: ['高价值'],
    lastTouchSummary: '术后复核',
    nextAction: '人工确认',
  },
  appointments: [],
  followups: [],
  treatmentSummaries: [
    {
      id: 'trt_voided_drawer',
      appointmentId: 'appt_voided',
      treatmentDate: '2026-06-02T12:00:00.000Z',
      treatmentProject: '光电修复作废记录',
      treatmentCategory: 'laser_repair',
      treatmentStage: 'D7 复核',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：误录入，保留历史追溯。',
      nextCareAction: '不再基于该摘要生成随访建议。',
      tags: ['结构化摘要'],
      status: 'voided',
      voidedAt: '2026-06-02T13:00:00.000Z',
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
      createdAt: '2026-06-02T12:00:00.000Z',
      updatedAt: '2026-06-02T13:00:00.000Z',
    },
  ],
  auditEvents: [],
  timeline: [
    {
      id: 'treatment_summary:trt_voided_drawer',
      type: 'treatment_summary',
      occurredAt: '2026-06-02T12:00:00.000Z',
      title: '光电修复作废记录 · D7 复核',
      summary: '结构化摘要：误录入，保留历史追溯。',
      status: 'voided',
      source: 'treatment_summary',
      relatedRecordId: 'trt_voided_drawer',
      riskLevel: 'watch',
      tags: ['已作废', '结构化摘要'],
    },
  ],
};

function expectNoSensitiveTimelineContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('完整病历正文');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
}

describe('客户详情时间线抽屉', () => {
  it('作废治疗摘要节点显示已作废和历史追溯提示', async () => {
    const { container } = render(
      <CustomerTimelineDrawer
        customerId="cust_voided"
        customerName="王女士"
        errorState={null}
        isLoading={false}
        onClose={vi.fn()}
        onTimelineRefresh={vi.fn()}
        timeline={voidedTimeline}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '客户详情时间线' });
    expect(within(dialog).getByText('光电修复作废记录')).toBeInTheDocument();
    expect(within(dialog).getAllByText('已作废').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('该治疗摘要已作废')).toBeInTheDocument();
    expect(within(dialog).getByText('仅保留历史追溯，不再作为后续运营依据。')).toBeInTheDocument();
    expect(within(dialog).getAllByText('状态：已作废').length).toBeGreaterThan(0);
    expectNoSensitiveTimelineContent(container);
  });
});
