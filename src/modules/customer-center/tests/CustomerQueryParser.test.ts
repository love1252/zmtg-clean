import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_LIFECYCLES,
  CUSTOMER_PRIORITIES,
  CUSTOMER_QUERY_DIRECTIONS,
  CUSTOMER_QUERY_PARAM_KEYS,
  CUSTOMER_SEARCH_FIELDS,
  parseCustomerQuery,
  parseCustomerSearchIntent,
  type CustomerQuery,
  type CustomerQueryParamKey,
  type CustomerQueryPolicy,
} from '@/modules/customer-center/domain/customer-query';

type TestSort = 'policy_sort_primary' | 'policy_sort_secondary';

const policy: CustomerQueryPolicy<TestSort> = {
  allowedOwnerIds: new Set(['owner_alpha']),
  allowedProjectIds: new Set(['project_alpha']),
  allowedTags: new Set(['tag_followup']),
  allowedSorts: new Set<TestSort>(['policy_sort_primary', 'policy_sort_secondary']),
  defaultSort: 'policy_sort_primary',
  defaultDirection: 'desc',
  defaultPage: 2,
  maxPage: 7,
};

const safeDefaultQuery: CustomerQuery<TestSort> = {
  lifecycle: null,
  priority: null,
  ownerId: null,
  projectId: null,
  tag: null,
  lastTouchedFrom: null,
  lastTouchedTo: null,
  sort: 'policy_sort_primary',
  direction: 'desc',
  page: 2,
};

function params(input: Record<string, string>) {
  return new URLSearchParams(input);
}

function expectSafeDefault(searchParams: URLSearchParams) {
  expect(parseCustomerQuery(searchParams, policy)).toEqual({
    source: 'safe_default',
    code: 'invalid_customer_query',
    query: safeDefaultQuery,
  });
}

describe('客户中心结构化查询 parser', () => {
  it('锁定十个 URL 白名单键，并从调用者策略取得安全默认', () => {
    expect(CUSTOMER_QUERY_PARAM_KEYS).toEqual([
      'lifecycle',
      'priority',
      'ownerId',
      'projectId',
      'tag',
      'lastTouchedFrom',
      'lastTouchedTo',
      'sort',
      'direction',
      'page',
    ]);
    for (const stableValues of [
      CUSTOMER_QUERY_PARAM_KEYS,
      CUSTOMER_LIFECYCLES,
      CUSTOMER_PRIORITIES,
      CUSTOMER_QUERY_DIRECTIONS,
      CUSTOMER_SEARCH_FIELDS,
    ]) {
      expect(Object.isFrozen(stableValues)).toBe(true);
    }
    expect(parseCustomerQuery(params({}), policy)).toEqual({
      source: 'parsed',
      code: null,
      query: safeDefaultQuery,
    });

    const alternatePolicy: CustomerQueryPolicy<TestSort> = {
      ...policy,
      defaultSort: 'policy_sort_secondary',
      defaultDirection: 'asc',
      defaultPage: 5,
    };
    expect(parseCustomerQuery(params({}), alternatePolicy)).toMatchObject({
      source: 'parsed',
      query: {
        sort: 'policy_sort_secondary',
        direction: 'asc',
        page: 5,
      },
    });
  });

  it('解析全部白名单字段，且 URL DTO 不包含自由关键词', () => {
    const result = parseCustomerQuery(
      params({
        lifecycle: 'post_care',
        priority: 'watch',
        ownerId: 'owner_alpha',
        projectId: 'project_alpha',
        tag: 'tag_followup',
        lastTouchedFrom: '2026-07-01',
        lastTouchedTo: '2026-07-17',
        sort: 'policy_sort_secondary',
        direction: 'asc',
        page: '7',
      }),
      policy,
    );

    expect(result).toEqual({
      source: 'parsed',
      code: null,
      query: {
        lifecycle: 'post_care',
        priority: 'watch',
        ownerId: 'owner_alpha',
        projectId: 'project_alpha',
        tag: 'tag_followup',
        lastTouchedFrom: '2026-07-01',
        lastTouchedTo: '2026-07-17',
        sort: 'policy_sort_secondary',
        direction: 'asc',
        page: 7,
      },
    });
    expect(Object.keys(result.query).sort()).toEqual([...CUSTOMER_QUERY_PARAM_KEYS].sort());
  });

  it('接受五种 lifecycle、三种 priority，并拒绝 legacy observe', () => {
    for (const lifecycle of CUSTOMER_LIFECYCLES) {
      expect(parseCustomerQuery(params({ lifecycle }), policy)).toMatchObject({
        source: 'parsed',
        query: { lifecycle },
      });
    }

    for (const priority of CUSTOMER_PRIORITIES) {
      expect(parseCustomerQuery(params({ priority }), policy)).toMatchObject({
        source: 'parsed',
        query: { priority },
      });
    }

    expectSafeDefault(params({ priority: 'observe' }));
    expectSafeDefault(params({ lifecycle: 'legacy_stage' }));
  });

  it('只接受策略批准的 owner、project、tag、sort 和 asc/desc', () => {
    expect(parseCustomerQuery(params({ ownerId: 'owner_alpha' }), policy).source).toBe('parsed');
    expect(parseCustomerQuery(params({ projectId: 'project_alpha' }), policy).source).toBe(
      'parsed',
    );
    expect(parseCustomerQuery(params({ tag: 'tag_followup' }), policy).source).toBe('parsed');
    expect(
      parseCustomerQuery(params({ sort: 'policy_sort_secondary', direction: 'asc' }), policy)
        .source,
    ).toBe('parsed');

    expectSafeDefault(params({ ownerId: 'owner_unapproved' }));
    expectSafeDefault(params({ projectId: 'project_unapproved' }));
    expectSafeDefault(params({ tag: 'tag_unapproved' }));
    expectSafeDefault(params({ sort: 'policy_sort_unapproved' }));
    expectSafeDefault(params({ direction: 'sideways' }));
  });

  it('严格校验日历日期、相等边界和正向范围', () => {
    expect(
      parseCustomerQuery(
        params({ lastTouchedFrom: '2026-07-17', lastTouchedTo: '2026-07-17' }),
        policy,
      ).source,
    ).toBe('parsed');

    const invalidDateQueries: Array<Record<string, string>> = [
      { lastTouchedFrom: 'not-a-date' },
      { lastTouchedTo: '2026-02-30' },
      { lastTouchedFrom: '2023-02-29' },
      { lastTouchedFrom: '2026-7-01' },
      { lastTouchedFrom: '2026-07-01T00:00:00Z' },
      { lastTouchedFrom: ' 2026-07-01' },
      { lastTouchedFrom: '2026-07-18', lastTouchedTo: '2026-07-17' },
      { lastTouchedFrom: '' },
    ];
    for (const input of invalidDateQueries) {
      expectSafeDefault(params(input));
    }
    expect(parseCustomerQuery(params({ lastTouchedFrom: '2024-02-29' }), policy).source).toBe(
      'parsed',
    );
  });

  it('只接受 1 到 maxPage 的十进制安全整数页码', () => {
    expect(parseCustomerQuery(params({ page: '1' }), policy)).toMatchObject({
      source: 'parsed',
      query: { page: 1 },
    });
    expect(parseCustomerQuery(params({ page: '7' }), policy)).toMatchObject({
      source: 'parsed',
      query: { page: 7 },
    });

    for (const page of ['0', '-1', '1.5', '1e2', '8', String(Number.MAX_SAFE_INTEGER + 1), '']) {
      expectSafeDefault(params({ page }));
    }
  });

  it('未知键、自由关键词键和十个白名单键的重复实例均整体回退', () => {
    expectSafeDefault(params({ tenantId: 'scope_placeholder' }));
    expectSafeDefault(params({ q: '客户甲' }));
    expectSafeDefault(params({ keyword: '客户甲' }));
    expectSafeDefault(params({ search: '客户甲' }));

    const validValues: Record<CustomerQueryParamKey, string> = {
      lifecycle: 'consulting',
      priority: 'high',
      ownerId: 'owner_alpha',
      projectId: 'project_alpha',
      tag: 'tag_followup',
      lastTouchedFrom: '2026-07-01',
      lastTouchedTo: '2026-07-17',
      sort: 'policy_sort_primary',
      direction: 'desc',
      page: '2',
    };

    for (const key of CUSTOMER_QUERY_PARAM_KEYS) {
      const duplicate = new URLSearchParams();
      duplicate.append(key, validValues[key]);
      duplicate.append(key, validValues[key]);
      expectSafeDefault(duplicate);
    }
  });

  it('任一非法字段使完整查询回退，固定结果不回显原始输入', () => {
    const rejectedMarker = 'rejected_query_marker';
    const result = parseCustomerQuery(
      params({ lifecycle: 'scheduled', priority: rejectedMarker }),
      policy,
    );

    expect(result).toEqual({
      source: 'safe_default',
      code: 'invalid_customer_query',
      query: safeDefaultQuery,
    });
    expect(JSON.stringify(result)).not.toContain(rejectedMarker);
    expect(result.query.lifecycle).toBeNull();
  });

  it('保持 URLSearchParams 与策略集合不变，并对相同输入给出确定结果', () => {
    const searchParams = params({ lifecycle: 'consulting', page: '3' });
    const paramsBefore = searchParams.toString();
    const policyBefore = {
      owners: [...policy.allowedOwnerIds],
      projects: [...policy.allowedProjectIds],
      tags: [...policy.allowedTags],
      sorts: [...policy.allowedSorts],
    };

    const first = parseCustomerQuery(searchParams, policy);
    const second = parseCustomerQuery(searchParams, policy);

    expect(first).toEqual(second);
    expect(searchParams.toString()).toBe(paramsBefore);
    expect({
      owners: [...policy.allowedOwnerIds],
      projects: [...policy.allowedProjectIds],
      tags: [...policy.allowedTags],
      sorts: [...policy.allowedSorts],
    }).toEqual(policyBefore);
  });
});

describe('客户中心低敏自由搜索意图', () => {
  it('自由关键词独立解析，且只能表达 displayName/maskedReference 搜索', () => {
    expect(CUSTOMER_SEARCH_FIELDS).toEqual(['displayName', 'maskedReference']);
    expect(parseCustomerSearchIntent('  客户甲  ')).toEqual({
      ok: true,
      intent: {
        keyword: '客户甲',
        fields: ['displayName', 'maskedReference'],
      },
    });
    expect(parseCustomerSearchIntent('档案****0421')).toEqual({
      ok: true,
      intent: {
        keyword: '档案****0421',
        fields: ['displayName', 'maskedReference'],
      },
    });
    expect(parseCustomerSearchIntent('   ')).toEqual({ ok: true, intent: null });
  });

  it('敏感模式统一返回固定低敏拒绝码且不回显输入', () => {
    const phonePattern = ['138', '0000', '0000'].join('');
    const identityPattern = `${'0'.repeat(17)}X`;
    const separatedIdentityPattern = `${'0'.repeat(17)}-X`;
    const emailPattern = ['user', 'example.invalid'].join('@');
    const externalAccountPattern = ['wxid', 'placeholder'].join('_');
    const tokenPattern = ['eyJhbGciOiJub25lIn0', 'eyJzdWIiOiJ4In0', ''].join('.');
    const archiveReferencePattern = `档案${'0'.repeat(8)}`;
    const archiveNumberPattern = `档案编号${'0'.repeat(8)}`;
    const medicalRecordPattern = `病历号MRN-${'0'.repeat(8)}`;
    const uuidPattern = ['018f47a2', '4c3d', '7b1a', '8c2d', '0'.repeat(12)].join('-');
    const objectIdPattern = 'a'.repeat(24);
    const ulidPattern = `01${'A'.repeat(24)}`;
    const lowercaseUlidPattern = `01${'a'.repeat(24)}`;
    const rejectedInputs = [
      phonePattern,
      '0'.repeat(15),
      identityPattern,
      separatedIdentityPattern,
      emailPattern,
      'https://example.invalid/customer',
      'example.invalid/customer',
      '//example.invalid/customer',
      'file:///tmp/customer',
      'ssh://example.invalid/customer',
      'sqlite:///tmp/customer.db',
      'postgres://example.invalid/database',
      'host=example.invalid dbname=demo user=reader password=placeholder',
      'token placeholder',
      'api_key placeholder',
      'sk-proj-placeholder',
      'external_id placeholder',
      'external_id_opaque',
      'openid_opaque',
      externalAccountPattern,
      tokenPattern,
      archiveReferencePattern,
      archiveNumberPattern,
      medicalRecordPattern,
      uuidPattern,
      objectIdPattern,
      ulidPattern,
      lowercaseUlidPattern,
      '客户\u0000甲',
    ];

    for (const input of rejectedInputs) {
      const result = parseCustomerSearchIntent(input);
      expect(result).toEqual({ ok: false, code: 'sensitive_customer_search' });
      expect(JSON.stringify(result)).not.toContain(input);
    }
  });
});
