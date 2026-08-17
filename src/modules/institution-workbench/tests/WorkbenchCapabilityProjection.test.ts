import { describe, expect, it } from 'vitest';

import {
  type CapabilityStatusDimensionsV1,
  type CapabilityStatusItemV1,
  type CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import type {
  InstitutionCapabilityKeyV1,
  InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import { buildWorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-projection';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const currentFreshness = {
  observedAt: '2026-07-18T01:00:00.000Z',
  freshUntil: '2026-07-18T01:05:00.000Z',
};

const referenceTime = '2026-07-18T01:02:00.000Z';

const defaultDimensions: CapabilityStatusDimensionsV1 = {
  codeMaturity: 'verified',
  institutionAuthorization: 'authorized',
  connectionAvailability: 'available',
  dataReadiness: 'ready',
  productionRelease: 'released',
};

type CapabilityEntry = {
  key: InstitutionCapabilityKeyV1;
  decision?: CapabilityStatusItemV1['decision'];
  dimensions?: CapabilityStatusDimensionsV1;
  safeSummary?: string | null;
  diagnosticTargetKey?: InstitutionDiagnosticTargetCapabilityKeyV1 | null;
  partitionReadiness?: CapabilityStatusV1['partitions'][number]['readiness'];
  partitionFreshness?: CapabilityStatusV1['partitions'][number]['freshness'];
  partitionFailureCode?: CapabilityStatusV1['partitions'][number]['failureCode'];
  includeInData?: boolean;
};

type CapabilitySourceOptions = {
  readiness?: CapabilityStatusV1['readiness'];
  freshness?: CapabilityStatusV1['freshness'];
  failureCode?: CapabilityStatusV1['failureCode'];
  data?: CapabilityStatusV1['data'];
};

function capabilitySource(
  entries: readonly CapabilityEntry[],
  options: CapabilitySourceOptions = {},
): CapabilityStatusV1 {
  return {
    contractVersion: 'v1',
    scope: { ...scope },
    readiness: options.readiness ?? 'ready',
    freshness: options.freshness === undefined ? currentFreshness : options.freshness,
    partitions: entries.map((entry) => ({
      key: entry.key,
      readiness: entry.partitionReadiness ?? 'ready',
      freshness:
        entry.partitionFreshness === undefined
          ? currentFreshness
          : entry.partitionFreshness,
      failureCode: entry.partitionFailureCode ?? null,
    })),
    data:
      options.data === undefined
        ? {
            capabilities: entries.flatMap((entry) =>
              entry.includeInData === false
                ? []
                : [
                    {
                      key: entry.key,
                      decision: entry.decision ?? 'read_only',
                      dimensions: entry.dimensions ?? { ...defaultDimensions },
                      safeSummary: entry.safeSummary ?? null,
                      diagnosticTargetKey: entry.diagnosticTargetKey ?? null,
                    },
                  ],
            ),
          }
        : options.data,
    failureCode: options.failureCode ?? null,
  };
}

function blockedProjection() {
  return {
    status: 'blocked',
    summaries: [],
    quickCreateMenu: null,
  };
}

describe('WorkbenchCapabilityProjection', () => {
  it('uses registry display order, labels, diagnostics, and the three fixed create links', () => {
    const source = capabilitySource([
      {
        key: 'page_system_data',
        decision: 'read_only',
        safeSummary: '数据接入与治理部分可用',
        diagnosticTargetKey: 'page_system_data',
      },
      {
        key: 'action_care_followup_create',
        decision: 'operational',
      },
      {
        key: 'page_customer_list',
        decision: 'hidden',
        safeSummary: '客户列表不可用',
      },
      {
        key: 'action_customer_create',
        decision: 'operational',
      },
      {
        key: 'page_workbench',
        decision: 'operational',
        safeSummary: '工作台业务可用',
      },
      {
        key: 'action_care_appointment_create',
        decision: 'operational',
      },
      {
        key: 'page_care_followups',
        decision: 'read_only',
        safeSummary: '随访任务仅供查看',
      },
    ]);

    const result = buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime });

    expect(result).toEqual({
      status: 'projected',
      sourceReadiness: 'ready',
      summaries: [
        {
          key: 'page_workbench',
          kind: 'page',
          label: '工作台',
          decision: 'operational',
          safeSummary: '工作台业务可用',
          dataStatus: 'current',
          observedAt: null,
          diagnosticTarget: null,
        },
        {
          key: 'page_care_followups',
          kind: 'page',
          label: '随访任务',
          decision: 'read_only',
          safeSummary: '随访任务仅供查看',
          dataStatus: 'current',
          observedAt: null,
          diagnosticTarget: null,
        },
        {
          key: 'page_system_data',
          kind: 'page',
          label: '数据接入与治理',
          decision: 'read_only',
          safeSummary: '数据接入与治理部分可用',
          dataStatus: 'current',
          observedAt: null,
          diagnosticTarget: {
            key: 'page_system_data',
            label: '数据接入与治理',
            href: '/hospital/system/data',
          },
        },
      ],
      quickCreateMenu: {
        label: '新建',
        items: [
          {
            key: 'action_customer_create',
            label: '新建客户',
            href: '/hospital/customers?create=1',
          },
          {
            key: 'action_care_appointment_create',
            label: '新建预约',
            href: '/hospital/care/appointments?create=1',
          },
          {
            key: 'action_care_followup_create',
            label: '新建随访',
            href: '/hospital/care/followups?create=1',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('客户列表不可用');
  });

  it('consumes the authoritative decision without deriving it from the five dimensions', () => {
    const adverseDimensions: CapabilityStatusDimensionsV1 = {
      codeMaturity: 'unverified',
      institutionAuthorization: 'not_authorized',
      connectionAvailability: 'unavailable',
      dataReadiness: 'unavailable',
      productionRelease: 'not_released',
    };
    const result = buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource([
        {
          key: 'action_customer_create',
          decision: 'read_only',
          dimensions: { ...defaultDimensions },
          safeSummary: '当前仅供查看',
        },
        {
          key: 'action_care_followup_create',
          decision: 'operational',
          dimensions: adverseDimensions,
        },
        {
          key: 'page_workbench',
          decision: 'hidden',
          dimensions: { ...defaultDimensions },
          safeSummary: null,
        },
      ]),
      referenceTime,
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.summaries).toEqual([
      {
        key: 'action_customer_create',
        kind: 'action',
        label: '新建客户',
        decision: 'read_only',
        safeSummary: '当前仅供查看',
        dataStatus: 'current',
        observedAt: null,
        diagnosticTarget: null,
      },
    ]);
    expect(result.quickCreateMenu?.items.map((item) => item.key)).toEqual([
      'action_care_followup_create',
    ]);
  });

  it('keeps a valid stale read-only summary but never enables a stale action', () => {
    const staleFreshness = {
      observedAt: '2026-07-17T03:00:00.000Z',
      freshUntil: '2026-07-17T03:05:00.000Z',
    };
    const result = buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource(
        [
          {
            key: 'action_customer_create',
            decision: 'read_only',
            safeSummary: '业务数据已过期，仅供查看',
            diagnosticTargetKey: 'page_system_overview',
            partitionReadiness: 'stale',
            partitionFreshness: staleFreshness,
            partitionFailureCode: 'data_incomplete',
          },
        ],
        {
          readiness: 'stale',
          freshness: staleFreshness,
          failureCode: 'data_incomplete',
        },
      ),
      referenceTime,
    });

    expect(result).toEqual({
      status: 'projected',
      sourceReadiness: 'stale',
      summaries: [
        {
          key: 'action_customer_create',
          kind: 'action',
          label: '新建客户',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          dataStatus: 'stale',
          observedAt: '2026-07-17T03:00:00.000Z',
          diagnosticTarget: {
            key: 'page_system_overview',
            label: '系统概览',
            href: '/hospital/system',
          },
        },
      ],
      quickCreateMenu: null,
    });
  });

  it('preserves ready portions of a partial source and strips unavailable or unauthorized data', () => {
    const result = buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource(
        [
          {
            key: 'page_workbench',
            partitionReadiness: 'denied',
            partitionFailureCode: 'permission_denied',
            includeInData: false,
          },
          {
            key: 'action_customer_create',
            decision: 'operational',
            safeSummary: '新建客户可用',
          },
          {
            key: 'action_care_appointment_create',
            decision: 'read_only',
            safeSummary: '新建预约已过期',
            partitionReadiness: 'stale',
            partitionFailureCode: 'data_incomplete',
          },
          {
            key: 'action_care_followup_create',
            partitionReadiness: 'disabled',
            partitionFailureCode: 'not_released',
            includeInData: false,
          },
          {
            key: 'page_system_data',
            partitionReadiness: 'unavailable',
            partitionFreshness: null,
            partitionFailureCode: 'upstream_unavailable',
            includeInData: false,
          },
        ],
        { readiness: 'partial', freshness: null, failureCode: 'data_incomplete' },
      ),
      referenceTime,
    });

    expect(result.status).toBe('projected');
    if (result.status !== 'projected') {
      return;
    }

    expect(result.sourceReadiness).toBe('partial');
    expect(result.summaries.map((summary) => summary.key)).toEqual([
      'action_customer_create',
      'action_care_appointment_create',
    ]);
    expect(result.summaries[1]).toMatchObject({
      dataStatus: 'stale',
      decision: 'read_only',
    });
    expect(result.quickCreateMenu?.items).toEqual([
      {
        key: 'action_customer_create',
        label: '新建客户',
        href: '/hospital/customers?create=1',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/page_workbench|page_system_data|followup/);
  });

  it('returns no business data for denied, disabled, or scope-mismatch sources', () => {
    const denied = capabilitySource(
      [
        {
          key: 'action_customer_create',
          partitionReadiness: 'denied',
          partitionFreshness: null,
          partitionFailureCode: 'permission_denied',
          includeInData: false,
        },
      ],
      {
        readiness: 'denied',
        freshness: null,
        failureCode: 'permission_denied',
        data: null,
      },
    );
    const disabled = capabilitySource(
      [
        {
          key: 'action_customer_create',
          partitionReadiness: 'disabled',
          partitionFreshness: null,
          partitionFailureCode: 'not_released',
          includeInData: false,
        },
      ],
      {
        readiness: 'disabled',
        freshness: null,
        failureCode: 'not_released',
        data: null,
      },
    );
    const topScopeMismatch = capabilitySource(
      [
        {
          key: 'action_customer_create',
          partitionReadiness: 'denied',
          partitionFreshness: null,
          partitionFailureCode: 'scope_mismatch',
          includeInData: false,
        },
      ],
      {
        readiness: 'denied',
        freshness: null,
        failureCode: 'scope_mismatch',
        data: null,
      },
    );
    const partitionScopeMismatch = capabilitySource(
      [
        {
          key: 'action_customer_create',
          decision: 'operational',
          partitionFailureCode: 'scope_mismatch',
        },
      ],
      { readiness: 'partial', freshness: null, failureCode: 'data_incomplete' },
    );

    for (const source of [denied, disabled, topScopeMismatch, partitionScopeMismatch]) {
      const result = buildWorkbenchCapabilityProjection({
        capabilities: source,
        referenceTime,
      });
      expect(result).toEqual(blockedProjection());
      expect(JSON.stringify(result)).not.toMatch(/客户|create|scope_mismatch/);
    }
  });

  it('represents an unavailable or empty source without inventing summaries or a menu', () => {
    const unavailable = capabilitySource(
      [
        {
          key: 'action_customer_create',
          partitionReadiness: 'unavailable',
          partitionFreshness: null,
          partitionFailureCode: 'upstream_unavailable',
          includeInData: false,
        },
      ],
      {
        readiness: 'unavailable',
        freshness: null,
        failureCode: 'upstream_unavailable',
        data: null,
      },
    );
    const empty = capabilitySource([], {
      readiness: 'empty',
      freshness: null,
      data: null,
    });

    expect(buildWorkbenchCapabilityProjection({
      capabilities: unavailable,
      referenceTime,
    })).toEqual({
      status: 'projected',
      sourceReadiness: 'unavailable',
      summaries: [],
      quickCreateMenu: null,
    });
    expect(buildWorkbenchCapabilityProjection({ capabilities: empty, referenceTime })).toEqual({
      status: 'projected',
      sourceReadiness: 'empty',
      summaries: [],
      quickCreateMenu: null,
    });
  });

  it('fails closed for unknown, duplicate, malformed, or cross-field-invalid payloads', () => {
    const malformedSources: CapabilityStatusV1[] = [];

    const invalidVersion = capabilitySource([{ key: 'page_workbench' }]);
    (invalidVersion as unknown as { contractVersion: string }).contractVersion = 'v2';
    malformedSources.push(invalidVersion);

    const emptyScope = capabilitySource([{ key: 'page_workbench' }]);
    emptyScope.scope.institutionId = '   ';
    malformedSources.push(emptyScope);

    const invalidTopReadiness = capabilitySource([{ key: 'page_workbench' }]);
    (invalidTopReadiness as unknown as { readiness: string }).readiness = 'unknown';
    malformedSources.push(invalidTopReadiness);

    const invalidFreshness = capabilitySource([{ key: 'page_workbench' }]);
    invalidFreshness.freshness = {
      observedAt: 'not-a-time',
      freshUntil: currentFreshness.freshUntil,
    };
    malformedSources.push(invalidFreshness);

    const missingTimezone = capabilitySource([{ key: 'page_workbench' }]);
    missingTimezone.freshness = {
      observedAt: '2026-07-18T01:00:00.000',
      freshUntil: currentFreshness.freshUntil,
    };
    malformedSources.push(missingTimezone);

    const normalizedInvalidDate = capabilitySource([{ key: 'page_workbench' }]);
    normalizedInvalidDate.freshness = {
      observedAt: '2026-02-30T01:00:00.000Z',
      freshUntil: currentFreshness.freshUntil,
    };
    malformedSources.push(normalizedInvalidDate);

    const invalidPartitionReadiness = capabilitySource([{ key: 'page_workbench' }]);
    (
      invalidPartitionReadiness.partitions[0] as unknown as {
        readiness: string;
      }
    ).readiness = 'partial';
    malformedSources.push(invalidPartitionReadiness);

    const readyWithFailure = capabilitySource([{ key: 'page_workbench' }], {
      failureCode: 'permission_denied',
    });
    malformedSources.push(readyWithFailure);

    const unknownPartition = capabilitySource([{ key: 'page_workbench' }]);
    (
      unknownPartition.partitions[0] as unknown as {
        key: string;
      }
    ).key = 'unknown_capability';
    malformedSources.push(unknownPartition);

    const duplicatePartition = capabilitySource([
      { key: 'page_workbench' },
      { key: 'action_customer_create' },
    ]);
    duplicatePartition.partitions[1] = duplicatePartition.partitions[0];
    malformedSources.push(duplicatePartition);

    const duplicateItem = capabilitySource([
      { key: 'page_workbench' },
      { key: 'action_customer_create' },
    ]);
    if (duplicateItem.data !== null) {
      duplicateItem.data.capabilities[1] = duplicateItem.data.capabilities[0];
    }
    malformedSources.push(duplicateItem);

    const missingPartition = capabilitySource([{ key: 'page_workbench' }]);
    missingPartition.partitions = [];
    malformedSources.push(missingPartition);

    const invalidDecision = capabilitySource([{ key: 'page_workbench' }]);
    if (invalidDecision.data !== null) {
      (
        invalidDecision.data.capabilities[0] as unknown as {
          decision: string;
        }
      ).decision = 'enabled';
    }
    malformedSources.push(invalidDecision);

    const invalidDimension = capabilitySource([{ key: 'page_workbench' }]);
    if (invalidDimension.data !== null) {
      (
        invalidDimension.data.capabilities[0].dimensions as unknown as {
          dataReadiness: string;
        }
      ).dataReadiness = 'denied';
    }
    malformedSources.push(invalidDimension);

    const invalidDiagnosticTarget = capabilitySource([{ key: 'page_workbench' }]);
    if (invalidDiagnosticTarget.data !== null) {
      (
        invalidDiagnosticTarget.data.capabilities[0] as unknown as {
          diagnosticTargetKey: string;
        }
      ).diagnosticTargetKey = '/hospital/system';
    }
    malformedSources.push(invalidDiagnosticTarget);

    const staleOperational = capabilitySource(
      [
        {
          key: 'action_customer_create',
          decision: 'operational',
          partitionReadiness: 'stale',
          partitionFailureCode: 'data_incomplete',
        },
      ],
      { readiness: 'stale', failureCode: 'data_incomplete' },
    );
    malformedSources.push(staleOperational);

    const stalePermissionFailure = capabilitySource(
      [
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          partitionReadiness: 'stale',
          partitionFailureCode: 'permission_denied',
        },
      ],
      { readiness: 'stale', failureCode: 'data_incomplete' },
    );
    malformedSources.push(stalePermissionFailure);

    const staleNotReleasedSource = capabilitySource(
      [
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          partitionReadiness: 'stale',
          partitionFailureCode: 'data_incomplete',
        },
      ],
      { readiness: 'stale', failureCode: 'not_released' },
    );
    malformedSources.push(staleNotReleasedSource);

    const unavailableWithData = capabilitySource(
      [
        {
          key: 'page_workbench',
          partitionReadiness: 'unavailable',
          partitionFreshness: null,
        },
      ],
      { readiness: 'unavailable', freshness: null },
    );
    malformedSources.push(unavailableWithData);

    const staleSourceWithEmptyPartitionData = capabilitySource(
      [
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          partitionReadiness: 'empty',
          partitionFailureCode: null,
        },
      ],
      { readiness: 'stale', failureCode: 'data_incomplete' },
    );
    malformedSources.push(staleSourceWithEmptyPartitionData);

    for (const source of malformedSources) {
      expect(buildWorkbenchCapabilityProjection({ capabilities: source, referenceTime })).toEqual(
        blockedProjection(),
      );
    }
  });

  it('accepts controlled low-sensitivity status text and rejects free-form sensitive content', () => {
    const controlledSummary = '工作台业务可用';
    const accepted = buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource([
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: controlledSummary,
        },
      ]),
      referenceTime,
    });
    expect(accepted.status).toBe('projected');
    if (accepted.status === 'projected') {
      expect(accepted.summaries[0]?.safeSummary).toBe(controlledSummary);
    }

    const forbiddenSummaries = [
      '业'.repeat(121),
      '查看 https://malicious.invalid/status',
      'provider endpoint 当前异常',
      'credential 已过期',
      '连接地址 localhost:55433',
      '联系人 13800138000',
      '联系人 138 0013 8000，业务可用',
      '负责人 test@example.com',
      '技术错误 ECONNREFUSED',
      '客户：张三，业务可用',
      '客户张三业务可用',
      '客户张三支付100元，业务可用',
      '张三术后疼痛，业务可用',
      '微信消息说恢复良好，业务可用',
      '消息正文：术后疼痛，业务可用',
      '治疗正文：恢复良好，业务可用',
      '支付明细：订单 A100，业务可用',
      '这是一段没有受控状态的自由文本',
      ' 前后空格不可接受',
      '包含\n换行',
    ];

    for (const safeSummary of forbiddenSummaries) {
      const result = buildWorkbenchCapabilityProjection({
        capabilities: capabilitySource([
          {
            key: 'page_workbench',
            decision: 'read_only',
            safeSummary,
          },
        ]),
        referenceTime,
      });
      expect(result).toEqual(blockedProjection());
    }
  });

  it('does not enable current actions without freshness and blocks contradictory denial failures', () => {
    const absentFreshness = capabilitySource([
      {
        key: 'action_customer_create',
        decision: 'operational',
        safeSummary: '新建客户可用',
        partitionFreshness: null,
      },
    ]);
    const contradictoryFailure = capabilitySource([
      {
        key: 'action_customer_create',
        decision: 'operational',
        safeSummary: '新建客户可用',
        partitionFailureCode: 'permission_denied',
      },
    ]);

    expect(buildWorkbenchCapabilityProjection({
      capabilities: absentFreshness,
      referenceTime,
    })).toEqual({
      status: 'projected',
      sourceReadiness: 'ready',
      summaries: [],
      quickCreateMenu: null,
    });
    expect(buildWorkbenchCapabilityProjection({
      capabilities: contradictoryFailure,
      referenceTime,
    })).toEqual(blockedProjection());
  });

  it('requires a current top snapshot and current partition snapshot for create actions', () => {
    const missingTopFreshness = capabilitySource([
      { key: 'action_customer_create', decision: 'operational' },
    ]);
    missingTopFreshness.freshness = null;

    const expiredTopFreshness = capabilitySource([
      { key: 'action_customer_create', decision: 'operational' },
    ]);
    expiredTopFreshness.freshness = {
      observedAt: '2020-01-01T00:00:00.000Z',
      freshUntil: '2020-01-01T00:05:00.000Z',
    };

    const expiredPartitionFreshness = capabilitySource(
      [
        {
          key: 'action_customer_create',
          decision: 'operational',
          safeSummary: '新建客户可用',
          partitionFreshness: {
            observedAt: '2020-01-01T00:00:00.000Z',
            freshUntil: '2020-01-01T00:05:00.000Z',
          },
        },
      ],
      { readiness: 'partial', freshness: null, failureCode: 'data_incomplete' },
    );

    expect(buildWorkbenchCapabilityProjection({
      capabilities: missingTopFreshness,
      referenceTime,
    })).toEqual(blockedProjection());
    expect(buildWorkbenchCapabilityProjection({
      capabilities: expiredTopFreshness,
      referenceTime,
    })).toEqual(blockedProjection());
    expect(buildWorkbenchCapabilityProjection({
      capabilities: expiredPartitionFreshness,
      referenceTime,
    })).toEqual({
      status: 'projected',
      sourceReadiness: 'partial',
      summaries: [],
      quickCreateMenu: null,
    });
    expect(buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource([
        { key: 'action_customer_create', decision: 'operational' },
      ]),
      referenceTime: 'not-a-time',
    })).toEqual(blockedProjection());
  });

  it('never projects a stale snapshot observed after the trusted reference time', () => {
    const futureFreshness = {
      observedAt: '2099-01-01T00:00:00.000Z',
      freshUntil: '2099-01-01T00:05:00.000Z',
    };
    const futureTopSnapshot = capabilitySource(
      [
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          partitionReadiness: 'stale',
          partitionFreshness: futureFreshness,
          partitionFailureCode: 'data_incomplete',
        },
      ],
      {
        readiness: 'stale',
        freshness: futureFreshness,
        failureCode: 'data_incomplete',
      },
    );
    const futurePartitionSnapshot = capabilitySource(
      [
        {
          key: 'page_workbench',
          decision: 'read_only',
          safeSummary: '业务数据已过期，仅供查看',
          partitionReadiness: 'stale',
          partitionFreshness: futureFreshness,
          partitionFailureCode: 'data_incomplete',
        },
      ],
      { readiness: 'partial', freshness: null, failureCode: 'data_incomplete' },
    );

    expect(buildWorkbenchCapabilityProjection({
      capabilities: futureTopSnapshot,
      referenceTime,
    })).toEqual(blockedProjection());
    expect(buildWorkbenchCapabilityProjection({
      capabilities: futurePartitionSnapshot,
      referenceTime,
    })).toEqual({
      status: 'projected',
      sourceReadiness: 'partial',
      summaries: [],
      quickCreateMenu: null,
    });
  });


  it('正式摘要兼容只接受两个获准完整字符串，不放宽别名前缀与状态短语组合', () => {
    for (const [key, safeSummary] of [
      ['page_knowledge_library', '知识库资料状态异常'],
      ['page_system_ai_usage', 'AI 使用统计可用'],
    ] as const) {
      const result = buildWorkbenchCapabilityProjection({
        capabilities: capabilitySource([
          {
            key,
            decision: 'read_only',
            safeSummary,
          },
        ]),
        referenceTime,
      });

      expect(result).toEqual(blockedProjection());
      expect(JSON.stringify(result)).not.toContain(safeSummary);
    }
  });

  it('接受当前 Phase 1 八个 governed readonly page 的 Authority 安全摘要并保持 Controlled Create 关闭', () => {
    const dims = (
      dataReadiness: CapabilityStatusDimensionsV1['dataReadiness'],
    ): CapabilityStatusDimensionsV1 => ({
      codeMaturity: 'verified',
      institutionAuthorization: 'authorized',
      connectionAvailability: 'not_required',
      dataReadiness,
      productionRelease: 'pilot_released',
    });
    const result = buildWorkbenchCapabilityProjection({
      capabilities: capabilitySource([
        { key: 'page_workbench', dimensions: dims('not_required'), safeSummary: '工作台仅供查看' },
        { key: 'page_customer_list', dimensions: dims('ready'), safeSummary: '客户列表仅供查看' },
        { key: 'page_conversation_queue', dimensions: dims('ready'), safeSummary: '会话队列仅供查看' },
        { key: 'page_care_appointments', dimensions: dims('ready'), safeSummary: '预约管理仅供查看' },
        { key: 'page_knowledge_library', dimensions: dims('ready'), safeSummary: '知识库资料仅供查看' },
        { key: 'page_analytics_overview', dimensions: dims('ready'), safeSummary: '经营总览仅供查看' },
        { key: 'page_system_ai_usage', dimensions: dims('ready'), safeSummary: 'AI 使用统计仅供查看' },
        { key: 'page_system_audit', dimensions: dims('partial'), safeSummary: '审计与安全仅供查看' },
      ]),
      referenceTime,
    });
    expect(result.status).toBe('projected');
    if (result.status !== 'projected') return;
    expect(result.summaries.map((summary) => summary.key)).toEqual([
      'page_workbench',
      'page_customer_list',
      'page_conversation_queue',
      'page_care_appointments',
      'page_knowledge_library',
      'page_analytics_overview',
      'page_system_ai_usage',
      'page_system_audit',
    ]);
    expect(result.summaries.every((summary) => summary.decision === 'read_only')).toBe(true);
    expect(result.quickCreateMenu).toBeNull();
  });

});
