import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS,
  KNOWLEDGE_BASE_QA_QUOTA_POLICY,
  type KnowledgeBaseProductionCapabilityId,
  getKnowledgeBasePermissionMatrix,
  getKnowledgeBaseProductionCapabilityStatus,
  getKnowledgeBaseSensitiveFieldPolicy,
} from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';
import { getKnowledgeBaseControlledTrialReadiness } from '@/modules/knowledge-base/domain/v1-knowledge-base-controlled-trial-readiness';

const disabledCapabilityIds: KnowledgeBaseProductionCapabilityId[] = [
  'realAiProvider',
  'ocr',
  'runtimeIngestion',
  'productionVectorStore',
];

const enabledInternalCapabilityIds: KnowledgeBaseProductionCapabilityId[] = [
  'fileManagement',
  'documentParsing',
  'keywordSearch',
  'mockEmbedding',
  'vectorSearch',
  'mockQa',
  'qaAudit',
  'qaQuota',
];

const platformActionIds = [
  'viewKnowledgeBase',
  'uploadFile',
  'archiveFile',
  'startParsing',
  'generateMockEmbedding',
  'keywordSearch',
  'vectorSearch',
  'qaAsk',
  'viewQaAudit',
  'manageInstitutionVisibility',
];

const institutionAllowedActionIds = [
  'viewAuthorizedKnowledgeBase',
  'downloadAuthorizedFile',
  'viewParseChunks',
  'keywordSearch',
  'vectorSearch',
  'qaAsk',
  'viewOwnQaAudit',
];

const institutionForbiddenActionIds = [
  'uploadPlatformKnowledgeFile',
  'archiveFile',
  'startParsing',
  'generateEmbedding',
  'manageVisibility',
  'viewOtherInstitutionAudit',
  'accessOtherTenantData',
];

const deniedFieldFragments = [
  'storageKey',
  '/Users/',
  'textContent',
  'rawContent',
  'parsedContent',
  'embeddingVectorJson',
  'trainingContent',
  'SQL',
  'stack',
  'token',
  'secret',
  'DATABASE_URL',
  '真实 AI 原始响应',
  'prompt',
  'system prompt',
];

describe('知识库生产级治理 policy', () => {
  it('返回完整 capability 状态，生产级真实能力默认 disabled 且有中文原因和进入条件', () => {
    const status = getKnowledgeBaseProductionCapabilityStatus();
    const capabilitiesById = new Map(status.capabilities.map((capability) => [capability.id, capability]));

    expect(status.requestId).toBe('knowledge-base-production-capabilities');
    expect(status.readonly).toBe(true);
    expect(status.capabilities.map((capability) => capability.id)).toEqual(
      KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS,
    );

    enabledInternalCapabilityIds.forEach((capabilityId) => {
      expect(capabilitiesById.get(capabilityId)).toEqual(
        expect.objectContaining({
          id: capabilityId,
          enabled: true,
          status: 'enabled',
        }),
      );
    });

    disabledCapabilityIds.forEach((capabilityId) => {
      const capability = capabilitiesById.get(capabilityId);
      expect(capability).toEqual(
        expect.objectContaining({
          id: capabilityId,
          enabled: false,
          status: 'disabled',
        }),
      );
      expect(capability?.disabledReason).toMatch(/未启用|未接入|未完成/);
      expect(capability?.entryCondition).toMatch(/审批|评审|验收|方案/);
    });

    expect(capabilitiesById.get('realAiProvider')).toEqual(
      expect.objectContaining({
        enabled: false,
        status: 'disabled',
        summary: expect.stringContaining('AI provider 适配层已准备'),
        disabledReason: expect.stringContaining('真实 AI 未启用'),
      }),
    );
    expect(JSON.stringify(status)).not.toContain('真实 AI 已可用');
  });

  it('权限矩阵覆盖平台端动作、机构端允许动作和机构端禁止动作', () => {
    const matrix = getKnowledgeBasePermissionMatrix();
    const platformActions = new Map(matrix.platform.actions.map((action) => [action.id, action]));
    const institutionAllowedActions = new Map(matrix.institution.allowedActions.map((action) => [action.id, action]));
    const institutionForbiddenActions = new Map(matrix.institution.forbiddenActions.map((action) => [action.id, action]));

    platformActionIds.forEach((actionId) => {
      expect(platformActions.get(actionId)).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: true,
        }),
      );
    });

    institutionAllowedActionIds.forEach((actionId) => {
      expect(institutionAllowedActions.get(actionId)).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: true,
        }),
      );
    });

    institutionForbiddenActionIds.forEach((actionId) => {
      const action = institutionForbiddenActions.get(actionId);
      expect(action).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: false,
        }),
      );
      expect(action?.reason).toMatch(/禁止|只能|不得/);
    });
  });

  it('集中 QA 用量策略保持 tenant 100、institution 30 和中文超限文案', () => {
    expect(KNOWLEDGE_BASE_QA_QUOTA_POLICY).toEqual({
      tenantDailyLimit: 100,
      institutionDailyLimit: 30,
      usageLimitedMessage: '当前知识库问答次数已达上限，请稍后再试',
    });
  });

  it('敏感字段策略覆盖禁止对外返回字段', () => {
    const policy = getKnowledgeBaseSensitiveFieldPolicy();

    deniedFieldFragments.forEach((fragment) => {
      expect(policy.denylist).toContain(fragment);
    });
    expect(policy.allowlist).toEqual(
      expect.arrayContaining([
        'knowledgeId',
        'fileId',
        'chunkId',
        'auditId',
        'question',
        'answerPreview',
        'safeStatus',
      ]),
    );
  });

  it('输出内部受控试用 view model，统一平台端和机构端的允许能力、禁止能力与安全限制', () => {
    const readiness = getKnowledgeBaseControlledTrialReadiness();

    expect(readiness.stage).toBe('10-4');
    expect(readiness.status).toBe('内部受控试用');
    expect(readiness.baselineCommit).toBe('1e41132cbfe23fc755c2426d271f889b40f41d27');
    expect(readiness.supportedFileTypes.map((fileType) => fileType.label)).toEqual([
      'TXT',
      'Markdown',
      'CSV',
      '文本型 PDF',
      'DOCX',
      'XLSX',
    ]);
    expect(readiness.safetyLimits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '文件大小限制', value: '20MB' }),
        expect.objectContaining({ label: '解析文本上限', value: '32000 字符' }),
        expect.objectContaining({ label: 'ZIP 单文件解压上限', value: '5MB' }),
        expect.objectContaining({ label: 'PDF 单段解压上限', value: '8MB' }),
      ]),
    );
    expect(readiness.platform.allowedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        '文件上传',
        '真实文本文件解析',
        'chunk 查看',
        '关键词检索',
        'mock 向量检索',
        'mock/local QA',
        'citations',
        'QA audit',
        'quota',
        'capability',
      ]),
    );
    expect(readiness.institution.allowedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        '授权知识库查看',
        '授权文件查看',
        '解析状态查看',
        'chunk 预览',
        '关键词检索',
        'mock/local QA',
        'citations',
        'QA audit',
      ]),
    );
    expect(readiness.blockedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        'OCR',
        '扫描 PDF',
        '真实 AI',
        '真实向量库',
        'runtime ingestion',
        'worker/queue',
        '训练',
        '计费',
        'dashboard',
      ]),
    );
    expect(readiness.institution.forbiddenActions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        '上传',
        '归档',
        '发起解析',
        '训练',
        '生成 embedding',
        '管理 visibility',
        '调用真实 AI',
      ]),
    );
    expect(JSON.stringify(readiness)).not.toContain('storageKey');
    expect(JSON.stringify(readiness)).not.toContain('/Users/');
    expect(JSON.stringify(readiness)).not.toContain('SQL');
    expect(JSON.stringify(readiness)).not.toContain('stack');
    expect(JSON.stringify(readiness)).not.toContain('token');
    expect(JSON.stringify(readiness)).not.toContain('secret');
    expect(JSON.stringify(readiness)).not.toContain('API key');
  });

  it('capability API contract 复用受控试用 view model，且不暴露禁止字段原文', () => {
    const status = getKnowledgeBaseProductionCapabilityStatus();

    expect(status.controlledTrial).toEqual(getKnowledgeBaseControlledTrialReadiness());
    expect(JSON.stringify(status.controlledTrial)).not.toContain('storageKey');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('/Users/');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('SQL');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('stack');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('token');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('secret');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('API key');
  });
});
