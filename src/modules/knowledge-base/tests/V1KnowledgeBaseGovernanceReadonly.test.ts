import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseGovernanceReadonlySummary,
  defaultV1KnowledgeBaseGovernanceReadonlyPolicy,
  v1KnowledgeBaseGovernanceReadonlySummaryFields,
  type V1KnowledgeBaseGovernanceReadonlyInput,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-governance-readonly-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseGovernance: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  workspaceId: 'demo-workspace-a',
  institutionId: 'demo-inst-a',
  viewerScope: 'institution' as const,
  viewerInstitutionScopeCode: 'demo-inst-a',
};

function governanceInput(
  overrides: Partial<V1KnowledgeBaseGovernanceReadonlyInput> = {},
): V1KnowledgeBaseGovernanceReadonlyInput {
  return {
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

function expectGovernanceWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1KnowledgeBaseGovernanceReadonlySummaryFields);
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

describe('V1 知识库治理总览 readonly 聚合 view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选治理详情', () => {
    const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput({
        knowledgeBaseCandidates: [
          {
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            title: '平台 FAQ',
            lowSensitiveSummary: '不应展示',
            sourceLabel: '不应展示来源',
            visibilityScope: 'platform_global',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'demo',
            uploadPayload: { fileName: 'real.docx' },
          },
        ],
      }),
      defaultV1KnowledgeBaseGovernanceReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseGovernanceReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库治理总览只读能力暂未开启',
      tenantId: 'not_available',
      institutionId: 'not_available',
      workspaceId: 'not_available',
      platformKnowledgeBaseSummary: 'not_available',
      institutionKnowledgeBaseSummary: 'not_available',
      boundarySummary: 'not_available',
      catalogSummary: 'not_available',
      versionSummary: 'not_available',
      visibilitySummary: 'not_available',
      auditSummary: 'not_available',
      governanceStatus: 'disabled',
      riskFlags: [],
      recommendedReadonlyActions: [],
    });
    expect(JSON.stringify(summary)).not.toContain('不应展示来源');
    expectGovernanceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('ready 时聚合平台端与机构端知识库治理低敏总览', () => {
    const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput(),
      enabledPolicy,
    );

    expect(summary).toEqual({
      status: 'ready',
      reasonCode: 'knowledge_base_governance_ready',
      resultCode: 'readonly',
      readonly: true,
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      platformKnowledgeBaseSummary: 'platform_items:1 / published:1 / draft:0 / archived:0 / disabled:0',
      institutionKnowledgeBaseSummary: 'institution_items:1 / published:0 / draft:1 / archived:0 / disabled:0',
      boundarySummary: 'ready / items:2',
      catalogSummary: 'ready / items:2',
      versionSummary: 'ready / current:1 / reviewing:1 / deprecated:0',
      visibilitySummary: 'ready / platform_global:0 / specified_institution:1 / institution_private:1',
      auditSummary: 'ready / items:1 / stale:0',
      governanceStatus: 'ready',
      riskFlags: ['reviewing_version_present'],
      recommendedReadonlyActions: ['review_draft_or_restricted_knowledge_readonly'],
    });
    expectGovernanceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('stale 时返回只读 stale 治理总览且只推荐只读复核提示', () => {
    const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput({
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
      }),
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'stale',
      reasonCode: 'knowledge_base_governance_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy: '知识库治理总览可能已过期',
      auditSummary: 'stale / items:1 / stale:1',
      governanceStatus: 'stale',
      riskFlags: ['reviewing_version_present', 'stale_audit_present'],
      recommendedReadonlyActions: [
        'review_draft_or_restricted_knowledge_readonly',
        'review_stale_audit_source_readonly',
      ],
    });
    expectGovernanceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('partial 时保留可用只读摘要并标记缺失来源', () => {
    const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput({
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
      }),
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'partial',
      reasonCode: 'knowledge_base_governance_partial',
      resultCode: 'partial',
      readonly: true,
      exceptionCopy: '知识库治理总览部分来源不完整，仅展示可用只读摘要',
      boundarySummary: 'ready / items:2',
      catalogSummary: 'ready / items:2',
      auditSummary: 'exception / items:0 / stale:0',
      governanceStatus: 'partial',
      riskFlags: ['audit_source_missing', 'reviewing_version_present'],
    });
    expectGovernanceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('tenant mismatch / RBAC denied / empty 返回低敏只读状态', () => {
    const tenantDenied = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput(),
      { ...enabledPolicy, tenantScopeMatched: false },
    );
    const rbacDenied = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput(),
      { ...enabledPolicy, canReadKnowledgeBaseGovernance: false },
    );
    const empty = buildV1KnowledgeBaseGovernanceReadonlySummary(
      { knowledgeBaseCandidates: [], auditCandidates: [] },
      enabledPolicy,
    );

    expect(tenantDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      governanceStatus: 'denied',
    });
    expect(rbacDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      governanceStatus: 'denied',
    });
    expect(empty).toMatchObject({
      status: 'empty',
      reasonCode: 'no_knowledge_base_governance_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库治理总览',
      governanceStatus: 'empty',
    });
    [tenantDenied, rbacDenied, empty].forEach((payload) => {
      expectGovernanceWhitelist(payload);
      expectNoSensitiveOrRuntimeFragments(payload);
    });
  });

  it('非 mock / seed / demo 来源安全降级且 recommendedReadonlyActions 不包含写操作', () => {
    const summary = buildV1KnowledgeBaseGovernanceReadonlySummary(
      governanceInput({
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
            scope: 'platform_knowledge_base',
            knowledgeType: 'risk_notice',
            title: '真实来源不应展示',
            lowSensitiveSummary: '不应展示',
            sourceLabel: 'production',
            visibilityScope: 'platform_global',
            publishStatus: 'published',
            versionSummary: 'v1',
            versionStatus: 'current',
            permissionStatus: 'visible',
            mockSeedDemoFlag: 'production' as never,
            hisConnection: 'his_connection_should_not_render',
            mutationPayload: { createTask: true },
          },
        ],
      }),
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.boundarySummary).toBe('ready / items:1');
    expect(JSON.stringify(summary)).not.toContain('真实来源不应展示');
    expect(summary.recommendedReadonlyActions.every((action) => action.endsWith('_readonly'))).toBe(
      true,
    );
    expectGovernanceWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });
});
