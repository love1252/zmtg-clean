import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT,
  MAX_TREATMENT_SUMMARY_QUERY_LIMIT,
  decodeTreatmentSummaryCursor,
  encodeTreatmentSummaryCursor,
  parseTreatmentSummaryQueryParams,
} from '@/modules/institution/server/treatment-summary-query-parser';

function params(input: Record<string, string>) {
  return new URLSearchParams(input);
}

function expectParseError(input: Record<string, string>, message: string) {
  const result = parseTreatmentSummaryQueryParams(params(input));

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain(message);
  }
}

describe('治疗摘要列表查询参数 parser', () => {
  it('空参数返回默认查询对象', () => {
    expect(parseTreatmentSummaryQueryParams(params({}))).toEqual({
      ok: true,
      query: {
        filters: {},
        limit: DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT,
      },
    });
  });

  it('只接受白名单字段并解析完整查询条件', () => {
    const cursor = encodeTreatmentSummaryCursor({
      id: 'trt_001',
      treatmentDate: '2026-05-31T09:00:00.000Z',
    });

    const result = parseTreatmentSummaryQueryParams(
      params({
        customerId: 'cust_qin_review',
        treatmentProject: ' 玻尿酸复诊 ',
        riskLevel: 'watch',
        from: '2026-05-30T08:00:00+08:00',
        to: '2026-06-01T18:00:00+08:00',
        limit: '25',
        cursor,
      }),
    );

    expect(result).toEqual({
      ok: true,
      query: {
        filters: {
          customerId: 'cust_qin_review',
          treatmentProject: '玻尿酸复诊',
          riskLevel: 'watch',
          from: '2026-05-30T00:00:00.000Z',
          to: '2026-06-01T10:00:00.000Z',
        },
        limit: 25,
        cursor: {
          id: 'trt_001',
          treatmentDate: '2026-05-31T09:00:00.000Z',
        },
      },
    });
    expect(decodeTreatmentSummaryCursor(cursor)).toEqual({
      ok: true,
      cursor: {
        id: 'trt_001',
        treatmentDate: '2026-05-31T09:00:00.000Z',
      },
    });
  });

  it('拒绝 tenantId 和未知字段，避免前端切换租户或注入任意 SQL 参数', () => {
    expectParseError({ tenantId: 'other-tenant' }, '不支持的筛选参数: tenantId');
    expectParseError({ orderBy: 'treatment_date desc' }, '不支持的筛选参数: orderBy');
    expectParseError({ sql: 'select * from treatment_summaries' }, '不支持的筛选参数: sql');
  });

  it('拒绝重复筛选参数，保持查询语义单一', () => {
    const duplicate = new URLSearchParams();
    duplicate.append('riskLevel', 'watch');
    duplicate.append('riskLevel', 'urgent');

    const result = parseTreatmentSummaryQueryParams(duplicate);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('riskLevel 只能出现一次');
    }
  });

  it('使用默认 limit，允许最大 limit，并拒绝非法 limit', () => {
    expect(parseTreatmentSummaryQueryParams(params({ limit: String(MAX_TREATMENT_SUMMARY_QUERY_LIMIT) }))).toEqual({
      ok: true,
      query: {
        filters: {},
        limit: MAX_TREATMENT_SUMMARY_QUERY_LIMIT,
      },
    });

    expectParseError({ limit: '0' }, 'limit 必须在 1 到 100 之间');
    expectParseError({ limit: '101' }, 'limit 必须在 1 到 100 之间');
    expectParseError({ limit: '1.5' }, 'limit 必须是整数');
    expectParseError({ limit: 'abc' }, 'limit 必须是整数');
  });

  it('稳定校验 customerId、riskLevel、日期范围和 cursor', () => {
    expectParseError({ customerId: 'cust 001' }, 'customerId 格式不正确');
    expectParseError({ riskLevel: 'critical' }, 'riskLevel 不在允许范围内');
    expectParseError({ from: 'not-a-date' }, 'from 必须是有效时间');
    expectParseError({ to: 'not-a-date' }, 'to 必须是有效时间');
    expectParseError(
      {
        from: '2026-06-02T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      },
      'from 不能晚于 to',
    );
    expectParseError({ cursor: 'not-a-valid-cursor' }, 'cursor 格式不正确');
  });

  it('拒绝 treatmentProject 中夹带敏感内容', () => {
    for (const value of ['DATABASE_URL=postgres://example', 'postgres://tenant', 'token value', 'secret value']) {
      expectParseError({ treatmentProject: value }, 'treatmentProject 不允许包含敏感信息');
    }
  });
});
