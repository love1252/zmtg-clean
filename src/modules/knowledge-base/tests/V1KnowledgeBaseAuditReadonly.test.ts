import { describe, expect, it } from 'vitest';
import {
  buildV1KnowledgeBaseAuditReadonlySummary,
  defaultV1KnowledgeBaseAuditReadonlyPolicy,
  v1KnowledgeBaseAuditReadonlyItemFields,
  type V1KnowledgeBaseAuditReadonlyCandidateInput,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-audit-readonly-view-models';

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseAudit: true,
  tenantScopeMatched: true,
  workspaceScopeMatched: true,
  institutionScopeMatched: true,
  tenantId: 'demo-tenant-a',
  workspaceId: 'demo-workspace-a',
  institutionId: 'demo-inst-a',
};

const summaryFields = [
  'status',
  'reasonCode',
  'resultCode',
  'readonly',
  'emptyCopy',
  'exceptionCopy',
  'staleCopy',
  'items',
];

const allowedAuditFields = [...summaryFields, ...v1KnowledgeBaseAuditReadonlyItemFields];

function candidate(
  overrides: Partial<V1KnowledgeBaseAuditReadonlyCandidateInput> = {},
): V1KnowledgeBaseAuditReadonlyCandidateInput {
  return {
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

function expectAuditWhitelist(payload: unknown) {
  const fields = collectFields(payload);
  const unknownFields = fields.filter((field) => !allowedAuditFields.includes(field));

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
    'runtime',
    'allowedActions',
    'selectedAction',
    'executableAction',
    'mutationPayload',
    'createTask',
    'createAppointment',
    'createDeal',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('V1 知识库审计与来源追踪 readonly view model', () => {
  it('默认关闭时优先返回 disabled 且不回显候选审计详情', () => {
    const summary = buildV1KnowledgeBaseAuditReadonlySummary(
      {
        candidates: [
          candidate({
            phone: '13800001252',
            uploadPayload: { fileName: 'real.docx' },
          }),
        ],
      },
      defaultV1KnowledgeBaseAuditReadonlyPolicy,
    );

    expect(defaultV1KnowledgeBaseAuditReadonlyPolicy.featureEnabled).toBe(false);
    expect(summary).toEqual({
      status: 'disabled',
      reasonCode: 'feature_flag_disabled',
      resultCode: 'skipped',
      readonly: true,
      emptyCopy: '该知识库审计与来源追踪只读能力暂未开启',
      items: [],
    });
    expect(JSON.stringify(summary)).not.toContain('机构 FAQ 种子来源');
    expectAuditWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('ready 时输出低敏审计摘要、来源摘要、发布/下架记录和引用来源', () => {
    const summary = buildV1KnowledgeBaseAuditReadonlySummary(
      {
        candidates: [
          candidate(),
          candidate({
            knowledgeBaseId: 'kb-demo-002',
            scope: 'platform_knowledge_base',
            knowledgeType: 'faq',
            institutionId: 'platform',
            sourceType: 'demo_reference',
            sourceLabel: '平台 FAQ demo 来源',
            visibilityScope: 'platform_global',
            reviewStatus: 'pending',
            publishStatus: 'draft',
            lastReviewedAt: '2026-06-03',
            lastPublishedAt: 'none',
            lastRetiredAt: 'none',
            citationSourceSummary: 'demo faq reference',
            riskFlags: ['review_pending'],
            mockSeedDemoFlag: 'demo',
            prompt: 'prompt should not render',
          }),
        ],
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'ready',
      reasonCode: 'knowledge_base_audit_ready',
      resultCode: 'readonly',
      readonly: true,
    });
    expect(summary.items).toEqual([
      {
        knowledgeBaseId: 'kb-demo-001',
        tenantId: 'demo-tenant-a',
        institutionId: 'demo-inst-a',
        workspaceId: 'demo-workspace-a',
        scope: 'institution_knowledge_base',
        knowledgeType: 'institution_faq',
        sourceType: 'seed_catalog',
        sourceLabel: '机构 FAQ 种子来源',
        sourceSummary: 'seed_catalog / 机构 FAQ 种子来源',
        reviewStatus: 'approved',
        reviewStatusSummary: 'approved / 2026-06-01',
        publishStatus: 'published',
        publishRecordSummary: 'published / 2026-06-02',
        retireRecordSummary: 'none',
        visibilityScope: 'institution_private',
        citationSourceSummary: 'seed faq reference',
        riskFlags: ['none'],
        auditFreshness: 'ready',
        mockSeedDemoFlag: 'seed',
        readonly: true,
        reasonCode: 'knowledge_base_audit_item_ready',
        resultCode: 'readonly',
      },
      {
        knowledgeBaseId: 'kb-demo-002',
        tenantId: 'demo-tenant-a',
        institutionId: 'platform',
        workspaceId: 'demo-workspace-a',
        scope: 'platform_knowledge_base',
        knowledgeType: 'faq',
        sourceType: 'demo_reference',
        sourceLabel: '平台 FAQ demo 来源',
        sourceSummary: 'demo_reference / 平台 FAQ demo 来源',
        reviewStatus: 'pending',
        reviewStatusSummary: 'pending / 2026-06-03',
        publishStatus: 'draft',
        publishRecordSummary: 'draft / none',
        retireRecordSummary: 'none',
        visibilityScope: 'platform_global',
        citationSourceSummary: 'demo faq reference',
        riskFlags: ['review_pending'],
        auditFreshness: 'ready',
        mockSeedDemoFlag: 'demo',
        readonly: true,
        reasonCode: 'knowledge_base_audit_item_ready',
        resultCode: 'readonly',
      },
    ]);
    summary.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual([...v1KnowledgeBaseAuditReadonlyItemFields].sort());
      expect(item.readonly).toBe(true);
    });
    expectAuditWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('stale 状态返回只读过期审计摘要', () => {
    const summary = buildV1KnowledgeBaseAuditReadonlySummary(
      {
        candidates: [
          candidate({
            reviewStatus: 'stale',
            publishStatus: 'archived',
            lastReviewedAt: '2026-05-01',
            lastPublishedAt: '2026-05-02',
            lastRetiredAt: '2026-06-01',
            riskFlags: ['stale_reference'],
            mockSeedDemoFlag: 'mock',
          }),
        ],
      },
      enabledPolicy,
    );

    expect(summary).toMatchObject({
      status: 'stale',
      reasonCode: 'knowledge_base_audit_stale',
      resultCode: 'stale',
      readonly: true,
      staleCopy: '知识库审计与来源追踪摘要可能已过期',
    });
    expect(summary.items[0]).toMatchObject({
      reviewStatus: 'stale',
      publishStatus: 'archived',
      retireRecordSummary: 'archived / 2026-06-01',
      auditFreshness: 'stale',
      readonly: true,
      reasonCode: 'knowledge_base_audit_item_stale',
    });
    expectAuditWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });

  it('tenant mismatch / RBAC denied / empty / source missing 返回低敏状态', () => {
    const empty = buildV1KnowledgeBaseAuditReadonlySummary({ candidates: [] }, enabledPolicy);
    const tenantDenied = buildV1KnowledgeBaseAuditReadonlySummary(
      { candidates: [candidate()] },
      { ...enabledPolicy, tenantScopeMatched: false },
    );
    const rbacDenied = buildV1KnowledgeBaseAuditReadonlySummary(
      { candidates: [candidate()] },
      { ...enabledPolicy, canReadKnowledgeBaseAudit: false },
    );
    const sourceMissing = buildV1KnowledgeBaseAuditReadonlySummary(
      {
        candidates: [
          candidate({
            sourceLabel: undefined,
            modelApiKey: 'sk_should_not_render',
          }),
        ],
      },
      enabledPolicy,
    );

    expect(empty).toEqual({
      status: 'empty',
      reasonCode: 'no_knowledge_base_audit_candidates',
      resultCode: 'empty',
      readonly: true,
      emptyCopy: '暂无可展示知识库审计与来源追踪摘要',
      items: [],
    });
    expect(tenantDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'tenant_scope_mismatch',
      resultCode: 'denied',
      readonly: true,
      items: [],
    });
    expect(rbacDenied).toMatchObject({
      status: 'denied',
      reasonCode: 'permission_denied',
      resultCode: 'denied',
      readonly: true,
      items: [],
    });
    expect(sourceMissing).toEqual({
      status: 'exception',
      reasonCode: 'knowledge_base_audit_source_missing',
      resultCode: 'unavailable',
      readonly: true,
      exceptionCopy: '知识库审计与来源追踪来源不完整，仅作内部参考',
      items: [],
    });
    [empty, tenantDenied, rbacDenied, sourceMissing].forEach((payload) => {
      expectAuditWhitelist(payload);
      expectNoSensitiveOrRuntimeFragments(payload);
    });
  });

  it('mock / seed / demo 来源限制与 tenant / workspace / institution 边界过滤生效', () => {
    const summary = buildV1KnowledgeBaseAuditReadonlySummary(
      {
        candidates: [
          candidate(),
          candidate({
            knowledgeBaseId: 'kb-other-tenant',
            tenantId: 'other-tenant',
            sourceLabel: '其他租户不应展示',
          }),
          candidate({
            knowledgeBaseId: 'kb-other-workspace',
            workspaceId: 'other-workspace',
            sourceLabel: '其他工作区不应展示',
          }),
          candidate({
            knowledgeBaseId: 'kb-other-institution',
            institutionId: 'other-inst',
            sourceLabel: '其他机构不应展示',
          }),
          candidate({
            knowledgeBaseId: 'kb-production',
            sourceLabel: '真实来源不应展示',
            mockSeedDemoFlag: 'production' as never,
            hisConnection: 'his_connection_should_not_render',
          }),
        ],
      },
      enabledPolicy,
    );

    expect(summary.status).toBe('ready');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      knowledgeBaseId: 'kb-demo-001',
      readonly: true,
      resultCode: 'readonly',
    });
    expect(JSON.stringify(summary)).not.toContain('其他租户不应展示');
    expect(JSON.stringify(summary)).not.toContain('其他工作区不应展示');
    expect(JSON.stringify(summary)).not.toContain('其他机构不应展示');
    expect(JSON.stringify(summary)).not.toContain('真实来源不应展示');
    expectAuditWhitelist(summary);
    expectNoSensitiveOrRuntimeFragments(summary);
  });
});
