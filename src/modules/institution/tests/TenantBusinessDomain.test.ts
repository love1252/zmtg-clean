import { describe, expect, it } from 'vitest';
import {
  listCustomerRecordsForAccess,
  type TenantCustomerRecord,
} from '@/modules/institution/domain/customer-records';
import {
  listAppointmentRecordsForAccess,
  type TenantAppointmentRecord,
} from '@/modules/institution/domain/appointment-records';
import {
  listFollowUpTasksForAccess,
  transitionFollowUpTask,
  type TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const demoTenantCustomerRecords: TenantCustomerRecord[] = [
  {
    id: 'cust_wang_repurchase',
    tenantId: 'demo-tenant-001',
    institutionId: null,
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值', '近期咨询补水', '适合人工承接'],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  },
  {
    id: 'cust_chen_conversion',
    tenantId: 'demo-tenant-001',
    institutionId: null,
    displayName: '陈女士',
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'consultant-zhou',
    projectInterest: '玻尿酸联合方案',
    maskedPhone: '139****2609',
    maskedMedicalRecordNo: 'MR****002',
    lastTouchSummary: '浏览案例页 3 次',
    nextAction: '发送案例对比与价格解释',
    tags: ['预算明确', '价格异议', '需跟进'],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  },
  {
    id: 'cust_zhao_care',
    tenantId: 'demo-tenant-001',
    institutionId: null,
    displayName: '赵女士',
    lifecycle: 'post_care',
    priority: 'high',
    ownerUserId: 'service-group-a',
    projectInterest: '光电修复',
    maskedPhone: '137****8842',
    maskedMedicalRecordNo: 'MR****003',
    lastTouchSummary: 'D3 红肿反馈',
    nextAction: '转人工回访并记录恢复情况',
    tags: ['敏感反馈', '需安抚', '术后 D3'],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  },
  {
    id: 'cust_other_tenant',
    tenantId: 'demo-tenant-002',
    institutionId: null,
    displayName: '周女士',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'consultant-other',
    projectInterest: '皮肤检测',
    maskedPhone: '136****7711',
    maskedMedicalRecordNo: 'MR****101',
    lastTouchSummary: '明日到院',
    nextAction: '同步到院提醒',
    tags: ['跨租户测试记录'],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  },
];

const demoTenantAppointmentRecords: TenantAppointmentRecord[] = [
  {
    id: 'appt_liu_precheck',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_liu_arrival',
    customerDisplayName: '刘女士',
    project: '水光补水',
    scheduledAt: '2026-06-01T10:30:00+08:00',
    consultantUserId: 'consultant-xu',
    status: 'pending_confirmation',
    note: '待同步术前注意事项',
  },
  {
    id: 'appt_qin_arrived',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_qin_review',
    customerDisplayName: '秦女士',
    project: '玻尿酸复诊',
    scheduledAt: '2026-05-30T11:20:00+08:00',
    consultantUserId: 'frontdesk-a',
    status: 'arrived',
    note: '等待治疗记录回填',
  },
  {
    id: 'appt_tang_reschedule',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_tang_thermage',
    customerDisplayName: '唐女士',
    project: '热玛吉面诊',
    scheduledAt: '2026-05-30T16:00:00+08:00',
    consultantUserId: 'consultant-lin',
    status: 'reschedule_requested',
    note: '需协调专家下周档期',
  },
  {
    id: 'appt_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    project: '皮肤检测',
    scheduledAt: '2026-06-02T14:00:00+08:00',
    consultantUserId: 'consultant-other',
    status: 'confirmed',
    note: '跨租户测试记录',
  },
];

const demoTenantFollowUpTasks: TenantFollowUpTask[] = [
  {
    id: 'fu_wang_d28',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_wang_repurchase',
    customerDisplayName: '王女士',
    journeyId: 'journey_repurchase',
    stage: 'D28 复购建议',
    status: 'due',
    dueAt: '2026-05-30T18:00:00+08:00',
    suggestedAction: '人工回访并推荐修复组合',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_zhao_d3',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_zhao_care',
    customerDisplayName: '赵女士',
    journeyId: 'journey_post_care',
    stage: 'D3 异常反馈',
    status: 'due',
    dueAt: '2026-05-30T09:30:00+08:00',
    suggestedAction: '客服回访并记录恢复情况',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_li_silent',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_li_silent',
    customerDisplayName: '李女士',
    journeyId: 'journey_silent',
    stage: '48h 沉默唤醒',
    status: 'scheduled',
    dueAt: '2026-05-31T10:00:00+08:00',
    suggestedAction: '发送轻量唤醒话术',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    journeyId: 'journey_other',
    stage: '跨租户测试任务',
    status: 'due',
    dueAt: '2026-05-30T12:00:00+08:00',
    suggestedAction: '不应被本租户读取',
    riskLevel: 'watch',
    updatedBy: null,
    updatedAt: null,
  },
];

describe('租户业务领域模型', () => {
  it('默认不返回内置虚拟客户记录', () => {
    const result = listCustomerRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
    });

    expect(result).toEqual({ allowed: true, records: [] });
  });

  it('机构管理员只能读取本租户客户摘要', () => {
    const result = listCustomerRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantCustomerRecords,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((record) => record.id)).toEqual([
      'cust_wang_repurchase',
      'cust_chen_conversion',
      'cust_zhao_care',
    ]);
    expect(result.records.every((record) => record.tenantId === 'demo-tenant-001')).toBe(true);
    expect(JSON.stringify(result.records)).not.toMatch(/phoneNumber|idNumber|medicalRecordNo/);
  });

  it('机构管理员跨租户读取客户时被拒绝且不返回记录', () => {
    const result = listCustomerRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-002',
      records: demoTenantCustomerRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('平台管理员默认不能读取客户明细', () => {
    const result = listCustomerRecordsForAccess({
      context: platformAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantCustomerRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('机构管理员只能读取本租户预约记录', () => {
    const result = listAppointmentRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantAppointmentRecords,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((record) => record.id)).toEqual([
      'appt_liu_precheck',
      'appt_qin_arrived',
      'appt_tang_reschedule',
    ]);
    expect(result.records.every((record) => record.tenantId === 'demo-tenant-001')).toBe(true);
    expect(result.records.map((record) => record.status)).toEqual([
      'pending_confirmation',
      'arrived',
      'reschedule_requested',
    ]);
  });

  it('默认不返回内置虚拟预约记录', () => {
    const result = listAppointmentRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
    });

    expect(result).toEqual({ allowed: true, records: [] });
  });

  it('机构管理员跨租户读取预约时被拒绝', () => {
    const result = listAppointmentRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-002',
      records: demoTenantAppointmentRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('机构管理员只能读取本租户随访任务', () => {
    const result = listFollowUpTasksForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      tasks: demoTenantFollowUpTasks,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((task) => task.id)).toEqual([
      'fu_wang_d28',
      'fu_zhao_d3',
      'fu_li_silent',
    ]);
    expect(result.records.every((task) => task.tenantId === 'demo-tenant-001')).toBe(true);
  });

  it('默认不返回内置虚拟随访任务', () => {
    const result = listFollowUpTasksForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
    });

    expect(result).toEqual({ allowed: true, records: [] });
  });

  it('允许随访任务按显式状态机流转', () => {
    const result = transitionFollowUpTask({
      task: demoTenantFollowUpTasks[0],
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });

    expect(result).toEqual({
      allowed: true,
      task: {
        ...demoTenantFollowUpTasks[0],
        status: 'in_progress',
        updatedBy: 'demo-user-admin',
        updatedAt: '2026-05-30T09:00:00.000Z',
      },
    });
  });

  it('拒绝随访任务非法状态流转', () => {
    const result = transitionFollowUpTask({
      task: { ...demoTenantFollowUpTasks[0], status: 'completed' },
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'invalid_transition',
      from: 'completed',
      to: 'in_progress',
    });
  });
});
