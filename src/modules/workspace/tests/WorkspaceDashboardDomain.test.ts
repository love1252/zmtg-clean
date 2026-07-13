import { describe, expect, it } from 'vitest';
import { Brain, TrendingUp } from 'lucide-react';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import { institutionNavItems } from '@/modules/workspace/domain/institution-dashboard';
import { buildInstitutionDashboardSummary } from '@/modules/workspace/domain/institution-dashboard-view-models';
import { buildV1OpportunityReadonlySummary } from '@/modules/workspace/domain/v1-opportunity-readonly-view-models';
import {
  buildPlatformOverviewViewModel,
  platformCapabilityCards,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';

const customerRecords: CustomerRecordSummary[] = [
  {
    id: 'cust_high_repurchase',
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
    tags: ['高价值'],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  },
  {
    id: 'cust_post_care',
    tenantId: 'demo-tenant-001',
    institutionId: null,
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
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
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

const enabledOpportunityPolicy = {
  featureEnabled: true,
  canReadOpportunities: true,
  tenantScopeMatched: true,
};

const forbiddenOpportunityFieldFragments = [
  'phone',
  'mobile',
  'contact',
  'idCard',
  'medicalRecord',
  'diagnosis',
  'treatmentRaw',
  'consultationRaw',
  'address',
  'amount',
  'revenue',
  'roi',
  'payment',
  'contract',
  'invoice',
  'credential',
  'token',
  'secret',
  'rawPayload',
  'sql',
  'stack',
  'dbUrl',
  'tenantId',
  'fullName',
];

describe('工作台看板领域模型', () => {
  it('保持机构导航唯一且只有一个激活入口', () => {
    const labels = institutionNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(institutionNavItems.map((item) => item.id)).toEqual([
      'dashboard',
      'customers',
      'followups',
      'aiServiceUsage',
      'treatmentSummaries',
      'opportunities',
      'audit',
      'wecomExternalContacts',
      'hisConnections',
      'conversations',
      'appointments',
      'knowledge',
      'analytics',
    ]);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(institutionNavItems.find((item) => item.active)?.id).toBe('dashboard');
    expect(labels).not.toContain('AI 模型');
    expect(labels).toEqual(
      expect.arrayContaining([
        '工作台',
        '客户中心',
        '智能随访',
        '治疗摘要管理',
        '审计日志',
        '企微外部联系人',
        'HIS 连接配置',
        '客服工作台',
        '预约中心',
        '知识库',
        '数据分析',
      ]),
    );
  });

  it('基于 API 记录派生机构首页指标，不带演示口径', () => {
    const summary = buildInstitutionDashboardSummary({
      customers: [...customerRecords],
      appointments: [...appointmentRecords],
      followUpTasks: [...followUpTasks],
    });

    expect(summary.metrics).toEqual([
      expect.objectContaining({ key: 'customer_total', label: '客户总数', value: '2', helper: 'API 数据' }),
      expect.objectContaining({ key: 'high_priority_customers', label: '高优先级客户', value: '1' }),
      expect.objectContaining({ key: 'pending_appointments', label: '待确认预约', value: '1' }),
      expect.objectContaining({ key: 'due_followups', label: '待处理随访', value: '1' }),
      expect.objectContaining({ key: 'completed_followups', label: '已完成随访' }),
      expect.objectContaining({ key: 'opportunity_pool', label: '机会池客户' }),
    ]);
    expect(summary.supportingStats).toEqual([
      expect.objectContaining({ key: 'repurchase_window', label: '复购窗口期', value: '1' }),
      expect.objectContaining({ key: 'post_care', label: '术后关怀中', value: '1' }),
      expect.objectContaining({ key: 'reschedule_appointments', label: '改约跟进', value: '1' }),
      expect.objectContaining({ key: 'urgent_followups', label: '重点随访', value: '1' }),
    ]);
    expect(summary.isEmpty).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('tenantId');
    expect(JSON.stringify(summary)).not.toContain('演示');
    expect(JSON.stringify(summary)).not.toContain('demo');
    expect(JSON.stringify(summary)).not.toContain('AI 已排序');
    expect(JSON.stringify(summary)).not.toContain('实时同步');
  });

  it('dashboard 摘要展示安全开关低敏状态', () => {
    const summary = buildInstitutionDashboardSummary({
      customers: [...customerRecords],
      appointments: [...appointmentRecords],
      followUpTasks: [...followUpTasks],
    });

    expect(summary.safetySwitch).toMatchObject({
      tenantRealChannelEnabled: false,
      institutionRealChannelEnabled: false,
      weComRealSendEnabled: false,
      smsRealSendEnabled: false,
      webhookEnabled: false,
      emergencyStopEnabled: true,
      allowRealSend: false,
      externalChannelEnabled: false,
      realChannelBlocked: true,
      status: 'mock_only',
    });
    expect(summary.safetySwitch.boundaryLabels).toEqual(
      expect.arrayContaining([
        '当前权限 / 安全边界：机构内角色按最小权限访问',
        '真实渠道默认关闭',
        '企业微信真实发送关闭',
        '短信真实发送关闭',
        'webhook 关闭',
        '当前仍为 mock',
        '不接真实 HIS / 企业微信 / 短信 / webhook',
        '不真实发送 / 不真实出网',
      ]),
    );
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

    expect(summary.metrics.map((metric) => metric.value)).toEqual(['0', '0', '0', '0', '0', '0']);
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
        'AI模型配置',
        'AI用量与费用',
        '知识库管理',
        '开放连接路线',
        '平台审计日志',
        '商业化边界',
      ]),
    );
    expect(platformNavItems.find((item) => item.label === 'AI模型配置')?.icon).toBe(Brain);
    expect(platformNavItems.find((item) => item.label === 'AI用量与费用')?.icon).toBe(
      TrendingUp,
    );
  });

  it('平台总览空租户时从真实租户列表派生零值运营口径', () => {
    const overview = buildPlatformOverviewViewModel({
      tenants: [],
      now: new Date('2026-06-22T00:00:00+08:00'),
    });

    expect(overview.metrics).toHaveLength(6);
    expect(overview.metrics.map((item) => item.label)).toEqual(
      [
        '活跃租户数',
        '有效套餐覆盖率',
        '基础配置缺失租户',
        '快照异常租户',
        '配额风险影响租户',
        '拒绝审计信号',
      ],
    );
    expect(overview.metrics.map((item) => item.value)).toEqual(['0', '0%', '0', '0', '0', '0']);
    expect(overview.metrics.map((item) => item.change).join(' ')).not.toContain('18');
    expect(overview.metrics.map((item) => item.change).join(' ')).not.toContain('配额拒绝 5');
    expect(overview.healthItems.map((item) => item.label)).toEqual([
      '缺少有效套餐',
      '缺少配额上限',
      '快照异常租户',
      '配额拒绝样本',
    ]);
    expect(overview.healthItems.map((item) => item.value)).toEqual(['0', '0', '0', '0']);
    expect(overview.tenantStatusItems.map((item) => item.value)).toEqual(['0', '0', '0']);
    expect(overview.planStatusItems.map((item) => item.value)).toEqual(['0', '0', '0']);
    expect(platformCapabilityCards.map((item) => item.title)).toEqual([
      '真实计费未启用',
      '外部连接未启用',
      'AI 模型处于受控试运行',
      '模型配置已接入多个厂商',
    ]);
  });
});

describe('V1 opportunity readonly 领域模型', () => {
  it('feature flag disabled 时返回安全空态且不返回候选对象', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'revisit_reminder',
            sourceType: 'treatment_summary',
            sourceSummary: '治疗后摘要 D7 复诊窗口',
            triggerReason: '复诊窗口进入人工确认范围',
            suggestedAction: '内部人员人工确认是否转随访',
            priority: 'high',
            dueDateWindow: 'D7',
            mockSeedDemoFlag: 'demo',
          },
        ],
      },
      {
        ...enabledOpportunityPolicy,
        featureEnabled: false,
      },
    );

    expect(summary).toMatchObject({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      opportunities: [],
    });
    expect(JSON.stringify(summary)).not.toContain('创建任务');
    expect(JSON.stringify(summary)).not.toContain('创建预约');
    expect(JSON.stringify(summary)).not.toContain('创建成交');
  });

  it('tenant 或 RBAC 不满足时返回低敏 denied 且不暴露对象存在性', () => {
    const tenantDeniedSummary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'repurchase',
            sourceType: 'customer_lifecycle',
            sourceSummary: '项目周期进入复购观察窗口',
            triggerReason: '复购窗口试运行',
            suggestedAction: '人工判断是否继续内部跟进',
            priority: 'medium',
            mockSeedDemoFlag: 'seed',
            tenantId: 'demo-tenant-001',
            institutionId: 'institution-001',
          },
        ],
      },
      {
        ...enabledOpportunityPolicy,
        tenantScopeMatched: false,
      },
    );
    const rbacDeniedSummary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'dormant_customer',
            sourceType: 'last_interaction',
            sourceSummary: '60 天未互动观察层级',
            triggerReason: '沉睡阈值试运行',
            suggestedAction: '人工判断是否继续观察',
            priority: 'low',
            mockSeedDemoFlag: 'mock',
          },
        ],
      },
      {
        ...enabledOpportunityPolicy,
        canReadOpportunities: false,
      },
    );

    expect(tenantDeniedSummary).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      opportunities: [],
    });
    expect(rbacDeniedSummary).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      opportunities: [],
    });
    expect(JSON.stringify(tenantDeniedSummary)).not.toContain('tenantId');
    expect(JSON.stringify(tenantDeniedSummary)).not.toContain('institutionId');
  });

  it('guard denied 或 disabled 时不返回候选详情、数量或来源摘要', () => {
    const guardedInput = {
      candidates: [
        {
          opportunityType: 'repurchase' as const,
          sourceType: 'customer_lifecycle',
          sourceSummary: '项目周期进入复购观察窗口',
          triggerReason: '复购窗口试运行',
          suggestedAction: '人工判断是否继续内部跟进',
          priority: 'high' as const,
          mockSeedDemoFlag: 'demo' as const,
          candidateCount: 1,
        },
      ],
    };
    const summaries = [
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...enabledOpportunityPolicy,
        featureEnabled: false,
      }),
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...enabledOpportunityPolicy,
        tenantScopeMatched: false,
      }),
      buildV1OpportunityReadonlySummary(guardedInput, {
        ...enabledOpportunityPolicy,
        canReadOpportunities: false,
      }),
    ];

    expect(summaries.map((summary) => summary.opportunities)).toEqual([[], [], []]);
    expect(summaries.map((summary) => summary.reasonCode)).toEqual([
      'feature_flag_disabled',
      'tenant_scope_mismatch',
      'permission_denied',
    ]);
    summaries.forEach((summary) => {
      const serialized = JSON.stringify(summary);

      expect(serialized).not.toContain('项目周期进入复购观察窗口');
      expect(serialized).not.toContain('复购窗口试运行');
      expect(serialized).not.toContain('人工判断是否继续内部跟进');
      expect(serialized).not.toContain('candidateCount');
    });
  });

  it('无候选机会时返回稳定空态且不误导为历史任务全部完成', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [],
      },
      enabledOpportunityPolicy,
    );

    expect(summary).toMatchObject({
      status: 'empty',
      reasonCode: 'no_candidate_opportunities',
      resultCode: 'empty',
      opportunities: [],
    });
    expect(summary.emptyCopy).toBe('暂无待处理机会');
    expect(summary.emptyCopy).not.toContain('历史任务全部完成');
    expect(JSON.stringify(summary)).not.toContain('真实统计');
  });

  it('来源缺失时返回低敏异常态且不猜测 raw source', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'revisit_reminder',
            triggerReason: '复诊窗口进入人工确认范围',
            suggestedAction: '内部人员人工确认是否转随访',
            priority: 'high',
            mockSeedDemoFlag: 'demo',
            rawPayload: 'HIS raw payload should not render',
            sql: 'select * from opportunities',
            stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
          },
        ],
      },
      enabledOpportunityPolicy,
    );

    expect(summary).toMatchObject({
      status: 'exception',
      reasonCode: 'source_missing',
      resultCode: 'unavailable',
    });
    expect(summary.opportunities).toEqual([]);
    expect(summary.exceptionCopy).toBe('机会来源不完整，仅作内部参考');
    expect(JSON.stringify(summary)).not.toContain('raw payload');
    expect(JSON.stringify(summary)).not.toContain('select *');
    expect(JSON.stringify(summary)).not.toContain('DATABASE_URL');
  });

  it('只返回低敏字段且 forbidden fields 不出现在序列化结果中', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'repurchase',
            sourceType: 'treatment_summary',
            sourceSummary: '治疗后摘要 · D28 稳定期 · 项目周期',
            triggerReason: '复购窗口为试运行口径',
            suggestedAction: '人工判断是否转内部跟进',
            priority: 'high',
            dueDateWindow: 'D28',
            status: 'pending_confirmation',
            mockSeedDemoFlag: 'seed',
            fullName: '真实姓名不应展示',
            phone: '13800001252',
            mobile: '13800001252',
            contact: '完整联系方式不应展示',
            idCard: '110101199001010011',
            medicalRecord: '完整病历正文不应展示',
            diagnosis: '诊断正文不应展示',
            treatmentRaw: '治疗原文不应展示',
            consultationRaw: '咨询原文不应展示',
            address: '完整地址不应展示',
            amount: '100000',
            revenue: '100000',
            roi: '900%',
            payment: '支付数据不应展示',
            contract: '合同数据不应展示',
            invoice: '发票数据不应展示',
            credential: 'credential_should_not_render',
            token: 'token_should_not_render',
            secret: 'secret_should_not_render',
            rawPayload: 'raw payload should not render',
            sql: 'select * from customers',
            stack: 'stack should not render',
            dbUrl: 'postgres://tenant:secret@localhost:5432/zmtg',
            tenantId: 'demo-tenant-001',
          },
        ],
      },
      enabledOpportunityPolicy,
    );

    const serialized = JSON.stringify(summary);

    expect(summary.status).toBe('ready');
    expect(summary.opportunities).toHaveLength(1);
    expect(summary.opportunities[0]).toEqual({
      opportunityType: 'repurchase',
      sourceType: 'treatment_summary',
      sourceSummary: '治疗后摘要 · D28 稳定期 · 项目周期',
      triggerReason: '复购窗口为试运行口径',
      suggestedAction: '人工判断是否转内部跟进',
      priority: 'high',
      dueDateWindow: 'D28',
      status: 'pending_confirmation',
      mockSeedDemoFlag: 'seed',
      reasonCode: 'candidate_ready',
      resultCode: 'readonly',
    });
    forbiddenOpportunityFieldFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });

  it('混合候选只返回允许的低敏 readonly opportunity 且 dueDateWindow 可选', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'revisit_reminder',
            sourceType: 'treatment_summary',
            sourceSummary: '治疗后摘要 · D7 复查窗口',
            triggerReason: '复诊窗口进入人工确认范围',
            suggestedAction: '内部人员人工确认是否转随访',
            priority: 'medium',
            mockSeedDemoFlag: 'demo',
            rawPayload: 'raw payload should not render',
            token: 'token_should_not_render',
          },
          {
            opportunityType: 'repurchase',
            sourceType: '',
            sourceSummary: '来源缺失候选不应出现在结果中',
            triggerReason: '缺失来源类型',
            suggestedAction: '不应展示',
            priority: 'high',
            mockSeedDemoFlag: 'seed',
          },
          {
            opportunityType: 'dormant_customer',
            sourceType: 'customer_lifecycle',
            sourceSummary: '缺少演示标记候选不应出现在结果中',
            triggerReason: '缺少 mock seed demo 标记',
            suggestedAction: '不应展示',
            priority: 'low',
          },
        ],
      },
      enabledOpportunityPolicy,
    );

    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'candidate_ready',
      resultCode: 'readonly',
    });
    expect(summary.opportunities).toHaveLength(1);
    expect(summary.opportunities[0]).toEqual({
      opportunityType: 'revisit_reminder',
      sourceType: 'treatment_summary',
      sourceSummary: '治疗后摘要 · D7 复查窗口',
      triggerReason: '复诊窗口进入人工确认范围',
      suggestedAction: '内部人员人工确认是否转随访',
      priority: 'medium',
      status: 'pending_confirmation',
      mockSeedDemoFlag: 'demo',
      reasonCode: 'candidate_ready',
      resultCode: 'readonly',
    });
    expect(summary.opportunities[0]).not.toHaveProperty('dueDateWindow');
    expect(serialized).not.toContain('来源缺失候选不应出现在结果中');
    expect(serialized).not.toContain('缺少演示标记候选不应出现在结果中');
    expect(serialized).not.toContain('raw payload');
    expect(serialized).not.toContain('token_should_not_render');
  });

  it('stale / already handled / invalid transition 只返回 blocked 状态且不提供可执行动作字段', () => {
    const summary = buildV1OpportunityReadonlySummary(
      {
        candidates: [
          {
            opportunityType: 'revisit_reminder',
            sourceType: 'appointment',
            sourceSummary: '预约状态 · D7 复查窗口',
            triggerReason: '复诊提醒已过期',
            suggestedAction: '刷新后由内部人员重新判断',
            priority: 'medium',
            status: 'stale',
            mockSeedDemoFlag: 'mock',
            allowedActions: ['转内部随访任务'],
          },
          {
            opportunityType: 'repurchase',
            sourceType: 'customer_lifecycle',
            sourceSummary: '项目周期 · 复购观察窗口',
            triggerReason: '对象已被处理',
            suggestedAction: '刷新后查看最新状态',
            priority: 'medium',
            status: 'already_handled',
            mockSeedDemoFlag: 'seed',
            selectedAction: 'convert_to_followup',
          },
          {
            opportunityType: 'dormant_customer',
            sourceType: 'last_interaction',
            sourceSummary: '60 天未互动观察层级',
            triggerReason: '当前状态不支持该流转',
            suggestedAction: '保留低敏异常态',
            priority: 'low',
            status: 'invalid_transition',
            mockSeedDemoFlag: 'demo',
            executableAction: 'wake_customer',
          },
        ],
      },
      enabledOpportunityPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.opportunities.map((item) => item.status)).toEqual([
      'blocked',
      'blocked',
      'blocked',
    ]);
    expect(summary.opportunities.map((item) => item.reasonCode)).toEqual([
      'state_stale',
      'already_handled',
      'invalid_transition',
    ]);
    expect(summary.opportunities.every((item) => item.resultCode === 'blocked')).toBe(true);
    expect(summary.opportunities.every(
      (item) => item.suggestedAction === '当前状态不可执行，请刷新后重新判断',
    )).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('allowedActions');
    expect(JSON.stringify(summary)).not.toContain('selectedAction');
    expect(JSON.stringify(summary)).not.toContain('executableAction');
    expect(JSON.stringify(summary)).not.toContain('转内部随访任务');
    expect(JSON.stringify(summary)).not.toContain('convert_to_followup');
    expect(JSON.stringify(summary)).not.toContain('wake_customer');
    expect(JSON.stringify(summary)).not.toContain('success');
  });
});
