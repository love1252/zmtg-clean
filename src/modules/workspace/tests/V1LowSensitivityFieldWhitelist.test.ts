import { describe, expect, it } from 'vitest';
import {
  buildV1BusinessClosedLoopReadonlyAggregationSummary,
  v1BusinessClosedLoopReadonlyAggregationItemFields,
} from '@/modules/workspace/domain/v1-business-closed-loop-readonly-aggregation-view-models';
import {
  defaultV1LowSensitivityForbiddenFieldFragments,
  validateV1LowSensitivityFieldWhitelist,
} from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';
import {
  buildV1ManagementReadonlyConfigSummary,
  v1ManagementReadonlyConfigItemFields,
} from '@/modules/workspace/domain/v1-management-readonly-config-view-models';

const readonlyBaseFields = [
  'status',
  'reasonCode',
  'resultCode',
  'emptyCopy',
  'exceptionCopy',
  'items',
];

const managementReadonlyAllowedFields = [
  ...readonlyBaseFields,
  ...v1ManagementReadonlyConfigItemFields,
];

const closedLoopAggregationAllowedFields = [
  ...readonlyBaseFields,
  ...v1BusinessClosedLoopReadonlyAggregationItemFields,
];

describe('V1 低敏字段白名单统一校验', () => {
  it('合法低敏 readonly item 字段通过校验', () => {
    const result = validateV1LowSensitivityFieldWhitelist(
      {
        label: '低敏摘要',
        lowSensitiveSummary: 'demo 只读摘要',
        readonly: true,
        resultCode: 'readonly',
      },
      {
        allowedFields: ['label', 'lowSensitiveSummary', 'readonly', 'resultCode'],
      },
    );

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.unknownFields).toEqual([]);
    expect(result.forbiddenFields).toEqual([]);
    expect(result.forbiddenValues).toEqual([]);
  });

  it('出现未知字段时失败并返回字段路径', () => {
    const result = validateV1LowSensitivityFieldWhitelist(
      {
        label: '低敏摘要',
        lowSensitiveSummary: 'demo 只读摘要',
        readonly: true,
        resultCode: 'readonly',
        internalNote: '不应输出的内部备注',
      },
      {
        allowedFields: ['label', 'lowSensitiveSummary', 'readonly', 'resultCode'],
      },
    );

    expect(result.valid).toBe(false);
    expect(result.unknownFields).toEqual(['$.internalNote']);
    expect(result.violations).toContainEqual({
      kind: 'unknown_field',
      path: '$.internalNote',
      field: 'internalNote',
    });
  });

  it('出现手机号 / 身份证 / credential / HIS / 模型 / 支付 / 合同 / 发票等字段时失败', () => {
    const result = validateV1LowSensitivityFieldWhitelist(
      {
        label: '低敏摘要',
        phone: '13800001252',
        idCard: '110101199001011252',
        credential: 'credential_should_not_render',
        hisConnection: 'real his connection should not render',
        modelApiKey: 'sk_test_should_not_render',
        payment: 'payment should not render',
        contract: 'contract should not render',
        invoice: 'invoice should not render',
      },
      {
        allowedFields: ['label'],
      },
    );

    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toEqual([
      '$.phone',
      '$.idCard',
      '$.credential',
      '$.hisConnection',
      '$.modelApiKey',
      '$.payment',
      '$.contract',
      '$.invoice',
    ]);
    expect(result.violations.map((violation) => violation.fragment)).toEqual(
      expect.arrayContaining([
        'phone',
        'idCard',
        'credential',
        'hisConnection',
        'modelApiKey',
        'payment',
        'contract',
        'invoice',
      ]),
    );
  });

  it('nested 对象或数组中的敏感字段、mutation/action/write 字段可被发现', () => {
    const result = validateV1LowSensitivityFieldWhitelist(
      {
        label: '低敏摘要',
        readonly: true,
        nested: {
          items: [
            {
              label: '嵌套项',
              mutationPayload: { createTask: true },
            },
            {
              label: '模型原文',
              prompt: 'prompt should not render',
              completion: 'completion should not render',
            },
          ],
        },
      },
      {
        allowedFields: ['label', 'readonly', 'nested', 'items'],
      },
    );

    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toEqual([
      '$.nested.items[0].mutationPayload',
      '$.nested.items[0].mutationPayload.createTask',
      '$.nested.items[1].prompt',
      '$.nested.items[1].completion',
    ]);
    expect(result.unknownFields).toEqual([
      '$.nested.items[0].mutationPayload',
      '$.nested.items[0].mutationPayload.createTask',
      '$.nested.items[1].prompt',
      '$.nested.items[1].completion',
    ]);
  });

  it('management readonly config 可复用白名单校验且不输出 mutation/action/write 字段', () => {
    const summary = buildV1ManagementReadonlyConfigSummary(
      {
        candidates: [
          {
            scope: 'institution',
            configKey: 'institution_followup_sop',
            label: '机构随访 SOP 配置',
            lowSensitiveSummary: 'demo 随访配置只读摘要',
            readiness: 'ready',
            mockSeedDemoFlag: 'demo',
            credential: 'credential_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      },
      {
        featureEnabled: true,
        canReadManagementConfig: true,
        tenantScopeMatched: true,
      },
    );

    const result = validateV1LowSensitivityFieldWhitelist(summary, {
      allowedFields: managementReadonlyAllowedFields,
    });

    expect(summary.status).toBe('ready');
    expect(result.valid).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('mutationPayload');
    expect(JSON.stringify(summary)).not.toContain('credential_should_not_render');
  });

  it('business closed-loop readonly aggregation 可复用白名单校验且不触发真实系统字段', () => {
    const summary = buildV1BusinessClosedLoopReadonlyAggregationSummary(
      {
        candidates: [
          {
            sourceKey: 'business_closed_loop_readonly',
            label: '闭环边界',
            lowSensitiveSummary: 'demo 主业务闭环只读摘要',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
            hisRawPayload: 'raw HIS payload should not render',
            modelApiKey: 'sk_test_should_not_render',
            allowedActions: ['createAppointment'],
          },
        ],
      },
      {
        featureEnabled: true,
        canReadClosedLoopAggregation: true,
        tenantScopeMatched: true,
      },
    );

    const result = validateV1LowSensitivityFieldWhitelist(summary, {
      allowedFields: closedLoopAggregationAllowedFields,
    });

    expect(summary.status).toBe('ready');
    expect(result.valid).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('hisRawPayload');
    expect(JSON.stringify(summary)).not.toContain('modelApiKey');
    expect(JSON.stringify(summary)).not.toContain('allowedActions');
  });

  it('默认禁止字段片段包含 readonly slice 的高敏边界', () => {
    expect(defaultV1LowSensitivityForbiddenFieldFragments).toEqual(
      expect.arrayContaining([
        'phone',
        'idCard',
        'credential',
        'hisConnection',
        'modelApiKey',
        'payment',
        'contract',
        'invoice',
        'mutationPayload',
        'allowedActions',
      ]),
    );
  });
});
