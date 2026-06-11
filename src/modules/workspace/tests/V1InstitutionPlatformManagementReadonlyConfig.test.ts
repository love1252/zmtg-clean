import { describe, expect, it } from 'vitest';
import {
  buildV1ManagementReadonlyConfigSummary,
  defaultV1ManagementReadonlyConfigPolicy,
  v1ManagementReadonlyConfigItemFields,
} from '@/modules/workspace/domain/v1-management-readonly-config-view-models';
import { validateV1LowSensitivityFieldWhitelist } from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';

const enabledPolicy = {
  featureEnabled: true,
  canReadManagementConfig: true,
  tenantScopeMatched: true,
};

const managementReadonlySummaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'emptyCopy',
  'exceptionCopy',
  'items',
];

const managementReadonlyLowSensitiveFields = [
  ...managementReadonlySummaryFields,
  ...v1ManagementReadonlyConfigItemFields,
];

function expectManagementReadonlyLowSensitiveWhitelist(payload: unknown) {
  const result = validateV1LowSensitivityFieldWhitelist(payload, {
    allowedFields: managementReadonlyLowSensitiveFields,
  });

  expect(result.valid).toBe(true);
  expect(result.unknownFields).toEqual([]);
  expect(result.forbiddenFields).toEqual([]);
  expect(result.forbiddenValues).toEqual([]);
}

describe('V1 机构端与平台端管理只读配置 view model', () => {
  it('默认关闭时返回安全空态且不回显候选配置', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [
          {
            scope: 'institution',
            configKey: 'institution_followup_sop',
            label: '机构随访 SOP 配置',
            lowSensitiveSummary: 'demo 机构内随访配置只读摘要',
            readiness: 'ready',
            mockSeedDemoFlag: 'demo',
            tenantId: 'demo-tenant-001',
            credential: 'credential_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      },
      defaultV1ManagementReadonlyConfigPolicy,
    );

    expect(defaultV1ManagementReadonlyConfigPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      emptyCopy: '该管理配置能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('机构随访 SOP 配置');
    expect(JSON.stringify(summary)).not.toContain('demo 机构内随访配置只读摘要');
    expectManagementReadonlyLowSensitiveWhitelist(summary);
  });

  it('tenant mismatch 或 RBAC denied 时不泄露候选对象、数量或配置详情', () => {
    const guardedInput = {
      candidates: [
        {
          scope: 'platform' as const,
          configKey: 'platform_ai_guardrail',
          label: '平台 AI 配置边界',
          lowSensitiveSummary: 'seed 平台 AI 只读配置摘要',
          readiness: 'disabled' as const,
          mockSeedDemoFlag: 'seed' as const,
          tenantId: 'other-tenant',
          candidateCount: 1,
          modelApiKey: 'sk_test_should_not_render',
          prompt: 'prompt should not render',
        },
      ],
    };
    const summaries = [
      buildV1ManagementReadonlyConfigSummary(guardedInput, {
        ...enabledPolicy,
        tenantScopeMatched: false,
      }),
      buildV1ManagementReadonlyConfigSummary(guardedInput, {
        ...enabledPolicy,
        canReadManagementConfig: false,
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

      expect(serialized).not.toContain('平台 AI 配置边界');
      expect(serialized).not.toContain('seed 平台 AI 只读配置摘要');
      expect(serialized).not.toContain('candidateCount');
      expectManagementReadonlyLowSensitiveWhitelist(summary);
    });
  });

  it('无候选配置时返回稳定 empty state', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [],
      },
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'empty',
      reasonCode: 'no_management_config_candidates',
      resultCode: 'empty',
      emptyCopy: '暂无可展示管理配置',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('真实统计');
    expect(JSON.stringify(summary)).not.toContain('可上线');
  });

  it('ready state 只返回机构端与平台端低敏只读字段白名单', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [
          {
            scope: 'institution',
            configKey: 'institution_revisit_rule',
            label: '机构复诊规则配置',
            lowSensitiveSummary: 'demo D7 复诊观察窗口，仅供内部人工判断',
            readiness: 'ready',
            mockSeedDemoFlag: 'demo',
            phone: '13800001252',
            medicalRecord: '完整病历正文不应展示',
            hisRawPayload: 'raw HIS payload should not render',
            allowedActions: ['createAppointment'],
            mutationPayload: { createAppointment: true },
          },
          {
            scope: 'platform',
            configKey: 'platform_quota_boundary',
            label: '平台配额边界配置',
            lowSensitiveSummary: 'seed 套餐与配额只读边界，不作为计费依据',
            readiness: 'blocked',
            mockSeedDemoFlag: 'seed',
            token: 'token_should_not_render',
            payment: 'payment should not render',
            contract: 'contract should not render',
            invoice: 'invoice should not render',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'management_config_ready',
      resultCode: 'readonly',
    });
    expect(summary.items).toEqual([
      {
        scope: 'institution',
        configKey: 'institution_revisit_rule',
        label: '机构复诊规则配置',
        lowSensitiveSummary: 'demo D7 复诊观察窗口，仅供内部人工判断',
        readiness: 'ready',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'management_config_ready',
        resultCode: 'readonly',
      },
      {
        scope: 'platform',
        configKey: 'platform_quota_boundary',
        label: '平台配额边界配置',
        lowSensitiveSummary: 'seed 套餐与配额只读边界，不作为计费依据',
        readiness: 'blocked',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'management_config_blocked',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual([...v1ManagementReadonlyConfigItemFields].sort());
      expect(item.readonly).toBe(true);
    });
    expectManagementReadonlyLowSensitiveWhitelist(summary);
  });

  it('混合候选只保留 mock / seed / demo 来源完整的低敏配置', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [
          {
            scope: 'institution',
            configKey: 'institution_followup_sop',
            label: '机构随访 SOP 配置',
            lowSensitiveSummary: 'mock 随访 SOP 低敏摘要',
            readiness: 'ready',
            mockSeedDemoFlag: 'mock',
          },
          {
            scope: 'institution',
            configKey: '',
            label: '缺少 key 的配置不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            mockSeedDemoFlag: 'demo',
          },
          {
            scope: 'platform',
            configKey: 'platform_model_config',
            label: '缺少 demo 标记的配置不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'disabled',
          },
        ],
      },
      enabledPolicy,
    );

    const serialized = JSON.stringify(summary);

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      scope: 'institution',
      configKey: 'institution_followup_sop',
      readonly: true,
      resultCode: 'readonly',
    });
    expect(serialized).not.toContain('缺少 key 的配置不应展示');
    expect(serialized).not.toContain('缺少 demo 标记的配置不应展示');
  });

  it('所有候选来源不完整时返回低敏 exception state 且不猜测真实来源', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [
          {
            scope: 'institution',
            label: '缺少配置 key',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            mockSeedDemoFlag: 'demo',
            sql: 'select * from management_config',
            stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
          },
        ],
      },
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'exception',
      reasonCode: 'management_config_source_missing',
      resultCode: 'unavailable',
      exceptionCopy: '管理配置来源不完整，仅作内部参考',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('缺少配置 key');
    expect(JSON.stringify(summary)).not.toContain('select *');
    expect(JSON.stringify(summary)).not.toContain('DATABASE_URL');
    expectManagementReadonlyLowSensitiveWhitelist(summary);
  });
});
