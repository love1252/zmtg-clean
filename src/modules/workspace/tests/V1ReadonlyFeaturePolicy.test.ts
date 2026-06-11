import { describe, expect, it } from 'vitest';
import {
  evaluateV1ReadonlyFeaturePolicy,
  type V1ReadonlyFeaturePolicyReasonCodes,
} from '@/modules/workspace/domain/v1-readonly-feature-policy';
import { validateV1LowSensitivityFieldWhitelist } from '@/modules/workspace/domain/v1-low-sensitivity-field-whitelist';

const managementReasonCodes = {
  empty: 'no_management_config_candidates',
  exception: 'management_config_source_missing',
  ready: 'management_config_ready',
} as const satisfies V1ReadonlyFeaturePolicyReasonCodes<
  'no_management_config_candidates',
  'management_config_source_missing',
  'management_config_ready'
>;

const aggregationReasonCodes = {
  empty: 'no_closed_loop_aggregation_candidates',
  exception: 'closed_loop_aggregation_source_missing',
  ready: 'closed_loop_aggregation_ready',
} as const satisfies V1ReadonlyFeaturePolicyReasonCodes<
  'no_closed_loop_aggregation_candidates',
  'closed_loop_aggregation_source_missing',
  'closed_loop_aggregation_ready'
>;

const lowSensitivePolicyFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
];

function expectLowSensitiveReadonlyPolicyOutput(payload: unknown) {
  const result = validateV1LowSensitivityFieldWhitelist(payload, {
    allowedFields: lowSensitivePolicyFields,
  });

  expect(result.valid).toBe(true);
  expect(result.unknownFields).toEqual([]);
  expect(result.forbiddenFields).toEqual([]);
  expect(result.forbiddenValues).toEqual([]);
}

describe('V1 readonly feature policy helper', () => {
  it('默认关闭优先返回 disabled，优先于 tenant / RBAC / empty', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: false,
      tenantScopeMatched: false,
      canRead: false,
      candidateCount: 0,
      readonlyItemCount: 0,
      reasonCodes: managementReasonCodes,
      copies: {
        disabled: '该管理配置能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示管理配置',
        exception: '管理配置来源不完整，仅作内部参考',
      },
    });

    expect(result).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该管理配置能力暂未开启',
    });
    expectLowSensitiveReadonlyPolicyOutput(result);
  });

  it('tenant mismatch 返回 tenant_scope_mismatch 且不暴露候选信息', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: false,
      canRead: true,
      candidateCount: 3,
      readonlyItemCount: 2,
      reasonCodes: managementReasonCodes,
      copies: {
        disabled: '该管理配置能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示管理配置',
        exception: '管理配置来源不完整，仅作内部参考',
      },
    });

    expect(result).toEqual({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      exceptionCopy: '当前账号没有访问权限',
    });
    expect(JSON.stringify(result)).not.toContain('candidateCount');
    expectLowSensitiveReadonlyPolicyOutput(result);
  });

  it('RBAC denied 返回 permission_denied', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: true,
      canRead: false,
      candidateCount: 1,
      readonlyItemCount: 1,
      reasonCodes: managementReasonCodes,
      copies: {
        disabled: '该管理配置能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示管理配置',
        exception: '管理配置来源不完整，仅作内部参考',
      },
    });

    expect(result).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
    });
    expectLowSensitiveReadonlyPolicyOutput(result);
  });

  it('empty 输入返回 empty', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: true,
      canRead: true,
      candidateCount: 0,
      readonlyItemCount: 0,
      reasonCodes: managementReasonCodes,
      copies: {
        disabled: '该管理配置能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示管理配置',
        exception: '管理配置来源不完整，仅作内部参考',
      },
    });

    expect(result).toEqual({
      status: 'empty',
      reasonCode: 'no_management_config_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示管理配置',
    });
  });

  it('候选存在但没有 readonly item 时返回 exception', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: true,
      canRead: true,
      candidateCount: 2,
      readonlyItemCount: 0,
      reasonCodes: aggregationReasonCodes,
      copies: {
        disabled: '该主业务闭环只读聚合能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示主业务闭环聚合',
        exception: '主业务闭环聚合来源不完整，仅作内部参考',
      },
    });

    expect(result).toEqual({
      status: 'exception',
      reasonCode: 'closed_loop_aggregation_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '主业务闭环聚合来源不完整，仅作内部参考',
    });
    expectLowSensitiveReadonlyPolicyOutput(result);
  });

  it('候选存在且 readonly item 存在时返回 ready', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: true,
      canRead: true,
      candidateCount: 2,
      readonlyItemCount: 1,
      reasonCodes: aggregationReasonCodes,
      copies: {
        disabled: '该主业务闭环只读聚合能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示主业务闭环聚合',
        exception: '主业务闭环聚合来源不完整，仅作内部参考',
      },
    });

    expect(result).toEqual({
      status: 'ready',
      reasonCode: 'closed_loop_aggregation_ready',
      resultCode: 'readonly',
      readonly: true,
    });
    expectLowSensitiveReadonlyPolicyOutput(result);
  });

  it('policy 输出不包含 mutation / action / write 或真实系统字段', () => {
    const result = evaluateV1ReadonlyFeaturePolicy({
      featureEnabled: true,
      tenantScopeMatched: true,
      canRead: true,
      candidateCount: 1,
      readonlyItemCount: 1,
      reasonCodes: aggregationReasonCodes,
      copies: {
        disabled: '该主业务闭环只读聚合能力暂未开启',
        denied: '当前账号没有访问权限',
        empty: '暂无可展示主业务闭环聚合',
        exception: '主业务闭环聚合来源不完整，仅作内部参考',
      },
    });
    const serialized = JSON.stringify(result);

    [
      'mutationPayload',
      'allowedActions',
      'selectedAction',
      'executableAction',
      'credential',
      'hisConnection',
      'hisRawPayload',
      'realCustomerData',
      'modelApiKey',
      'prompt',
      'completion',
      'payment',
      'contract',
      'invoice',
    ].forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });
});
