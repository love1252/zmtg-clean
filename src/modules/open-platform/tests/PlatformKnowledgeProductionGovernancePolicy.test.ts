import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS,
  KNOWLEDGE_BASE_QA_QUOTA_POLICY,
  type KnowledgeBaseProductionCapabilityId,
  getKnowledgeBasePermissionMatrix,
  getKnowledgeBaseProductionCapabilityStatus,
  getKnowledgeBaseSensitiveFieldPolicy,
} from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';

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
});
