import { describe, expect, it } from 'vitest';
import { buildEntitlementUsageView } from '@/modules/institution/domain/entitlement-usage-view';

describe('buildEntitlementUsageView', () => {
  const baseInput = {
    tenantId: 'tenant-001',
    institutionId: 'inst-001',
    planCode: 'growth-care' as const,
    planName: '成长版',
    usages: {
      customers: 50 as number | null,
      staffSeats: 15 as number | null,
      knowledgeFiles: 90 as number | null,
      aiCallsThisMonth: 200 as number | null,
    },
    limits: {
      maxCustomers: 100 as number | null,
      maxStaffSeats: 20 as number | null,
      maxKnowledgeFiles: 100 as number | null,
      maxAiCalls: 500 as number | null,
    },
  };

  // 1. planCode / planName
  it('有 active plan 时返回 planCode 和 planName', () => {
    const view = buildEntitlementUsageView(baseInput);
    expect(view.planCode).toBe('growth-care');
    expect(view.planName).toBe('成长版');
  });

  it('planName 为 null 时不返回 null（fallback 由调用方负责）', () => {
    const view = buildEntitlementUsageView({ ...baseInput, planName: null });
    expect(view.planCode).toBe('growth-care');
    expect(view.planName).toBeNull();
  });

  it('无 active plan 时 planCode 为 null', () => {
    const view = buildEntitlementUsageView({
      ...baseInput,
      planCode: null,
      planName: null,
      usages: { customers: null, staffSeats: null, knowledgeFiles: null, aiCallsThisMonth: null },
      limits: { maxCustomers: null, maxStaffSeats: null, maxKnowledgeFiles: null, maxAiCalls: null },
    });
    expect(view.planCode).toBeNull();
    expect(view.planName).toBeNull();
  });

  // 2. items 结构
  it('返回 4 个 EntitlementUsageItem', () => {
    const view = buildEntitlementUsageView(baseInput);
    expect(view.items).toHaveLength(4);
    expect(view.items.map((i) => i.resource)).toEqual([
      'customers', 'staff_seats', 'knowledge_files', 'ai_calls',
    ]);
  });

  it('每个 item 有 resource / label / used / limit / remaining / status', () => {
    const view = buildEntitlementUsageView(baseInput);
    for (const item of view.items) {
      expect(item).toHaveProperty('resource');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('used');
      expect(item).toHaveProperty('limit');
      expect(item).toHaveProperty('remaining');
      expect(item).toHaveProperty('status');
    }
  });

  // 3. customers
  it('customers used / limit / remaining / status 正确', () => {
    const view = buildEntitlementUsageView(baseInput);
    const customerItem = view.items.find((i) => i.resource === 'customers')!;
    expect(customerItem.used).toBe(50);
    expect(customerItem.limit).toBe(100);
    expect(customerItem.remaining).toBe(50);
    expect(customerItem.status).toBe('normal');
  });

  // 4. staffSeats
  it('staffSeats used / limit / remaining / status 正确', () => {
    const view = buildEntitlementUsageView(baseInput);
    const item = view.items.find((i) => i.resource === 'staff_seats')!;
    expect(item.used).toBe(15);
    expect(item.limit).toBe(20);
    expect(item.remaining).toBe(5);
    expect(item.status).toBe('normal');
  });

  // 5. knowledgeFiles
  it('knowledgeFiles used / limit / remaining / status 正确', () => {
    const input = {
      ...baseInput,
      usages: { ...baseInput.usages, knowledgeFiles: 100 },
    };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'knowledge_files')!;
    expect(item.used).toBe(100);
    expect(item.limit).toBe(100);
    expect(item.remaining).toBe(0);
    expect(item.status).toBe('exceeded');
  });

  // 6. aiCallsThisMonth
  it('aiCallsThisMonth used / limit / remaining / status 正确', () => {
    const input = {
      ...baseInput,
      usages: { ...baseInput.usages, aiCallsThisMonth: 450 },
    };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'ai_calls')!;
    expect(item.used).toBe(450);
    expect(item.limit).toBe(500);
    expect(item.remaining).toBe(50);
    expect(item.status).toBe('near_limit');
  });

  // 7. normal 状态
  it('used < 80% of limit 时状态为 normal', () => {
    const input = {
      ...baseInput,
      usages: { ...baseInput.usages, customers: 79 }, // 79/100 = 79%
    };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.status).toBe('normal');
  });

  // 8. near_limit 状态 (used / limit >= 80%)
  it('used / limit >= 80% 时状态为 near_limit', () => {
    const cases = [
      { used: 80, limit: 100, desc: '80%' }, // exactly 80%
      { used: 99, limit: 100, desc: '99%' }, // close to limit
    ];
    for (const c of cases) {
      const input = { ...baseInput, usages: { ...baseInput.usages, customers: c.used }, limits: { ...baseInput.limits, maxCustomers: c.limit } };
      const view = buildEntitlementUsageView(input);
      const item = view.items.find((i) => i.resource === 'customers')!;
      expect(item.status, `used=${c.used} limit=${c.limit} (${c.desc})`).toBe('near_limit');
    }
  });

  // 9. exceeded 状态 (remaining <= 0)
  it('remaining <= 0 (used >= limit) 时状态为 exceeded', () => {
    const cases = [
      { used: 100, limit: 100, desc: 'exactly at limit' },
      { used: 101, limit: 100, desc: 'over limit' },
    ];
    for (const c of cases) {
      const input = { ...baseInput, usages: { ...baseInput.usages, customers: c.used }, limits: { ...baseInput.limits, maxCustomers: c.limit } };
      const view = buildEntitlementUsageView(input);
      const item = view.items.find((i) => i.resource === 'customers')!;
      expect(item.status, `used=${c.used} limit=${c.limit} (${c.desc})`).toBe('exceeded');
    }
  });

  it('exceeded 时 remaining 归 0 不出现负数', () => {
    const input = { ...baseInput, usages: { ...baseInput.usages, customers: 120 }, limits: { ...baseInput.limits, maxCustomers: 100 } };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.status).toBe('exceeded');
    expect(item.remaining).toBe(0);
  });

  // 10. no_active_plan
  it('无 active plan 时所有 item status 为 no_active_plan', () => {
    const view = buildEntitlementUsageView({
      ...baseInput,
      planCode: null,
      planName: null,
      usages: { customers: null, staffSeats: null, knowledgeFiles: null, aiCallsThisMonth: null },
      limits: { maxCustomers: null, maxStaffSeats: null, maxKnowledgeFiles: null, maxAiCalls: null },
    });
    for (const item of view.items) {
      expect(item.status).toBe('no_active_plan');
    }
    expect(view.readable).toBe(true);
  });

  // 11. not_configured
  it('limit 为 null / undefined 时单个 item status 为 not_configured', () => {
    const input = {
      ...baseInput,
      limits: { ...baseInput.limits, maxCustomers: null as number | null },
    };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.status).toBe('not_configured');
    expect(item.remaining).toBeNull();
  });

  // 12. limit 为 0 时不产生 NaN 不除零
  it('limit 为 0 时 used / limit >= 1 判定为 exceeded 不报 NaN', () => {
    const input = { ...baseInput, usages: { ...baseInput.usages, customers: 1 }, limits: { ...baseInput.limits, maxCustomers: 0 } };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.status).toBe('exceeded');
    expect(item.remaining).toBe(0);
    expect(Number.isNaN(item.remaining!)).toBe(false);
  });

  it('limit=0 used=0 时 remaining=0 status=exceeded', () => {
    const input = { ...baseInput, usages: { ...baseInput.usages, customers: 0 }, limits: { ...baseInput.limits, maxCustomers: 0 } };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.status).toBe('exceeded');
    expect(item.remaining).toBe(0);
  });

  // 13. used 为 null 时
  it('used 为 null 且 limit 有值时 status 为 normal', () => {
    const input = { ...baseInput, usages: { ...baseInput.usages, customers: null } };
    const view = buildEntitlementUsageView(input);
    const item = view.items.find((i) => i.resource === 'customers')!;
    expect(item.used).toBeNull();
    expect(item.status).toBe('normal');
    expect(item.remaining).toBeNull();
  });

  // 14. source 字段
  it('source 返回 mixed', () => {
    const view = buildEntitlementUsageView(baseInput);
    expect(view.source).toBe('mixed');
  });

  it('readable 恒为 true', () => {
    const view = buildEntitlementUsageView(baseInput);
    expect(view.readable).toBe(true);
  });

  // 15. tenantId / institutionId
  it('tenantId 和 institutionId 透传正确', () => {
    const view = buildEntitlementUsageView({
      ...baseInput,
      tenantId: 't-abc',
      institutionId: 'inst-xyz',
    });
    expect(view.tenantId).toBe('t-abc');
    expect(view.institutionId).toBe('inst-xyz');
  });

  it('institutionId 为 undefined 时返回 null', () => {
    const view = buildEntitlementUsageView({
      ...baseInput,
      institutionId: undefined,
    });
    expect(view.institutionId).toBeNull();
  });

  // 16. Chinese label
  it('label 返回中文', () => {
    const view = buildEntitlementUsageView(baseInput);
    const labels = view.items.map((i) => i.label);
    expect(labels).toEqual(['客户数', '员工席位', '知识库文件', 'AI 调用（本月）']);
  });
});
