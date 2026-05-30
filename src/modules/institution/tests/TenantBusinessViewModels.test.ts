import { describe, expect, it } from 'vitest';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import {
  appointmentStatusLabels,
  buildCustomerSegmentStats,
  customerLifecycleLabels,
  customerPriorityLabels,
  followUpRiskLevelLabels,
  followUpStatusLabels,
  formatBusinessDateTime,
  getAllowedFollowUpNextStatuses,
  groupAppointmentsByStatus,
  sortFollowUpTasksForWorkQueue,
} from '@/modules/institution/domain/tenant-business-view-models';

const customers: CustomerRecordSummary[] = [
  {
    id: 'cust_high',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '皮肤管理',
    maskedPhone: '138****0000',
    maskedMedicalRecordNo: 'MR****001',
    lastTouchSummary: '初次咨询',
    nextAction: '预约到店',
    tags: ['新客'],
  },
  {
    id: 'cust_post_care',
    tenantId: 'demo-tenant-001',
    displayName: '赵女士',
    lifecycle: 'post_care',
    priority: 'medium',
    ownerUserId: 'service-a',
    projectInterest: '光电修复',
    maskedPhone: '137****0000',
    maskedMedicalRecordNo: 'MR****002',
    lastTouchSummary: '术后 D3',
    nextAction: '人工回访',
    tags: ['术后'],
  },
  {
    id: 'cust_repurchase',
    tenantId: 'demo-tenant-001',
    displayName: '陈女士',
    lifecycle: 'repurchase_window',
    priority: 'observe',
    ownerUserId: 'consultant-zhou',
    projectInterest: '补水修复',
    maskedPhone: '136****0000',
    maskedMedicalRecordNo: 'MR****003',
    lastTouchSummary: '术后第 28 天',
    nextAction: '复查邀约',
    tags: ['复购'],
  },
  {
    id: 'cust_silent',
    tenantId: 'demo-tenant-001',
    displayName: '李女士',
    lifecycle: 'silent_reactivation',
    priority: 'observe',
    ownerUserId: 'service-a',
    projectInterest: '皮肤管理',
    maskedPhone: '135****0000',
    maskedMedicalRecordNo: 'MR****004',
    lastTouchSummary: '48h 未回复',
    nextAction: '轻量唤醒',
    tags: ['沉默'],
  },
];

const appointments: AppointmentRecordSummary[] = [
  {
    id: 'appt_confirmed',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_high',
    customerDisplayName: '王女士',
    project: '皮肤管理',
    scheduledAt: '2026-06-01T10:30:00+08:00',
    consultantUserId: 'consultant-lin',
    status: 'confirmed',
    note: '已确认',
  },
  {
    id: 'appt_pending',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_repurchase',
    customerDisplayName: '陈女士',
    project: '补水修复',
    scheduledAt: '2026-06-01T14:30:00+08:00',
    consultantUserId: 'consultant-zhou',
    status: 'pending_confirmation',
    note: '待确认',
  },
  {
    id: 'appt_arrived',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_post_care',
    customerDisplayName: '赵女士',
    project: '光电修复',
    scheduledAt: '2026-06-01T09:30:00+08:00',
    consultantUserId: 'frontdesk-a',
    status: 'arrived',
    note: '已到院',
  },
];

const followUpTasks: TenantFollowUpTask[] = [
  {
    id: 'fu_watch_early',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_high',
    customerDisplayName: '王女士',
    journeyId: 'journey_post_care',
    stage: 'D3 回访',
    status: 'due',
    dueAt: '2026-05-30T09:30:00+08:00',
    suggestedAction: '人工回访',
    riskLevel: 'watch',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_urgent_late',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_post_care',
    customerDisplayName: '赵女士',
    journeyId: 'journey_post_care',
    stage: 'D7 回访',
    status: 'due',
    dueAt: '2026-05-30T18:00:00+08:00',
    suggestedAction: '升级处理',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_normal',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_silent',
    customerDisplayName: '李女士',
    journeyId: 'journey_silent',
    stage: '48h 唤醒',
    status: 'scheduled',
    dueAt: '2026-05-31T10:00:00+08:00',
    suggestedAction: '轻量唤醒',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
  },
];

describe('机构业务页面 view model', () => {
  it('提供业务状态中文标签', () => {
    expect(customerLifecycleLabels).toEqual({
      consulting: '咨询转化',
      scheduled: '预约到院',
      post_care: '术后关怀',
      repurchase_window: '复购窗口期',
      silent_reactivation: '沉默待激活',
    });
    expect(customerPriorityLabels).toEqual({
      high: '高优先级',
      medium: '中优先级',
      observe: '观察',
    });
    expect(appointmentStatusLabels).toMatchObject({
      pending_confirmation: '待确认',
      confirmed: '已确认',
      arrived: '已到院',
      completed: '已完成',
      reschedule_requested: '改约跟进',
      cancelled: '已取消',
    });
    expect(followUpStatusLabels).toMatchObject({
      scheduled: '已计划',
      due: '待处理',
      in_progress: '处理中',
      escalated: '已升级',
      completed: '已完成',
      cancelled: '已取消',
    });
    expect(followUpRiskLevelLabels).toEqual({
      normal: '普通',
      watch: '关注',
      urgent: '优先',
    });
  });

  it('基于客户 records 计算客户分层统计', () => {
    expect(buildCustomerSegmentStats(customers)).toEqual([
      { key: 'high_priority', label: '高意向待承接', count: 1 },
      { key: 'post_care', label: '术后关怀中', count: 1 },
      { key: 'repurchase_window', label: '复购窗口期', count: 1 },
      { key: 'silent_reactivation', label: '沉默待激活', count: 1 },
    ]);
  });

  it('按稳定状态顺序分组预约', () => {
    const groups = groupAppointmentsByStatus(appointments);

    expect(groups.map((group) => [group.status, group.label, group.records.map((record) => record.id)])).toEqual([
      ['pending_confirmation', '待确认', ['appt_pending']],
      ['confirmed', '已确认', ['appt_confirmed']],
      ['arrived', '已到院', ['appt_arrived']],
      ['completed', '已完成', []],
      ['reschedule_requested', '改约跟进', []],
      ['cancelled', '已取消', []],
    ]);
  });

  it('按风险优先级和到期时间排序随访任务', () => {
    expect(sortFollowUpTasksForWorkQueue(followUpTasks).map((task) => task.id)).toEqual([
      'fu_urgent_late',
      'fu_watch_early',
      'fu_normal',
    ]);
  });

  it('计算随访任务允许的下一步状态', () => {
    expect(getAllowedFollowUpNextStatuses('scheduled')).toEqual(['due', 'cancelled']);
    expect(getAllowedFollowUpNextStatuses('due')).toEqual(['in_progress', 'escalated', 'cancelled']);
    expect(getAllowedFollowUpNextStatuses('in_progress')).toEqual(['completed', 'escalated', 'cancelled']);
    expect(getAllowedFollowUpNextStatuses('escalated')).toEqual(['in_progress', 'completed', 'cancelled']);
    expect(getAllowedFollowUpNextStatuses('completed')).toEqual([]);
    expect(getAllowedFollowUpNextStatuses('cancelled')).toEqual([]);
  });

  it('格式化业务时间为稳定展示文案', () => {
    expect(formatBusinessDateTime('2026-06-01T10:30:00+08:00')).toBe('2026-06-01 10:30');
    expect(formatBusinessDateTime('not-a-date')).toBe('not-a-date');
  });
});
