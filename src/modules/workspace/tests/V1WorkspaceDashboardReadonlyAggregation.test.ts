import { describe, expect, it } from 'vitest';
import {
  buildV1WorkspaceDashboardReadonlyAggregationSummary,
  defaultV1WorkspaceDashboardReadonlyAggregationPolicy,
  v1WorkspaceDashboardReadonlyAggregationSummaryFields,
  type V1WorkspaceDashboardReadonlyAggregationInput,
} from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-aggregation-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadWorkspaceDashboardAggregation: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

function dashboardInput(
  overrides: Partial<V1WorkspaceDashboardReadonlyAggregationInput> = {},
): V1WorkspaceDashboardReadonlyAggregationInput {
  return {
    businessLoopCandidates: [
      {
        sourceKey: 'business_closed_loop_readonly',
        label: '主业务闭环',
        lowSensitiveSummary: 'demo 主业务闭环只读摘要',
        readiness: 'ready',
        metricValue: '3 readonly signals',
        mockSeedDemoFlag: 'demo',
      },
      {
        sourceKey: 'management_readonly_config',
        label: '管理配置',
        lowSensitiveSummary: 'seed 管理配置只读摘要',
        readiness: 'blocked',
        metricValue: '1 blocked signal',
        mockSeedDemoFlag: 'seed',
      },
    ],
    managementConfigCandidates: [
      {
        scope: 'platform',
        configKey: 'platform-governance',
        label: '平台治理配置',
        lowSensitiveSummary: 'demo 平台配置摘要',
        readiness: 'ready',
        mockSeedDemoFlag: 'demo',
      },
      {
        scope: 'institution',
        configKey: 'institution-governance',
        label: '机构治理配置',
        lowSensitiveSummary: 'seed 机构配置摘要',
        readiness: 'blocked',
        mockSeedDemoFlag: 'seed',
      },
    ],
    knowledgeGovernanceInput: {
      knowledgeBaseCandidates: [
        {
          scope: 'platform_knowledge_base',
          knowledgeType: 'faq',
          title: '平台 FAQ',
          lowSensitiveSummary: 'demo 平台 FAQ 治理摘要',
          sourceLabel: '平台知识种子',
          visibilityScope: 'specified_institution:demo-inst-a',
          publishStatus: 'published',
          versionSummary: 'v1 stable',
          versionStatus: 'current',
          permissionStatus: 'visible',
          mockSeedDemoFlag: 'demo',
        },
        {
          scope: 'institution_knowledge_base',
          knowledgeType: 'institution_faq',
          title: '机构 FAQ',
          lowSensitiveSummary: 'seed 机构 FAQ 治理摘要',
          sourceLabel: '机构知识种子',
          visibilityScope: 'institution_private:demo-inst-a',
          publishStatus: 'draft',
          versionSummary: 'v2 review',
          versionStatus: 'reviewing',
          permissionStatus: 'restricted',
          mockSeedDemoFlag: 'seed',
        },
      ],
      auditCandidates: [
        {
          knowledgeBaseId: 'kb-demo-001',
          tenantId: 'demo-tenant-a',
          institutionId: 'demo-inst-a',
          workspaceId: 'demo-workspace-a',
          scope: 'institution_knowledge_base',
          knowledgeType: 'institution_faq',
          sourceType: 'seed_catalog',
          sourceLabel: '机构 FAQ 种子来源',
          reviewStatus: 'approved',
          publishStatus: 'published',
          visibilityScope: 'institution_private',
          lastReviewedAt: '2026-06-01',
          lastPublishedAt: '2026-06-02',
          lastRetiredAt: 'none',
          citationSourceSummary: 'seed faq reference',
          riskFlags: ['none'],
          mockSeedDemoFlag: 'seed',
        },
      ],
    },
    ...overrides,
  };
}

function collectFields(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectFields(item));
  }

  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  return Object.entries(payload).flatMap(([field, value]) => [
    field,
    ...collectFields(value),
  ]);
}

function expectDashboardWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1WorkspaceDashboardReadonlyAggregationSummaryFields);
  const unknownFields = fields.filter((field) => !allowedFields.has(field));

  expect(unknownFields).toEqual([]);
}

function expectNoSensitiveOrRuntimeFragments(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'phone',
    'mobile',
    'idCard',
    'identityCard',
    'medicalRecord',
    'diagnosis',
    'order',
    'payment',
    'contract',
    'invoice',
    'credential',
    'token',
    'secret',
    'hisConnection',
    'hisRawPayload',
    'realCustomerData',
    'modelApiKey',
    'prompt',
    'completion',
    'upload',
    'parse',
    'chunk',
    'embedding',
    'vector',
    'retrieval',
    'aiKnowledgeRuntime',
    'runtime',
    'allowedActions',
    'selectedAction',
    'executableAction',
    'mutationPayload',
    'createTask',
    'createAppointment',
    'createDeal',
    'autoMarketing',
    'autoTouch',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('V1 workspace dashboard readonly 聚合 view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选 dashboard 详情', () => {
    const summary = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      dashboardInput({
        businessLoopCandidates: [
          {
            sourceKey: 'business_closed_loop_readonly',
            label: '不应展示业务闭环',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            metricValue: '1',
            mockSeedDemoFlag: 'demo',
            phone: '13800001252',
          },
        ],
      }),
      defaultV1WorkspaceDashboardReadonlyAggregationPolicy,
    );

    expect(defaultV1WorkspaceDashboardReadonlyAggregationPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该 workspace dashboard 只读聚合能力暂未开启',
      tenantId: 'not_available',
      institutionId: 'not_available',
      workspaceId: 'not_available',
      businessLoopSummary: 'not_available',
      managementConfigSummary: 'not_available',
      knowledgeGovernanceSummary: 'not_available',
      fieldWhitelistSummary: 'not_available',
      readonlyFeaturePolicySummary: 'not_available',
      dashboardStatus: 'disabled',
      riskFlags: [],
      recommendedReadonlyActions: [],
    });
    expect(JSON.stringify(summary)).not.toContain('不应展示业务闭环');
    expectDashboardWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('ready 时聚合业务闭环、管理配置、知识库治理、白名单和 readonly policy 状态', () => {
    const summary = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      dashboardInput(),
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'ready',
      reasonCode: 'workspace_dashboard_readonly_aggregation_ready',
      resultCode: 'readonly',
      readonly: true,
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      businessLoopSummary: 'ready / items:2 / blocked:1 / exception:0',
      managementConfigSummary: 'ready / items:2 / blocked:1 / missing:0',
      knowledgeGovernanceSummary: 'ready / reviewing_version_present',
      fieldWhitelistSummary: 'ready / unknown:0 / forbidden:0',
      readonlyFeaturePolicySummary: 'ready / readonly',
      dashboardStatus: 'ready',
      riskFlags: ['business_loop_blocked', 'management_config_blocked', 'reviewing_version_present'],
      recommendedReadonlyActions: [
        'review_business_loop_blockers_readonly',
        'review_management_config_blockers_readonly',
        'review_knowledge_governance_risks_readonly',
      ],
    });
    expectDashboardWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('stale 时保留只读 dashboard 聚合并只推荐只读复核提示', () => {
    const input = dashboardInput();
    const summary = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      {
        ...input,
        knowledgeGovernanceInput: {
          ...input.knowledgeGovernanceInput,
          auditCandidates: [
            {
              knowledgeBaseId: 'kb-demo-001',
              tenantId: 'demo-tenant-a',
              institutionId: 'demo-inst-a',
              workspaceId: 'demo-workspace-a',
              scope: 'institution_knowledge_base',
              knowledgeType: 'institution_faq',
              sourceType: 'seed_catalog',
              sourceLabel: '机构 FAQ 种子来源',
              reviewStatus: 'stale',
              publishStatus: 'archived',
              visibilityScope: 'institution_private',
              lastReviewedAt: '2026-05-01',
              lastPublishedAt: '2026-05-02',
              lastRetiredAt: '2026-06-01',
              citationSourceSummary: 'seed faq reference',
              riskFlags: ['stale_reference'],
              mockSeedDemoFlag: 'seed',
            },
          ],
        },
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'stale',
      reasonCode: 'workspace_dashboard_readonly_aggregation_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy: 'workspace dashboard 只读聚合可能已过期',
      knowledgeGovernanceSummary: 'stale / reviewing_version_present,stale_audit_present',
      dashboardStatus: 'stale',
    });
    expect(summary.recommendedReadonlyActions).toEqual([
      'review_business_loop_blockers_readonly',
      'review_management_config_blockers_readonly',
      'review_knowledge_governance_risks_readonly',
      'review_stale_dashboard_sources_readonly',
    ]);
    expectDashboardWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('partial 时保留可用只读摘要并标记 source missing', () => {
    const input = dashboardInput();
    const summary = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      {
        ...input,
        knowledgeGovernanceInput: {
          ...input.knowledgeGovernanceInput,
          auditCandidates: [
            {
              knowledgeBaseId: 'kb-demo-001',
              tenantId: 'demo-tenant-a',
              institutionId: 'demo-inst-a',
              workspaceId: 'demo-workspace-a',
              scope: 'institution_knowledge_base',
              knowledgeType: 'institution_faq',
              sourceType: 'seed_catalog',
              sourceLabel: undefined,
              reviewStatus: 'approved',
              publishStatus: 'published',
              visibilityScope: 'institution_private',
              lastReviewedAt: '2026-06-01',
              lastPublishedAt: '2026-06-02',
              lastRetiredAt: 'none',
              citationSourceSummary: 'seed faq reference',
              riskFlags: ['none'],
              mockSeedDemoFlag: 'seed',
            },
          ],
        },
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'partial',
      reasonCode: 'workspace_dashboard_readonly_aggregation_partial',
      resultCode: 'partial',
      readonly: true,
      exceptionCopy: 'workspace dashboard 只读聚合部分来源不完整，仅展示可用摘要',
      knowledgeGovernanceSummary: 'partial / audit_source_missing,reviewing_version_present',
      dashboardStatus: 'partial',
      riskFlags: expect.arrayContaining(['knowledge_governance_partial']),
    });
    expectDashboardWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('tenant mismatch / RBAC denied / empty 返回低敏只读状态', () => {
    const tenantDenied = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      dashboardInput(),
      { ...enabledPolicy, tenantScopeMatched: false },
    );
    const rbacDenied = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      dashboardInput(),
      { ...enabledPolicy, canReadWorkspaceDashboardAggregation: false },
    );
    const empty = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      { businessLoopCandidates: [], managementConfigCandidates: [] },
      enabledPolicy,
    );

    expect(tenantDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      dashboardStatus: 'denied',
    });
    expect(rbacDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      dashboardStatus: 'denied',
    });
    expect(empty).toMatchObject({
      status: 'empty',
      reasonCode: 'no_workspace_dashboard_readonly_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示 workspace dashboard 只读聚合',
      dashboardStatus: 'empty',
    });
    [tenantDenied, rbacDenied, empty].forEach((payload) => {
      expectDashboardWhitelist(payload);
      expectNoSensitiveOrRuntimeFragments(payload);
    });
  });

  it('非法来源安全降级且 recommendedReadonlyActions 不包含写操作', () => {
    const summary = buildV1WorkspaceDashboardReadonlyAggregationSummary(
      dashboardInput({
        businessLoopCandidates: [
          {
            sourceKey: 'business_closed_loop_readonly',
            label: '主业务闭环',
            lowSensitiveSummary: 'demo 主业务闭环只读摘要',
            readiness: 'ready',
            metricValue: '1 readonly signal',
            mockSeedDemoFlag: 'demo',
          },
          {
            sourceKey: 'opportunity_readonly',
            label: '真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            readiness: 'ready',
            metricValue: 'production',
            mockSeedDemoFlag: 'production' as never,
            hisConnection: 'his_connection_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.businessLoopSummary).toBe('ready / items:1 / blocked:0 / exception:0');
    expect(JSON.stringify(summary)).not.toContain('真实来源不应展示');
    expect(summary.recommendedReadonlyActions.every((action) => action.endsWith('_readonly'))).toBe(
      true,
    );
    expectDashboardWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });
});
