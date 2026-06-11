import { describe, expect, it } from 'vitest';
import {
  buildV1BusinessClosedLoopReadonlyAggregationSummary,
  defaultV1BusinessClosedLoopReadonlyAggregationPolicy,
  v1BusinessClosedLoopReadonlyAggregationItemFields,
} from '@/modules/workspace/domain/v1-business-closed-loop-readonly-aggregation-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadClosedLoopAggregation: true,
  tenantScopeMatched: true,
};

const forbiddenAggregationFragments = [
  'phone',
  'mobile',
  'contact',
  'idCard',
  'identityCard',
  'medicalRecord',
  'diagnosis',
  'treatmentRaw',
  'consultationRaw',
  'hisConnection',
  'hisRawPayload',
  'credential',
  'credentials',
  'token',
  'secret',
  'password',
  'DATABASE_URL',
  'DB_URL',
  'SQL',
  'stack',
  'tenantId',
  'customerId',
  'customerList',
  'realCustomerData',
  'modelApiKey',
  'prompt',
  'completion',
  'payment',
  'contract',
  'invoice',
  'allowedActions',
  'selectedAction',
  'executableAction',
  'actionToken',
  'mutationPayload',
  'createTask',
  'createAppointment',
  'createDeal',
  'autoMarketing',
  'autoTouch',
  '真实 HIS',
  '真实客户数据',
  '真实模型',
  '自动营销',
  '自动触达',
  '创建任务',
  '创建预约',
  '创建成交',
  '支付',
  '合同',
  '发票',
  '可试点',
  '可上线',
];

function expectNoForbiddenAggregationFragments(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenAggregationFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('V1 主业务闭环只读聚合 view model', () => {
  it('默认关闭时返回安全空态且不回显任何候选聚合详情', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [
          {
            sourceKey: 'opportunity_readonly',
            label: '机会只读候选',
            lowSensitiveSummary: 'demo 机会只读摘要',
            readiness: 'ready',
            metricValue: '3',
            mockSeedDemoFlag: 'demo',
            tenantId: 'demo-tenant-001',
            credential: 'credential_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      },
      defaultV1BusinessClosedLoopReadonlyAggregationPolicy,
    );

    expect(defaultV1BusinessClosedLoopReadonlyAggregationPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      emptyCopy: '该主业务闭环只读聚合能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('机会只读候选');
    expect(JSON.stringify(summary)).not.toContain('demo 机会只读摘要');
    expectNoForbiddenAggregationFragments(summary);
  });

  it('tenant mismatch 或 RBAC denied 时返回低敏 denied 且不泄露候选数量或来源摘要', () => {
    const guardedInput = {
      candidates: [
        {
          sourceKey: 'management_readonly_config' as const,
          label: '机构管理配置',
          lowSensitiveSummary: 'seed 管理配置只读摘要',
          readiness: 'ready' as const,
          metricValue: '2',
          mockSeedDemoFlag: 'seed' as const,
          tenantId: 'other-tenant',
          candidateCount: 2,
          modelApiKey: 'sk_test_should_not_render',
          prompt: 'prompt should not render',
        },
      ],
    };
    const summaries = [
      buildV1BusinessClosedLoopReadonlyAggregationSummary(guardedInput, {
        ...enabledPolicy,
        tenantScopeMatched: false,
      }),
      buildV1BusinessClosedLoopReadonlyAggregationSummary(guardedInput, {
        ...enabledPolicy,
        canReadClosedLoopAggregation: false,
      }),
    ];

    expect(summaries.map((summary) => summary.items)).toEqual([[], []]);
    expect(summaries.map((summary) => summary.reasonCode)).toEqual([
      'tenant_scope_mismatch',
      'permission_denied',
    ]);
    expect(summaries.map((summary) => summary.resultCode)).toEqual(['denied', 'denied']);
    summaries.forEach((summary) => {
      const serialized = JSON.stringify(summary);

      expect(serialized).not.toContain('机构管理配置');
      expect(serialized).not.toContain('seed 管理配置只读摘要');
      expect(serialized).not.toContain('candidateCount');
      expectNoForbiddenAggregationFragments(summary);
    });
  });

  it('无候选聚合输入时返回稳定 empty state', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [],
      },
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'empty',
      reasonCode: 'no_closed_loop_aggregation_candidates',
      resultCode: 'empty',
      emptyCopy: '暂无可展示主业务闭环聚合',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('真实统计');
    expect(JSON.stringify(summary)).not.toContain('可上线');
  });

  it('ready state 聚合已有 readonly 能力并只返回低敏字段白名单', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [
          {
            sourceKey: 'business_closed_loop_readonly',
            label: '闭环边界',
            lowSensitiveSummary: 'demo 治疗后客户运营状态可被低敏表达',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
            customerList: ['真实客户列表不应展示'],
            realCustomerData: '真实客户数据不应展示',
          },
          {
            sourceKey: 'opportunity_readonly',
            label: '机会只读',
            lowSensitiveSummary: 'seed 复诊 / 复购 / 沉睡机会只读摘要',
            readiness: 'blocked',
            metricValue: '3',
            mockSeedDemoFlag: 'seed',
            allowedActions: ['createAppointment'],
            actionToken: 'action-token-should-not-render',
            mutationPayload: { createAppointment: true },
          },
          {
            sourceKey: 'management_readonly_config',
            label: '管理配置',
            lowSensitiveSummary: 'mock 机构与平台配置只读摘要',
            readiness: 'ready',
            metricValue: '2',
            mockSeedDemoFlag: 'mock',
            credential: 'credential_should_not_render',
            hisConnection: 'real his connection should not render',
          },
          {
            sourceKey: 'workspace_dashboard_readonly',
            label: '工作台看板',
            lowSensitiveSummary: 'demo 工作台只读指标摘要',
            readiness: 'exception',
            metricValue: '暂不可用',
            mockSeedDemoFlag: 'demo',
            sql: 'select * from customers',
            stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'closed_loop_aggregation_ready',
      resultCode: 'readonly',
    });
    expect(summary.items).toEqual([
      {
        sourceKey: 'business_closed_loop_readonly',
        label: '闭环边界',
        lowSensitiveSummary: 'demo 治疗后客户运营状态可被低敏表达',
        readiness: 'ready',
        metricValue: '1',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'closed_loop_aggregation_ready',
        resultCode: 'readonly',
      },
      {
        sourceKey: 'opportunity_readonly',
        label: '机会只读',
        lowSensitiveSummary: 'seed 复诊 / 复购 / 沉睡机会只读摘要',
        readiness: 'blocked',
        metricValue: '3',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'closed_loop_aggregation_blocked',
        resultCode: 'readonly',
      },
      {
        sourceKey: 'management_readonly_config',
        label: '管理配置',
        lowSensitiveSummary: 'mock 机构与平台配置只读摘要',
        readiness: 'ready',
        metricValue: '2',
        mockSeedDemoFlag: 'mock',
        readonly: true,
        reasonCode: 'closed_loop_aggregation_ready',
        resultCode: 'readonly',
      },
      {
        sourceKey: 'workspace_dashboard_readonly',
        label: '工作台看板',
        lowSensitiveSummary: 'demo 工作台只读指标摘要',
        readiness: 'exception',
        metricValue: '暂不可用',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'closed_loop_aggregation_exception',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual(
        [...v1BusinessClosedLoopReadonlyAggregationItemFields].sort(),
      );
      expect(item.readonly).toBe(true);
      expect(item.resultCode).toBe('readonly');
    });
    expectNoForbiddenAggregationFragments(summary);
  });

  it('混合候选只保留 mock / seed / demo 来源完整的低敏聚合项', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [
          {
            sourceKey: 'opportunity_readonly',
            label: '机会只读',
            lowSensitiveSummary: 'mock 机会只读摘要',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'mock',
          },
          {
            sourceKey: 'opportunity_readonly',
            label: '非法真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'production' as never,
          },
          {
            sourceKey: 'real_his_aggregation' as never,
            label: '真实 HIS 聚合不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
          },
          {
            sourceKey: 'workspace_dashboard_readonly',
            label: '',
            lowSensitiveSummary: '缺少 label 不应展示',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'seed',
          },
        ],
      },
      enabledPolicy,
    );

    const serialized = JSON.stringify(summary);

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      sourceKey: 'opportunity_readonly',
      label: '机会只读',
      readonly: true,
      resultCode: 'readonly',
    });
    expect(serialized).not.toContain('非法真实来源不应展示');
    expect(serialized).not.toContain('真实 HIS 聚合不应展示');
    expect(serialized).not.toContain('缺少 label 不应展示');
  });

  it('所有候选来源不完整时进入低敏 exception state 且不猜测 raw source', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [
          {
            sourceKey: 'business_closed_loop_readonly',
            label: '缺少低敏摘要',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
            sql: 'select * from closed_loop',
            stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
          },
          {
            sourceKey: 'real_model_output' as never,
            label: '真实模型输出不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
            completion: '真实模型原文不应展示',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'exception',
      reasonCode: 'closed_loop_aggregation_source_missing',
      resultCode: 'unavailable',
      exceptionCopy: '主业务闭环聚合来源不完整，仅作内部参考',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('缺少低敏摘要');
    expect(JSON.stringify(summary)).not.toContain('真实模型输出不应展示');
    expect(JSON.stringify(summary)).not.toContain('select *');
    expect(JSON.stringify(summary)).not.toContain('DATABASE_URL');
    expectNoForbiddenAggregationFragments(summary);
  });
});
