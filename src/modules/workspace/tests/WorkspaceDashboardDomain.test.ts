import { describe, expect, it } from 'vitest';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import { institutionNavItems } from '@/modules/workspace/domain/institution-dashboard';
import { buildInstitutionDashboardSummary } from '@/modules/workspace/domain/institution-dashboard-view-models';
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';

const customerRecords: CustomerRecordSummary[] = [
  {
    id: 'cust_high_repurchase',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值'],
  },
  {
    id: 'cust_post_care',
    tenantId: 'demo-tenant-001',
    displayName: '赵女士',
    lifecycle: 'post_care',
    priority: 'medium',
    ownerUserId: 'service-group-a',
    projectInterest: '光电修复',
    maskedPhone: '137****8842',
    maskedMedicalRecordNo: 'MR****003',
    lastTouchSummary: 'D3 红肿反馈',
    nextAction: '客服回访并记录恢复情况',
    tags: ['术后'],
  },
];

const appointmentRecords: AppointmentRecordSummary[] = [
  {
    id: 'appt_pending',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_high_repurchase',
    customerDisplayName: '王女士',
    project: '热玛吉复诊',
    scheduledAt: '2026-06-01T10:30:00+08:00',
    consultantUserId: 'consultant-lin',
    status: 'pending_confirmation',
    note: '待电话确认到院',
  },
  {
    id: 'appt_reschedule',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_post_care',
    customerDisplayName: '赵女士',
    project: '光电修复复诊',
    scheduledAt: '2026-06-02T14:30:00+08:00',
    consultantUserId: 'service-group-a',
    status: 'reschedule_requested',
    note: '需协调医生档期',
  },
];

const followUpTasks: TenantFollowUpTask[] = [
  {
    id: 'fu_urgent_due',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_post_care',
    customerDisplayName: '赵女士',
    journeyId: 'journey_post_care',
    stage: 'D3 异常反馈',
    status: 'due',
    dueAt: '2026-05-31T09:30:00+08:00',
    suggestedAction: '客服回访并记录恢复情况',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_scheduled',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_high_repurchase',
    customerDisplayName: '王女士',
    journeyId: 'journey_repurchase',
    stage: 'D28 复购建议',
    status: 'scheduled',
    dueAt: '2026-06-02T10:00:00+08:00',
    suggestedAction: '人工回访并推荐修复组合',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
  },
];

describe('工作台看板领域模型', () => {
  it('保持机构导航唯一且只有一个激活入口', () => {
    const labels = institutionNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(institutionNavItems.map((item) => item.id)).toEqual([
      'dashboard',
      'customers',
      'followups',
      'treatmentSummaries',
      'audit',
      'hisConnections',
      'conversations',
      'appointments',
      'knowledge',
      'analytics',
    ]);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(institutionNavItems.find((item) => item.active)?.id).toBe('dashboard');
    expect(labels).toEqual(
      expect.arrayContaining([
        '工作台',
        '客户中心',
        '智能随访',
        '治疗摘要管理',
        '审计日志',
        'HIS 连接配置',
        '客服工作台',
        '预约中心',
        '知识库',
        '数据分析',
      ]),
    );
  });

  it('基于演示数据派生机构首页指标', () => {
    const summary = buildInstitutionDashboardSummary({
      customers: [...customerRecords],
      appointments: [...appointmentRecords],
      followUpTasks: [...followUpTasks],
    });

    expect(summary.metrics).toEqual([
      expect.objectContaining({ key: 'customer_total', label: '当前演示客户', value: '2' }),
      expect.objectContaining({ key: 'high_priority_customers', label: '高优先级客户', value: '1' }),
      expect.objectContaining({ key: 'pending_appointments', label: '待确认预约', value: '1' }),
      expect.objectContaining({ key: 'due_followups', label: '待处理随访', value: '1' }),
    ]);
    expect(summary.supportingStats).toEqual([
      expect.objectContaining({ key: 'repurchase_window', label: '复购窗口期', value: '1' }),
      expect.objectContaining({ key: 'post_care', label: '术后关怀中', value: '1' }),
      expect.objectContaining({ key: 'reschedule_appointments', label: '改约跟进', value: '1' }),
      expect.objectContaining({ key: 'urgent_followups', label: '重点随访', value: '1' }),
    ]);
    expect(summary.isEmpty).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('tenantId');
    expect(JSON.stringify(summary)).not.toContain('AI 已排序');
    expect(JSON.stringify(summary)).not.toContain('实时同步');
  });

  it('基于演示数据派生近期行动摘要', () => {
    const summary = buildInstitutionDashboardSummary({
      customers: [...customerRecords],
      appointments: [...appointmentRecords],
      followUpTasks: [...followUpTasks],
    });

    expect(summary.actionItems.map((item) => item.title)).toEqual([
      '赵女士：D3 异常反馈',
      '王女士：热玛吉复诊',
      '赵女士：光电修复复诊',
      '王女士：热玛吉修复组合',
    ]);
    expect(summary.actionItems[0]).toMatchObject({
      source: 'followup',
      badge: '随访',
      detail: expect.stringContaining('客服回访并记录恢复情况'),
    });
    expect(summary.actionItems[1]).toMatchObject({
      source: 'appointment',
      badge: '预约',
      detail: expect.stringContaining('待确认'),
    });
  });

  it('空 records 返回稳定零值摘要和空行动列表', () => {
    const summary = buildInstitutionDashboardSummary({
      customers: [],
      appointments: [],
      followUpTasks: [],
    });

    expect(summary.metrics.map((metric) => metric.value)).toEqual(['0', '0', '0', '0']);
    expect(summary.supportingStats.map((metric) => metric.value)).toEqual(['0', '0', '0', '0']);
    expect(summary.actionItems).toEqual([]);
    expect(summary.isEmpty).toBe(true);
  });

  it('保持平台导航唯一且只有一个激活入口', () => {
    const labels = platformNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(platformNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(labels).toEqual(
      expect.arrayContaining([
        '平台总览',
        '首页与品牌',
        '租户管理',
        '产品与套餐',
        'AI 配额边界',
        '开放连接路线',
        '权限与审计',
        '商业化边界',
      ]),
    );
  });

  it('保持平台运营卡片具备业务含义', () => {
    expect(platformMetrics).toHaveLength(6);
    expect(platformMetrics.map((item) => item.label)).toEqual(
      expect.arrayContaining(['demo 租户', '演示套餐', 'AI 配额', '配额快照', '商业化信号', '平台审计']),
    );
    expect(platformHealthItems).toHaveLength(4);
    expect(platformHealthItems.map((item) => item.detail)).toEqual(
      expect.arrayContaining(['当前未启用 AI 调用配额', '运营辅助，不做正式计费']),
    );
    expect(platformCapabilityCards.map((item) => item.title)).toEqual([
      '开放连接治理边界',
      '商业化健康收尾',
      '平台操作可审计',
    ]);
  });
});
