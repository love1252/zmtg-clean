import { describe, expect, it } from 'vitest';

import {
  deriveInstitutionCapabilityDecisionV1,
  evaluateInstitutionCapabilityStatusV1,
  isInstitutionCapabilitySafeSummaryV1,
} from '@/modules/institution/server/institution-capability-status-evaluator';

const baseDimensions = {
  codeMaturity: 'verified',
  institutionAuthorization: 'authorized',
  connectionAvailability: 'not_required',
  dataReadiness: 'ready',
  productionRelease: 'released',
} as const;

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    key: 'page_customer_list',
    dimensions: baseDimensions,
    safeSummary: '当前能力已核验',
    diagnosticTargetKey: null,
    ...overrides,
  };
}

describe('InstitutionCapabilityStatusEvaluator', () => {
  it.each([
    ['available', 'ready', 'pilot_released'],
    ['available', 'empty', 'released'],
    ['not_required', 'not_required', 'pilot_released'],
  ] as const)(
    '仅 verified、authorized、连接可用、数据可用和已放行时 operational',
    (connectionAvailability, dataReadiness, productionRelease) => {
      const result = evaluateInstitutionCapabilityStatusV1(
        evaluation({
          dimensions: {
            ...baseDimensions,
            connectionAvailability,
            dataReadiness,
            productionRelease,
          },
        }),
      );

      expect(result).toMatchObject({ ok: true, item: { decision: 'operational' } });
    },
  );

  it.each([
    ['codeMaturity', 'unverified'],
    ['institutionAuthorization', 'not_authorized'],
    ['connectionAvailability', 'unavailable'],
    ['dataReadiness', 'unavailable'],
    ['productionRelease', 'not_released'],
    ['productionRelease', 'suspended'],
  ] as const)('%s=%s 时 authoritative decision 固定 hidden', (field, value) => {
    const result = evaluateInstitutionCapabilityStatusV1(
      evaluation({ dimensions: { ...baseDimensions, [field]: value } }),
    );

    expect(result).toMatchObject({ ok: true, item: { decision: 'hidden' } });
  });

  it.each(['partial', 'stale'] as const)(
    'dataReadiness=%s 最多 read_only',
    (dataReadiness) => {
      const result = evaluateInstitutionCapabilityStatusV1(
        evaluation({ dimensions: { ...baseDimensions, dataReadiness } }),
      );

      expect(result).toMatchObject({ ok: true, item: { decision: 'read_only' } });
    },
  );

  it('not_authorized 不回显业务摘要或诊断目标', () => {
    const result = evaluateInstitutionCapabilityStatusV1(
      evaluation({
        dimensions: {
          ...baseDimensions,
          institutionAuthorization: 'not_authorized',
        },
        diagnosticTargetKey: 'page_system_overview',
      }),
    );

    expect(result).toEqual({
      ok: true,
      item: {
        key: 'page_customer_list',
        decision: 'hidden',
        dimensions: {
          ...baseDimensions,
          institutionAuthorization: 'not_authorized',
        },
        safeSummary: null,
        diagnosticTargetKey: null,
      },
    });
  });

  it('严格拒绝未知 key、缺 key、额外字段和客户端 decision', () => {
    expect(
      evaluateInstitutionCapabilityStatusV1(evaluation({ key: 'page_unknown' })),
    ).toEqual({ ok: false, failureReason: 'unknown_capability' });

    const missingKey = evaluation();
    delete (missingKey as { key?: unknown }).key;
    expect(evaluateInstitutionCapabilityStatusV1(missingKey)).toEqual({
      ok: false,
      failureReason: 'invalid_input',
    });
    expect(
      evaluateInstitutionCapabilityStatusV1({ ...evaluation(), extra: true }),
    ).toEqual({ ok: false, failureReason: 'invalid_input' });
    expect(
      evaluateInstitutionCapabilityStatusV1({
        ...evaluation(),
        decision: 'operational',
      }),
    ).toEqual({ ok: false, failureReason: 'invalid_input' });
  });

  it.each([
    ['codeMaturity', 'ready'],
    ['institutionAuthorization', true],
    ['connectionAvailability', 'connected'],
    ['dataReadiness', 'denied'],
    ['productionRelease', 'enabled'],
  ])('拒绝未知五维词汇 %s=%s', (field, value) => {
    expect(
      evaluateInstitutionCapabilityStatusV1(
        evaluation({ dimensions: { ...baseDimensions, [field]: value } }),
      ),
    ).toEqual({ ok: false, failureReason: 'invalid_dimensions' });
  });

  it('五维对象必须字段完整且不能携带第二套状态', () => {
    const missing = { ...baseDimensions } as Record<string, unknown>;
    delete missing.dataReadiness;
    expect(
      evaluateInstitutionCapabilityStatusV1(evaluation({ dimensions: missing })),
    ).toEqual({ ok: false, failureReason: 'invalid_dimensions' });
    expect(
      evaluateInstitutionCapabilityStatusV1(
        evaluation({ dimensions: { ...baseDimensions, released: true } }),
      ),
    ).toEqual({ ok: false, failureReason: 'invalid_dimensions' });
  });

  it('safeSummary 只接受固定低敏文案或 null', () => {
    expect(isInstitutionCapabilitySafeSummaryV1('当前能力已核验')).toBe(true);
    expect(isInstitutionCapabilitySafeSummaryV1('当前能力数据已过期')).toBe(true);
    expect(isInstitutionCapabilitySafeSummaryV1('好'.repeat(120))).toBe(false);
    expect(isInstitutionCapabilitySafeSummaryV1('🙂'.repeat(120))).toBe(false);
    expect(isInstitutionCapabilitySafeSummaryV1('')).toBe(false);
    expect(isInstitutionCapabilitySafeSummaryV1('   ')).toBe(false);
    expect(isInstitutionCapabilitySafeSummaryV1(null)).toBe(true);
  });

  it.each([
    '低敏状态\n第二行',
    '请访问 https://internal.example.com',
    'provider returned error ECONNRESET',
    'AIBOTK adapter endpoint unavailable',
    'access_token=secret-value',
    'token=secret-value',
    '上游提供商返回 TypeError',
    '连接 localhost:5432 失败',
    '连接 127.0.0.1 失败',
    '手机号：13800000000',
    '手机号：138-0000-0000',
    '身份证：110105199001011234',
    '联系：admin@example.com',
    '文件位于 /Users/example/service.ts:12',
    '密码为 abcdef',
    'ETIMEDOUT',
    '请访问 internal.example.ai',
    'github_pat_11AA22BB33CC44DD55EE66FF77GG88HH99II',
    'ｐａｓｓｗｏｒｄ＝secret',
  ])('不接受控制符、URL、provider、错误、凭证或 PII：%s', (unsafeSummary) => {
    const result = evaluateInstitutionCapabilityStatusV1(
      evaluation({ safeSummary: unsafeSummary }),
    );

    expect(result).toEqual({ ok: false, failureReason: 'unsafe_summary' });
    expect(JSON.stringify(result)).not.toContain(unsafeSummary);
  });

  it('diagnosticTargetKey 只接受公共管理诊断白名单，不接受页面或 URL', () => {
    expect(
      evaluateInstitutionCapabilityStatusV1(
        evaluation({ diagnosticTargetKey: 'page_system_data' }),
      ),
    ).toMatchObject({
      ok: true,
      item: { diagnosticTargetKey: 'page_system_data' },
    });
    expect(
      evaluateInstitutionCapabilityStatusV1(
        evaluation({ diagnosticTargetKey: 'page_system_organization' }),
      ),
    ).toEqual({ ok: false, failureReason: 'invalid_diagnostic_target' });
    expect(
      evaluateInstitutionCapabilityStatusV1(
        evaluation({ diagnosticTargetKey: '/hospital/system/data' }),
      ),
    ).toEqual({ ok: false, failureReason: 'invalid_diagnostic_target' });
  });

  it('action capability 只返回展示投影，不签发 action 权限', () => {
    const result = evaluateInstitutionCapabilityStatusV1(
      evaluation({ key: 'action_customer_create' }),
    );
    expect(result).toMatchObject({ ok: true, item: { decision: 'operational' } });
    if (!result.ok) throw new Error('expected successful evaluation');
    expect(Object.keys(result.item).sort()).toEqual(
      ['key', 'decision', 'dimensions', 'safeSummary', 'diagnosticTargetKey'].sort(),
    );
    expect(result.item).not.toHaveProperty('allowed');
    expect(result.item).not.toHaveProperty('actionAuthorization');
  });

  it('导出的 decision helper 对缺失、非法或夹带字段的五维固定 fail-closed', () => {
    expect(
      deriveInstitutionCapabilityDecisionV1({
        codeMaturity: 'verified',
        institutionAuthorization: 'authorized',
      }),
    ).toBe('hidden');
    expect(
      deriveInstitutionCapabilityDecisionV1({ ...baseDimensions, extra: true }),
    ).toBe('hidden');
  });

  it('拒绝 accessor、Symbol、不可枚举额外字段并阻断二次读取', () => {
    let keyReadCount = 0;
    const accessorInput = {
      get key() {
        keyReadCount += 1;
        return keyReadCount === 1 ? 'page_customer_list' : 'page_unknown';
      },
      dimensions: baseDimensions,
      safeSummary: '当前能力已核验',
      diagnosticTargetKey: null,
    };
    expect(evaluateInstitutionCapabilityStatusV1(accessorInput)).toEqual({
      ok: false,
      failureReason: 'invalid_input',
    });

    const symbolExtra = evaluation();
    Object.defineProperty(symbolExtra, Symbol('extra'), { value: true });
    expect(evaluateInstitutionCapabilityStatusV1(symbolExtra)).toEqual({
      ok: false,
      failureReason: 'invalid_input',
    });

    const hiddenExtra = evaluation();
    Object.defineProperty(hiddenExtra, 'extra', { value: true, enumerable: false });
    expect(evaluateInstitutionCapabilityStatusV1(hiddenExtra)).toEqual({
      ok: false,
      failureReason: 'invalid_input',
    });
  });
});
