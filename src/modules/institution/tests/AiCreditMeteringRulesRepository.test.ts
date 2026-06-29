import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAiCreditMeteringRulesRepository,
  mapPlatformAiCreditMeteringRuleRowToDomainRule,
  selectCurrentAiCreditMeteringRule,
} from '@/modules/institution/server/ai-credit-metering-rules-repository';
import type { TenantDatabase } from '@/server/db/client';
import { platformAiCreditMeteringRules } from '@/server/db/schema';

const andMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ operator: 'and', conditions })));
const descMock = vi.hoisted(() => vi.fn((column: unknown) => ({ column, direction: 'desc' })));
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);
const gtMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'gt', value })),
);
const isNullMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({ column, operator: 'isNull' })),
);
const lteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'lte', value })),
);
const orMock = vi.hoisted(() => vi.fn((...conditions: unknown[]) => ({ operator: 'or', conditions })));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    desc: descMock,
    eq: eqMock,
    gt: gtMock,
    isNull: isNullMock,
    lte: lteMock,
    or: orMock,
  };
});

type MeteringRuleRow = typeof platformAiCreditMeteringRules.$inferSelect;

const now = new Date('2026-06-29T10:00:00.000Z');

function createRuleRow(overrides: Partial<MeteringRuleRow> = {}): MeteringRuleRow {
  return {
    id: 'rule_current',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    meteringVersion: 'ai-credits-v0.6-20260629',
    inputTokenWeight: '1.250000',
    outputTokenWeight: '4.500000',
    modelMultiplier: '1.750000',
    ragCreditSurcharge: 2,
    creditsPerStandardTokenUnit: 1000,
    enabled: true,
    effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-07-01T00:00:00.000Z'),
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createSelectDatabase(rows: unknown[] = []) {
  const limit = vi.fn(async (_count: number) => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    limit,
    orderBy,
    select,
    where,
  };
}

beforeEach(() => {
  andMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
  gtMock.mockClear();
  isNullMock.mockClear();
  lteMock.mockClear();
  orMock.mockClear();
});

describe('AI credits metering rule lookup repository', () => {
  it('能查询 provider/model 当前 enabled 生效规则并映射为 domain rule', async () => {
    const row = createRuleRow();
    const query = createSelectDatabase([row]);

    const result = await createAiCreditMeteringRulesRepository(query.database)
      .findCurrentRuleForProviderModel({ provider: 'anthropic', model: 'claude-sonnet-4-6', at: now });

    expect(query.from).toHaveBeenCalledWith(platformAiCreditMeteringRules);
    expect(eqMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.provider, 'anthropic');
    expect(eqMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.model, 'claude-sonnet-4-6');
    expect(eqMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.enabled, true);
    expect(lteMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.effectiveFrom, now);
    expect(isNullMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.effectiveTo);
    expect(gtMock).toHaveBeenCalledWith(platformAiCreditMeteringRules.effectiveTo, now);
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: platformAiCreditMeteringRules.effectiveFrom, direction: 'desc' },
      { column: platformAiCreditMeteringRules.createdAt, direction: 'desc' },
    );
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      status: 'found',
      rule: {
        enabled: true,
        meteringVersion: 'ai-credits-v0.6-20260629',
        inputTokenWeight: 1.25,
        outputTokenWeight: 4.5,
        modelMultiplier: 1.75,
        creditsPerStandardTokenUnit: 1000,
        ragCreditSurcharge: 2,
      },
      selectedRule: {
        id: 'rule_current',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        meteringVersion: 'ai-credits-v0.6-20260629',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    });
  });

  it('disabled 规则不被选中', () => {
    const result = selectCurrentAiCreditMeteringRule({
      rows: [createRuleRow({ enabled: false })],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result).toEqual({ status: 'no_rule', reason: 'missing_metering_rule', rule: null });
  });

  it('未到 effective_from 的规则不被选中', () => {
    const result = selectCurrentAiCreditMeteringRule({
      rows: [createRuleRow({ effectiveFrom: new Date('2026-06-30T00:00:00.000Z') })],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result.status).toBe('no_rule');
  });

  it('已过 effective_to 的规则不被选中', () => {
    const result = selectCurrentAiCreditMeteringRule({
      rows: [createRuleRow({ effectiveTo: new Date('2026-06-29T10:00:00.000Z') })],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result.status).toBe('no_rule');
  });

  it('effective_to 为 null 时视为长期有效', () => {
    const result = selectCurrentAiCreditMeteringRule({
      rows: [createRuleRow({ effectiveTo: null })],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result.status).toBe('found');
    expect(result.rule?.meteringVersion).toBe('ai-credits-v0.6-20260629');
  });

  it('多个有效规则时选择最新 effective_from，仍并列再选择最新 created_at', () => {
    const older = createRuleRow({
      id: 'rule_older',
      meteringVersion: 'older',
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    const newerEffectiveFrom = createRuleRow({
      id: 'rule_newer_effective_from',
      meteringVersion: 'newer-effective-from',
      effectiveFrom: new Date('2026-06-15T00:00:00.000Z'),
      createdAt: new Date('2026-06-15T00:00:00.000Z'),
    });
    const newestCreatedAtTieBreaker = createRuleRow({
      id: 'rule_newest_created_at',
      meteringVersion: 'newest-created-at',
      effectiveFrom: new Date('2026-06-15T00:00:00.000Z'),
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    });

    const result = selectCurrentAiCreditMeteringRule({
      rows: [older, newerEffectiveFrom, newestCreatedAtTieBreaker],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result.status).toBe('found');
    expect(result.rule?.meteringVersion).toBe('newest-created-at');
  });

  it('provider/model 不匹配时返回空结果', () => {
    const result = selectCurrentAiCreditMeteringRule({
      rows: [
        createRuleRow({ provider: 'openai', model: 'claude-sonnet-4-6' }),
        createRuleRow({ provider: 'anthropic', model: 'claude-opus-4-8' }),
      ],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });

    expect(result).toEqual({ status: 'no_rule', reason: 'missing_metering_rule', rule: null });
  });

  it('DB row 映射到计量 domain rule 字段正确', () => {
    expect(mapPlatformAiCreditMeteringRuleRowToDomainRule(createRuleRow())).toEqual({
      enabled: true,
      meteringVersion: 'ai-credits-v0.6-20260629',
      inputTokenWeight: 1.25,
      outputTokenWeight: 4.5,
      modelMultiplier: 1.75,
      creditsPerStandardTokenUnit: 1000,
      ragCreditSurcharge: 2,
    });
  });

  it('输出不包含 apiKey / encryptedApiKey / baseUrl / Authorization / prompt / answer / rawResponse', () => {
    const poisonedRow = {
      ...createRuleRow({ effectiveTo: null }),
      apiKey: 'sk-test-should-not-leak',
      encryptedApiKey: 'encrypted-api-key-should-not-leak',
      baseUrl: 'https://provider.example.test',
      Authorization: 'Bearer secret-token',
      prompt: '用户原始问题',
      answer: 'AI 原始回答',
      rawResponse: { choices: [{ message: { content: 'raw answer' } }] },
    } as unknown as MeteringRuleRow;

    const result = selectCurrentAiCreditMeteringRule({
      rows: [poisonedRow],
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      at: now,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('sk-test-should-not-leak');
    expect(serialized).not.toContain('encryptedApiKey');
    expect(serialized).not.toContain('encrypted-api-key-should-not-leak');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('provider.example.test');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('用户原始问题');
    expect(serialized).not.toContain('answer');
    expect(serialized).not.toContain('AI 原始回答');
    expect(serialized).not.toContain('rawResponse');
  });

  it('未修改 quota enforcement、schema 和 migration', () => {
    const changedFiles = execFileSync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3));

    expect(changedFiles).not.toContain('src/modules/institution/domain/quota-enforcement.ts');
    expect(changedFiles).not.toContain('src/server/db/schema.ts');
    expect(changedFiles.some((file) => file.includes('/migrations/') || file.includes('drizzle/'))).toBe(
      false,
    );
  });
});
