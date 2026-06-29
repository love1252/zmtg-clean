import { describe, expect, it, vi } from 'vitest';

import {
  createPlatformAiCreditMeteringRule,
  listPlatformAiCreditMeteringRules,
  mapPlatformAiCreditMeteringRuleToDto,
  patchPlatformAiCreditMeteringRule,
  type PlatformAiCreditMeteringRulesRepository,
} from '@/modules/open-platform/server/ai-credit-metering-rules-management';

const baseRow = {
  id: 'rule-001',
  provider: 'deepseek',
  model: 'deepseek-chat',
  meteringVersion: 'ai-credits-v0.6-test',
  inputTokenWeight: '1.000000',
  outputTokenWeight: '3.000000',
  modelMultiplier: '2.000000',
  ragCreditSurcharge: 1,
  creditsPerStandardTokenUnit: 100,
  enabled: true,
  effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
  effectiveTo: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

const baseDto = mapPlatformAiCreditMeteringRuleToDto(baseRow);

function createRepository(overrides: Partial<PlatformAiCreditMeteringRulesRepository> = {}) {
  return {
    listRules: vi.fn(async () => [baseDto]),
    findRuleById: vi.fn(async () => baseRow),
    insertRule: vi.fn(async () => baseDto),
    updateRule: vi.fn(async () => baseDto),
    ...overrides,
  } satisfies PlatformAiCreditMeteringRulesRepository;
}

function validCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'deepseek',
    model: 'deepseek-chat',
    meteringVersion: 'ai-credits-v0.6-test',
    inputTokenWeight: 1,
    outputTokenWeight: 3,
    modelMultiplier: 2,
    ragCreditSurcharge: 1,
    creditsPerStandardTokenUnit: 100,
    enabled: true,
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    effectiveTo: null,
    ...overrides,
  };
}

describe('平台端 AI credits metering rules management service', () => {
  it('平台端可 list rules 且返回低敏字段', async () => {
    const repository = createRepository();

    const result = await listPlatformAiCreditMeteringRules({
      repository,
      filters: { provider: 'deepseek', model: 'deepseek-chat', enabled: true },
    });

    expect(repository.listRules).toHaveBeenCalledWith({
      provider: 'deepseek',
      model: 'deepseek-chat',
      enabled: true,
    });
    expect(result.records).toEqual([baseDto]);
    expect(JSON.stringify(result)).not.toMatch(
      /apiKey|encryptedApiKey|baseUrl|Authorization|prompt|question|answer|rawResponse|signedUrl|storageKey/i,
    );
  });

  it('平台端可 create rule', async () => {
    const repository = createRepository();

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload(),
      now: new Date('2026-06-29T00:00:00.000Z'),
    });

    expect(result.status).toBe('created');
    expect(repository.insertRule).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'deepseek',
      model: 'deepseek-chat',
      meteringVersion: 'ai-credits-v0.6-test',
      inputTokenWeight: '1.000000',
      outputTokenWeight: '3.000000',
      modelMultiplier: '2.000000',
      ragCreditSurcharge: 1,
      creditsPerStandardTokenUnit: 100,
      enabled: true,
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
      effectiveTo: null,
    }));
  });

  it('平台端可 patch enabled', async () => {
    const repository = createRepository();

    const result = await patchPlatformAiCreditMeteringRule({
      repository,
      id: 'rule-001',
      payload: { enabled: false },
      now: new Date('2026-06-29T00:00:00.000Z'),
    });

    expect(result.status).toBe('updated');
    expect(repository.updateRule).toHaveBeenCalledWith('rule-001', expect.objectContaining({
      enabled: false,
      updatedAt: new Date('2026-06-29T00:00:00.000Z'),
    }));
  });

  it('平台端可 patch effectiveFrom / effectiveTo', async () => {
    const repository = createRepository();

    const result = await patchPlatformAiCreditMeteringRule({
      repository,
      id: 'rule-001',
      payload: {
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveTo: '2026-08-01T00:00:00.000Z',
      },
    });

    expect(result.status).toBe('updated');
    expect(repository.updateRule).toHaveBeenCalledWith('rule-001', expect.objectContaining({
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-08-01T00:00:00.000Z'),
    }));
  });

  it.each([
    ['provider', { provider: '' }],
    ['model', { model: '' }],
    ['meteringVersion', { meteringVersion: '' }],
  ])('缺 %s 被拒绝', async (_field, override) => {
    const repository = createRepository();

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload(override),
    });

    expect(result.status).toBe('validation_failed');
    expect(repository.insertRule).not.toHaveBeenCalled();
  });

  it.each([
    ['inputTokenWeight', { inputTokenWeight: 0 }],
    ['outputTokenWeight', { outputTokenWeight: -1 }],
    ['modelMultiplier', { modelMultiplier: 0 }],
    ['creditsPerStandardTokenUnit', { creditsPerStandardTokenUnit: 0 }],
    ['ragCreditSurcharge', { ragCreditSurcharge: -1 }],
  ])('非法权重 / 单位 %s 被拒绝', async (_field, override) => {
    const repository = createRepository();

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload(override),
    });

    expect(result.status).toBe('validation_failed');
    expect(repository.insertRule).not.toHaveBeenCalled();
  });

  it('effectiveTo <= effectiveFrom 被拒绝', async () => {
    const repository = createRepository();

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload({ effectiveTo: '2026-06-01T00:00:00.000Z' }),
    });

    expect(result.status).toBe('validation_failed');
    expect(repository.insertRule).not.toHaveBeenCalled();
  });

  it('provider + model + meteringVersion 唯一冲突返回受控错误', async () => {
    const repository = createRepository({
      insertRule: vi.fn(async () => {
        throw { code: '23505' };
      }),
    });

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload(),
    });

    expect(result).toEqual({
      status: 'conflict',
      errorCode: 'METERING_RULE_VERSION_CONFLICT',
    });
  });

  it('不接受 apiKey/baseUrl/Authorization 等敏感字段', async () => {
    const repository = createRepository();

    const result = await createPlatformAiCreditMeteringRule({
      repository,
      payload: validCreatePayload({
        apiKey: 'sk-test-should-not-appear',
        baseUrl: 'https://provider.example.test',
        Authorization: 'Bearer secret',
        rawResponse: { unsafe: true },
      }),
    });

    expect(result.status).toBe('validation_failed');
    expect(JSON.stringify(result)).not.toContain('sk-test-should-not-appear');
    expect(repository.insertRule).not.toHaveBeenCalled();
  });
});
